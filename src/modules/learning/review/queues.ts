
import type {
  BuildUnlockSessionQueueOptions,
  LearningCard,
  LearningCardState,
  LearningPreset,
  ReviewLog,
} from '../domain/entities';
import { getFsrsScheduler, toFsrsCard } from '../domain/fsrs';
import { clampSessionCreditsRequired, migrateGateRule, migrateLearningCard, migrateLearningPreset } from '../domain/presets';

let unlockSessionScopeCache:
  | {
      cardsRef: LearningCard[];
      reviewLogsRef: ReviewLog[];
      deckId?: string;
      normalizedCards: LearningCard[];
      resolvedDeckId?: string;
      scopedCards: LearningCard[];
      scopedReviewLogs: ReviewLog[];
      scopedNewCards: LearningCard[];
    }
  | null = null;

export function buildReviewQueue(
  deckCards: LearningCard[],
  requiredCorrectReviews: number,
  now = Date.now(),
): string[] {
  return buildUnlockSessionQueue({
    cards: deckCards,
    deckId: deckCards[0]?.deckId,
    sessionCreditsRequired: requiredCorrectReviews,
    ignoreNewCardsLimit: true,
    now,
  });
}

export function advanceReviewQueue(reviewQueue: string[], reviewedCardId: string): string[] {
  const reviewedIndex = reviewQueue.indexOf(reviewedCardId);
  if (reviewedIndex < 0) {
    return reviewQueue;
  }

  return [
    ...reviewQueue.slice(0, reviewedIndex),
    ...reviewQueue.slice(reviewedIndex + 1),
  ];
}

function getSiblingKey(card: LearningCard): string {
  return card.noteId || card.id;
}

function dedupeSiblingCards(cards: LearningCard[], burySiblings: boolean, seenSiblingKeys = new Set<string>()): LearningCard[] {
  if (!burySiblings) {
    return cards;
  }

  return cards.filter((card) => {
    const siblingKey = getSiblingKey(card);
    if (seenSiblingKeys.has(siblingKey)) {
      return false;
    }

    seenSiblingKeys.add(siblingKey);
    return true;
  });
}

function interleaveSessionCards(
  reviewCards: LearningCard[],
  newCards: LearningCard[],
  reviewsBetweenNewCards: number,
): LearningCard[] {
  if (reviewCards.length === 0) {
    return [...newCards];
  }

  if (newCards.length === 0) {
    return [...reviewCards];
  }

  const interval = Math.max(1, Math.round(reviewsBetweenNewCards));
  const interleaved: LearningCard[] = [];
  let reviewIndex = 0;
  let newIndex = 0;

  while (reviewIndex < reviewCards.length) {
    const nextReviewSliceEnd = Math.min(reviewCards.length, reviewIndex + interval);
    interleaved.push(...reviewCards.slice(reviewIndex, nextReviewSliceEnd));
    reviewIndex = nextReviewSliceEnd;

    if (newIndex < newCards.length) {
      interleaved.push(newCards[newIndex]);
      newIndex += 1;
    }
  }

  if (newIndex < newCards.length) {
    interleaved.push(...newCards.slice(newIndex));
  }

  return interleaved;
}

export function getReviewAheadCards(
  cards: LearningCard[],
  preset: LearningPreset,
  reviewAheadHours: number,
  now = Date.now(),
  cardsAreNormalized = false,
): LearningCard[] {
  const reviewAheadWindow = now + reviewAheadHours * 60 * 60 * 1000;
  const scheduler = getFsrsScheduler(preset);

  return cards
    .filter(
      (card) =>
        (card.state === 'review' || card.state === 'relearning')
        && card.dueAt > now
        && card.dueAt <= reviewAheadWindow,
    )
    .map((card) => {
      const normalizedCard = cardsAreNormalized ? card : migrateLearningCard(card);
      return {
        card: normalizedCard,
        retrievability: scheduler.get_retrievability(toFsrsCard(normalizedCard, now), new Date(now), false),
      };
    })
    .sort((left, right) => {
      if (left.retrievability !== right.retrievability) {
        return left.retrievability - right.retrievability;
      }
      if (left.card.dueAt !== right.card.dueAt) {
        return left.card.dueAt - right.card.dueAt;
      }
      return left.card.createdAt - right.card.createdAt;
    })
    .map((entry) => entry.card);
}

