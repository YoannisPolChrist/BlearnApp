import { createJSONStorage, type StateStorage } from 'zustand/middleware';

const DB_NAME = 'blearn-persist';
const STORE_NAME = 'zustand';
const STORAGE_IDLE_POLL_MS = 10;
const pendingStorageWrites = new Map<string, Set<Promise<unknown>>>();
let cachedPersistDbPromise: Promise<IDBDatabase> | null = null;
let cachedPersistDb: IDBDatabase | null = null;

function canUseIndexedDb() {
  return typeof indexedDB !== 'undefined';
}

function canUseLocalStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function trackStorageWrite<T>(storageKey: string, operation: () => T | Promise<T>): Promise<T> {
  const pendingWrites = pendingStorageWrites.get(storageKey) ?? new Set<Promise<unknown>>();
  pendingStorageWrites.set(storageKey, pendingWrites);

  const trackedPromise = Promise.resolve()
    .then(operation)
    .finally(() => {
      pendingWrites.delete(trackedPromise);
      if (pendingWrites.size === 0) {
        pendingStorageWrites.delete(storageKey);
      }
    });

  pendingWrites.add(trackedPromise);
  return trackedPromise;
}

function resetPersistDbCache() {
  const db = cachedPersistDb;
  cachedPersistDb = null;
  cachedPersistDbPromise = null;

  if (db) {
    try {
      db.close();
    } catch {
      // If the connection is already closing or closed, there is nothing left to do.
    }
  }
}

function handlePersistDbVersionChange() {
  resetPersistDbCache();
}

function openPersistDb(): Promise<IDBDatabase> {
  if (cachedPersistDbPromise) {
    return cachedPersistDbPromise;
  }

  cachedPersistDbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      cachedPersistDb = db;
      db.onversionchange = handlePersistDbVersionChange;
      resolve(db);
    };

    request.onerror = () => {
      resetPersistDbCache();
      reject(request.error ?? new Error('Failed to open IndexedDB'));
    };
  }).catch((error) => {
    resetPersistDbCache();
    throw error;
  });

  return cachedPersistDbPromise;
}

function isRetriableIndexedDbError(error: unknown) {
  if (error instanceof DOMException) {
    return error.name === 'AbortError'
      || error.name === 'InvalidStateError'
      || error.name === 'NotFoundError'
      || error.name === 'TransactionInactiveError';
  }

  if (error instanceof Error) {
    return /abort|invalidstate|notfound|transactioninactive/i.test(error.name)
      || /abort|invalid state|not found|transaction inactive/i.test(error.message);
  }

  return false;
}

async function runIndexedDbRequest<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
  retriesRemaining = 1,
): Promise<T> {
  try {
    const db = await openPersistDb();

    return await new Promise<T>((resolve, reject) => {
      let settled = false;
      const settle = (callback: () => void) => {
        if (settled) {
          return;
        }
        settled = true;
        callback();
      };

      try {
        const transaction = db.transaction(STORE_NAME, mode);
        const store = transaction.objectStore(STORE_NAME);
        const request = operation(store);

        request.onerror = () => settle(() => reject(request.error ?? new Error('IndexedDB request failed')));
        transaction.onerror = () => settle(() => reject(transaction.error ?? new Error('IndexedDB transaction failed')));
        transaction.onabort = () => settle(() => reject(transaction.error ?? new Error('IndexedDB transaction aborted')));

        if (mode === 'readonly') {
          request.onsuccess = () => settle(() => resolve(request.result));
          transaction.oncomplete = () => settle(() => resolve(request.result));
        } else {
          request.onsuccess = () => undefined;
          transaction.oncomplete = () => settle(() => resolve(request.result));
        }
      } catch (error) {
        settle(() => reject(error));
      }
    });
  } catch (error) {
    resetPersistDbCache();
    if (retriesRemaining > 0 && isRetriableIndexedDbError(error)) {
      return runIndexedDbRequest(mode, operation, retriesRemaining - 1);
    }
    throw error;
  }
}

function readLocalStorageValue(name: string) {
  if (!canUseLocalStorage()) {
    return null;
  }

  return window.localStorage.getItem(name);
}

function writeLocalStorageValue(
  name: string,
  value: string,
  pruneValue?: ((serializedValue: string) => string | null) | null,
) {
  if (!canUseLocalStorage()) {
    return;
  }

  try {
    window.localStorage.setItem(name, value);
  } catch (error) {
    if (!pruneValue || !isQuotaExceededError(error)) {
      throw error;
    }

    const prunedValue = pruneValue(value);
    if (!prunedValue || prunedValue === value) {
      throw error;
    }

    window.localStorage.setItem(name, prunedValue);
  }
}

