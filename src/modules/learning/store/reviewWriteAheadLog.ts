import type { LearningCard, ReviewLog } from '@/modules/learning/domain/entities';

/**
 * Synchronous write-ahead log for review results (Masterplan Phase 2.2).
 *
 * The learning store persists the ENTIRE serialized state asynchronously to
 * IndexedDB on every change. If Android freezes or kills the WebView while
 * that write is in flight — which happens constantly around the blocking
 * overlay — the review is lost and the card "forgets" its schedule.
 *
 * This module writes each completed review synchronously to localStorage
 * BEFORE the big snapshot persist runs. localStorage writes commit
 * synchronously within the same task, so they survive any process death that
 * the user can trigger. On startup the WAL is replayed against the hydrated
 * store; entries already covered by the snapshot are skipped.
 *
 * Durability ordering contract (Masterplan 2.6): the big snapshot may be
 * lost — replay restores it. The WAL must never be lost first.
 */

export interface ReviewWalEntry {
  logId: string;
  card: LearningCard;
  log: ReviewLog;
}

export interface ReviewWalReplayResult {
  replayedCount: number;
  skippedCount: number;
  droppedCount: number;
}

const WAL_STORAGE_KEY = 'blearn-review-wal-v1';
const MAX_WAL_ENTRIES = 200;

function readWalEntries(): ReviewWalEntry[] {
  try {
    const raw = window.localStorage.getItem(WAL_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(
      (entry): entry is ReviewWalEntry =>
        Boolean(entry)
        && typeof entry.logId === 'string'
        && entry.logId.length > 0
        && Boolean(entry.card)
        && Boolean(entry.log),
    );
  } catch {
    return [];
  }
}

function writeWalEntries(entries: ReviewWalEntry[]): boolean {
  try {
    window.localStorage.setItem(WAL_STORAGE_KEY, JSON.stringify(entries));
    return true;
  } catch {
    // Quota or storage failure: the WAL is best-effort protection and must
    // never break the review path itself.
    return false;
  }
}

/**
 * Append a completed review synchronously. Call BEFORE the store `set` that
 * schedules the asynchronous snapshot persist.
 */
export function appendReviewToWal(card: LearningCard, log: ReviewLog): void {
  const entries = readWalEntries();
  entries.push({ logId: log.id, card, log });
  while (entries.length > MAX_WAL_ENTRIES) {
    entries.shift();
  }
  writeWalEntries(entries);
}

export function clearReviewWal(): void {
  try {
    window.localStorage.removeItem(WAL_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function peekReviewWal(): ReviewWalEntry[] {
  return readWalEntries();
}

interface ReplayableLearningState {
  cards: Record<string, LearningCard>;
  reviewLogs: Record<string, ReviewLog>;
}

interface ReplayableStoreApi {
  getState: () => ReplayableLearningState;
  setState: (partial: Partial<ReplayableLearningState>) => void;
}

/**
 * Replay WAL entries the hydrated snapshot does not contain. Run once after
 * persist hydration finishes. Clears the WAL afterwards: every surviving
 * entry is now part of the in-memory state and will be included in the next
 * snapshot persist.
 */
export function replayReviewWal(store: ReplayableStoreApi): ReviewWalReplayResult {
  const entries = readWalEntries();
  if (entries.length === 0) {
    return { replayedCount: 0, skippedCount: 0, droppedCount: 0 };
  }

  const state = store.getState();
  const nextCards: Record<string, LearningCard> = { ...state.cards };
  const nextReviewLogs: Record<string, ReviewLog> = { ...state.reviewLogs };

  let replayedCount = 0;
  let skippedCount = 0;
  let droppedCount = 0;

  for (const entry of entries) {
    if (nextReviewLogs[entry.logId]) {
      // Snapshot persist won the race for this review — nothing lost.
      skippedCount += 1;
      continue;
    }

    const existingCard = nextCards[entry.card.id];
    if (!existingCard) {
      // Card no longer exists (deck deleted between review and restart).
      // Restoring the log alone would create an orphan; drop the entry.
      droppedCount += 1;
      continue;
    }

    const existingLastReviewedAt = existingCard.lastReviewedAt ?? 0;
    if (entry.log.reviewedAt >= existingLastReviewedAt) {
      nextCards[entry.card.id] = entry.card;
    }
    nextReviewLogs[entry.logId] = entry.log;
    replayedCount += 1;
  }

  if (replayedCount > 0) {
    store.setState({ cards: nextCards, reviewLogs: nextReviewLogs });
  }

  clearReviewWal();

  if (replayedCount > 0 || droppedCount > 0) {
    // Recovery counter (Masterplan 2.6): regularly seeing > 0 here is the
    // early-warning signal for persist problems before users notice loss.
    console.warn(
      `Review-WAL replay: restored ${replayedCount} review(s), skipped ${skippedCount}, dropped ${droppedCount}.`,
    );
  }

  return { replayedCount, skippedCount, droppedCount };
}
