import { useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { isFirebaseConfigured, isFirebaseWriteEnabled } from '@/lib/firebase';
import { useCloudSyncRuntimeStore } from '@/lib/cloudSyncRuntime';
import {
  getLearningCloudStateSignature,
  isLearningCloudStateEmpty,
  mergeLearningCloudStates,
  normalizeLearningCloudState,
  type LearningCloudState,
} from '@/lib/learningCloudSync';
import {
  areLearningCloudSyncCursorsEqual,
  cacheLearningCloudSyncBaseline,
  getCachedLearningCloudSyncBaseline,
} from '@/lib/learningCloudSyncBaseline';
import { isManualLearningCloudSyncActive } from '@/lib/learningCloudSyncActivity';
import { hasPendingLearningCloudChanges } from '@/lib/learningCloudPendingChanges';
import { withTimeout } from '@/lib/promiseTimeout';
import {
  clearWindowTimer,
  getLearningCloudLocalSyncState,
  getLearningCloudRuntimeErrorMessage,
  getLearningCloudSyncApi,
  getPersistedLearningOwner,
  getRemoteMutationCursor,
  preparePersistedLearningAccountSwitch,
  readLearningCloudStateFromStore,
  setLearningCloudSyncApiForTest,
  setPersistedLearningOwner,
  writeLearningCloudStateToStore,
  type LearningCloudSyncApi,
} from '@/modules/learning/sync/learningCloudRuntimeBridge';
import { useLearningCloudLocalSave } from '@/modules/learning/sync/useLearningCloudLocalSave';
import { useLearningCloudSaveRetry } from '@/modules/learning/sync/useLearningCloudSaveRetry';
import type { LearningCloudSyncCursor } from '@/services/firebaseLearningSyncService';
import { useAuthStore } from '@/store/useAuthStore';
import { useLearningStore } from '@/store/useLearningStore';

const LOCAL_SAVE_DEBOUNCE_MS = 1200;
const LEARNING_CLOUD_OPERATION_TIMEOUT_MS = 12_000;
const LEARNING_CLOUD_BOOTSTRAP_SAVE_TIMEOUT_MS = 90_000;
const LEARNING_CLOUD_INIT_RETRY_MS = 3_000;

export function __setLearningCloudSyncApiForTest(overrides: Partial<LearningCloudSyncApi> | null) {
  setLearningCloudSyncApiForTest(overrides);
}

export function useLearningStoreRehydration(enabled = true) {
  const rehydratedRef = useRef(false);

  useEffect(() => {
    if (!enabled || rehydratedRef.current) {
      return;
    }

    rehydratedRef.current = true;
    Promise.resolve(useLearningStore.persist.rehydrate()).catch((error) => {
      rehydratedRef.current = false;
      console.warn('Learning store rehydration failed:', error);
    });
  }, [enabled]);
}

export function useLearningCloudSync(enabled = true) {
  const firebaseConfigured = isFirebaseConfigured();
  const firebaseWritesEnabled = isFirebaseWriteEnabled();
  const authReady = useAuthStore((state) => state.authReady);
  const authStatus = useAuthStore((state) => state.status);
  const authUserId = useAuthStore((state) => state.user?.uid);
  const setLearningSyncRuntime = useCloudSyncRuntimeStore((state) => state.setLearning);
  const resetLearningSyncRuntime = useCloudSyncRuntimeStore((state) => state.resetLearning);
  const syncedLearningState = useLearningStore(
    useShallow((state) => ({
      activeDeckId: state.activeDeckId,
      activeDeckUpdatedAt: state.activeDeckUpdatedAt,
      decks: state.decks,
      notes: state.notes,
      cards: state.cards,
      reviewLogs: state.reviewLogs,
      presets: state.presets,
      assignments: state.assignments,
      gateRule: state.gateRule,
      gateRuleUpdatedAt: state.gateRuleUpdatedAt,
      cardBrowser: state.cardBrowser,
      savedCardQueries: state.savedCardQueries,
      filteredDeckLiteDefinition: state.filteredDeckLiteDefinition,
      filteredDeckLiteDefinitions: state.filteredDeckLiteDefinitions,
      filteredDeckLiteRuns: state.filteredDeckLiteRuns,
    })),
  );

  const applyingRemoteStateRef = useRef(false);
  const deviceIdRef = useRef<string | null>(null);
  const activeUserIdRef = useRef<string | null>(null);
  const lastSyncedStateRef = useRef<LearningCloudState | null>(null);
  const remoteSubscriptionRef = useRef<(() => void) | null>(null);
  const pendingSaveTimerRef = useRef<number | null>(null);
  const retryInitTimerRef = useRef<number | null>(null);
  const remoteMutationCursorRef = useRef<LearningCloudSyncCursor | null>(null);
  const remoteLoadCursorRef = useRef<string | null>(null);
  const syncReadyRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      syncReadyRef.current = false;
      resetLearningSyncRuntime();
      return;
    }

    if (!firebaseConfigured || authStatus === 'disabled') {
      syncReadyRef.current = false;
      setLearningSyncRuntime({
        status: 'blocked-firebase-missing',
        currentError: null,
      });
      return;
    }

    if (!firebaseWritesEnabled) {
      syncReadyRef.current = false;
      setLearningSyncRuntime({
        status: 'blocked-writes-disabled',
        currentError: null,
      });
      return;
    }

    if (!authReady) {
      syncReadyRef.current = false;
      setLearningSyncRuntime({
        status: 'idle',
        currentError: null,
      });
      return;
    }

    let cancelled = false;
    clearWindowTimer(pendingSaveTimerRef.current);
    pendingSaveTimerRef.current = null;
    clearWindowTimer(retryInitTimerRef.current);
    retryInitTimerRef.current = null;
    remoteSubscriptionRef.current?.();
    remoteSubscriptionRef.current = null;
    syncReadyRef.current = false;
    remoteMutationCursorRef.current = null;
    remoteLoadCursorRef.current = null;

    if (!authUserId) {
      activeUserIdRef.current = null;
      lastSyncedStateRef.current = null;
      setLearningSyncRuntime({
        status: 'blocked-signed-out',
        currentError: null,
      });
      return;
    }

    activeUserIdRef.current = authUserId;
    setLearningSyncRuntime({
      status: 'starting',
      currentError: null,
    });

    const startSync = async () => {
      try {
        if (isManualLearningCloudSyncActive()) {
          syncReadyRef.current = false;
          setLearningSyncRuntime({
            status: 'idle',
            currentError: null,
          });
          return;
        }

        const learningCloudSyncApi = await getLearningCloudSyncApi();
        deviceIdRef.current = learningCloudSyncApi.getLearningSyncDeviceId();

        const persistedOwner = getPersistedLearningOwner();
        let accountSwitchLocalState: LearningCloudState | null | undefined;
        if (persistedOwner && persistedOwner !== authUserId) {
          accountSwitchLocalState = await preparePersistedLearningAccountSwitch(persistedOwner, authUserId);
        }

        await withTimeout(
          Promise.resolve(useLearningStore.persist.rehydrate()),
          LEARNING_CLOUD_OPERATION_TIMEOUT_MS,
          'learning store rehydrate',
        );
        if (cancelled || activeUserIdRef.current !== authUserId) {
          return;
        }

        const localState = accountSwitchLocalState !== undefined
          ? accountSwitchLocalState
          : readLearningCloudStateFromStore();
        const localSyncState = getLearningCloudLocalSyncState();
        const remoteCursor = await withTimeout(
          learningCloudSyncApi.loadLearningCloudSyncCursor(authUserId),
          LEARNING_CLOUD_OPERATION_TIMEOUT_MS,
          'learning cloud cursor load',
        );
        if (cancelled || activeUserIdRef.current !== authUserId) {
          return;
        }

        const cachedBaseline = getCachedLearningCloudSyncBaseline(authUserId);
        const canReuseCachedRemoteState = Boolean(
          cachedBaseline && areLearningCloudSyncCursorsEqual(cachedBaseline.cursor, remoteCursor),
        );
        const localRemoteCursor = localSyncState.lastRemoteCursor || null;
        const hasLocalPendingChanges = hasPendingLearningCloudChanges(localState, localSyncState);
        let effectiveRemoteCursor = remoteCursor;
        let remoteState: LearningCloudState | null = null;

        if (canReuseCachedRemoteState) {
          remoteState = cachedBaseline?.state || null;
        } else if (localRemoteCursor && areLearningCloudSyncCursorsEqual(localRemoteCursor, remoteCursor)) {
          remoteState = hasLocalPendingChanges ? null : localState;
        } else if (localRemoteCursor) {
          const pulled = await withTimeout(
            learningCloudSyncApi.pullLearningCloudMutations(authUserId, localRemoteCursor),
            LEARNING_CLOUD_OPERATION_TIMEOUT_MS,
            'learning cloud mutation pull',
          );
          effectiveRemoteCursor = pulled.cursor || remoteCursor;
          remoteState = pulled.mutations.length > 0
            ? learningCloudSyncApi.applyLearningCloudMutations(localState, pulled.mutations)
            : await withTimeout(
                learningCloudSyncApi.loadLearningCloudState(authUserId),
                LEARNING_CLOUD_OPERATION_TIMEOUT_MS,
                'learning cloud state load',
              );
        } else {
          remoteState = await withTimeout(
            learningCloudSyncApi.loadLearningCloudState(authUserId),
            LEARNING_CLOUD_OPERATION_TIMEOUT_MS,
            'learning cloud state load',
          );
        }
        if (cancelled || activeUserIdRef.current !== authUserId) {
          return;
        }

        const mergedState = mergeLearningCloudStates(localState, remoteState);
        const currentStoreState = readLearningCloudStateFromStore();
        remoteMutationCursorRef.current = effectiveRemoteCursor;
        setPersistedLearningOwner(authUserId);

        if (getLearningCloudStateSignature(mergedState) !== getLearningCloudStateSignature(currentStoreState)) {
          applyingRemoteStateRef.current = true;
          writeLearningCloudStateToStore(mergedState);
          applyingRemoteStateRef.current = false;
        }

        const remoteSignature = getLearningCloudStateSignature(remoteState);
        const mergedSignature = getLearningCloudStateSignature(mergedState);
        let savedMeta: LearningCloudMeta | null = null;

        if (mergedSignature !== remoteSignature && (remoteState || !isLearningCloudStateEmpty(mergedState))) {
          savedMeta = await withTimeout(
            learningCloudSyncApi.saveLearningCloudState(
              authUserId,
              mergedState,
              remoteState,
              deviceIdRef.current || learningCloudSyncApi.getLearningSyncDeviceId(),
              {
                localSyncState: getLearningCloudLocalSyncState(),
              },
            ),
            LEARNING_CLOUD_BOOTSTRAP_SAVE_TIMEOUT_MS,
            remoteState ? 'learning cloud merge save' : 'learning cloud bootstrap save',
          );
        }

        if (cancelled || activeUserIdRef.current !== authUserId) {
          return;
        }

        if (savedMeta) {
          remoteMutationCursorRef.current = getRemoteMutationCursor(savedMeta) || remoteMutationCursorRef.current;
          cacheLearningCloudSyncBaseline(authUserId, mergedState, remoteMutationCursorRef.current);
          lastSyncedStateRef.current = mergedState;
          useLearningStore.getState().markLearningCloudSyncCompleted(
            savedMeta?.lastMutationAt || Date.now(),
            remoteMutationCursorRef.current,
            getLearningCloudStateSignature(mergedState),
          );
          setLearningSyncRuntime({
            status: 'ready',
            currentError: null,
            lastSuccessfulSyncAt: savedMeta?.lastMutationAt || Date.now(),
          });
        } else {
          lastSyncedStateRef.current = mergedState;
          cacheLearningCloudSyncBaseline(authUserId, mergedState, effectiveRemoteCursor);
          useLearningStore.getState().markLearningCloudSyncCompleted(
            effectiveRemoteCursor?.mutationAt || Date.now(),
            effectiveRemoteCursor,
            getLearningCloudStateSignature(mergedState),
          );
          setLearningSyncRuntime({
            status: 'ready',
            currentError: null,
            lastSuccessfulSyncAt: effectiveRemoteCursor?.mutationAt || Date.now(),
          });
        }

        remoteSubscriptionRef.current = learningCloudSyncApi.subscribeToLearningCloudMetadata(
          authUserId,
          async (meta) => {
            const remoteMutationCursor = getRemoteMutationCursor(meta);
            const knownMutationCursorId = remoteMutationCursorRef.current?.mutationId || null;
            if (
              !meta
              || meta.updatedByDeviceId === deviceIdRef.current
              || activeUserIdRef.current !== authUserId
              || (remoteMutationCursor
                && remoteMutationCursor.mutationId === knownMutationCursorId
                && remoteLoadCursorRef.current !== remoteMutationCursor.mutationId)
            ) {
              return;
            }

            try {
              const currentLocalState = readLearningCloudStateFromStore();

              if (remoteMutationCursor) {
                remoteLoadCursorRef.current = remoteMutationCursor.mutationId;
                const pulled = await withTimeout(
                  learningCloudSyncApi.pullLearningCloudMutations(
                    authUserId,
                    remoteMutationCursorRef.current,
                  ),
                  LEARNING_CLOUD_OPERATION_TIMEOUT_MS,
                  'learning cloud mutation pull',
                );

                if (activeUserIdRef.current !== authUserId) {
                  if (remoteLoadCursorRef.current === remoteMutationCursor.mutationId) {
                    remoteLoadCursorRef.current = null;
                  }
                  return;
                }

                if (pulled.mutations.length > 0) {
                  const mergedRemoteState = learningCloudSyncApi.applyLearningCloudMutations(
                    currentLocalState,
                    pulled.mutations,
                  );
                  lastSyncedStateRef.current = mergedRemoteState;
                  remoteMutationCursorRef.current = pulled.cursor || remoteMutationCursor;
                  cacheLearningCloudSyncBaseline(authUserId, mergedRemoteState, remoteMutationCursorRef.current);
                  remoteLoadCursorRef.current = null;

                  if (
                    getLearningCloudStateSignature(mergedRemoteState)
                    === getLearningCloudStateSignature(currentLocalState)
                  ) {
                    return;
                  }

                  applyingRemoteStateRef.current = true;
                  writeLearningCloudStateToStore(mergedRemoteState);
                  applyingRemoteStateRef.current = false;
                  setLearningSyncRuntime({
                    status: 'ready',
                    currentError: null,
                    lastSuccessfulSyncAt: remoteMutationCursorRef.current?.mutationAt || Date.now(),
                  });
                  return;
                }
              }

              const latestRemoteState = await withTimeout(
                learningCloudSyncApi.loadLearningCloudState(authUserId),
                LEARNING_CLOUD_OPERATION_TIMEOUT_MS,
                'learning cloud snapshot reload',
              );
              if (!latestRemoteState || activeUserIdRef.current !== authUserId) {
                if (remoteMutationCursor && remoteLoadCursorRef.current === remoteMutationCursor.mutationId) {
                  remoteLoadCursorRef.current = null;
                }
                return;
              }

              const mergedRemoteState = mergeLearningCloudStates(currentLocalState, latestRemoteState);
              lastSyncedStateRef.current = mergedRemoteState;
              remoteMutationCursorRef.current = remoteMutationCursor || remoteMutationCursorRef.current;
              cacheLearningCloudSyncBaseline(authUserId, mergedRemoteState, remoteMutationCursorRef.current);
              remoteLoadCursorRef.current = null;

              if (
                getLearningCloudStateSignature(mergedRemoteState)
                === getLearningCloudStateSignature(currentLocalState)
              ) {
                return;
              }

              applyingRemoteStateRef.current = true;
              writeLearningCloudStateToStore(mergedRemoteState);
              applyingRemoteStateRef.current = false;
              setLearningSyncRuntime({
                status: 'ready',
                currentError: null,
                lastSuccessfulSyncAt: remoteMutationCursor?.mutationAt || Date.now(),
              });
            } catch (error) {
              if (remoteMutationCursor && remoteLoadCursorRef.current === remoteMutationCursor.mutationId) {
                remoteLoadCursorRef.current = null;
              }
              setLearningSyncRuntime({
                status: 'error',
                currentError: getLearningCloudRuntimeErrorMessage(error),
              });
              console.warn('Learning cloud sync update failed:', error);
            }
          },
          (error) => {
            setLearningSyncRuntime({
              status: 'error',
              currentError: getLearningCloudRuntimeErrorMessage(error),
            });
            console.warn('Learning cloud sync listener failed:', error);
          },
        );
        syncReadyRef.current = true;
      } catch (error) {
        syncReadyRef.current = false;
        setLearningSyncRuntime({
          status: 'error',
          currentError: getLearningCloudRuntimeErrorMessage(error),
        });
        console.warn('Learning cloud sync initialization failed:', error);
        if (!cancelled && activeUserIdRef.current === authUserId && !isManualLearningCloudSyncActive()) {
          clearWindowTimer(retryInitTimerRef.current);
          retryInitTimerRef.current = window.setTimeout(() => {
            retryInitTimerRef.current = null;
            if (!cancelled && activeUserIdRef.current === authUserId && !isManualLearningCloudSyncActive()) {
              void startSync();
            }
          }, LEARNING_CLOUD_INIT_RETRY_MS);
        }
      }
    };

    void startSync();

    return () => {
      cancelled = true;
      clearWindowTimer(pendingSaveTimerRef.current);
      pendingSaveTimerRef.current = null;
      clearWindowTimer(retryInitTimerRef.current);
      retryInitTimerRef.current = null;
      remoteSubscriptionRef.current?.();
      remoteSubscriptionRef.current = null;
      syncReadyRef.current = false;
      remoteMutationCursorRef.current = null;
      remoteLoadCursorRef.current = null;
    };
  }, [
    authReady,
    authStatus,
    authUserId,
    enabled,
    firebaseConfigured,
    firebaseWritesEnabled,
    resetLearningSyncRuntime,
    setLearningSyncRuntime,
  ]);

  useLearningCloudLocalSave({
    activeUserIdRef,
    applyingRemoteStateRef,
    authReady,
    authStatus,
    authUserId,
    deviceIdRef,
    enabled,
    firebaseWritesEnabled,
    lastSyncedStateRef,
    operationTimeoutMs: LEARNING_CLOUD_OPERATION_TIMEOUT_MS,
    pendingSaveTimerRef,
    remoteMutationCursorRef,
    saveDebounceMs: LOCAL_SAVE_DEBOUNCE_MS,
    setLearningSyncRuntime,
    syncReadyRef,
    syncedLearningState,
  });

  useLearningCloudSaveRetry(enabled && firebaseWritesEnabled);
}
