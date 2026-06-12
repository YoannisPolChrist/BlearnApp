import { useEffect, useRef } from 'react';
import { shallow } from 'zustand/shallow';
import {
  processLearningMediaRuntime,
  processLearningSyncRuntime,
} from '@/services/learningBackgroundService';
import {
  getLearningCloudStateSignature,
  type LearningCloudState,
} from '@/lib/learningCloudSync';
import { isManualLearningCloudSyncActive } from '@/lib/learningCloudSyncActivity';
import { getMediaRegistrySignature } from '@/modules/learning/media/mediaRegistry';
import { getMediaTransferQueueSignature } from '@/modules/learning/media/mediaTransferQueue';
import {
  normalizeLearningSyncWorkerQueue,
  type LearningSyncWorkerQueue,
} from '@/modules/learning/workers/learningSyncWorker';
import { createIndexedRecordView } from '@/modules/learning/store/helpers';
import { useAuthStore } from '@/store/useAuthStore';
import { useLearningStore } from '@/store/useLearningStore';

const MEDIA_PULSE_DELAY_MS = 250;
const SYNC_PULSE_DELAY_MS = 250;
const SYNC_MIN_INTERVAL_MS = 15_000;
let learningCloudSyncModulePromise: Promise<typeof import('@/services/firebaseLearningSyncService')> | null = null;

function updateQueueSignatureHash(hash: number, value: string | number | null | undefined) {
  const nextValue = value == null ? '' : String(value);
  let nextHash = hash;

  for (let index = 0; index < nextValue.length; index += 1) {
    nextHash ^= nextValue.charCodeAt(index);
    nextHash = Math.imul(nextHash, 16777619);
  }

  return nextHash >>> 0;
}

async function loadLearningCloudState(userId: string) {
  if (!learningCloudSyncModulePromise) {
    learningCloudSyncModulePromise = import('@/services/firebaseLearningSyncService');
  }

  const learningCloudSyncModule = await learningCloudSyncModulePromise;
  return learningCloudSyncModule.loadLearningCloudState(userId);
}

function readLearningCloudStateFromStore() {
  const state = useLearningStore.getState();
  return {
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
  } satisfies LearningCloudState;
}