export function getDueSessionCards(
  cards: LearningCard[],
  deckIds?: string[],
  now = Date.now(),
  cardsAreNormalized = false,
): LearningCard[] {
  const deckFilter = deckIds && deckIds.length > 0 ? new Set(deckIds) : null;
  return cards
    .map((card) => (cardsAreNormalized ? card : migrateLearningCard(card)))
    .filter(
      (card) =>
        (!deckFilter || deckFilter.has(card.deckId))
        && card.state !== 'new'
        // Suspended cards must never surface in any queue — including the
        // blocking learn flow — regardless of how overdue they are.
        && card.state !== 'suspended'
        && card.dueAt <= now,
    )
    .sort((left, right) => {
      const statePriority = getLearningCardPriority(left.state) - getLearningCardPriority(right.state);
      if (statePriority !== 0) return statePriority;
      if (left.dueAt !== right.dueAt) return left.dueAt - right.dueAt;
      return left.createdAt - right.createdAt;
    });
}

function buildUnlockSessionQueueFromCandidates(candidateIds: string[], sessionCreditsRequired: number): string[] {
  if (candidateIds.length === 0) {
    return [];
  }

  const desiredCount = clampSessionCreditsRequired(sessionCreditsRequired, candidateIds.length);
  return candidateIds.slice(0, desiredCount);
}

function getUnlockSessionScope({
  cards,
  reviewLogs,
  deckId,
}: Pick<BuildUnlockSessionQueueOptions, 'cards' | 'reviewLogs' | 'deckId'>) {
  if (
    unlockSessionScopeCache
    && unlockSessionScopeCache.cardsRef === cards
    && unlockSessionScopeCache.reviewLogsRef === reviewLogs
    && unlockSessionScopeCache.deckId === deckId
  ) {
    return unlockSessionScopeCache;
  }

  const normalizedCards = cards.map((card) => migrateLearningCard(card));
  const resolvedDeckId = deckId || normalizedCards[0]?.deckId;
  const scopedCards = resolvedDeckId
    ? normalizedCards.filter((card) => card.deckId === resolvedDeckId)
    : normalizedCards;
  const scopedReviewLogs = resolvedDeckId
    ? reviewLogs.filter((log) => log.deckId === resolvedDeckId)
    : reviewLogs;
  const scopedNewCards = scopedCards
    .filter((card) => card.state === 'new')
    .sort((left, right) => left.createdAt - right.createdAt);

  unlockSessionScopeCache = {
    cardsRef: cards,
    reviewLogsRef: reviewLogs,
    deckId,
    normalizedCards,
    resolvedDeckId,
    scopedCards,
    scopedReviewLogs,
    scopedNewCards,
  };

  return unlockSessionScopeCache;
}

function countDailyReviewActivity(reviewLogs: ReviewLog[], deckId: string, now = Date.now()) {
  if (reviewLogs.length === 0) {
    return {
      reviewsToday: 0,
      newCardsIntroducedToday: 0,
    };
  }

  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const dayStart = startOfDay.getTime();
  const seenCardIds = new Set<string>();
  let reviewsToday = 0;
  let newCardsIntroducedToday = 0;

  for (const log of reviewLogs) {
    if (log.deckId !== deckId || log.reviewedAt < dayStart || log.reviewedAt > now) {
      continue;
    }

    reviewsToday += 1;
    if (log.previousState === 'new' && !seenCardIds.has(log.cardId)) {
      seenCardIds.add(log.cardId);
      newCardsIntroducedToday += 1;
    }
  }

  return {
    reviewsToday,
    newCardsIntroducedToday,
  };
}

