import { normalizeLearningCloudState, type LearningCloudState } from '@/lib/learningCloudSync';
import type { LearningCloudSyncCursor } from '@/services/firebaseLearningSyncService';

export interface LearningCloudSyncBaseline {
  cursor: LearningCloudSyncCursor | null;
  state: LearningCloudState;
}

const baselineByUserId = new Map<string, LearningCloudSyncBaseline>();

function normalizeCursor(cursor?: Partial<LearningCloudSyncCursor> | null): LearningCloudSyncCursor | null {
  if (!cursor?.mutationId || !Number.isFinite(cursor.mutationAt)) {
    return null;
  }

  return {
    mutationId: cursor.mutationId,
    mutationAt: Math.max(0, Math.round(cursor.mutationAt)),
  };
}

export function areLearningCloudSyncCursorsEqual(
  left?: Partial<LearningCloudSyncCursor> | null,
  right?: Partial<LearningCloudSyncCursor> | null,
): boolean {
  const normalizedLeft = normalizeCursor(left);
  const normalizedRight = normalizeCursor(right);

  if (!normalizedLeft && !normalizedRight) {
    return true;
  }

  if (!normalizedLeft || !normalizedRight) {
    return false;
  }

  return normalizedLeft.mutationAt === normalizedRight.mutationAt
    && normalizedLeft.mutationId === normalizedRight.mutationId;
}

export function cacheLearningCloudSyncBaseline(
  userId: string,
  state: LearningCloudState,
  cursor?: Partial<LearningCloudSyncCursor> | null,
) {
  const normalizedUserId = userId.trim();
  if (!normalizedUserId) {
    return;
  }

  baselineByUserId.set(normalizedUserId, {
    cursor: normalizeCursor(cursor),
    state: normalizeLearningCloudState(state),
  });
}

export function getCachedLearningCloudSyncBaseline(userId: string): LearningCloudSyncBaseline | null {
  return baselineByUserId.get(userId.trim()) || null;
}

export function clearLearningCloudSyncBaseline(userId?: string) {
  if (!userId) {
    baselineByUserId.clear();
    return;
  }

  baselineByUserId.delete(userId.trim());
}
