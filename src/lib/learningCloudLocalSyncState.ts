import type { LearningCloudSyncCursor } from '@/services/firebaseLearningSyncService';

export interface LearningCloudTombstone {
  id: string;
  deletedAt: number;
}

export interface LearningCloudLocalSyncState {
  version: 1;
  lastSuccessfulSyncAt?: number;
  lastRemoteCursor?: LearningCloudSyncCursor | null;
  lastSuccessfulStateSignature?: string;
  deletedDecks: LearningCloudTombstone[];
  deletedNotes: LearningCloudTombstone[];
  deletedCards: LearningCloudTombstone[];
  deletedReviewLogs: LearningCloudTombstone[];
  deletedPresets: LearningCloudTombstone[];
}

function normalizeTimestamp(value: number | undefined) {
  return Number.isFinite(value) ? Math.max(0, Math.round(value as number)) : undefined;
}

function normalizeCursor(
  cursor?: Partial<LearningCloudSyncCursor> | null,
): LearningCloudSyncCursor | null {
  if (!cursor?.mutationId || !Number.isFinite(cursor.mutationAt)) {
    return null;
  }

  return {
    mutationId: cursor.mutationId,
    mutationAt: Math.max(0, Math.round(cursor.mutationAt)),
  };
}

function normalizeTombstones(input?: LearningCloudTombstone[] | null): LearningCloudTombstone[] {
  const byId = new Map<string, LearningCloudTombstone>();

  for (const entry of input || []) {
    if (!entry?.id) {
      continue;
    }

    const deletedAt = normalizeTimestamp(entry.deletedAt);
    if (!deletedAt) {
      continue;
    }

    const existing = byId.get(entry.id);
    if (!existing || deletedAt > existing.deletedAt) {
      byId.set(entry.id, { id: entry.id, deletedAt });
    }
  }

  return Array.from(byId.values()).sort((left, right) => {
    if (right.deletedAt !== left.deletedAt) {
      return right.deletedAt - left.deletedAt;
    }

    return left.id.localeCompare(right.id);
  });
}

export function createLearningCloudLocalSyncState(): LearningCloudLocalSyncState {
  return {
    version: 1,
    lastSuccessfulSyncAt: undefined,
    lastRemoteCursor: null,
    lastSuccessfulStateSignature: undefined,
    deletedDecks: [],
    deletedNotes: [],
    deletedCards: [],
    deletedReviewLogs: [],
    deletedPresets: [],
  };
}

export function normalizeLearningCloudLocalSyncState(
  input?: Partial<LearningCloudLocalSyncState> | null,
): LearningCloudLocalSyncState {
  const fallback = createLearningCloudLocalSyncState();

  return {
    version: 1,
    lastSuccessfulSyncAt: normalizeTimestamp(input?.lastSuccessfulSyncAt),
    lastRemoteCursor: normalizeCursor(input?.lastRemoteCursor),
    lastSuccessfulStateSignature:
      typeof input?.lastSuccessfulStateSignature === 'string' && input.lastSuccessfulStateSignature.trim()
        ? input.lastSuccessfulStateSignature.trim()
        : undefined,
    deletedDecks: normalizeTombstones(input?.deletedDecks),
    deletedNotes: normalizeTombstones(input?.deletedNotes),
    deletedCards: normalizeTombstones(input?.deletedCards),
    deletedReviewLogs: normalizeTombstones(input?.deletedReviewLogs),
    deletedPresets: normalizeTombstones(input?.deletedPresets),
  };
}

export function appendLearningCloudTombstones(
  existing: LearningCloudTombstone[],
  ids: string[],
  deletedAt = Date.now(),
): LearningCloudTombstone[] {
  if (ids.length === 0) {
    return existing;
  }

  return normalizeTombstones([
    ...existing,
    ...ids.map((id) => ({ id, deletedAt })),
  ]);
}

export function pruneLearningCloudTombstones(
  tombstones: LearningCloudTombstone[],
  syncedAt: number,
): LearningCloudTombstone[] {
  return tombstones.filter((entry) => entry.deletedAt > syncedAt);
}
