import { describe, expect, it } from 'vitest';
import { mergeLatestWriteWinsCloudStates, mergeAppendOnlyReviewLogs, applyMutationToCloudState } from '../index';

describe('conflict resolution', () => {
  it('keeps latest metadata while preserving append-only review logs', () => {
    const merged = mergeLatestWriteWinsCloudStates(
      {
        decks: [
          {
            id: 'deck-1',
            name: 'Local deck',
            description: '',
            language: 'de',
            tags: [],
            cardIds: [],
            presetId: 'preset_passive',
            createdAt: 1,
            updatedAt: 10,
          },
        ],
        notes: [],
        cards: [],
        reviewLogs: [
          {
            id: 'revlog-1',
            deckId: 'deck-1',
            cardId: 'card-1',
            reviewedAt: 5,
            rating: 'good',
            previousState: 'new',
            newState: 'learning',
            scheduledDays: 0,
            elapsedDays: 0,
            wasCorrect: true,
            memoryStateBefore: null,
            memoryStateAfter: null,
          },
        ],
        presets: [],
      },
      {
        decks: [
          {
            id: 'deck-1',
            name: 'Remote deck',
            description: '',
            language: 'de',
            tags: [],
            cardIds: [],
            presetId: 'preset_passive',
            createdAt: 1,
            updatedAt: 20,
          },
        ],
        notes: [],
        cards: [],
        reviewLogs: [
          {
            id: 'revlog-2',
            deckId: 'deck-1',
            cardId: 'card-2',
            reviewedAt: 7,
            rating: 'easy',
            previousState: 'learning',
            newState: 'review',
            scheduledDays: 1,
            elapsedDays: 1,
            wasCorrect: true,
            memoryStateBefore: null,
            memoryStateAfter: null,
          },
        ],
        presets: [],
      },
    );

    expect(merged.decks[0]?.name).toBe('Remote deck');
    expect(merged.reviewLogs).toHaveLength(2);
    expect(merged.reviewLogs[0]?.id).toBe('revlog-2');
  });

  it('treats review-log mutations as append-only and idempotent', () => {
    const afterFirst = applyMutationToCloudState(undefined, {
      mutationId: 'mutation-1',
      clientId: 'client-a',
      sequence: 1,
      createdAt: 10,
      entityType: 'reviewLog',
      entityId: 'revlog-1',
      kind: 'append',
      payload: {
        id: 'revlog-1',
        deckId: 'deck-1',
        cardId: 'card-1',
        reviewedAt: 10,
        rating: 'good',
        previousState: 'new',
        newState: 'learning',
        scheduledDays: 0,
        elapsedDays: 0,
        wasCorrect: true,
        memoryStateBefore: null,
        memoryStateAfter: null,
      },
    });
    const afterDuplicate = applyMutationToCloudState(afterFirst, {
      mutationId: 'mutation-1',
      clientId: 'client-a',
      sequence: 1,
      createdAt: 10,
      entityType: 'reviewLog',
      entityId: 'revlog-1',
      kind: 'append',
      payload: {
        id: 'revlog-1',
        deckId: 'deck-1',
        cardId: 'card-1',
        reviewedAt: 10,
        rating: 'good',
        previousState: 'new',
        newState: 'learning',
        scheduledDays: 0,
        elapsedDays: 0,
        wasCorrect: true,
        memoryStateBefore: null,
        memoryStateAfter: null,
      },
    });

    expect(mergeAppendOnlyReviewLogs(afterFirst.reviewLogs, afterDuplicate.reviewLogs)).toHaveLength(1);
  });
});
