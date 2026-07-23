import type { Firestore } from 'firebase/firestore';
import {
  assertFirestore,
  ensureFirestore,
  loadFirestoreSdk,
} from '@/lib/firestoreTransport';
import {
  COLLECTIONS,
  DEVICE_ID_STORAGE_KEY,
  INTER_BATCH_COMMIT_DELAY_MS,
  META_COLLECTION,
  META_DOCUMENT_ID,
  SUBCOLLECTIONS,
  USERS_COLLECTION,
  type DeckScopedSyncCollectionKey,
  type SyncCollectionKey,
} from './constants';
import type { FirestoreSdk } from './types';

export { assertFirestore, ensureFirestore, loadFirestoreSdk };

export function getMetaDoc(sdk: FirestoreSdk, firestore: Firestore, userId: string) {
  return sdk.doc(firestore, USERS_COLLECTION, userId, META_COLLECTION, META_DOCUMENT_ID);
}

/**
 * Returns a top-level collection reference (old format).
 * Used for decks, presets, mutations, and backward-compatible reads of
 * the old bucket / flat collections.
 */
export function getCollectionRef(
  sdk: FirestoreSdk,
  firestore: Firestore,
  userId: string,
  key: SyncCollectionKey,
) {
  return sdk.collection(firestore, USERS_COLLECTION, userId, COLLECTIONS[key]);
}

/**
 * Returns a deck-scoped subcollection reference (new format):
 *
 *   users/{uid}/learningDecks/{deckId}/{subcollection}/{docId}
 */
export function getDeckScopedCollectionRef(
  sdk: FirestoreSdk,
  firestore: Firestore,
  userId: string,
  deckId: string,
  subcollectionKey: DeckScopedSyncCollectionKey,
) {
  return sdk.collection(
    firestore,
    USERS_COLLECTION,
    userId,
    COLLECTIONS.decks,
    deckId,
    SUBCOLLECTIONS[subcollectionKey],
  );
}

/**
 * Returns the per-deck "meta" document reference:
 *
 *   users/{uid}/learningDecks/{deckId}/meta
 */
export function getDeckMetaDoc(
  sdk: FirestoreSdk,
  firestore: Firestore,
  userId: string,
  deckId: string,
) {
  return sdk.doc(
    firestore,
    USERS_COLLECTION,
    userId,
    COLLECTIONS.decks,
    deckId,
    SUBCOLLECTIONS.meta,
  );
}

export function getMutationCollectionRef(sdk: FirestoreSdk, firestore: Firestore, userId: string) {
  return getCollectionRef(sdk, firestore, userId, 'mutations');
}

export function waitForInterBatchCommitDelay() {
  if (INTER_BATCH_COMMIT_DELAY_MS <= 0) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    setTimeout(resolve, INTER_BATCH_COMMIT_DELAY_MS);
  });
}

export async function waitForPendingChunkWrites(
  sdk: FirestoreSdk,
  firestore: Firestore,
) {
  if (typeof sdk.waitForPendingWrites !== 'function') {
    return;
  }

  await sdk.waitForPendingWrites(firestore);
}

export function getLearningSyncDeviceId(): string {
  if (typeof window === 'undefined') {
    return 'server';
  }

  const existingValue = window.localStorage.getItem(DEVICE_ID_STORAGE_KEY);
  if (existingValue) {
    return existingValue;
  }

  const nextValue =
    typeof window.crypto?.randomUUID === 'function'
      ? window.crypto.randomUUID()
      : `device_${Math.random().toString(36).slice(2, 10)}`;
  window.localStorage.setItem(DEVICE_ID_STORAGE_KEY, nextValue);
  return nextValue;
}
