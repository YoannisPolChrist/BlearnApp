import { useCallback, useRef, useState } from 'react';
import { isFirebaseWriteEnabled } from '@/lib/firebase';
import { useI18n } from '@/hooks/useI18n';
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
import { hasPendingLearningCloudChanges } from '@/lib/learningCloudPendingChanges';
import { beginManualLearningCloudSync } from '@/lib/learningCloudSyncActivity';
import { waitForPersistStorageIdle } from '@/lib/persistStorage';
import { withTimeout } from '@/lib/promiseTimeout';
import { showSuccessFeedback } from '@/lib/successFeedback';
import {
  applyLearningCloudMutations,
  getLearningSyncDeviceId,
  loadLearningCloudState,
  loadLearningCloudSyncCursor,
  pullLearningCloudMutations,
  saveLearningCloudState,
  type LearningCloudMeta,
  type LearningCloudSyncCursor,
} from '@/services/firebaseLearningSyncService';
import { useAuthStore } from '@/store/useAuthStore';
import { useLearningStore } from '@/store/useLearningStore';
import { createIndexedRecordView } from '@/modules/learning/store/helpers';

const LEARNING_STORAGE_KEY = 'blearn-learning-storage';
const MANUAL_LEARNING_STORAGE_IDLE_TIMEOUT_MS = 4_000;
const MANUAL_LEARNING_CLOUD_REHYDRATE_TIMEOUT_MS = 20_000;
const MANUAL_LEARNING_CLOUD_LOAD_TIMEOUT_MS = 30_000;
const MANUAL_LEARNING_CLOUD_SAVE_TIMEOUT_MS = 90_000;
const MANUAL_LEARNING_CLOUD_CURSOR_TIMEOUT_MS = 12_000;

export type ManualLearningCloudSyncCapabilityState =
  | 'ready'
  | 'auth-loading'
  | 'firebase-missing'
  | 'writes-disabled'
  | 'signed-out';

function readLearningCloudStateFromStore(): LearningCloudState {
  const state = useLearningStore.getState();
  return normalizeLearningCloudState({
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
  });
}

