import type { Firestore } from 'firebase/firestore';
import {
  ensureFirebaseFirestore,
  getFirebaseFirestore,
} from '@/lib/firebase';
import {
  COLLECTIONS,
  DEVICE_ID_STORAGE_KEY,
  INTER_BATCH_COMMIT_DELAY_MS,
  META_COLLECTION,
  META_DOCUMENT_ID,
  USERS_COLLECTION,
  type SyncCollectionKey,
} from './constants';
import type { FirestoreSdk } from './types';

let firestoreSdkPromise: Promise<FirestoreSdk> | null = null;

export function loadFirestoreSdk(): Promise<FirestoreSdk> {
  if (!firestoreSdkPromise) {
    firestoreSdkPromise = import('firebase/firestore');
  }

  return firestoreSdkPromise;
}

export function assertFirestore(): Firestore {
  const firestore = getFirebaseFirestore();
  if (!firestore) {
    throw new Error('Firestore ist nicht konfiguriert. Setze alle VITE_FIREBASE_* Variablen.');
  }

  return firestore;
}

export async function ensureFirestore(): Promise<Firestore> {
  const firestore = await ensureFirebaseFirestore();
  if (!firestore) {
    throw new Error('Firestore ist nicht konfiguriert. Setze alle VITE_FIREBASE_* Variablen.');
  }

  return firestore;
}

export function getMetaDoc(sdk: FirestoreSdk, firestore: Firestore, userId: string) {
  return sdk.doc(firestore, USERS_COLLECTION, userId, META_COLLECTION, META_DOCUMENT_ID);
}

export function getCollectionRef(
  sdk: FirestoreSdk,
  firestore: Firestore,
  userId: string,
  key: SyncCollectionKey,
) {
  return sdk.collection(firestore, USERS_COLLECTION, userId, COLLECTIONS[key]);
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
