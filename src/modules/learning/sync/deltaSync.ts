import { normalizeLearningCloudState, type LearningCloudState } from './learningCloudState';
import {
  applyMutationToCloudState,
  resolveCloudStateConflicts,
} from './conflictResolution';
import {
  acknowledgeMutationLog,
  appendMutation,
  createMutationLog,
  getPendingMutations,
  normalizeMutationLog,
} from './mutationLog';
import type {
  DeltaSyncReconcileResult,
  DeltaSyncState,
  MutationLogState,
  SyncCursor,
  SyncMutationInput,
} from './syncTypes';

export interface CreateDeltaSyncStateOptions {
  clientId: string;
  cloudState?: Partial<LearningCloudState> | null;
  mutationLog?: Partial<MutationLogState> | null;
  appliedCursor?: SyncCursor | null;
}

function pickNewestCursor(left: SyncCursor | null, right: SyncCursor | null): SyncCursor | null {
  if (!left) return right;
  if (!right) return left;
  if (left.clientId !== right.clientId) {
    return right.updatedAt >= left.updatedAt ? right : left;
  }
  if (right.sequence !== left.sequence) {
    return right.sequence > left.sequence ? right : left;
  }
  return right.updatedAt >= left.updatedAt ? right : left;
}

export function createDeltaSyncState(
  options: CreateDeltaSyncStateOptions,
): DeltaSyncState {
  const cloudState = normalizeLearningCloudState(options.cloudState);
  const mutationLog = createMutationLog(
    options.clientId,
    normalizeMutationLog({
      clientId: options.clientId,
      entries: options.mutationLog?.entries ?? [],
      acknowledgedCursor: options.mutationLog?.acknowledgedCursor ?? options.appliedCursor ?? null,
    }).entries,
    options.mutationLog?.acknowledgedCursor ?? options.appliedCursor ?? null,
  );

  return {
    clientId: options.clientId,
    cloudState,
    mutationLog,
    appliedCursor: options.appliedCursor ?? mutationLog.acknowledgedCursor,
  };
}

export function applyLocalMutation(
  snapshot: DeltaSyncState,
  mutation: SyncMutationInput,
  now = Date.now(),
): DeltaSyncState {
  const { log, mutation: appendedMutation } = appendMutation(snapshot.mutationLog, mutation, now);
  return {
    ...snapshot,
    cloudState: applyMutationToCloudState(snapshot.cloudState, appendedMutation, now),
    mutationLog: log,
  };
}

export function getDeltaSyncPendingMutations(snapshot: DeltaSyncState) {
  return getPendingMutations(snapshot.mutationLog, snapshot.appliedCursor);
}

export function acknowledgeDeltaSyncCursor(
  snapshot: DeltaSyncState,
  cursor: SyncCursor | null | undefined,
): DeltaSyncState {
  if (!cursor) {
    return snapshot;
  }

  const appliedCursor = pickNewestCursor(snapshot.appliedCursor, cursor);
  const mutationLog = acknowledgeMutationLog(snapshot.mutationLog, appliedCursor);

  return {
    ...snapshot,
    appliedCursor,
    mutationLog,
  };
}

export function reconcileDeltaSync(
  snapshot: DeltaSyncState,
  remoteState?: Partial<LearningCloudState> | null,
  remoteCursor?: SyncCursor | null,
): DeltaSyncReconcileResult {
  const pendingMutations = getDeltaSyncPendingMutations(snapshot);
  const mergedState = resolveCloudStateConflicts(snapshot.cloudState, remoteState, pendingMutations);
  const appliedCursor = pickNewestCursor(snapshot.appliedCursor, remoteCursor ?? null);
  const mutationLog = acknowledgeMutationLog(snapshot.mutationLog, appliedCursor);

  return {
    cloudState: mergedState,
    mutationLog,
    appliedMutations: pendingMutations,
    pendingMutations: getPendingMutations(mutationLog, appliedCursor),
    appliedCursor,
  };
}

export function replaceDeltaSyncState(
  snapshot: DeltaSyncState,
  nextCloudState?: Partial<LearningCloudState> | null,
  nextAppliedCursor?: SyncCursor | null,
): DeltaSyncState {
  return {
    ...snapshot,
    cloudState: normalizeLearningCloudState(nextCloudState ?? snapshot.cloudState),
    appliedCursor: nextAppliedCursor ?? snapshot.appliedCursor,
    mutationLog: nextAppliedCursor
      ? acknowledgeMutationLog(snapshot.mutationLog, nextAppliedCursor)
      : snapshot.mutationLog,
  };
}
