type LearningCloudImmediateSaveHandler = (reason: string) => Promise<boolean>;

let immediateSaveHandler: LearningCloudImmediateSaveHandler | null = null;

export function setLearningCloudImmediateSaveHandler(handler: LearningCloudImmediateSaveHandler | null) {
  immediateSaveHandler = handler;

  return () => {
    if (immediateSaveHandler === handler) {
      immediateSaveHandler = null;
    }
  };
}

export async function flushLearningCloudSaveIfAvailable(reason: string) {
  if (!immediateSaveHandler) {
    return false;
  }

  return immediateSaveHandler(reason);
}

export function resetLearningCloudImmediateSaveForTests() {
  immediateSaveHandler = null;
}