function getLearningCloudLocalSyncState() {
  return useLearningStore.getState().learningCloudLocalSyncState;
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

function getLearningCloudMetaCursor(meta: LearningCloudMeta | null | undefined): LearningCloudSyncCursor | null {
  if (meta?.mutationCursor?.mutationId && Number.isFinite(meta.mutationCursor.mutationAt)) {
    return meta.mutationCursor;
  }

  if (meta?.lastMutationId && Number.isFinite(meta.lastMutationAt)) {
    return {
      mutationId: meta.lastMutationId,
      mutationAt: meta.lastMutationAt,
    };
  }

  return null;
}

function getManualSyncErrorMessage(error: unknown, isGerman: boolean) {
  if (error instanceof Error) {
    if (/Firebase-Schreibzugriffe.*gesperrt/i.test(error.message)) {
      return isGerman
        ? 'Cloud-Schreiben ist in diesem lokalen Build absichtlich gesperrt.'
        : 'Cloud writes are intentionally blocked in this local build.';
    }

    if (/Firestore ist nicht konfiguriert/i.test(error.message)) {
      return isGerman
        ? 'Firebase-Sync ist noch nicht eingerichtet.'
        : 'Firebase sync is not configured yet.';
    }

    if (/timed out after/i.test(error.message)) {
      return isGerman
        ? 'Die Synchronisierung hat zu lange gedauert. Bitte erneut versuchen.'
        : 'Sync took too long. Please try again.';
    }

    return error.message;
  }

  return isGerman
    ? 'Die Synchronisierung konnte gerade nicht abgeschlossen werden.'
    : 'Sync could not be completed right now.';
}

export function useManualLearningCloudSync() {
  const { locale } = useI18n();
  const isGerman = locale.toLowerCase().startsWith('de');
  const firebaseWritesEnabled = isFirebaseWriteEnabled();
  const authReady = useAuthStore((state) => state.authReady);
  const authStatus = useAuthStore((state) => state.status);
  const authUserId = useAuthStore((state) => state.user?.uid);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const inFlightSyncRef = useRef<Promise<boolean> | null>(null);

  const canSync = firebaseWritesEnabled && authReady && authStatus !== 'disabled' && Boolean(authUserId);
  const syncCapabilityState: ManualLearningCloudSyncCapabilityState = !authReady
    ? 'auth-loading'
    : authStatus === 'disabled'
      ? 'firebase-missing'
      : !firebaseWritesEnabled
        ? 'writes-disabled'
        : authUserId
          ? 'ready'
          : 'signed-out';
  const syncCapabilityReason = syncCapabilityState === 'auth-loading'
    ? (isGerman
      ? 'Konto und Cloud-Status werden noch vorbereitet.'
      : 'Account and cloud status are still preparing.')
    : syncCapabilityState === 'firebase-missing'
      ? (isGerman
        ? 'Firebase ist in diesem Build noch nicht vollstaendig eingerichtet.'
        : 'Firebase is not fully configured in this build yet.')
      : syncCapabilityState === 'writes-disabled'
        ? (isGerman
          ? 'Cloud-Schreiben ist in diesem Build deaktiviert. Anzeigen geht, Schreiben und manueller Sync nicht.'
          : 'Cloud writes are disabled in this build. Reading can work, but manual sync and writes cannot.')
        : syncCapabilityState === 'signed-out'
          ? (isGerman
            ? 'Melde dich an, damit Lernstand und Vokabeln wirklich mit der Cloud synchronisiert werden.'
            : 'Sign in so vocabulary and learning progress can sync with the cloud.')
          : null;

  const ensureLearningStoreReady = useCallback(async () => {
    if (!useLearningStore.persist.hasHydrated()) {
      await withTimeout(
        useLearningStore.persist.rehydrate(),
        MANUAL_LEARNING_CLOUD_REHYDRATE_TIMEOUT_MS,
        'learning store rehydrate',
      );
    }

    await waitForPersistStorageIdle(
      LEARNING_STORAGE_KEY,
      MANUAL_LEARNING_STORAGE_IDLE_TIMEOUT_MS,
    ).catch(() => undefined);
  }, []);

  const syncLearningCloud = useCallback(async () => {
    if (inFlightSyncRef.current) {
      return inFlightSyncRef.current;
    }

    if (!firebaseWritesEnabled) {
      setSyncError(
        isGerman
          ? 'Cloud-Schreiben ist in diesem lokalen Build absichtlich gesperrt.'
          : 'Cloud writes are intentionally blocked in this local build.',
      );
      return false;
    }

    if (!authUserId || !canSync) {
      setSyncError(
        isGerman
          ? 'Melde dich zuerst an, damit deine Vokabeln mit der Cloud synchronisiert werden koennen.'
          : 'Sign in first so your vocabulary can sync with the cloud.',
      );
      return false;
    }

    setSyncError(null);
    setSyncing(true);

    const syncPromise = (async () => {
      const finishManualSync = beginManualLearningCloudSync();
      try {
        await ensureLearningStoreReady();

        const localState = readLearningCloudStateFromStore();
        const localSyncState = getLearningCloudLocalSyncState();
        const remoteCursor = await withTimeout(
          loadLearningCloudSyncCursor(authUserId),
          MANUAL_LEARNING_CLOUD_CURSOR_TIMEOUT_MS,
          'learning cloud cursor load',
        );
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
            pullLearningCloudMutations(authUserId, localRemoteCursor),
            MANUAL_LEARNING_CLOUD_LOAD_TIMEOUT_MS,
            'learning cloud mutation pull',
          );
          effectiveRemoteCursor = pulled.cursor || remoteCursor;
          remoteState = pulled.mutations.length > 0
            ? applyLearningCloudMutations(localState, pulled.mutations)
            : await withTimeout(
                loadLearningCloudState(authUserId),
                MANUAL_LEARNING_CLOUD_LOAD_TIMEOUT_MS,
                'learning cloud state load',
              );
        } else {
          remoteState = await withTimeout(
            loadLearningCloudState(authUserId),
            MANUAL_LEARNING_CLOUD_LOAD_TIMEOUT_MS,
            'learning cloud state load',
          );
        }
        if (remoteState) {
          cacheLearningCloudSyncBaseline(authUserId, remoteState, effectiveRemoteCursor);
        }
        const mergedState = mergeLearningCloudStates(localState, remoteState);
        const localSignature = getLearningCloudStateSignature(localState);
        const remoteSignature = getLearningCloudStateSignature(remoteState);
        const mergedSignature = getLearningCloudStateSignature(mergedState);

        if (mergedSignature !== localSignature) {
          writeLearningCloudStateToStore(mergedState);
        }

        let pushedChanges = false;
        if (mergedSignature !== remoteSignature && (remoteState || !isLearningCloudStateEmpty(mergedState))) {
          const savedMeta = await withTimeout(
            saveLearningCloudState(
              authUserId,
              mergedState,
              canReuseCachedRemoteState ? (cachedBaseline?.state || remoteState) : remoteState,
              getLearningSyncDeviceId(),
              {
                localSyncState,
              },
            ),
            MANUAL_LEARNING_CLOUD_SAVE_TIMEOUT_MS,
            'learning cloud save',
          );
          const savedCursor = getLearningCloudMetaCursor(savedMeta);
          cacheLearningCloudSyncBaseline(authUserId, mergedState, savedCursor);
          useLearningStore.getState().markLearningCloudSyncCompleted(
            savedMeta?.lastMutationAt || Date.now(),
            savedCursor,
            getLearningCloudStateSignature(mergedState),
          );
          pushedChanges = true;
        } else {
          cacheLearningCloudSyncBaseline(authUserId, mergedState, effectiveRemoteCursor);
          useLearningStore.getState().markLearningCloudSyncCompleted(
            effectiveRemoteCursor?.mutationAt || Date.now(),
            effectiveRemoteCursor,
            getLearningCloudStateSignature(mergedState),
          );
        }

        showSuccessFeedback({
          eyebrow: isGerman ? 'Cloud-Sync' : 'Cloud sync',
          title: isGerman ? 'Vokabeln synchronisiert' : 'Vocabulary synced',
          description: pushedChanges
            ? (isGerman
              ? 'Lokaler Stand und Cloud wurden zusammengefuehrt und gespeichert.'
              : 'Local and cloud state were merged and saved.')
            : (isGerman
              ? 'Lokaler Stand und Cloud sind bereits auf dem gleichen Stand.'
              : 'Local and cloud are already up to date.'),
        });
        return true;
      } catch (error) {
        console.warn('Manual learning cloud sync failed:', error);
        setSyncError(getManualSyncErrorMessage(error, isGerman));
        return false;
      } finally {
        finishManualSync();
        inFlightSyncRef.current = null;
        setSyncing(false);
      }
    })();

    inFlightSyncRef.current = syncPromise;
    return syncPromise;
  }, [authUserId, canSync, ensureLearningStoreReady, firebaseWritesEnabled, isGerman]);

  return {
    canSync,
    firebaseWritesEnabled,
    syncError,
    syncCapabilityReason,
    syncCapabilityState,
    syncing,
    syncLearningCloud,
  };
}
