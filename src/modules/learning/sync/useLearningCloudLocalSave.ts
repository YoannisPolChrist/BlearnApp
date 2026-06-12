import { useEffect, type MutableRefObject } from 'react';
import { useCloudSyncRuntimeStore } from '@/lib/cloudSyncRuntime';
import {
  getLearningCloudStateSignature,
  normalizeLearningCloudState,
  type LearningCloudState,
} from '@/lib/learningCloudSync';
import { cacheLearningCloudSyncBaseline } from '@/lib/learningCloudSyncBaseline';
import { isManualLearningCloudSyncActive } from '@/lib/learningCloudSyncActivity';
import { setLearningCloudImmediateSaveHandler } from '@/lib/learningCloudImmediateSave';
import { withTimeout } from '@/lib/promiseTimeout';
import type { LearningCloudSyncCursor } from '@/services/firebaseLearningSyncService';
import { useLearningStore } from '@/store/useLearningStore';
import {
  clearWindowTimer,
  getLearningCloudLocalSyncState,
  getLearningCloudRuntimeErrorMessage,
  getLearningCloudSyncApi,
  getRemoteMutationCursor,
  readLearningCloudStateFromStore,
} from './learningCloudRuntimeBridge';

export function useLearningCloudLocalSave({
  activeUserIdRef,
  applyingRemoteStateRef,
  authReady,
  authStatus,
  authUserId,
  deviceIdRef,
  enabled,
  firebaseWritesEnabled,
  lastSyncedStateRef,
  operationTimeoutMs,
  pendingSaveTimerRef,
  remoteMutationCursorRef,
  saveDebounceMs,
  setLearningSyncRuntime,
  syncReadyRef,
  syncedLearningState,
}: {
  activeUserIdRef: MutableRefObject<string | null>;
  applyingRemoteStateRef: MutableRefObject<boolean>;
  authReady: boolean;
  authStatus: string;
  authUserId?: string;
  deviceIdRef: MutableRefObject<string | null>;
  enabled: boolean;
  firebaseWritesEnabled: boolean;
  lastSyncedStateRef: MutableRefObject<LearningCloudState | null>;
  operationTimeoutMs: number;
  pendingSaveTimerRef: MutableRefObject<number | null>;
  remoteMutationCursorRef: MutableRefObject<LearningCloudSyncCursor | null>;
  saveDebounceMs: number;
  setLearningSyncRuntime: ReturnType<typeof useCloudSyncRuntimeStore.getState>['setLearning'];
  syncReadyRef: MutableRefObject<boolean>;
  syncedLearningState: {
    activeDeckId?: string;
    activeDeckUpdatedAt?: number;
    decks: Record<string, unknown>;
    notes: Record<string, unknown>;
    cards: Record<string, unknown>;
    reviewLogs: Record<string, unknown>;
    presets: Record<string, unknown>;
    assignments: unknown[];
    gateRule: unknown;
    gateRuleUpdatedAt?: number;
    cardBrowser: unknown;
    savedCardQueries: unknown[];
    filteredDeckLiteDefinition: unknown;
    filteredDeckLiteDefinitions: unknown[];
    filteredDeckLiteRuns: unknown[];
  };
}) {
  useEffect(() => {
    return setLearningCloudImmediateSaveHandler(async () => {
      if (
        !enabled
        || !firebaseWritesEnabled
        || !authReady
        || authStatus === 'disabled'
        || !authUserId
        || !syncReadyRef.current
        || applyingRemoteStateRef.current
        || isManualLearningCloudSyncActive()
      ) {
        return false;
      }

      if (activeUserIdRef.current !== authUserId) {
        return false;
      }

      const nextState = readLearningCloudStateFromStore();
      const nextSignature = getLearningCloudStateSignature(nextState);
      const previousSignature = getLearningCloudStateSignature(lastSyncedStateRef.current);

      if (nextSignature === previousSignature) {
        return true;
      }

      clearWindowTimer(pendingSaveTimerRef.current);
      pendingSaveTimerRef.current = null;

      try {
        const learningCloudSyncApi = await getLearningCloudSyncApi();
        const savedMeta = await withTimeout(
          learningCloudSyncApi.saveLearningCloudState(
            authUserId,
            nextState,
            lastSyncedStateRef.current,
            deviceIdRef.current || learningCloudSyncApi.getLearningSyncDeviceId(),
            {
              localSyncState: getLearningCloudLocalSyncState(),
            },
          ),
          operationTimeoutMs,
          'learning cloud immediate save',
        );
        remoteMutationCursorRef.current = getRemoteMutationCursor(savedMeta) || remoteMutationCursorRef.current;
        lastSyncedStateRef.current = nextState;
        cacheLearningCloudSyncBaseline(authUserId, nextState, remoteMutationCursorRef.current);
        useLearningStore.getState().markLearningCloudSyncCompleted(
          savedMeta?.lastMutationAt || Date.now(),
          remoteMutationCursorRef.current,
          getLearningCloudStateSignature(nextState),
        );
        setLearningSyncRuntime({
          status: 'ready',
          currentError: null,
          lastSuccessfulSyncAt: savedMeta?.lastMutationAt || Date.now(),
        });
        return true;
      } catch (error) {
        setLearningSyncRuntime({
          status: 'error',
          currentError: getLearningCloudRuntimeErrorMessage(error),
        });
        console.warn('Immediate learning cloud sync save failed:', error);
        return false;
      }
    });
  }, [
    activeUserIdRef,
    applyingRemoteStateRef,
    authReady,
    authStatus,
    authUserId,
    deviceIdRef,
    enabled,
    firebaseWritesEnabled,
    lastSyncedStateRef,
    operationTimeoutMs,
    pendingSaveTimerRef,
    remoteMutationCursorRef,
    setLearningSyncRuntime,
    syncReadyRef,
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
      || isManualLearningCloudSyncActive()
    ) {
      return;
    }

    const nextState = normalizeLearningCloudState({
      ...syncedLearningState,
      decks: Object.values(syncedLearningState.decks),
      notes: Object.values(syncedLearningState.notes),
      cards: Object.values(syncedLearningState.cards),
      reviewLogs: Object.values(syncedLearningState.reviewLogs),
      presets: Object.values(syncedLearningState.presets),
      assignments: syncedLearningState.assignments,
      gateRule: syncedLearningState.gateRule,
      gateRuleUpdatedAt: syncedLearningState.gateRuleUpdatedAt,
    } as Partial<LearningCloudState>);
    const nextSignature = getLearningCloudStateSignature(nextState);
    const previousSignature = getLearningCloudStateSignature(lastSyncedStateRef.current);

    if (nextSignature === previousSignature) {
      return;
    }

    clearWindowTimer(pendingSaveTimerRef.current);
    pendingSaveTimerRef.current = window.setTimeout(() => {
      void (async () => {
        if (
          !authUserId
          || activeUserIdRef.current !== authUserId
          || isManualLearningCloudSyncActive()
        ) {
          return;
        }

        try {
          const learningCloudSyncApi = await getLearningCloudSyncApi();
          const savedMeta = await withTimeout(
            learningCloudSyncApi.saveLearningCloudState(
              authUserId,
              nextState,
              lastSyncedStateRef.current,
              deviceIdRef.current || learningCloudSyncApi.getLearningSyncDeviceId(),
              {
                localSyncState: getLearningCloudLocalSyncState(),
              },
            ),
            operationTimeoutMs,
            'learning cloud save',
          );
          remoteMutationCursorRef.current = getRemoteMutationCursor(savedMeta) || remoteMutationCursorRef.current;
          lastSyncedStateRef.current = nextState;
          cacheLearningCloudSyncBaseline(authUserId, nextState, remoteMutationCursorRef.current);
          useLearningStore.getState().markLearningCloudSyncCompleted(
            savedMeta?.lastMutationAt || Date.now(),
            remoteMutationCursorRef.current,
            getLearningCloudStateSignature(nextState),
          );
          setLearningSyncRuntime({
            status: 'ready',
            currentError: null,
            lastSuccessfulSyncAt: savedMeta?.lastMutationAt || Date.now(),
          });
        } catch (error) {
          setLearningSyncRuntime({
            status: 'error',
            currentError: getLearningCloudRuntimeErrorMessage(error),
          });
          console.warn('Learning cloud sync save failed:', error);
        }
      })();
    }, saveDebounceMs);

    return () => {
      clearWindowTimer(pendingSaveTimerRef.current);
      pendingSaveTimerRef.current = null;
    };
  }, [
    activeUserIdRef,
    applyingRemoteStateRef,
    authReady,
    authStatus,
    authUserId,
    deviceIdRef,
    enabled,
    firebaseWritesEnabled,
    lastSyncedStateRef,
    operationTimeoutMs,
    pendingSaveTimerRef,
    remoteMutationCursorRef,
    saveDebounceMs,
    setLearningSyncRuntime,
    syncReadyRef,
    syncedLearningState,
  ]);
}
