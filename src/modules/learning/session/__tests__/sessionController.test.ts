import { describe, expect, it, vi } from 'vitest';
import { createLearningSessionController, createUnlockSessionSnapshotFromContext, SessionTimer } from '../index';

describe('session controller', () => {
  const cards = [
    {
      id: 'card-1',
      noteId: 'note-1',
      deckId: 'deck-1',
      type: 'basic' as const,
      state: 'new' as const,
      dueAt: Date.now(),
      intervalDays: 0,
      easeFactor: 2.5,
      reps: 0,
      lapses: 0,
      stepIndex: 0,
      memoryState: null,
      createdAt: Date.now(),
    },
  ];

  it('tracks history and undo state', () => {
    const snapshot = createUnlockSessionSnapshotFromContext({
      cards,
      notes: [
        {
          id: 'note-1',
          deckId: 'deck-1',
          type: 'basic',
          front: 'Front',
          back: 'Back',
          tags: [],
          language: 'de',
          createdAt: Date.now(),
        },
      ],
      reviewLogs: [],
      deckId: 'deck-1',
      sessionCreditsRequired: 1,
      now: 1_700_000_000_000,
    });
    const controller = createLearningSessionController(snapshot);

    controller.setTypedAnswer('hallo');
    controller.setRevealed(true);
    expect(controller.getSnapshot().history.length).toBe(0);

    controller.resetCurrentCardState();
    controller.advanceQueue('card-1');
    expect(controller.getSnapshot().currentCardId).toBeUndefined();
    expect(controller.getSnapshot().status).toBe('completed');
  });

  it('creates a session snapshot with queue metadata', () => {
    const snapshot = createUnlockSessionSnapshotFromContext({
      cards,
      notes: [],
      reviewLogs: [],
      deckId: 'deck-1',
      sessionCreditsRequired: 1,
    });

    expect(snapshot.kind).toBe('unlock');
    expect(snapshot.status).toBe('active');
    expect(snapshot.queue).toHaveLength(1);
    expect(snapshot.candidateIds).toHaveLength(1);
    expect(snapshot.currentCardId).toBe('card-1');
  });

  it('limits unlock candidates to the required review count', () => {
    const snapshot = createUnlockSessionSnapshotFromContext({
      cards: [
        cards[0],
        {
          ...cards[0],
          id: 'card-2',
          noteId: 'note-2',
          createdAt: Date.now() + 1,
        },
        {
          ...cards[0],
          id: 'card-3',
          noteId: 'note-3',
          createdAt: Date.now() + 2,
        },
      ],
      notes: [],
      reviewLogs: [],
      deckId: 'deck-1',
      sessionCreditsRequired: 2,
      now: 1_700_000_000_000,
      ignoreNewCardsLimit: true,
    });
    expect(snapshot.queue).toHaveLength(2);
    expect(snapshot.candidateIds).toEqual(snapshot.queue);
    expect(snapshot.candidateIds).not.toContain('card-3');
  });

  it('runs a micro-session subset to completion without requiring the rest of the deck', () => {
    const now = 1_700_000_000_000;
    const fullDeckCards = Array.from({ length: 8 }, (_, index) => ({
      ...cards[0],
      id: `card-${index + 1}`,
      noteId: `note-${index + 1}`,
      createdAt: now - 10_000 + index,
      dueAt: now - 1_000,
    }));
    const microSessionCards = fullDeckCards.slice(0, 3);

    const snapshot = createUnlockSessionSnapshotFromContext({
      cards: microSessionCards,
      notes: [],
      reviewLogs: [],
      deckId: 'deck-1',
      sessionCreditsRequired: 3,
      now,
      ignoreNewCardsLimit: true,
    });
    const controller = createLearningSessionController(snapshot);

    expect(snapshot.queue).toHaveLength(3);
    expect(snapshot.candidateIds).toEqual(snapshot.queue);
    expect(Object.keys(snapshot.cardSnapshotsById)).toEqual(['card-1', 'card-2', 'card-3']);
    expect(snapshot.cardSnapshotsById['card-4']).toBeUndefined();

    controller.grade('good', { cardId: 'card-1', wasCorrect: true, now: now + 1 });
    controller.grade('good', { cardId: 'card-2', wasCorrect: true, now: now + 2 });
    controller.grade('good', { cardId: 'card-3', wasCorrect: true, now: now + 3 });

    expect(controller.getSnapshot()).toMatchObject({
      status: 'completed',
      currentCardId: undefined,
      queue: [],
      candidateIds: ['card-1', 'card-2', 'card-3'],
    });
  });

  it('completes the unlock session once the required reviews are done', () => {
    const snapshot = createUnlockSessionSnapshotFromContext({
      cards: [
        cards[0],
        {
          ...cards[0],
          id: 'card-2',
          noteId: 'note-2',
          createdAt: Date.now() + 1,
        },
      ],
      notes: [],
      reviewLogs: [],
      deckId: 'deck-1',
      sessionCreditsRequired: 1,
      now: 1_700_000_000_000,
      ignoreNewCardsLimit: true,
    });
    const controller = createLearningSessionController(snapshot);

    controller.grade('good', { cardId: 'card-1', wasCorrect: true, now: 1_700_000_000_001 });

    expect(controller.getSnapshot().status).toBe('completed');
    expect(controller.getSnapshot().currentCardId).toBeUndefined();
    expect(controller.getSnapshot().queue).toHaveLength(0);
  });

  it('supports timer snapshots', () => {
    const snapshot = createUnlockSessionSnapshotFromContext({
      cards,
      notes: [],
      reviewLogs: [],
      deckId: 'deck-1',
      sessionCreditsRequired: 1,
    });
    const controller = createLearningSessionController(snapshot);
    controller.setTimerSnapshot({ isRunning: true, elapsedMs: 1000 });
    expect(controller.getSnapshot().timer.elapsedMs).toBe(1000);
  });

  it('keeps typed-answer feedback when a solved card is revealed manually', () => {
    const snapshot = createUnlockSessionSnapshotFromContext({
      cards,
      notes: [
        {
          id: 'note-1',
          deckId: 'deck-1',
          type: 'basic',
          front: 'friend',
          back: 'Freund',
          tags: [],
          language: 'de',
          createdAt: Date.now(),
        },
      ],
      reviewLogs: [],
      deckId: 'deck-1',
      sessionCreditsRequired: 1,
      now: 1_700_000_000_000,
    });
    const controller = createLearningSessionController(snapshot);

    controller.setTypedAnswer('Freu');
    controller.setTypedCorrect(true);
    controller.setAttemptMessage('Das war fast richtig.');

    controller.reveal(1_700_000_000_100);

    expect(controller.getSnapshot()).toMatchObject({
      revealed: true,
      typedAnswer: 'Freu',
      typedCorrect: true,
      attemptMessage: 'Das war fast richtig.',
    });
  });
});

describe('session timer', () => {
  it('pauses, resumes and stops', () => {
    vi.useFakeTimers();
    let now = 0;
    const timer = new SessionTimer({
      now: () => now,
      schedule: (cb) => window.setTimeout(cb, 16),
      cancel: (handle) => window.clearTimeout(handle),
    });

    now = 10;
    timer.start(now);
    now = 1010;
    vi.advanceTimersByTime(16);
    expect(timer.getSnapshot().elapsedMs).toBeGreaterThanOrEqual(1000);

    timer.pause(1200);
    expect(timer.getSnapshot().isPaused).toBe(true);

    timer.resume(2000);
    expect(timer.getSnapshot().isPaused).toBe(false);

    timer.stop(2500);
    expect(timer.getSnapshot().isRunning).toBe(false);
    vi.useRealTimers();
  });
});
