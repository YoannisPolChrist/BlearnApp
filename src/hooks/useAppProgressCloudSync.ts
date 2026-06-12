import { useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { isFirebaseConfigured, isFirebaseWriteEnabled } from '@/lib/firebase';
import { useCloudSyncRuntimeStore } from '@/lib/cloudSyncRuntime';
import {
  deriveProgressState,
  getProgressCloudStateSignature,
  isProgressCloudStateEmpty,
  mergeProgressCloudStates,
  normalizeProgressCloudState,
  type ProgressCloudState,
} from '@/lib/progressCloudSync';
import { useAuthStore } from '@/store/useAuthStore';
import { useAppStore } from '@/store/useAppStore';
import {
  loadProgressCloudState,
  saveProgressCloudState,
  subscribeToProgressCloudState,
  getProgressSyncDeviceId,
} from '@/services/firebaseProgressSyncService';

const PROGRESS_SAVE_DEBOUNCE_MS = 1200;
const PROGRESS_STORAGE_OWNER_KEY = 'blearn-progress-storage-owner';
const PROGRESS_STORAGE_BACKUP_PREFIX = 'blearn-progress-storage-backup:';

interface ProgressStoreSnapshot {
  checkins: ReturnType<typeof useAppStore.getState>['checkins'];
  userProfile: ReturnType<typeof useAppStore.getState>['userProfile'];
  dailyStats: ReturnType<typeof useAppStore.getState>['dailyStats'];
  streak: number;
  lastCheckinDate: string | null;
}

function getProgressBackupKey(userId: string) {
  return `${PROGRESS_STORAGE_BACKUP_PREFIX}${userId}`;
}

function getDefaultProgressSnapshot(): ProgressStoreSnapshot {
  const initialState = useAppStore.getInitialState();
  return {
    checkins: [],
    userProfile: initialState.userProfile,
    dailyStats: initialState.dailyStats,
    streak: initialState.streak,
    lastCheckinDate: initialState.lastCheckinDate,
  };
}

function readProgressSnapshotFromStore(): ProgressStoreSnapshot {
  const state = useAppStore.getState();
  return {
    checkins: state.checkins,
    userProfile: state.userProfile,
    dailyStats: state.dailyStats,
    streak: state.streak,
    lastCheckinDate: state.lastCheckinDate,
  };
}

function readProgressSourceStateFromStore(): ProgressCloudState {
  const state = useAppStore.getState();
  return normalizeProgressCloudState({
    checkins: state.checkins,
    interactions: state.userProfile.recentInteractions,
  });
}

function applyProgressDerivedState(nextState: ProgressCloudState) {
  const derived = deriveProgressState(nextState);
  useAppStore.setState({
    checkins: derived.checkins,
    userProfile: derived.userProfile,
    dailyStats: derived.dailyStats,
    streak: derived.streak,
    lastCheckinDate: derived.lastCheckinDate,
  });
}

function isProgressSnapshotEmpty(snapshot: ProgressStoreSnapshot) {
  return snapshot.checkins.length === 0 && snapshot.userProfile.recentInteractions.length === 0;
}

function readProgressBackup(userId: string): ProgressStoreSnapshot | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.localStorage.getItem(getProgressBackupKey(userId));
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<ProgressStoreSnapshot> | null;
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    return {
      ...getDefaultProgressSnapshot(),
      ...parsed,
      checkins: Array.isArray(parsed.checkins) ? parsed.checkins : [],
    } as ProgressStoreSnapshot;
  } catch {
    return null;
  }
}

function storeProgressBackup(userId: string, snapshot: ProgressStoreSnapshot) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(getProgressBackupKey(userId), JSON.stringify(snapshot));
}

function setProgressOwner(userId: string) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(PROGRESS_STORAGE_OWNER_KEY, userId);
}

function getProgressOwner() {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage.getItem(PROGRESS_STORAGE_OWNER_KEY);
}

function switchProgressAccount(previousUserId: string | null, nextUserId: string) {
  const currentSnapshot = readProgressSnapshotFromStore();
  if (previousUserId) {
    storeProgressBackup(previousUserId, currentSnapshot);
  }

  const nextSnapshot = readProgressBackup(nextUserId);
  if (nextSnapshot) {
    useAppStore.setState(nextSnapshot);
    return;
  }

  useAppStore.setState(getDefaultProgressSnapshot());
}

function getProgressCloudRuntimeErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Progress cloud sync failed.';
}