function writeLearningCloudStateToStore(nextState: LearningCloudState) {
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

export function getLearningSyncWorkerQueueSignature(queue: LearningSyncWorkerQueue | null | undefined) {
  const normalizedQueue = normalizeLearningSyncWorkerQueue(queue);
  let hash = 2166136261;

  for (const job of normalizedQueue.jobs) {
    hash = updateQueueSignatureHash(hash, job.id);
    hash = updateQueueSignatureHash(hash, job.status);
    hash = updateQueueSignatureHash(hash, job.attempts);
    hash = updateQueueSignatureHash(hash, job.maxAttempts);
    hash = updateQueueSignatureHash(hash, job.nextAttemptAt);
    hash = updateQueueSignatureHash(hash, job.createdAt);
    hash = updateQueueSignatureHash(hash, job.updatedAt);
    hash = updateQueueSignatureHash(hash, job.lastAttemptAt);
    hash = updateQueueSignatureHash(hash, job.lastError);
    hash = updateQueueSignatureHash(hash, job.localSignature);
    hash = updateQueueSignatureHash(hash, job.remoteSignature);
  }

  return [
    `v${normalizedQueue.version}`,
    `u${normalizedQueue.updatedAt}`,
    `n${normalizedQueue.jobs.length}`,
    `h${hash.toString(36)}`,
  ].join('|');
}

type UseLearningBackgroundRuntimeOptions = {
  syncEnabled?: boolean;
};

export function useLearningBackgroundRuntime(
  enabled = true,
  options: UseLearningBackgroundRuntimeOptions = {},
) {
  const syncEnabled = options.syncEnabled ?? true;
  const authReady = useAuthStore((state) => state.authReady);
  const authStatus = useAuthStore((state) => state.status);
  const authUserId = useAuthStore((state) => state.user?.uid);
  const mediaTimerRef = useRef<number | null>(null);
  const syncTimerRef = useRef<number | null>(null);
  const mediaBusyRef = useRef(false);
  const syncBusyRef = useRef(false);
  const mediaPendingRef = useRef(false);
  const syncPendingRef = useRef(false);
  const syncPendingForceRef = useRef(false);
  const syncDirtyRef = useRef(false);
  const syncDirtyVersionRef = useRef(0);
  const syncApplyingRemoteStateRef = useRef(false);
  const syncTimerDueAtRef = useRef<number | null>(null);
  const syncTimerForceRef = useRef(false);
  const lastSyncRunAtRef = useRef(0);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    const clearMediaTimer = () => {
      if (mediaTimerRef.current !== null) {
        window.clearTimeout(mediaTimerRef.current);
        mediaTimerRef.current = null;
      }
    };

    const scheduleMediaPulse = (delay = MEDIA_PULSE_DELAY_MS) => {
      clearMediaTimer();
      mediaTimerRef.current = window.setTimeout(() => {
        void runMediaPulse();
      }, delay);
    };

    const runMediaPulse = async () => {
      if (mediaBusyRef.current) {
        mediaPendingRef.current = true;
        return;
      }

      mediaBusyRef.current = true;
      try {
        const state = useLearningStore.getState();
        const result = await processLearningMediaRuntime(
          {
            notes: state.notes,
            mediaRegistry: state.mediaRegistry,
            mediaTransferQueue: state.mediaTransferQueue,
          },
          Date.now(),
        );

        const nextRegistrySignature = getMediaRegistrySignature(result.registry);
        const nextQueueSignature = getMediaTransferQueueSignature(result.queue);
        const currentRegistrySignature = getMediaRegistrySignature(state.mediaRegistry);
        const currentQueueSignature = getMediaTransferQueueSignature(state.mediaTransferQueue);

        if (
          nextRegistrySignature !== currentRegistrySignature
          || nextQueueSignature !== currentQueueSignature
        ) {
          useLearningStore.setState({
            mediaRegistry: result.registry,
            mediaTransferQueue: result.queue,
          });
        }
      } catch (error) {
        console.warn('Learning background media runtime failed:', error);
      } finally {
        mediaBusyRef.current = false;
        if (mediaPendingRef.current) {
          mediaPendingRef.current = false;
          scheduleMediaPulse(0);
        }
      }
    };

    const unsubscribe = useLearningStore.subscribe(
      (state) => [state.notes, state.mediaRegistry, state.mediaTransferQueue] as const,
      () => {
        scheduleMediaPulse();
      },
      { equalityFn: shallow },
    );

    scheduleMediaPulse(0);

    return () => {
      unsubscribe();
      clearMediaTimer();
      mediaPendingRef.current = false;
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !syncEnabled) {
      return undefined;
    }

    const clearSyncTimer = () => {
      if (syncTimerRef.current !== null) {
        window.clearTimeout(syncTimerRef.current);
        syncTimerRef.current = null;
      }
      syncTimerDueAtRef.current = null;
      syncTimerForceRef.current = false;
    };

    const getQueuedSyncDelay = (nextRunAt?: number) => {
      if (!Number.isFinite(nextRunAt)) {
        return null;
      }

      return Math.max(0, Math.round((nextRunAt as number) - Date.now()));
    };

    const getSyncPulseDelay = (delay = SYNC_PULSE_DELAY_MS, force = false) => {
      const requestedDelay = Math.max(0, Math.round(delay));
      if (force || lastSyncRunAtRef.current === 0) {
        return requestedDelay;
      }

      const throttleDelay = Math.max(0, SYNC_MIN_INTERVAL_MS - (Date.now() - lastSyncRunAtRef.current));
      return Math.max(requestedDelay, throttleDelay);
    };

    const scheduleSyncPulse = (delay = SYNC_PULSE_DELAY_MS, force = false) => {
      if (isManualLearningCloudSyncActive()) {
        return;
      }

      const nextDelay = getSyncPulseDelay(delay, force);
      const dueAt = Date.now() + nextDelay;

      if (syncTimerRef.current !== null) {
        const scheduledDueAt = syncTimerDueAtRef.current ?? dueAt;
        const scheduledForce = syncTimerForceRef.current;

        if ((scheduledForce || !force) && scheduledDueAt <= dueAt) {
          return;
        }

        clearSyncTimer();
      }

      syncTimerDueAtRef.current = dueAt;
      syncTimerForceRef.current = force;
      syncTimerRef.current = window.setTimeout(() => {
        const nextForce = syncTimerForceRef.current;
        syncTimerRef.current = null;
        syncTimerDueAtRef.current = null;
        syncTimerForceRef.current = false;
        void runSyncPulse(nextForce);
      }, nextDelay);
    };

    const runSyncPulse = async (force = false) => {
      if (syncBusyRef.current) {
        syncPendingRef.current = true;
        syncPendingForceRef.current = syncPendingForceRef.current || force;
        return;
      }

      if (isManualLearningCloudSyncActive()) {
        return;
      }

      if (
        authStatus === 'disabled'
        || !authReady
        || !authUserId
        || typeof navigator !== 'undefined'
        && navigator.onLine === false
      ) {
        return;
      }

      const now = Date.now();
      if (!force && now - lastSyncRunAtRef.current < SYNC_MIN_INTERVAL_MS) {
        scheduleSyncPulse(SYNC_MIN_INTERVAL_MS - (now - lastSyncRunAtRef.current));
        return;
      }

      syncBusyRef.current = true;
      lastSyncRunAtRef.current = now;
      let queuedRetryDelay: number | null = null;
      const runDirtyVersion = syncDirtyVersionRef.current;
      let schedulePendingPulse = false;
      let pendingForce = false;

      try {
        const state = useLearningStore.getState();
        const remoteState = await loadLearningCloudState(authUserId);
        const runtimeState = {
          ...readLearningCloudStateFromStore(),
          mediaRegistry: state.mediaRegistry,
          mediaTransferQueue: state.mediaTransferQueue,
          learningSyncWorkerQueue: state.learningSyncWorkerQueue,
        };
        const result = await processLearningSyncRuntime(
          runtimeState,
          remoteState,
          now,
          { forceRun: true },
        );

        const currentStoreSignature = getLearningCloudStateSignature(readLearningCloudStateFromStore());
        if (result.mergedSignature !== currentStoreSignature) {
          syncApplyingRemoteStateRef.current = true;
          try {
            writeLearningCloudStateToStore(result.mergedState);
          } finally {
            syncApplyingRemoteStateRef.current = false;
          }
        }

        const nextQueueSignature = getLearningSyncWorkerQueueSignature(result.queue);
        const currentQueueSignature = getLearningSyncWorkerQueueSignature(state.learningSyncWorkerQueue);
        if (nextQueueSignature !== currentQueueSignature) {
          useLearningStore.setState({
            learningSyncWorkerQueue: result.queue,
          });
        }
        if (syncDirtyVersionRef.current === runDirtyVersion) {
          syncDirtyRef.current = false;
        }
        queuedRetryDelay = getQueuedSyncDelay(result.nextRunAt);
      } catch (error) {
        console.warn('Learning background sync runtime failed:', error);
      } finally {
        syncBusyRef.current = false;
        if (syncPendingRef.current) {
          pendingForce = syncPendingForceRef.current;
          syncPendingRef.current = false;
          syncPendingForceRef.current = false;
          schedulePendingPulse = true;
        }
      }

      if (schedulePendingPulse) {
        scheduleSyncPulse(pendingForce ? 0 : SYNC_PULSE_DELAY_MS, pendingForce);
        return;
      }

      if (queuedRetryDelay !== null) {
        scheduleSyncPulse(queuedRetryDelay);
      }
    };

    const handleFocus = () => {
      scheduleSyncPulse(0, true);
    };

    const handleOnline = () => {
      scheduleSyncPulse(0, true);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        scheduleSyncPulse(0, true);
      }
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    const unsubscribeCloudState = useLearningStore.subscribe(
      (state) => [
        state.activeDeckId,
        state.activeDeckUpdatedAt,
        state.decks,
        state.notes,
        state.cards,
        state.reviewLogs,
        state.presets,
        state.cardBrowser,
        state.savedCardQueries,
        state.filteredDeckLiteDefinition,
        state.filteredDeckLiteDefinitions,
        state.filteredDeckLiteRuns,
      ] as const,
      () => {
        if (syncApplyingRemoteStateRef.current) {
          return;
        }

        syncDirtyRef.current = true;
        syncDirtyVersionRef.current += 1;
        scheduleSyncPulse();
      },
      { equalityFn: shallow },
    );
    const unsubscribeQueue = useLearningStore.subscribe(
      (state) => getLearningSyncWorkerQueueSignature(state.learningSyncWorkerQueue),
      () => {
        const queue = normalizeLearningSyncWorkerQueue(useLearningStore.getState().learningSyncWorkerQueue);
        const nextRunAt = queue.jobs.find((job) => job.status === 'queued')?.nextAttemptAt;
        const nextDelay = getQueuedSyncDelay(nextRunAt);
        if (nextDelay !== null) {
          scheduleSyncPulse(nextDelay);
        }
      },
    );

    scheduleSyncPulse(0, true);

    return () => {
      unsubscribeCloudState();
      unsubscribeQueue();
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearSyncTimer();
      syncPendingRef.current = false;
      syncPendingForceRef.current = false;
      syncDirtyRef.current = false;
      syncApplyingRemoteStateRef.current = false;
    };
  }, [authReady, authStatus, authUserId, enabled, syncEnabled]);
}