export function buildUnlockSessionCandidateIds({
  cards,
  deckId,
  reviewLogs = [],
  preset,
  gateRule,
  sessionCreditsRequired,
  ignoreNewCardsLimit = false,
  includeReviewAhead = true,
  excludeCardIds,
  now = Date.now(),
}: BuildUnlockSessionQueueOptions): string[] {
  const resolvedPreset = migrateLearningPreset(preset);
  const resolvedGateRule = migrateGateRule(gateRule);
  const requiredCredits = sessionCreditsRequired ?? resolvedGateRule.sessionCreditsRequired;

  const {
    resolvedDeckId,
    scopedCards,
    scopedReviewLogs,
    scopedNewCards,
  } = getUnlockSessionScope({
    cards,
    reviewLogs,
    deckId,
  });

  const dueCards = getDueSessionCards(scopedCards, undefined, now, true);
  const reviewAheadCards = includeReviewAhead
    ? getReviewAheadCards(
        scopedCards,
        resolvedPreset,
        resolvedGateRule.reviewAheadHours,
        now,
        true,
      )
    : [];

  const seenSiblingKeys = new Set<string>();
  const dueSelection = dedupeSiblingCards(dueCards, resolvedPreset.burySiblings, seenSiblingKeys);
  const dueSelectionIds = new Set(dueSelection.map((card) => card.id));
  const reviewAheadSelection = dedupeSiblingCards(
    reviewAheadCards.filter((card) => !dueSelectionIds.has(card.id)),
    resolvedPreset.burySiblings,
    seenSiblingKeys,
  );

  const { reviewsToday, newCardsIntroducedToday } = resolvedDeckId
    ? countDailyReviewActivity(scopedReviewLogs, resolvedDeckId, now)
    : { reviewsToday: 0, newCardsIntroducedToday: 0 };

  const allowedReviews = ignoreNewCardsLimit 
    ? Infinity 
    : Math.max(0, resolvedPreset.maxReviewsPerDay - reviewsToday);
    
  const limitedDueSelection = dueSelection.slice(0, allowedReviews);

  const allowedNewCards = ignoreNewCardsLimit
    ? Infinity
    : Math.max(0, resolvedPreset.newCardsPerDay - newCardsIntroducedToday);
    
  const limitedNewCards = dedupeSiblingCards(
    // Begrabene neue Karten aussparen: "begraben" heißt, dueAt wurde explizit
    // über now UND createdAt hinaus verschoben (Import setzt dueAt = createdAt).
    scopedNewCards.filter((card) => (card.dueAt ?? 0) <= Math.max(now, card.createdAt)),
    resolvedPreset.burySiblings,
    seenSiblingKeys,
  ).slice(0, allowedNewCards);

  const reviewCandidates = [...limitedDueSelection, ...reviewAheadSelection];

  // Cross-flow-Pacing für neue Karten: Die erste neue Karte stünde sonst erst an
  // Position `reviewsBetweenNewCards` der interleavten Liste — bei kurzen
  // Blocking-Sessions (Kappung auf sessionCreditsRequired) wird sie dadurch nie
  // erreicht. Stattdessen wird anhand der KUMULATIVEN Reviews des Tages bestimmt,
  // wie viele neue Karten "fällig" sind, und diese kommen nach vorn (innerhalb
  // der Kappung). So zählt der Counter über mehrere Flows hinweg mit.
  const reviewsPerNewCard = Math.max(1, Math.round(resolvedPreset.reviewsBetweenNewCards));
  const newCardsOwedByPacing = Math.max(
    0,
    Math.floor(reviewsToday / reviewsPerNewCard) - newCardsIntroducedToday,
  );
  const pacedNewCards = limitedNewCards.slice(0, newCardsOwedByPacing);
  const remainingNewCards = limitedNewCards.slice(pacedNewCards.length);

  let interleaved = [
    ...pacedNewCards,
    ...interleaveSessionCards(
      reviewCandidates,
      remainingNewCards,
      resolvedPreset.reviewsBetweenNewCards,
    ),
  ];

  if (interleaved.length < requiredCredits) {
    const selectedCandidateIds = new Set(interleaved.map((card) => card.id));
    const reviewAheadSelectionIds = new Set(reviewAheadSelection.map((card) => card.id));
    const fillerCards = dedupeSiblingCards(
      scopedCards.filter(c => {
        if (c.state === 'suspended' || c.state === 'new' || selectedCandidateIds.has(c.id)) {
          return false;
        }
        if ((c.state === 'learning' || c.state === 'relearning') && c.dueAt > now) {
          return false;
        }
        if (c.state === 'review' && c.dueAt > now) {
          return includeReviewAhead && reviewAheadSelectionIds.has(c.id);
        }
        return true;
      }),
      resolvedPreset.burySiblings,
      seenSiblingKeys
    ).sort((a, b) => (b.lastReviewedAt ?? 0) - (a.lastReviewedAt ?? 0));
    
    const needed = requiredCredits - interleaved.length;
    interleaved = [...interleaved, ...fillerCards.slice(0, needed)];
  }

  const filtered = excludeCardIds && excludeCardIds.size > 0
    ? interleaved.filter(card => !excludeCardIds.has(card.id))
    : interleaved;

  return filtered.map((card) => card.id);
}

export function buildUnlockSessionQueue(options: BuildUnlockSessionQueueOptions): string[] {
  const candidateIds = buildUnlockSessionCandidateIds(options);
  const resolvedGateRule = migrateGateRule(options.gateRule);
  const desiredCount = options.sessionCreditsRequired ?? resolvedGateRule.sessionCreditsRequired;
  return buildUnlockSessionQueueFromCandidates(candidateIds, desiredCount);
}

export function getDueCards(cards: LearningCard[], deckIds?: string[], now = Date.now()): LearningCard[] {
  return getDueSessionCards(cards, deckIds, now);
}

function getLearningCardPriority(state: LearningCardState): number {
  switch (state) {
    case 'learning':
      return 0;
    case 'relearning':
      return 1;
    case 'review':
      return 2;
    default:
      return 3;
  }
}
