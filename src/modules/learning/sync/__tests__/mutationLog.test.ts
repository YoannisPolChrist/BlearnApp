import { describe, expect, it } from 'vitest';
import { appendMutation, createMutationLog, getMutationLogCursor, getPendingMutations } from '../index';

describe('mutation log', () => {
  it('deduplicates mutations by mutation id and advances the cursor', () => {
    const log = createMutationLog('client-a');
    const first = appendMutation(
      log,
      {
        mutationId: 'mutation-1',
        entityType: 'deck',
        entityId: 'deck-1',
        kind: 'upsert',
        payload: {
          id: 'deck-1',
          name: 'French Top 5000',
        },
      },
      1_700_000_000_000,
    );
    const duplicate = appendMutation(
      first.log,
      {
        mutationId: 'mutation-1',
        entityType: 'deck',
        entityId: 'deck-1',
        kind: 'upsert',
        payload: {
          id: 'deck-1',
          name: 'French Top 5000',
        },
      },
      1_700_000_000_100,
    );

    expect(first.log.entries).toHaveLength(1);
    expect(duplicate.log.entries).toHaveLength(1);
    expect(getMutationLogCursor(duplicate.log)).toMatchObject({
      clientId: 'client-a',
      sequence: 1,
    });
  });

  it('returns pending mutations after the acknowledged cursor', () => {
    const log = createMutationLog('client-a');
    const first = appendMutation(
      log,
      {
        mutationId: 'mutation-1',
        entityType: 'deck',
        entityId: 'deck-1',
        kind: 'upsert',
        payload: {
          id: 'deck-1',
          name: 'French Top 5000',
        },
      },
      1_700_000_000_000,
    );
    const second = appendMutation(
      first.log,
      {
        mutationId: 'mutation-2',
        entityType: 'reviewLog',
        entityId: 'revlog-1',
        kind: 'append',
        payload: {
          id: 'revlog-1',
          deckId: 'deck-1',
          cardId: 'card-1',
          reviewedAt: 1_700_000_000_500,
          rating: 'good',
          previousState: 'new',
          newState: 'learning',
          scheduledDays: 0,
          elapsedDays: 0,
          wasCorrect: true,
          memoryStateBefore: null,
          memoryStateAfter: null,
        },
      },
      1_700_000_000_500,
    );

    expect(getPendingMutations(second.log, getMutationLogCursor(first.log))).toHaveLength(1);
  });
});
