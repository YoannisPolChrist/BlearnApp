
import type { GateRule, LearningCard, LearningDeck, LearningDeckStats, LearningPreset, ReviewLog } from '../domain/entities';
import { migrateGateRule, migrateLearningCard, migrateLearningPreset } from '../domain/presets';
import { getDueSessionCards, getReviewAheadCards } from '../review/queues';
import { getLearningOptimizerStatus } from './optimizer';
import { countNewCardsIntroducedToday, countReviewsToday } from './utils';

export function getDeckLearningStats(options: {
  deck: LearningDeck;
  cards: LearningCard[];
  reviewLogs: ReviewLog[];
  preset?: LearningPreset;
  gateRule?: Partial<GateRule>;
  now?: number;
}): LearningDeckStats {
  const now = options.now ?? Date.now();
  const resolvedPreset = migrateLearningPreset(options.preset);
  const resolvedGateRule = migrateGateRule(options.gateRule);
  const deckCards = options.cards
    .filter((card) => card.deckId === options.deck.id)
    .map((card) => migrateLearningCard(card));
  const dueNowCards = getDueSessionCards(deckCards, undefined, now, true);
  const reviewAheadCards = getReviewAheadCards(deckCards, resolvedPreset, resolvedGateRule.reviewAheadHours, now, true);
  const reviewsToday = countReviewsToday(options.reviewLogs, options.deck.id, now);
  const newCardsToday = countNewCardsIntroducedToday(options.reviewLogs, options.deck.id, now);
  const optimizer = getLearningOptimizerStatus(
    options.reviewLogs.filter((log) => log.deckId === options.deck.id),
    resolvedPreset,
    now,
  );

  return {
    totalCards: deckCards.length,
    dueNowCount: dueNowCards.length,
    dueCount: dueNowCards.length,
    overdueCount: dueNowCards.filter((card) => card.dueAt < now).length,
    reviewAheadCount: reviewAheadCards.length,
    newLeftToday: Math.max(0, resolvedPreset.newCardsPerDay - newCardsToday),
    reviewsLeftToday: Math.max(0, resolvedPreset.maxReviewsPerDay - reviewsToday),
    desiredRetention: resolvedPreset.desiredRetention,
    nextOptimizerRunAt: optimizer.nextRunAt,
    optimizerStatus: optimizer.status,
  };
}
