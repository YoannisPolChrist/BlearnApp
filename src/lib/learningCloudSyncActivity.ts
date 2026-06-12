let manualLearningCloudSyncCount = 0;

export function beginManualLearningCloudSync() {
  manualLearningCloudSyncCount += 1;

  return () => {
    manualLearningCloudSyncCount = Math.max(0, manualLearningCloudSyncCount - 1);
  };
}

export function isManualLearningCloudSyncActive() {
  return manualLearningCloudSyncCount > 0;
}
