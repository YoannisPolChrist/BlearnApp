import { normalizeLearningCloudState, type LearningCloudState } from '@/lib/learningCloudSync';
import { createIndexedRecordView } from '@/modules/learning/store/helpers';
import type {
  LearningCloudMeta,
  LearningCloudSyncCursor,
} from '@/services/firebaseLearningSyncService';
import { useLearningStore } from '@/store/useLearningStore';

const LEARNING_STORAGE_KEY = 'blearn-learning-storage';
const LEARNING_STORAGE_OWNER_KEY = 'blearn-learning-storage-owner';
const LEARNING_STORAGE_BACKUP_PREFIX = 'blearn-learning-storage-backup:';

type LearningCloudSyncModule = typeof import('@/services/firebaseLearningSyncService');
export type LearningCloudSyncApi = Pick<
  LearningCloudSyncModule,
  | 'applyLearningCloudMutations'
  | 'getLearningSyncDeviceId'
  | 'loadLearningCloudState'
  | 'loadLearningCloudSyncCursor'
  | 'pullLearningCloudMutations'
  | 'saveLearningCloudState'
  | 'subscribeToLearningCloudMetadata'
>;

let learningCloudSyncApiOverrides: Partial<LearningCloudSyncApi> | null = null;
let learningCloudSyncModulePromise: Promise<LearningCloudSyncModule> | null = null;

export async function getLearningCloudSyncApi(): Promise<LearningCloudSyncApi> {
  if (!learningCloudSyncModulePromise) {
    learningCloudSyncModulePromise = import('@/services/firebaseLearningSyncService');
  }

  const learningCloudSyncModule = await learningCloudSyncModulePromise;
  return learningCloudSyncApiOverrides
    ? { ...learningCloudSyncModule, ...learningCloudSyncApiOverrides }
    : learningCloudSyncModule;
}

export function setLearningCloudSyncApiForTest(overrides: Partial<LearningCloudSyncApi> | null) {
  learningCloudSyncApiOverrides = overrides;
}

export function readLearningCloudStateFromStore(): LearningCloudState {
  const state = useLearningStore.getState();
  return normalizeLearningCloudState({
    activeDeckId: state.activeDeckId,
    activeDeckUpdatedAt: state.activeDeckUpdatedAt,
    decks: Object.values(state.decks),
    notes: Object.values(state.notes),
    cards: Object.values(state.cards),
    reviewLogs: Object.values(state.reviewLogs),
    presets: Object.values(state.presets),
    assignments: state.assignments,
    gateRule: state.gateRule,
    gateRuleUpdatedAt: state.gateRuleUpdatedAt,
    cardBrowser: state.cardBrowser,
    savedCardQueries: state.savedCardQueries,
    filteredDeckLiteDefinition: state.filteredDeckLiteDefinition,
    filteredDeckLiteDefinitions: state.filteredDeckLiteDefinitions,
    filteredDeckLiteRuns: state.filteredDeckLiteRuns,
  });
}

export function getLearningCloudLocalSyncState() {
  return useLearningStore.getState().learningCloudLocalSyncState;
}

export function writeLearningCloudStateToStore(nextState: LearningCloudState) {
  useLearningStore.setState({
    activeDeckId: nextState.activeDeckId,
    activeDeckUpdatedAt: nextState.activeDeckUpdatedAt,
    decks: createIndexedRecordView(nextState.decks),
    notes: createIndexedRecordView(nextState.notes),
    cards: createIndexedRecordView(nextState.cards),
    reviewLogs: createIndexedRecordView(nextState.reviewLogs),
    presets: createIndexedRecordView(nextState.presets),
    assignments: nextState.assignments,
    gateRule: nextState.gateRule,
    gateRuleUpdatedAt: nextState.gateRuleUpdatedAt,
    cardBrowser: nextState.cardBrowser,
    savedCardQueries: nextState.savedCardQueries,
    filteredDeckLiteDefinition: nextState.filteredDeckLiteDefinition,
    filteredDeckLiteDefinitions: nextState.filteredDeckLiteDefinitions,
    filteredDeckLiteRuns: nextState.filteredDeckLiteRuns,
  });
}

export function clearWindowTimer(timerId: number | null) {
  if (timerId !== null && typeof window !== 'undefined') {
    window.clearTimeout(timerId);
  }
}

function getPersistedLearningStorageName() {
  return useLearningStore.persist.getOptions().name || LEARNING_STORAGE_KEY;
}

export function getPersistedLearningOwner() {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage.getItem(LEARNING_STORAGE_OWNER_KEY);
}

export function setPersistedLearningOwner(userId: string) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(LEARNING_STORAGE_OWNER_KEY, userId);
}

function getLearningStorageBackupKey(userId: string) {
  return `${LEARNING_STORAGE_BACKUP_PREFIX}${userId}`;
}

async function readPersistedLearningSnapshot(name: string) {
  const storage = useLearningStore.persist.getOptions().storage;

  if (storage) {
    return await storage.getItem(name);
  }

  if (typeof window !== 'undefined') {
    return window.localStorage.getItem(name);
  }

  return null;
}

async function writePersistedLearningSnapshot(name: string, snapshot: unknown) {
  const storage = useLearningStore.persist.getOptions().storage;

  if (storage) {
    await storage.setItem(name, snapshot as never);
    return;
  }

  if (typeof window !== 'undefined' && typeof snapshot === 'string') {
    window.localStorage.setItem(name, snapshot);
  }
}

function readLearningCloudStateFromPersistedSnapshot(snapshot: unknown): LearningCloudState | null {
  if (!snapshot) {
    return null;
  }

  const parsedSnapshot = typeof snapshot === 'string'
    ? (() => {
        try {
          return JSON.parse(snapshot) as unknown;
        } catch {
          return null;
        }
      })()
    : snapshot;

  if (!parsedSnapshot || typeof parsedSnapshot !== 'object' || !('state' in parsedSnapshot)) {
    return null;
  }

  const persistedState = parsedSnapshot.state;
  if (!persistedState || typeof persistedState !== 'object') {
    return null;
  }

  return normalizeLearningCloudState(persistedState as Partial<LearningCloudState>);
}

export async function preparePersistedLearningAccountSwitch(previousUserId: string, nextUserId: string) {
  const storageName = getPersistedLearningStorageName();
  const currentSnapshot = await readPersistedLearningSnapshot(storageName);
  if (currentSnapshot) {
    await writePersistedLearningSnapshot(getLearningStorageBackupKey(previousUserId), currentSnapshot);
  }

  const nextSnapshot = await readPersistedLearningSnapshot(getLearningStorageBackupKey(nextUserId));
  return readLearningCloudStateFromPersistedSnapshot(nextSnapshot);
}

export function getRemoteMutationCursor(meta: LearningCloudMeta | null | undefined): LearningCloudSyncCursor | null {
  if (meta?.mutationCursor?.mutationId && Number.isFinite(meta.mutationCursor.mutationAt)) {
    return meta.mutationCursor;
  }

  if (meta?.lastMutationId && Number.isFinite(meta?.lastMutationAt)) {
    return {
      mutationId: meta.lastMutationId,
      mutationAt: meta.lastMutationAt as number,
    };
  }

  return null;
}

export function getLearningCloudRuntimeErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Learning cloud sync failed.';
}
