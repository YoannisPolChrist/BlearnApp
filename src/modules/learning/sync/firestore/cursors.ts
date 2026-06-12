import type { LearningCloudMutationRecord, LearningCloudSyncCursor } from './types';

export function createSyntheticLearningCloudCursor(mutationAt: number): LearningCloudSyncCursor {
  const mutationId = `snapshot_${mutationAt}_${Math.random().toString(36).slice(2, 10)}`;
  return {
    mutationId,
    mutationAt,
  };
}

export function normalizeSyncCursor(cursor?: Partial<LearningCloudSyncCursor> | null): LearningCloudSyncCursor | null {
  if (!cursor?.mutationId || !Number.isFinite(cursor.mutationAt)) {
    return null;
  }

  return {
    mutationId: cursor.mutationId,
    mutationAt: Math.max(0, Math.round(cursor.mutationAt)),
  };
}

export function compareSyncCursors(
  left?: LearningCloudSyncCursor | null,
  right?: LearningCloudSyncCursor | null,
): number {
  if (!left && !right) {
    return 0;
  }

  if (!left) {
    return -1;
  }

  if (!right) {
    return 1;
  }

  if (left.mutationAt !== right.mutationAt) {
    return left.mutationAt - right.mutationAt;
  }

  return left.mutationId.localeCompare(right.mutationId);
}

export function sortMutationRecords(records: LearningCloudMutationRecord[]) {
  return [...records].sort((left, right) => compareSyncCursors(left.cursor, right.cursor));
}
