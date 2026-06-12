import type { ImportJob, LearningDeck, LearningPreset } from '@/lib/learning';

const EMPTY_DECK_STATS = {
  totalCards: 0,
  dueNowCount: 0,
  dueCount: 0,
  overdueCount: 0,
  reviewAheadCount: 0,
  newLeftToday: 0,
  reviewsLeftToday: 0,
  desiredRetention: 0.9,
  optimizerStatus: 'collecting' as const,
};

type LearnDeckStats = typeof EMPTY_DECK_STATS;

export function formatReviewMixLabel(reviewsBetweenNewCards: number) {
  return `1:${Math.max(1, Math.round(reviewsBetweenNewCards))}`;
}

export function buildLearnHubSummary(options: {
  activeDeckId?: string;
  decks: LearningDeck[];
  getDeckStats: (deckId: string) => LearnDeckStats | null;
  getResolvedPresetForDeck: (deckId: string) => LearningPreset;
}) {
  const starterDeckCount = options.decks.filter((deck) => deck.tags.includes('starter')).length;
  const visibleDecks = options.decks.filter((deck) => !deck.tags.includes('starter'));

  const deckStats = visibleDecks.map((deck) => ({
    ...deck,
    ...(options.getDeckStats(deck.id) ?? EMPTY_DECK_STATS),
    reviewsBetweenNewCards: options.getResolvedPresetForDeck(deck.id).reviewsBetweenNewCards,
    reviewMixLabel: formatReviewMixLabel(options.getResolvedPresetForDeck(deck.id).reviewsBetweenNewCards),
  }));

  const activeDeck =
    deckStats.find((deck) => deck.id === options.activeDeckId)
    ?? deckStats[0];
  const totalDueCards = deckStats.reduce((sum, deck) => sum + (deck.dueNowCount || 0), 0);

  return {
    deckStats,
    activeDeck,
    totalDueCards,
    starterDeckCount,
  };
}

export function countSuccessfulImportJobs(importJobs: ImportJob[]) {
  return importJobs.filter((job) => !job.error).length;
}

export function buildLearnReviewProgress(options: {
  sessionCreditsRequired: number;
  countedReviews: number;
}) {
  const progressPercent =
    options.sessionCreditsRequired > 0
      ? Math.min(100, (options.countedReviews / options.sessionCreditsRequired) * 100)
      : 0;
  const remainingCount = Math.max(0, options.sessionCreditsRequired - options.countedReviews);

  return {
    progressPercent,
    remainingCount,
  };
}
