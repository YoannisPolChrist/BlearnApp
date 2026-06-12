import { create } from 'zustand';

export type CloudSyncRuntimeStatus =
  | 'idle'
  | 'blocked-firebase-missing'
  | 'blocked-writes-disabled'
  | 'blocked-signed-out'
  | 'starting'
  | 'ready'
  | 'error';

export interface CloudSyncRuntimeEntry {
  status: CloudSyncRuntimeStatus;
  currentError: string | null;
  lastSuccessfulSyncAt: number | null;
}

interface CloudSyncRuntimeState {
  learning: CloudSyncRuntimeEntry;
  progress: CloudSyncRuntimeEntry;
  setLearning: (nextEntry: Partial<CloudSyncRuntimeEntry> & Pick<CloudSyncRuntimeEntry, 'status'>) => void;
  setProgress: (nextEntry: Partial<CloudSyncRuntimeEntry> & Pick<CloudSyncRuntimeEntry, 'status'>) => void;
  resetLearning: () => void;
  resetProgress: () => void;
}

const EMPTY_RUNTIME_ENTRY: CloudSyncRuntimeEntry = {
  status: 'idle',
  currentError: null,
  lastSuccessfulSyncAt: null,
};

export const useCloudSyncRuntimeStore = create<CloudSyncRuntimeState>((set) => ({
  learning: EMPTY_RUNTIME_ENTRY,
  progress: EMPTY_RUNTIME_ENTRY,
  setLearning: (nextEntry) =>
    set((state) => ({
      learning: {
        ...state.learning,
        ...nextEntry,
      },
    })),
  setProgress: (nextEntry) =>
    set((state) => ({
      progress: {
        ...state.progress,
        ...nextEntry,
      },
    })),
  resetLearning: () =>
    set({
      learning: EMPTY_RUNTIME_ENTRY,
    }),
  resetProgress: () =>
    set({
      progress: EMPTY_RUNTIME_ENTRY,
    }),
}));

export function resetCloudSyncRuntimeForTests() {
  useCloudSyncRuntimeStore.setState({
    learning: EMPTY_RUNTIME_ENTRY,
    progress: EMPTY_RUNTIME_ENTRY,
  });
}

export function getCloudSyncRuntimeStatusTone(status: CloudSyncRuntimeStatus) {
  if (status === 'ready') {
    return 'success';
  }

  if (status === 'error') {
    return 'destructive';
  }

  if (status.startsWith('blocked-')) {
    return 'warning';
  }

  return 'muted';
}
