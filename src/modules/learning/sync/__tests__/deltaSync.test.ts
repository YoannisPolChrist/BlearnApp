import { describe, expect, it } from 'vitest';
import {
  acknowledgeDeltaSyncCursor,
  applyLocalMutation,
  createDeltaSyncState,
  getDeltaSyncPendingMutations,
  reconcileDeltaSync,
} from '../index';

describe('delta sync', () => {
  it('applies local mutations and keeps them pending until acknowledged', () => {
    const snapshot = createDeltaSyncState({
      clientId: 'client-a',
      cloudState: {
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
        reviewLogs: [],
        presets: [],
      },
    });

    const next = applyLocalMutation(
      snapshot,
      {
        mutationId: 'mutation-1',
        entityType: 'deck',
        entityId: 'deck-1',
        kind: 'upsert',
        payload: {
          id: 'deck-1',
          name: 'Updated deck',
          updatedAt: 20,
        },
      },
      20,
    );

    expect(next.cloudState.decks[0]?.name).toBe('Updated deck');
    expect(getDeltaSyncPendingMutations(next)).toHaveLength(1);

    const acknowledged = acknowledgeDeltaSyncCursor(next, {
      clientId: 'client-a',
      sequence: 1,
      updatedAt: 20,
    });

    expect(getDeltaSyncPendingMutations(acknowledged)).toHaveLength(0);
  });

  it('reconciles remote state while preserving pending local mutations', () => {
    const snapshot = createDeltaSyncState({
      clientId: 'client-a',
      cloudState: {
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
        reviewLogs: [],
        presets: [],
      },
    });

    const withLocalMutation = applyLocalMutation(
      snapshot,
      {
        mutationId: 'mutation-1',
        entityType: 'deck',
        entityId: 'deck-1',
        kind: 'upsert',
        payload: {
          id: 'deck-1',
          name: 'Local update',
          updatedAt: 30,
        },
      },
      30,
    );

    const reconciled = reconcileDeltaSync(withLocalMutation, {
      decks: [
        {
          id: 'deck-1',
          name: 'Remote update',
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
      reviewLogs: [],
      presets: [],
    });

    expect(reconciled.cloudState.decks[0]?.name).toBe('Local update');
    expect(reconciled.appliedMutations).toHaveLength(1);
    expect(reconciled.pendingMutations).toHaveLength(1);
  });
});
