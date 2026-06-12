import { describe, expect, it } from 'vitest';
import { buildEntitiesFromRows, getDefaultLearningPresets } from '@/lib/learning';
import {
  getLearningCloudStateSignature,
  normalizeLearningCloudState,
} from '@/modules/learning/sync/learningCloudState';
import { runLearningSyncWorker } from '@/modules/learning/workers/learningSyncWorker';

describe('learning sync worker signatures', () => {
  it('produces a stable signature for equivalent normalized worker states', () => {
    const now = 1_700_000_000_000;
    const { decks, notes, cards } = buildEntitiesFromRows(
      [{ deck: 'Italian', front: 'ciao', back: 'hello', type: 'basic' }],
      now,
    );

    const left = {
      activeDeckId: decks[0].id,
      activeDeckUpdatedAt: now + 1_000,
      decks,
      notes,
      cards,
      reviewLogs: [],
      presets: getDefaultLearningPresets(),
    };
    const right = {
      presets: [...getDefaultLearningPresets()].reverse(),
      reviewLogs: [],
      cards: [...cards].reverse(),
      notes: [...notes].reverse(),
      decks: [...decks].reverse(),
      activeDeckId: decks[0].id,
      activeDeckUpdatedAt: now + 1_000,
    };

    expect(getLearningCloudStateSignature(left)).toBe(getLearningCloudStateSignature(right));
  });

  it('treats meaningful worker-state changes as part of the signature', () => {
    const now = 1_700_000_000_000;
    const { decks, notes, cards } = buildEntitiesFromRows(
      [{ deck: 'Italian', front: 'ciao', back: 'hello', type: 'basic' }],
      now,
    );

    expect(
      getLearningCloudStateSignature({
        activeDeckId: decks[0].id,
        activeDeckUpdatedAt: now + 1_000,
        decks,
        notes,
        cards,
        reviewLogs: [],
        presets: getDefaultLearningPresets(),
      }),
    ).not.toBe(
      getLearningCloudStateSignature({
        activeDeckId: decks[0].id,
        activeDeckUpdatedAt: now + 2_000,
        decks,
        notes,
        cards,
        reviewLogs: [],
        presets: getDefaultLearningPresets(),
      }),
    );
  });

  it('keeps the worker idle when local and remote states are semantically identical', async () => {
    const now = 1_700_000_000_000;
    const { decks, notes, cards } = buildEntitiesFromRows(
      [{ deck: 'Italian', front: 'ciao', back: 'hello', type: 'basic' }],
      now,
    );

    const localState = normalizeLearningCloudState({
      activeDeckId: decks[0].id,
      activeDeckUpdatedAt: now + 1_000,
      decks,
      notes,
      cards,
      reviewLogs: [],
      presets: getDefaultLearningPresets(),
    });
    const remoteState = normalizeLearningCloudState({
      presets: [...getDefaultLearningPresets()].reverse(),
      reviewLogs: [],
      cards: [...cards].reverse(),
      notes: [...notes].reverse(),
      decks: [...decks].reverse(),
      activeDeckId: decks[0].id,
      activeDeckUpdatedAt: now + 1_000,
    });

    const result = await runLearningSyncWorker({
      localState,
      remoteState,
      now,
    });

    expect(result.status).toBe('idle');
    expect(result.queue.jobs).toHaveLength(0);
    expect(result.localSignature).toBe(result.remoteSignature);
  });
});
