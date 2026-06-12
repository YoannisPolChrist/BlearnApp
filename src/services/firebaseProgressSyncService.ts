import type { Firestore, Unsubscribe } from 'firebase/firestore';
import {
  assertFirebaseWritesEnabled,
  ensureFirebaseFirestore,
  getFirebaseFirestore,
} from '@/lib/firebase';
import {
  getProgressCloudStateSignature,
  normalizeProgressCloudState,
  type ProgressCloudState,
} from '@/lib/progressCloudSync';

const USERS_COLLECTION = 'users';
const PROGRESS_COLLECTION = 'progress';
const PROGRESS_DOCUMENT_ID = 'profile';
const DEVICE_ID_STORAGE_KEY = 'blearn-progress-sync-device-id';

type FirestoreSdk = typeof import('firebase/firestore');

export interface ProgressCloudReadOptions {
  source?: 'default' | 'server';
}

let firestoreSdkPromise: Promise<FirestoreSdk> | null = null;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function sanitizeFirestoreValue<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .filter((entry) => entry !== undefined)
      .map((entry) => sanitizeFirestoreValue(entry)) as T;
  }

  if (!isPlainObject(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).flatMap(([key, entry]) => (
      entry === undefined
        ? []
        : [[key, sanitizeFirestoreValue(entry)]]
    )),
  ) as T;
}

function loadFirestoreSdk(): Promise<FirestoreSdk> {
  if (!firestoreSdkPromise) {
    firestoreSdkPromise = import('firebase/firestore');
  }

  return firestoreSdkPromise;
}

function assertFirestore(): Firestore {
  const firestore = getFirebaseFirestore();
  if (!firestore) {
    throw new Error('Firestore ist nicht konfiguriert. Setze alle VITE_FIREBASE_* Variablen.');
  }

  return firestore;
}

async function ensureFirestore(): Promise<Firestore> {
  const firestore = await ensureFirebaseFirestore();
  if (!firestore) {
    throw new Error('Firestore ist nicht konfiguriert. Setze alle VITE_FIREBASE_* Variablen.');
  }

  return firestore;
}

function getProgressDoc(sdk: FirestoreSdk, firestore: Firestore, userId: string) {
  return sdk.doc(firestore, USERS_COLLECTION, userId, PROGRESS_COLLECTION, PROGRESS_DOCUMENT_ID);
}

function normalizeProgressRecord(record?: Partial<ProgressCloudState> | null): ProgressCloudState | null {
  if (!record) {
    return null;
  }

  const normalized = normalizeProgressCloudState(record);
  if (normalized.checkins.length === 0 && normalized.interactions.length === 0) {
    return null;
  }

  return normalized;
}

export function getProgressSyncDeviceId() {
  if (typeof window === 'undefined') {
    return 'server';
  }

  const existing = window.localStorage.getItem(DEVICE_ID_STORAGE_KEY);
  if (existing) {
    return existing;
  }

  const deviceId = `progress-${Math.random().toString(36).slice(2, 10)}`;
  window.localStorage.setItem(DEVICE_ID_STORAGE_KEY, deviceId);
  return deviceId;
}

export async function loadProgressCloudState(
  userId: string,
  options?: ProgressCloudReadOptions,
): Promise<ProgressCloudState | null> {
  const sdk = await loadFirestoreSdk();
  const firestore = await ensureFirestore();
  const docRef = getProgressDoc(sdk, firestore, userId);
  const snapshot = options?.source === 'server' && typeof sdk.getDocFromServer === 'function'
    ? await sdk.getDocFromServer(docRef).catch(() => sdk.getDoc(docRef))
    : await sdk.getDoc(docRef);

  if (!snapshot.exists()) {
    return null;
  }

  return normalizeProgressRecord(snapshot.data() as Partial<ProgressCloudState>);
}

export async function saveProgressCloudState(
  userId: string,
  state: ProgressCloudState,
  deviceId = getProgressSyncDeviceId(),
): Promise<void> {
  assertFirebaseWritesEnabled('Progress Cloud-Sync');
  const sdk = await loadFirestoreSdk();
  const firestore = await ensureFirestore();
  const normalizedState = normalizeProgressCloudState(state);
  const payload = sanitizeFirestoreValue({
    schemaVersion: 1,
    updatedAt: Date.now(),
    updatedByDeviceId: deviceId,
    progressSignature: getProgressCloudStateSignature(normalizedState),
    ...normalizedState,
  });

  await sdk.setDoc(
    getProgressDoc(sdk, firestore, userId),
    payload,
    { merge: false },
  );
}

export function subscribeToProgressCloudState(
  userId: string,
  onChange: (state: ProgressCloudState | null) => void,
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
        getProgressDoc(sdk, firestore, userId),
        (snapshot) => {
          onChange(
            snapshot.exists()
              ? normalizeProgressRecord(snapshot.data() as Partial<ProgressCloudState>)
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
        onError?.(error instanceof Error ? error : new Error('Progress cloud metadata subscription failed.'));
      }
    });

  return () => {
    cancelled = true;
    unsubscribe();
  };
}
