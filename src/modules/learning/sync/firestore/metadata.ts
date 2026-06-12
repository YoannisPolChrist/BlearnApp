import type { Firestore, Unsubscribe } from 'firebase/firestore';
import { assertFirebaseWritesEnabled } from '@/lib/firebase';
import { normalizeSyncCursor } from './cursors';
import {
  assertFirestore,
  ensureFirestore,
  getMetaDoc,
  loadFirestoreSdk,
  waitForPendingChunkWrites,
} from './transport';
import type {
  FirestoreSdk,
  LearningCloudMeta,
  LearningCloudReadOptions,
  LearningCloudSyncCursor,
} from './types';
import { sanitizeFirestoreValue } from './utils';

export function normalizeLearningCloudMeta(meta?: Partial<LearningCloudMeta> | null): LearningCloudMeta | null {
  if (!meta) {
    return null;
  }

  const schemaVersion = Number.isFinite(meta.schemaVersion) ? Math.max(1, Math.round(meta.schemaVersion as number)) : 1;

  return {
    schemaVersion,
    activeDeckId: meta.activeDeckId,
    activeDeckUpdatedAt: Number.isFinite(meta.activeDeckUpdatedAt) ? meta.activeDeckUpdatedAt : undefined,
    deckCount: Number.isFinite(meta.deckCount) ? Math.max(0, Math.round(meta.deckCount as number)) : undefined,
    noteCount: Number.isFinite(meta.noteCount) ? Math.max(0, Math.round(meta.noteCount as number)) : undefined,
    cardCount: Number.isFinite(meta.cardCount) ? Math.max(0, Math.round(meta.cardCount as number)) : undefined,
    reviewLogCount: Number.isFinite(meta.reviewLogCount) ? Math.max(0, Math.round(meta.reviewLogCount as number)) : undefined,
    presetCount: Number.isFinite(meta.presetCount) ? Math.max(0, Math.round(meta.presetCount as number)) : undefined,
    cardBrowser: meta.cardBrowser,
    savedCardQueries: meta.savedCardQueries,
    filteredDeckLiteDefinition: meta.filteredDeckLiteDefinition,
    filteredDeckLiteDefinitions: meta.filteredDeckLiteDefinitions,
    filteredDeckLiteRuns: meta.filteredDeckLiteRuns,
    assignments: meta.assignments,
    gateRule: meta.gateRule,
    gateRuleUpdatedAt: Number.isFinite(meta.gateRuleUpdatedAt) ? Math.max(0, Math.round(meta.gateRuleUpdatedAt as number)) : undefined,
    snapshotCursor: normalizeSyncCursor(meta.snapshotCursor) || undefined,
    mutationCursor: normalizeSyncCursor(meta.mutationCursor) || undefined,
    mutationCount: Number.isFinite(meta.mutationCount) ? Math.max(0, Math.round(meta.mutationCount as number)) : undefined,
    updatedByDeviceId: typeof meta.updatedByDeviceId === 'string' ? meta.updatedByDeviceId : undefined,
    clientUpdatedAt: Number.isFinite(meta.clientUpdatedAt) ? Math.max(0, Math.round(meta.clientUpdatedAt as number)) : undefined,
    lastMutationId: typeof meta.lastMutationId === 'string' ? meta.lastMutationId : undefined,
    lastMutationAt: Number.isFinite(meta.lastMutationAt) ? Math.max(0, Math.round(meta.lastMutationAt as number)) : undefined,
  };
}

export async function loadLearningCloudMetaWithSdk(
  sdk: FirestoreSdk,
  firestore: Firestore,
  userId: string,
  options?: LearningCloudReadOptions,
): Promise<LearningCloudMeta | null> {
  const metaRef = getMetaDoc(sdk, firestore, userId);
  const metaSnapshot = options?.source === 'server' && typeof sdk.getDocFromServer === 'function'
    ? await sdk.getDocFromServer(metaRef).catch(() => sdk.getDoc(metaRef))
    : await sdk.getDoc(metaRef);
  if (!metaSnapshot.exists()) {
    return null;
  }

  return normalizeLearningCloudMeta(metaSnapshot.data() as LearningCloudMeta);
}

export async function loadLearningCloudSyncCursor(
  userId: string,
  options?: LearningCloudReadOptions,
): Promise<LearningCloudSyncCursor | null> {
  const sdk = await loadFirestoreSdk();
  const firestore = await ensureFirestore();
  return loadLearningCloudSyncCursorWithSdk(sdk, firestore, userId, options);
}

export async function loadLearningCloudSyncCursorWithSdk(
  sdk: FirestoreSdk,
  firestore: Firestore,
  userId: string,
  options?: LearningCloudReadOptions,
): Promise<LearningCloudSyncCursor | null> {
  const meta = await loadLearningCloudMetaWithSdk(sdk, firestore, userId, options);
  if (!meta) {
    return null;
  }

  return normalizeSyncCursor(meta.mutationCursor)
    || normalizeSyncCursor({
      mutationId: meta.lastMutationId || '',
      mutationAt: meta.lastMutationAt || meta.clientUpdatedAt,
    });
}

export async function loadLearningCloudMetadata(
  userId: string,
  options?: LearningCloudReadOptions,
): Promise<LearningCloudMeta | null> {
  const sdk = await loadFirestoreSdk();
  const firestore = await ensureFirestore();
  return loadLearningCloudMetaWithSdk(sdk, firestore, userId, options);
}

export async function saveLearningCloudSyncCursor(
  userId: string,
  cursor: LearningCloudSyncCursor | null,
  deviceId: string,
): Promise<void> {
  assertFirebaseWritesEnabled('Learn-Cloud-Schreibzugriffe');
  const sdk = await loadFirestoreSdk();
  const firestore = await ensureFirestore();
  await sdk.setDoc(
    getMetaDoc(sdk, firestore, userId),
    sanitizeFirestoreValue({
      schemaVersion: 2,
      snapshotCursor: cursor || null,
      mutationCursor: cursor || null,
      lastMutationId: cursor?.mutationId,
      lastMutationAt: cursor?.mutationAt,
      updatedByDeviceId: deviceId,
      clientUpdatedAt: Date.now(),
      updatedAt: sdk.serverTimestamp(),
    }),
    { merge: true },
  );
}

export function subscribeToLearningCloudMetadata(
  userId: string,
  onChange: (meta: LearningCloudMeta | null) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const firestore = assertFirestore();
  let cancelled = false;
  let unsubscribe: Unsubscribe = () => {};

  void loadFirestoreSdk()
    .then((sdk) => {
      if (cancelled) {
        return;
      }

      unsubscribe = sdk.onSnapshot(
        getMetaDoc(sdk, firestore, userId),
        (snapshot) => {
          onChange(
            snapshot.exists()
              ? normalizeLearningCloudMeta(snapshot.data() as Partial<LearningCloudMeta>)
              : null,
          );
        },
        (error) => {
          onError?.(error);
        },
      );
    })
    .catch((error) => {
      if (!cancelled) {
        onError?.(error instanceof Error ? error : new Error('Learning cloud metadata subscription failed.'));
      }
    });

  return () => {
    cancelled = true;
    unsubscribe();
  };
}

export async function writeLearningCloudMeta(
  sdk: FirestoreSdk,
  firestore: Firestore,
  userId: string,
  meta: LearningCloudMeta,
): Promise<void> {
  await sdk.setDoc(
    getMetaDoc(sdk, firestore, userId),
    sanitizeFirestoreValue({
      ...meta,
      updatedAt: sdk.serverTimestamp(),
    }),
    { merge: true },
  );
  await waitForPendingChunkWrites(sdk, firestore);
}
