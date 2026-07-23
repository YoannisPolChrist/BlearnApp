import type { ImportJob, LearningDeck, LearningPreset } from '@/lib/learning';

const EMPTY_DECK_STATS = {
  totalCards: 0,
  neverLearnedCount: 0,
  reviewsThisWeek: 0,
  activeDaysThisWeek: 0,
  reviewedDaysThisWeek: [false, false, false, false, false, false, false],
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

function isStarterDeck(deck: LearningDeck): boolean {
  const isLegacyStarterDeck =
    deck.sourceType === undefined &&
    deck.name.trim().toLocaleLowerCase() === 'starter vokabeln';
  const hasLegacyTemplateTag = deck.tags.some((tag) => /^jean-paul(?:-|$)/i.test(tag));

  return (
    deck.sourceType === 'starter' ||
    (deck.sourceType === undefined
      && !deck.sourceTemplateId
      && (isLegacyStarterDeck || (!hasLegacyTemplateTag && deck.tags.includes('starter'))))
  );
}

export function buildLearnHubSummary(options: {
  activeDeckId?: string;
  decks: LearningDeck[];
  getDeckStats: (deckId: string) => LearnDeckStats | null;
  getResolvedPresetForDeck: (deckId: string) => LearningPreset;
}) {
  const starterDeckCount = options.decks.filter(isStarterDeck).length;
  const visibleDecks = options.decks.filter((deck) => !isStarterDeck(deck));

  const deckStats = visibleDecks.map((deck) => ({
    ...deck,
    ...(options.getDeckStats(deck.id) ?? EMPTY_DECK_STATS),
    reviewsBetweenNewCards: options.getResolvedPresetForDeck(deck.id).reviewsBetweenNewCards,
    reviewMixLabel: formatReviewMixLabel(options.getResolvedPresetForDeck(deck.id).reviewsBetweenNewCards),
  }));

  const activeDeck =
    deckStats.find((deck) => deck.id === options.activeDeckId) ??
    deckStats[0];
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