function createIndexedDbBackedStateStorage(
  storageKey: string,
  options?: {
    localStoragePrune?: ((serializedValue: string) => string | null) | null;
    mirrorToLocalStorage?: boolean;
  },
): StateStorage {
  const localStoragePrune = options?.localStoragePrune ?? null;
  const mirrorToLocalStorage = options?.mirrorToLocalStorage ?? false;

  return {
    getItem: async (name) => {
      if (canUseIndexedDb()) {
        try {
          const value = await runIndexedDbRequest('readonly', (store) => store.get(name));
          if (typeof value === 'string') {
            return value;
          }

          const localStorageValue = readLocalStorageValue(name);
          if (typeof localStorageValue === 'string') {
            try {
              await runIndexedDbRequest('readwrite', (store) => store.put(localStorageValue, name));
            } catch (error) {
              console.warn('IndexedDB backfill from localStorage failed:', error);
            }

            return localStorageValue;
          }
        } catch (error) {
          console.warn('IndexedDB read failed, falling back to localStorage:', error);
        }
      }

      return readLocalStorageValue(name);
    },

    setItem: (name, value) => trackStorageWrite(storageKey, async () => {
      let indexedDbPersisted = false;

      if (canUseIndexedDb()) {
        try {
          await runIndexedDbRequest('readwrite', (store) => store.put(value, name));
          indexedDbPersisted = true;
        } catch (error) {
          console.warn('IndexedDB write failed, falling back to localStorage:', error);
        }
      }

      if (mirrorToLocalStorage && canUseLocalStorage()) {
        try {
          writeLocalStorageValue(name, value, localStoragePrune);
        } catch (error) {
          if (!indexedDbPersisted) {
            throw error;
          }

          console.warn('LocalStorage mirror write failed after IndexedDB persistence:', error);
        }
        return;
      }

      if (!indexedDbPersisted && canUseLocalStorage()) {
        writeLocalStorageValue(name, value, localStoragePrune);
      }
    }),

    removeItem: (name) => trackStorageWrite(storageKey, async () => {
      if (canUseIndexedDb()) {
        try {
          await runIndexedDbRequest('readwrite', (store) => store.delete(name));
        } catch (error) {
          console.warn('IndexedDB delete failed, falling back to localStorage:', error);
        }
      }

      if (canUseLocalStorage()) {
        window.localStorage.removeItem(name);
      }
    }),
  };
}

export function createIndexedDbJsonStorage(storageKey: string) {
  return createJSONStorage(() => createIndexedDbBackedStateStorage(storageKey));
}

export function createQuotaResilientJsonStorage(
  storageKey: string,
  pruneValue: (serializedValue: string) => string | null,
) {
  return createJSONStorage(() => createIndexedDbBackedStateStorage(storageKey, {
    localStoragePrune: pruneValue,
    mirrorToLocalStorage: true,
  }));
}

export async function waitForPersistStorageIdle(storageKey: string, timeoutMs = 2500) {
  const deadline = Date.now() + timeoutMs;

  while (true) {
    const pendingWrites = pendingStorageWrites.get(storageKey);
    if (!pendingWrites || pendingWrites.size === 0) {
      return;
    }

    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) {
      throw new Error(`Timed out while waiting for persisted storage "${storageKey}" to settle.`);
    }

    await Promise.race([
      Promise.allSettled([...pendingWrites]),
      new Promise((resolve) => {
        window.setTimeout(resolve, Math.min(STORAGE_IDLE_POLL_MS, remainingMs));
      }),
    ]);
  }
}

/**
 * Flush every tracked persist key. Used on app pause/hide so that in-flight
 * IndexedDB writes (the entire learning store is serialized asynchronously)
 * are not lost when Android kills or freezes the WebView — the root cause of
 * "my reviews were not saved" reports. Never throws: a flush failure must not
 * break the pause path; it is logged for diagnostics instead.
 */
export async function flushAllPersistStorage(timeoutMs = 1500): Promise<{
  flushedKeys: string[];
  timedOutKeys: string[];
}> {
  const storageKeys = [...pendingStorageWrites.keys()];
  const flushedKeys: string[] = [];
  const timedOutKeys: string[] = [];

  await Promise.all(
    storageKeys.map(async (storageKey) => {
      try {
        await waitForPersistStorageIdle(storageKey, timeoutMs);
        flushedKeys.push(storageKey);
      } catch (error) {
        timedOutKeys.push(storageKey);
        console.warn(`Persist flush timed out for "${storageKey}":`, error);
      }
    }),
  );

  return { flushedKeys, timedOutKeys };
}

export function isQuotaExceededError(error: unknown) {
  if (error instanceof DOMException) {
    return error.name === 'QuotaExceededError' || error.code === 22;
  }

  if (error instanceof Error) {
    return /quotaexceeded/i.test(error.name) || /quotaexceeded/i.test(error.message);
  }

  return false;
}
