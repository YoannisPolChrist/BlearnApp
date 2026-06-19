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
import { isNative, getUsageForRange } from '@/services/screenTimeService';

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

const UPLOADED_IDS_STORAGE_KEY_PREFIX = 'blearn-uploaded-ids-';

function getUploadedIds(userId: string): Set<string> {
  if (typeof window === 'undefined') {
    return new Set<string>();
  }
  try {
    const raw = window.localStorage.getItem(`${UPLOADED_IDS_STORAGE_KEY_PREFIX}${userId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return new Set(parsed);
      }
    }
  } catch (e) {
    console.warn('Error reading uploaded IDs:', e);
  }
  return new Set<string>();
}

function saveUploadedIds(userId: string, ids: Set<string>) {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(
      `${UPLOADED_IDS_STORAGE_KEY_PREFIX}${userId}`,
      JSON.stringify(Array.from(ids))
    );
  } catch (e) {
    console.warn('Error saving uploaded IDs:', e);
  }
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

  const uploadedIds = getUploadedIds(userId);
  const checkinsToSave = normalizedState.checkins.filter((c) => !uploadedIds.has(c.id));
  const interactionsToSave = normalizedState.interactions.filter((i) => !uploadedIds.has(i.id));

  const allOps = [
    ...checkinsToSave.map((checkin) => ({
      id: checkin.id,
      ref: sdk.doc(firestore, USERS_COLLECTION, userId, 'checkins', checkin.id),
      data: sanitizeFirestoreValue(checkin),
    })),
    ...interactionsToSave.map((interaction) => ({
      id: interaction.id,
      ref: sdk.doc(firestore, USERS_COLLECTION, userId, 'interactions', interaction.id),
      data: sanitizeFirestoreValue(interaction),
    })),
  ];

  if (allOps.length === 0) {
    return;
  }

  for (let i = 0; i < allOps.length; i += 400) {
    const chunk = allOps.slice(i, i + 400);
    const batch = sdk.writeBatch(firestore);
    for (const op of chunk) {
      batch.set(op.ref, op.data);
    }
    await batch.commit();

    for (const op of chunk) {
      uploadedIds.add(op.id);
    }
  }

  saveUploadedIds(userId, uploadedIds);
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

export async function syncAppUsageToFirestore(userId: string): Promise<void> {
  if (!isNative) return;

  assertFirebaseWritesEnabled('App Usage Sync');
  const sdk = await loadFirestoreSdk();
  const firestore = await ensureFirestore();

  const now = Date.now();
  const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
  const expiresAt = now + ninetyDaysMs;

  // Clean up expired app usage documents
  try {
    const collectionRef = sdk.collection(firestore, USERS_COLLECTION, userId, 'appUsage');
    const snapshot = await sdk.getDocs(collectionRef);
    const batch = sdk.writeBatch(firestore);
    let deleteCount = 0;

    snapshot.forEach((doc) => {
      const data = doc.data();
      if (data.expiresAt && data.expiresAt < now) {
        batch.delete(doc.ref);
        deleteCount++;
      }
    });

    if (deleteCount > 0) {
      await batch.commit();
      console.log(`[AppUsageSync] Cleaned up ${deleteCount} expired app usage documents.`);
    }
  } catch (err) {
    console.warn('[AppUsageSync] Failed to clean up expired documents:', err);
  }

  // Sync last 7 days of daily app usage
  for (let i = 0; i < 7; i++) {
    try {
      const bounds = getDayBoundsLocal(i);
      const usage = await getUsageForRange(bounds.startMs, bounds.endMs);

      const apps = (usage.entries || [])
        .filter((entry) => entry.totalTimeMs > 0)
        .map((entry) => ({
          packageName: entry.packageName || entry.appId,
          label: entry.label || entry.appName,
          totalTimeMs: entry.totalTimeMs,
        }));

      const docRef = sdk.doc(firestore, USERS_COLLECTION, userId, 'appUsage', bounds.dateKey);
      await sdk.setDoc(docRef, {
        date: bounds.dateKey,
        timestamp: bounds.startMs,
        totalScreenTimeMs: usage.totalScreenTimeMs,
        expiresAt,
        apps,
      }, { merge: true });
    } catch (err) {
      console.warn(`[AppUsageSync] Failed to sync usage for ${i} days ago:`, err);
    }
  }
}

function getDayBoundsLocal(daysAgo: number) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);

  const start = new Date(date);
  start.setHours(0, 0, 0, 0);

  const end = new Date(date);
  end.setHours(23, 59, 59, 999);

  const year = start.getFullYear();
  const month = String(start.getMonth() + 1).padStart(2, '0');
  const day = String(start.getDate()).padStart(2, '0');
  const dateKey = `${year}-${month}-${day}`;

  return {
    dateKey,
    startMs: start.getTime(),
    endMs: end.getTime(),
  };
}
