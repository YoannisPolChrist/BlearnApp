import { buildReviewQueue, buildUnlockSessionQueue } from '@/lib/learning';
import type { LearningCard, LearningDeck } from '@/lib/learning';
import type {
  LearningSessionContext,
  LearningSessionKind,
  LearningSessionSnapshot,
  LearningSessionTimerSnapshot,
} from './sessionTypes';

export function createTimerSnapshot(limitMs?: number): LearningSessionTimerSnapshot {
  return {
    isRunning: false,
    isPaused: false,
    elapsedMs: 0,
    limitMs,
  };
}

function buildCardSnapshotMap(cards: LearningCard[], candidateIds: string[]): Record<string, LearningCard> {
  const candidateSet = new Set(candidateIds);
  return cards.reduce<Record<string, LearningCard>>((map, card) => {
    if (!candidateSet.has(card.id)) {
      return map;
    }

    map[card.id] = { ...card };
    return map;
  }, {});
}

export function resolveAvailableDeckId({
  preferredDeckIds,
  decks,
  cards,
}: {
  preferredDeckIds: Array<string | undefined>;
  decks: LearningDeck[];
  cards: LearningCard[];
}) {
  const existingDeckIds = new Set(decks.map((deck) => deck.id));
  const deckIdsWithCards = new Set(cards.map((card) => card.deckId));
  const uniquePreferredDeckIds = preferredDeckIds
    .map((deckId) => deckId?.trim())
    .filter((deckId, index, allDeckIds): deckId is string => Boolean(deckId) && allDeckIds.indexOf(deckId) === index);

  for (const deckId of uniquePreferredDeckIds) {
    if (existingDeckIds.has(deckId) && deckIdsWithCards.has(deckId)) {
      return deckId;
    }
  }

  const firstDeckWithCards = decks.find((deck) => deckIdsWithCards.has(deck.id));
  if (firstDeckWithCards) {
    return firstDeckWithCards.id;
  }

  for (const deckId of uniquePreferredDeckIds) {
    if (existingDeckIds.has(deckId)) {
      return deckId;
    }
  }

  return decks[0]?.id;
}

export function createLearningSessionSnapshot(
  context: LearningSessionContext,
  kind: LearningSessionKind = 'unlock',
): LearningSessionSnapshot {
  const queue =
    kind === 'unlock'
      ? buildUnlockSessionQueue({
          cards: context.cards,
          deckId: context.deckId,
          reviewLogs: context.reviewLogs,
          preset: context.preset,
          gateRule: context.gateRule,
          sessionCreditsRequired: context.sessionCreditsRequired,
          ignoreNewCardsLimit: context.ignoreNewCardsLimit,
          includeReviewAhead: context.includeReviewAhead,
          excludeCardIds: context.excludeCardIds,
          now: context.now,
        })
      : buildReviewQueue(context.cards, context.sessionCreditsRequired, context.now);
  // Both unlock and review sessions restrict candidateIds to the queue.
  // This prevents the grade() refill mechanism from pulling non-due or
  // already-reviewed cards back into the session after the queue is exhausted.
  const candidateIds = [...queue];
  const startedAt = context.now ?? Date.now();
  const currentCardId = queue[0];
  const status = queue.length > 0 ? 'active' : 'completed';

  return {
    kind,
    status,
    deckId: context.deckId,
    targetId: context.targetId,
    targetType: context.targetType,
    currentCardId,
    sessionCreditsRequired: context.sessionCreditsRequired,
    unlockDurationMinutes: context.unlockDurationMinutes,
    queue,
    candidateIds,
    candidateCursor: Math.min(queue.length, candidateIds.length),
    cardSnapshotsById: buildCardSnapshotMap(context.cards, candidateIds),
    typedAnswer: '',
    typedCorrect: null,
    revealed: false,
    attemptCount: 0,
    attemptMessage: null,
    countedReviews: 0,
    startedAt,
    updatedAt: startedAt,
    history: [],
    timer: createTimerSnapshot(context.unlockDurationMinutes ? context.unlockDurationMinutes * 60 * 1000 : undefined),
  };
}

export function createReviewSessionSnapshotFromCards(
  cards: LearningCard[],
  sessionCreditsRequired: number,
  now = Date.now(),
) {
  return createLearningSessionSnapshot(
    {
      cards,
      notes: [],
      reviewLogs: [],
      sessionCreditsRequired,
      ignoreNewCardsLimit: true,
      now,
    },
    'review',
  );
}

export function createUnlockSessionSnapshotFromContext(context: LearningSessionContext) {
  return createLearningSessionSnapshot(context, 'unlock');
}
