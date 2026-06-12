export {
  MAX_CLOUD_REVIEW_LOGS,
  getLearningCloudStateSignature,
  isLearningCloudStateEmpty,
  mergeLearningCloudStates,
  normalizeLearningCloudState,
  type LearningCloudState,
} from './learningCloudState';
export {
  applyLocalMutation,
  acknowledgeDeltaSyncCursor,
  createDeltaSyncState,
  getDeltaSyncPendingMutations,
  reconcileDeltaSync,
  replaceDeltaSyncState,
  type CreateDeltaSyncStateOptions,
} from './deltaSync';
export {
  applyMutationToCloudState,
  mergeAppendOnlyReviewLogs,
  mergeLatestWriteWinsCloudStates,
  resolveCloudStateConflicts,
} from './conflictResolution';
export {
  acknowledgeMutationLog,
  advanceMutationCursor,
  appendMutation,
  createMutationLog,
  getMutationLogCursor,
  getMutationsSinceCursor,
  getPendingMutations,
  hasAppliedMutation,
  normalizeMutationLog,
} from './mutationLog';
export {
  getCardRevision,
  getDeckRevision,
  getNoteRevision,
  getPresetRevision,
  getReviewLogRevision,
  mergeById,
  normalizeActiveDeckSelection,
  normalizeLearningNote,
  normalizeRevisionTimestamp,
  pickMostRecentActiveDeckSelection,
  sortById,
} from './learningSyncMappers';
export {
  createSyncCursor,
  type DeltaSyncReconcileResult,
  type DeltaSyncState,
  type MutationLogState,
  type SyncCursor,
  type SyncEntityType,
  type SyncMutationEntry,
  type SyncMutationInput,
  type SyncMutationKind,
} from './syncTypes';
