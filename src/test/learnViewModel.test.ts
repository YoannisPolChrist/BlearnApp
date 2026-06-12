import { describe, expect, it } from 'vitest';
import { buildLearnHubSummary, buildLearnReviewProgress, countSuccessfulImportJobs } from '@/lib/view-models/learn';
import type { LearningDeck } from '@/lib/learning';

const NOW = Date.UTC(2026, 2, 16, 12, 0, 0);

function createDeck(id: string, name: string, tags: string[] = []): LearningDeck {
  return {
    id,
    name,
    description: '',
    language: 'de',
    tags,
    cardIds: [],
    createdAt: NOW,
    updatedAt: NOW,
  };
}

describe('learn view models', () => {
  it('builds a stable hub summary while hiding starter decks from the visible hub', () => {
    const decks = [
      createDeck('deck-1', 'Spanish Top 5000', ['starter']),
      createDeck('deck-2', 'French Daily'),
    ];

    const summary = buildLearnHubSummary({
      activeDeckId: 'deck-2',
      decks,
      getDeckStats: (deckId) =>
        deckId === 'deck-1'
          ? {
              totalCards: 120,
              dueNowCount: 7,
              dueCount: 9,
              overdueCount: 2,
              reviewAheadCount: 0,
              newLeftToday: 5,
              reviewsLeftToday: 4,
              desiredRetention: 0.9,
              optimizerStatus: 'collecting',
            }
          : {
              totalCards: 60,
              dueNowCount: 3,
              dueCount: 3,
              overdueCount: 1,
              reviewAheadCount: 0,
              newLeftToday: 2,
              reviewsLeftToday: 1,
              desiredRetention: 0.9,
              optimizerStatus: 'collecting',
            },
      getResolvedPresetForDeck: (deckId) => ({
        id: `preset-${deckId}`,
        name: `Preset ${deckId}`,
        desiredRetention: 0.9,
        fsrsParams: [],
        newCardsPerDay: 3,
        maxReviewsPerDay: 25,
        reviewsBetweenNewCards: deckId === 'deck-1' ? 10 : 15,
        learningStepsMinutes: [1, 10],
        relearningStepsMinutes: [10],
        reviewSortOrder: 'ascendingRetrievability',
        burySiblings: true,
        updatedAt: NOW,
      }),
    });

    expect(summary.activeDeck?.id).toBe('deck-2');
    expect(summary.totalDueCards).toBe(3);
    expect(summary.starterDeckCount).toBe(1);
    expect(summary.deckStats).toHaveLength(1);
    expect(summary.deckStats[0]?.id).toBe('deck-2');
    expect(summary.deckStats[0]?.reviewMixLabel).toBe('1:15');
  });

  it('counts successful imports and review progress without exposing layout logic', () => {
    expect(
      countSuccessfulImportJobs([
        { id: '1', filename: 'a.csv', source: 'csv', status: 'completed', importedDeckIds: [], importedCardCount: 12, createdAt: NOW },
        { id: '2', filename: 'b.json', source: 'json', status: 'failed', importedDeckIds: [], importedCardCount: 0, createdAt: NOW, error: 'boom' },
      ]),
    ).toBe(1);

    const progress = buildLearnReviewProgress({
      sessionCreditsRequired: 3,
      countedReviews: 1,
    });

    expect(progress.progressPercent).toBeCloseTo(33.33333333333333);
    expect(progress.remainingCount).toBe(2);
  });
});
