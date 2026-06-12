import { waitForPersistStorageIdle } from '@/lib/persistStorage';
import { waitForAppStorePersistence } from '@/store/appStore.shared';

const DEFAULT_PERSIST_TIMEOUT_MS = 2500;
export const LEARNING_STORE_PERSIST_KEY = 'blearn-learning-storage';

interface BlockingFlowPersistenceOptions {
  includeLearningStore?: boolean;
  timeoutMs?: number;
}

export async function waitForBlockingFlowPersistence({
  includeLearningStore = false,
  timeoutMs = DEFAULT_PERSIST_TIMEOUT_MS,
}: BlockingFlowPersistenceOptions = {}) {
  await waitForAppStorePersistence(timeoutMs);

  if (!includeLearningStore) {
    return;
  }

  await waitForPersistStorageIdle(LEARNING_STORE_PERSIST_KEY, timeoutMs);
}