export function useAppProgressCloudSync(enabled = true) {
  const firebaseConfigured = isFirebaseConfigured();
  const firebaseWritesEnabled = isFirebaseWriteEnabled();
  const authReady = useAuthStore((state) => state.authReady);
  const authStatus = useAuthStore((state) => state.status);
  const authUserId = useAuthStore((state) => state.user?.uid);
  const setProgressSyncRuntime = useCloudSyncRuntimeStore((state) => state.setProgress);
  const resetProgressSyncRuntime = useCloudSyncRuntimeStore((state) => state.resetProgress);
  const progressSourceState = useAppStore(
    useShallow((state) => ({
      checkins: state.checkins,
      recentInteractions: state.userProfile.recentInteractions,
    })),
  );

  const syncReadyRef = useRef(false);
  const applyingRemoteStateRef = useRef(false);
  const activeUserIdRef = useRef<string | null>(null);
  const remoteSubscriptionRef = useRef<(() => void) | null>(null);
  const pendingSaveTimerRef = useRef<number | null>(null);
  const lastSyncedSignatureRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      syncReadyRef.current = false;
      resetProgressSyncRuntime();
      return undefined;
    }

    if (!firebaseConfigured || authStatus === 'disabled') {
      syncReadyRef.current = false;
      setProgressSyncRuntime({
        status: 'blocked-firebase-missing',
        currentError: null,
      });
      return undefined;
    }

    if (!firebaseWritesEnabled) {
      syncReadyRef.current = false;
      setProgressSyncRuntime({
        status: 'blocked-writes-disabled',
        currentError: null,
      });
      return undefined;
    }

    if (!authReady) {
      syncReadyRef.current = false;
      setProgressSyncRuntime({
        status: 'idle',
        currentError: null,
      });
      return undefined;
    }

    let cancelled = false;
    activeUserIdRef.current = authUserId ?? null;

    const clearSaveTimer = () => {
      if (pendingSaveTimerRef.current !== null) {
        window.clearTimeout(pendingSaveTimerRef.current);
        pendingSaveTimerRef.current = null;
      }
    };

    const scheduleSave = (delay = PROGRESS_SAVE_DEBOUNCE_MS) => {
      clearSaveTimer();
      pendingSaveTimerRef.current = window.setTimeout(() => {
        pendingSaveTimerRef.current = null;

        void (async () => {
          if (
            !authUserId
            || activeUserIdRef.current !== authUserId
            || applyingRemoteStateRef.current
          ) {
            return;
          }

          const nextState = readProgressSourceStateFromStore();
          const nextSignature = getProgressCloudStateSignature(nextState);
          if (nextSignature === lastSyncedSignatureRef.current) {
            return;
          }

          try {
            await saveProgressCloudState(authUserId, nextState, getProgressSyncDeviceId());
            lastSyncedSignatureRef.current = nextSignature;
          } catch (error) {
            console.warn('Progress cloud sync save failed:', error);
          }
        })();
      }, delay);
    };

    const startSync = async () => {
      try {
        if (!authUserId) {
          lastSyncedSignatureRef.current = null;
          syncReadyRef.current = false;
          setProgressSyncRuntime({
            status: 'blocked-signed-out',
            currentError: null,
          });
          return;
        }

        setProgressSyncRuntime({
          status: 'starting',
          currentError: null,
        });

        const persistedOwner = getProgressOwner();
        if (persistedOwner !== authUserId) {
          switchProgressAccount(persistedOwner, authUserId);
        }

        const localState = readProgressSourceStateFromStore();
        const remoteState = await loadProgressCloudState(authUserId, { source: 'server' });
        if (cancelled || activeUserIdRef.current !== authUserId) {
          return;
        }

        const mergedState = mergeProgressCloudStates(localState, remoteState);
        const mergedSignature = getProgressCloudStateSignature(mergedState);
        const localSignature = getProgressCloudStateSignature(localState);
        const remoteSignature = getProgressCloudStateSignature(remoteState);

        if (mergedSignature !== localSignature) {
          applyingRemoteStateRef.current = true;
          applyProgressDerivedState(mergedState);
          applyingRemoteStateRef.current = false;
        }

        setProgressOwner(authUserId);
        lastSyncedSignatureRef.current = mergedSignature;
        syncReadyRef.current = true;
        setProgressSyncRuntime({
          status: 'ready',
          currentError: null,
          lastSuccessfulSyncAt: Date.now(),
        });

        if (mergedSignature !== remoteSignature && !isProgressCloudStateEmpty(mergedState)) {
          await saveProgressCloudState(authUserId, mergedState, getProgressSyncDeviceId());
          lastSyncedSignatureRef.current = mergedSignature;
          setProgressSyncRuntime({
            status: 'ready',
            currentError: null,
            lastSuccessfulSyncAt: Date.now(),
          });
        }

        remoteSubscriptionRef.current = subscribeToProgressCloudState(
          authUserId,
          async (nextRemoteState) => {
            if (
              cancelled
              || activeUserIdRef.current !== authUserId
              || applyingRemoteStateRef.current
            ) {
              return;
            }

            const currentLocalState = readProgressSourceStateFromStore();
            const mergedRemoteState = mergeProgressCloudStates(currentLocalState, nextRemoteState);
            const mergedRemoteSignature = getProgressCloudStateSignature(mergedRemoteState);
            const currentLocalSignature = getProgressCloudStateSignature(currentLocalState);
            const nextRemoteSignature = getProgressCloudStateSignature(nextRemoteState);

            if (mergedRemoteSignature !== currentLocalSignature) {
              applyingRemoteStateRef.current = true;
              applyProgressDerivedState(mergedRemoteState);
              applyingRemoteStateRef.current = false;
            }

            lastSyncedSignatureRef.current = mergedRemoteSignature;
            setProgressSyncRuntime({
              status: 'ready',
              currentError: null,
              lastSuccessfulSyncAt: Date.now(),
            });

            if (
              mergedRemoteSignature !== nextRemoteSignature
              && !isProgressCloudStateEmpty(mergedRemoteState)
            ) {
              try {
                await saveProgressCloudState(authUserId, mergedRemoteState, getProgressSyncDeviceId());
                setProgressSyncRuntime({
                  status: 'ready',
                  currentError: null,
                  lastSuccessfulSyncAt: Date.now(),
                });
              } catch (error) {
                setProgressSyncRuntime({
                  status: 'error',
                  currentError: getProgressCloudRuntimeErrorMessage(error),
                });
                console.warn('Progress cloud sync update failed:', error);
              }
            }
          },
          (error) => {
            setProgressSyncRuntime({
              status: 'error',
              currentError: getProgressCloudRuntimeErrorMessage(error),
            });
            console.warn('Progress cloud sync listener failed:', error);
          },
        );
      } catch (error) {
        syncReadyRef.current = false;
        setProgressSyncRuntime({
          status: 'error',
          currentError: getProgressCloudRuntimeErrorMessage(error),
        });
        console.warn('Progress cloud sync initialization failed:', error);
      }
    };

    void startSync();

    return () => {
      cancelled = true;
      clearSaveTimer();
      remoteSubscriptionRef.current?.();
      remoteSubscriptionRef.current = null;
      syncReadyRef.current = false;
    };
  }, [
    authReady,
    authStatus,
    authUserId,
    enabled,
    firebaseConfigured,
    firebaseWritesEnabled,
    resetProgressSyncRuntime,
    setProgressSyncRuntime,
  ]);

  useEffect(() => {
    if (
      !enabled
      || !firebaseWritesEnabled
      || !authReady
      || authStatus === 'disabled'
      || !authUserId
      || !syncReadyRef.current
      || applyingRemoteStateRef.current
    ) {
      return;
    }

    const nextState = readProgressSourceStateFromStore();
    const nextSignature = getProgressCloudStateSignature(nextState);
    if (nextSignature === lastSyncedSignatureRef.current) {
      return;
    }

    const timerId = window.setTimeout(() => {
      void (async () => {
        if (
          !authUserId
          || activeUserIdRef.current !== authUserId
          || applyingRemoteStateRef.current
        ) {
          return;
        }

        try {
          await saveProgressCloudState(authUserId, nextState, getProgressSyncDeviceId());
          lastSyncedSignatureRef.current = nextSignature;
          setProgressSyncRuntime({
            status: 'ready',
            currentError: null,
            lastSuccessfulSyncAt: Date.now(),
          });
        } catch (error) {
          setProgressSyncRuntime({
            status: 'error',
            currentError: getProgressCloudRuntimeErrorMessage(error),
          });
          console.warn('Progress cloud sync save failed:', error);
        }
      })();
    }, PROGRESS_SAVE_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [authReady, authStatus, authUserId, enabled, firebaseWritesEnabled, progressSourceState, setProgressSyncRuntime]);
}
