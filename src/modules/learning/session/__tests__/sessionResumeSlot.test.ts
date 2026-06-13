import { beforeEach, describe, expect, it } from 'vitest';
import type { LearningSessionSnapshot } from '../sessionTypes';
import {
  clearSessionResumeSnapshot,
  saveSessionResumeSnapshot,
  takeSessionResumeSnapshot,
} from '../sessionResumeSlot';

function buildSnapshot(overrides: Partial<LearningSessionSnapshot> = {}): LearningSessionSnapshot {
  return {
    kind: 'unlock',
    status: 'active',
    deckId: 'deck-1',
    targetId: 'com.example.app',
    targetType: 'app',
    currentCardId: 'card-2',
    sessionCreditsRequired: 5,
    unlockDurationMinutes: 10,
    queue: ['card-2', 'card-3'],
    candidateIds: ['card-1', 'card-2', 'card-3'],
    candidateCursor: 3,
    cardSnapshotsById: {},
    typedAnswer: '',
    typedCorrect: null,
    revealed: false,
    attemptCount: 0,
    attemptMessage: null,
    countedReviews: 1,
    startedAt: Date.now() - 60_000,
    updatedAt: Date.now(),
    history: [
      { kind: 'review', at: Date.now() - 30_000, cardId: 'card-1', previous: {}, next: {} },
    ],
    timer: { isRunning: true, isPaused: false, elapsedMs: 60_000 },
    ...overrides,
  };
}

const IDENTITY = {
  kind: 'unlock' as const,
  deckId: 'deck-1',
  targetId: 'com.example.app',
  targetType: 'app' as const,
};

describe('sessionResumeSlot (Session-Resume 5.4)', () => {
  beforeEach(() => {
    clearSessionResumeSnapshot();
  });

  it('stellt eine unterbrochene Session mit Fortschritt wieder her', () => {
    saveSessionResumeSnapshot(buildSnapshot());
    const resumed = takeSessionResumeSnapshot(IDENTITY);
    expect(resumed).not.toBeNull();
    expect(resumed?.countedReviews).toBe(1);
    expect(resumed?.queue).toEqual(['card-2', 'card-3']);
  });

  it('konsumiert den Slot beim Lesen (kein Doppel-Resume)', () => {
    saveSessionResumeSnapshot(buildSnapshot());
    expect(takeSessionResumeSnapshot(IDENTITY)).not.toBeNull();
    expect(takeSessionResumeSnapshot(IDENTITY)).toBeNull();
  });

  it('verwirft Snapshots mit anderer Session-Identität', () => {
    saveSessionResumeSnapshot(buildSnapshot());
    const resumed = takeSessionResumeSnapshot({ ...IDENTITY, deckId: 'deck-OTHER' });
    expect(resumed).toBeNull();
  });

  it('verwirft veraltete Snapshots (TTL)', () => {
    const now = Date.now();
    saveSessionResumeSnapshot(buildSnapshot(), now - 60 * 60 * 1000);
    expect(takeSessionResumeSnapshot(IDENTITY, 30 * 60 * 1000, now)).toBeNull();
  });

  it('speichert Sessions ohne Fortschritt gar nicht erst', () => {
    saveSessionResumeSnapshot(buildSnapshot({ countedReviews: 0, history: [] }));
    expect(takeSessionResumeSnapshot(IDENTITY)).toBeNull();
  });
});
