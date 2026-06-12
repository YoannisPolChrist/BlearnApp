import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LearningCard, ReviewLog } from '@/modules/learning/domain/entities';
import {
  appendReviewToWal,
  clearReviewWal,
  peekReviewWal,
  replayReviewWal,
} from '@/modules/learning/store/reviewWriteAheadLog';

function buildCard(id: string, overrides: Partial<LearningCard> = {}): LearningCard {
  return {
    id,
    noteId: `note_${id}`,
    deckId: 'deck_1',
    type: 'basic',
    state: 'review',
    dueAt: 2_000,
    intervalDays: 3,
    easeFactor: 2.5,
    reps: 4,
    lapses: 0,
    stepIndex: 0,
    memoryState: null,
    lastReviewedAt: 1_000,
    createdAt: 0,
    ...overrides,
  } as LearningCard;
}

function buildLog(id: string, cardId: string, reviewedAt: number): ReviewLog {
  return {
    id,
    deckId: 'deck_1',
    cardId,
    reviewedAt,
    rating: 'good',
    previousState: 'review',
    newState: 'review',
    scheduledDays: 3,
    elapsedDays: 1,
    wasCorrect: true,
    memoryStateBefore: null,
    memoryStateAfter: null,
  } as ReviewLog;
}

function buildStore(initial: {
  cards: Record<string, LearningCard>;
  reviewLogs: Record<string, ReviewLog>;
}) {
  let state = { ...initial };
  return {
    getState: () => state,
    setState: (partial: Partial<typeof state>) => {
      state = { ...state, ...partial };
    },
  };
}

describe('reviewWriteAheadLog', () => {
  beforeEach(() => {
    clearReviewWal();
  });

  it('appends entries synchronously and peeks them back', () => {
    const card = buildCard('card_1', { lastReviewedAt: 5_000 });
    const log = buildLog('log_1', 'card_1', 5_000);

    appendReviewToWal(card, log);

    const entries = peekReviewWal();
    expect(entries).toHaveLength(1);
    expect(entries[0].logId).toBe('log_1');
    expect(entries[0].card.id).toBe('card_1');
  });

  it('replays a review the snapshot persist lost', () => {
    const staleCard = buildCard('card_1', { dueAt: 2_000, lastReviewedAt: 1_000 });
    const reviewedCard = buildCard('card_1', { dueAt: 90_000, lastReviewedAt: 5_000, reps: 5 });
    const log = buildLog('log_1', 'card_1', 5_000);

    appendReviewToWal(reviewedCard, log);

    const store = buildStore({ cards: { card_1: staleCard }, reviewLogs: {} });
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = replayReviewWal(store);
    consoleWarn.mockRestore();

    expect(result.replayedCount).toBe(1);
    expect(store.getState().cards.card_1.dueAt).toBe(90_000);
    expect(store.getState().cards.card_1.reps).toBe(5);
    expect(store.getState().reviewLogs.log_1).toBeDefined();
    // WAL is cleared after replay — surviving entries live in the store now.
    expect(peekReviewWal()).toHaveLength(0);
  });

  it('skips entries the snapshot already contains', () => {
    const card = buildCard('card_1', { lastReviewedAt: 5_000 });
    const log = buildLog('log_1', 'card_1', 5_000);
    appendReviewToWal(card, log);

    const store = buildStore({
      cards: { card_1: card },
      reviewLogs: { log_1: log },
    });

    const result = replayReviewWal(store);

    expect(result.replayedCount).toBe(0);
    expect(result.skippedCount).toBe(1);
  });

  it('does not overwrite a newer card state with an older WAL entry', () => {
    const olderReviewedCard = buildCard('card_1', { dueAt: 50_000, lastReviewedAt: 5_000 });
    const olderLog = buildLog('log_old', 'card_1', 5_000);
    appendReviewToWal(olderReviewedCard, olderLog);

    const newerCard = buildCard('card_1', { dueAt: 200_000, lastReviewedAt: 9_000 });
    const store = buildStore({ cards: { card_1: newerCard }, reviewLogs: {} });

    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = replayReviewWal(store);
    consoleWarn.mockRestore();

    // The log itself is preserved (append-only history)...
    expect(store.getState().reviewLogs.log_old).toBeDefined();
    expect(result.replayedCount).toBe(1);
    // ...but the card keeps its newer scheduling state.
    expect(store.getState().cards.card_1.dueAt).toBe(200_000);
  });

  it('drops entries whose card no longer exists', () => {
    appendReviewToWal(buildCard('card_gone'), buildLog('log_1', 'card_gone', 5_000));

    const store = buildStore({ cards: {}, reviewLogs: {} });
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = replayReviewWal(store);
    consoleWarn.mockRestore();

    expect(result.droppedCount).toBe(1);
    expect(store.getState().reviewLogs.log_1).toBeUndefined();
  });

  it('caps the WAL so a runaway caller cannot grow storage unbounded', () => {
    for (let index = 0; index < 230; index += 1) {
      appendReviewToWal(
        buildCard(`card_${index}`),
        buildLog(`log_${index}`, `card_${index}`, index),
      );
    }

    const entries = peekReviewWal();
    expect(entries.length).toBeLessThanOrEqual(200);
    // Oldest entries are evicted first.
    expect(entries[0].logId).toBe('log_30');
    expect(entries[entries.length - 1].logId).toBe('log_229');
  });

  it('survives corrupted WAL content without throwing', () => {
    window.localStorage.setItem('blearn-review-wal-v1', '{not json');
    const store = buildStore({ cards: {}, reviewLogs: {} });
    expect(() => replayReviewWal(store)).not.toThrow();
    expect(peekReviewWal()).toHaveLength(0);
  });
});
