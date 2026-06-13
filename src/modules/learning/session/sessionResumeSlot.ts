import type { LearningSessionSnapshot } from './sessionTypes';

/**
 * Session-Resume (Masterplan 4.4 / Fahrplan 5.4): der aktive Session-Snapshot
 * wird synchron in einen kleinen, eigenen Slot geschrieben (analog zum
 * Review-WAL aus 2.2). Stirbt der Prozess mitten in der Session, wird sie beim
 * nächsten Öffnen an derselben Stelle fortgesetzt statt neu zu starten.
 */

const STORAGE_KEY = 'blearn-session-resume-v1';
const DEFAULT_MAX_AGE_MS = 30 * 60 * 1000;

interface SessionResumeRecord {
  snapshot: LearningSessionSnapshot;
  savedAt: number;
}

function getStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function saveSessionResumeSnapshot(snapshot: LearningSessionSnapshot, now = Date.now()): void {
  const storage = getStorage();
  if (!storage) return;

  // Nur aktive Sessions mit echtem Fortschritt sind ein Resume wert.
  if (snapshot.status !== 'active' || (snapshot.countedReviews === 0 && snapshot.history.length === 0)) {
    return;
  }

  try {
    const record: SessionResumeRecord = { snapshot, savedAt: now };
    storage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {
    // Quota/Privacy-Mode: Resume ist Komfort, nie kritisch.
  }
}

export function clearSessionResumeSnapshot(): void {
  try {
    getStorage()?.removeItem(STORAGE_KEY);
  } catch {
    // ignorieren
  }
}

export interface SessionResumeIdentity {
  kind: LearningSessionSnapshot['kind'];
  deckId?: string;
  targetId?: string;
  targetType?: LearningSessionSnapshot['targetType'];
}

/**
 * Liefert den gespeicherten Snapshot, wenn er zur angefragten Session-Identität
 * passt und frisch genug ist — und konsumiert den Slot dabei.
 */
export function takeSessionResumeSnapshot(
  identity: SessionResumeIdentity,
  maxAgeMs = DEFAULT_MAX_AGE_MS,
  now = Date.now(),
): LearningSessionSnapshot | null {
  const storage = getStorage();
  if (!storage) return null;

  let record: SessionResumeRecord | null = null;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    record = raw ? (JSON.parse(raw) as SessionResumeRecord) : null;
  } catch {
    record = null;
  }

  if (!record?.snapshot) {
    return null;
  }

  const { snapshot, savedAt } = record;
  const stale = !Number.isFinite(savedAt) || now - savedAt > maxAgeMs;
  const identityMatches =
    snapshot.kind === identity.kind
    && snapshot.deckId === identity.deckId
    && (snapshot.targetId ?? undefined) === (identity.targetId ?? undefined)
    && (snapshot.targetType ?? undefined) === (identity.targetType ?? undefined);
  const resumable =
    snapshot.status === 'active'
    && snapshot.queue.length > 0
    && (snapshot.countedReviews > 0 || snapshot.history.length > 0);

  clearSessionResumeSnapshot();

  if (stale || !identityMatches || !resumable) {
    return null;
  }

  return snapshot;
}
