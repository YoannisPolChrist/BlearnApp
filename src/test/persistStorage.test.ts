import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createQuotaResilientJsonStorage, waitForPersistStorageIdle } from '@/lib/persistStorage';

type IndexedDbHarness = ReturnType<typeof createIndexedDbHarness>;

function createIndexedDbHarness() {
  let openCount = 0;
  let storeReady = false;
  let currentDb: FakeIndexedDb | null = null;
  const values = new Map<string, string>();

  class FakeRequest<T> {
    result!: T;
    error: DOMException | null = null;
    onsuccess: ((event: Event) => void) | null = null;
    onerror: ((event: Event) => void) | null = null;
    onupgradeneeded: ((event: Event) => void) | null = null;
  }

  class FakeTransaction {
    error: DOMException | null = null;
    oncomplete: ((event: Event) => void) | null = null;
    onerror: ((event: Event) => void) | null = null;
    onabort: ((event: Event) => void) | null = null;

    objectStore() {
      return {
        get: (name: string) => {
          const request = new FakeRequest<string | undefined>();
          queueMicrotask(() => {
            request.result = values.get(name);
            request.onsuccess?.(new Event('success'));
            this.oncomplete?.(new Event('complete'));
          });
          return request as unknown as IDBRequest<string | undefined>;
        },
        put: (value: string, name: string) => {
          const request = new FakeRequest<IDBValidKey>();
          queueMicrotask(() => {
            values.set(name, value);
            request.result = name;
            request.onsuccess?.(new Event('success'));
            this.oncomplete?.(new Event('complete'));
          });
          return request as unknown as IDBRequest<IDBValidKey>;
        },
        delete: (name: string) => {
          const request = new FakeRequest<void>();
          queueMicrotask(() => {
            values.delete(name);
            request.result = undefined;
            request.onsuccess?.(new Event('success'));
            this.oncomplete?.(new Event('complete'));
          });
          return request as unknown as IDBRequest<void>;
        },
      } as IDBObjectStore;
    }
  }

  class FakeIndexedDb {
    closed = false;
    onversionchange: ((event: Event) => void) | null = null;
    readonly objectStoreNames = {
      contains: (name: string) => storeReady && name === 'zustand',
    } as DOMStringList;

    createObjectStore() {
      storeReady = true;
      return {} as IDBObjectStore;
    }

    transaction(_storeName: string, _mode: IDBTransactionMode) {
      if (this.closed) {
        throw new DOMException('Database closed', 'InvalidStateError');
      }

      return new FakeTransaction(this);
    }

    close() {
      this.closed = true;
    }
  }

  class FakeOpenRequest extends FakeRequest<FakeIndexedDb> {
    triggerUpgrade = false;
  }

  function open(): FakeOpenRequest {
    const request = new FakeOpenRequest();
    const db = new FakeIndexedDb();
    currentDb = db;
    openCount += 1;
    request.result = db;
    queueMicrotask(() => {
      if (request.triggerUpgrade && request.onupgradeneeded) {
        request.onupgradeneeded(new Event('upgradeneeded'));
      }
      request.onsuccess?.(new Event('success'));
    });
    return request;
  }

  const indexedDB = {
    open: (_name: string, _version?: number) => {
      const request = open();
      if (!storeReady) {
        request.triggerUpgrade = true;
      }
      return request as unknown as IDBOpenDBRequest;
    },
  } as IDBFactory;

  function dispatchVersionChange() {
    currentDb?.onversionchange?.(new Event('versionchange'));
  }

  function install() {
    Object.defineProperty(globalThis, 'indexedDB', {
      value: indexedDB,
      configurable: true,
      writable: true,
    });
  }

  function reset() {
    dispatchVersionChange();
    values.clear();
    storeReady = false;
    currentDb = null;
    openCount = 0;
  }

  return {
    install,
    reset,
    dispatchVersionChange,
    getOpenCount: () => openCount,
    getCurrentDb: () => currentDb,
  };
}

let indexedDbHarness: IndexedDbHarness;

beforeEach(() => {
  indexedDbHarness = createIndexedDbHarness();
  indexedDbHarness.install();
});

afterEach(() => {
  indexedDbHarness.reset();
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe('createQuotaResilientJsonStorage', () => {
  it('retries with a pruned payload after a quota error', async () => {
    const originalSetItem = Storage.prototype.setItem;
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
      this: Storage,
      key: string,
      value: string,
    ) {
      if (key === 'quota-test' && value.includes('"tooBig":true')) {
        throw new DOMException('Quota exceeded', 'QuotaExceededError');
      }

      return originalSetItem.call(this, key, value);
    });

    const storage = createQuotaResilientJsonStorage('quota-test', () =>
      JSON.stringify({
        state: {
          savedModeSelection: 'strict',
          blockedApps: ['com.example.youtube'],
        },
        version: 0,
      }),
    );

    void (storage as { setItem: (name: string, value: unknown) => Promise<void> }).setItem('quota-test', {
      state: { tooBig: true },
      version: 0,
    });
    await waitForPersistStorageIdle('quota-test');

    expect(setItemSpy).toHaveBeenCalledTimes(2);
    expect(window.localStorage.getItem('quota-test')).toContain('"savedModeSelection":"strict"');
    expect(window.localStorage.getItem('quota-test')).not.toContain('"tooBig":true');
  });
});

describe('createIndexedDbJsonStorage migration fallback', () => {
  it('rehydrates legacy localStorage data when IndexedDB has no snapshot yet', async () => {
    const { createIndexedDbJsonStorage } = await import('@/lib/persistStorage');
    const storage = createIndexedDbJsonStorage('learning-migration-test');
    const legacySnapshot = JSON.stringify({
      state: {
        activeDeckId: 'deck_1',
      },
      version: 0,
    });

    window.localStorage.setItem('learning-migration-test', legacySnapshot);

    expect(await storage.getItem('learning-migration-test')).toEqual({
      state: {
        activeDeckId: 'deck_1',
      },
      version: 0,
    });
  });

  it('reuses the same IndexedDB connection until the browser signals version change', async () => {
    const { createIndexedDbJsonStorage } = await import('@/lib/persistStorage');
    const storage = createIndexedDbJsonStorage('learning-cache-test');

    await storage.setItem('learning-cache-test', {
      state: {
        activeDeckId: 'deck-a',
      },
      version: 0,
    });
    await waitForPersistStorageIdle('learning-cache-test');

    expect(indexedDbHarness.getOpenCount()).toBe(1);

    await storage.setItem('learning-cache-test', {
      state: {
        activeDeckId: 'deck-b',
      },
      version: 0,
    });
    await waitForPersistStorageIdle('learning-cache-test');

    expect(indexedDbHarness.getOpenCount()).toBe(1);
    expect(await storage.getItem('learning-cache-test')).toEqual({
      state: {
        activeDeckId: 'deck-b',
      },
      version: 0,
    });
  });

  it('opens a fresh IndexedDB connection after a version change', async () => {
    const { createIndexedDbJsonStorage } = await import('@/lib/persistStorage');
    const storage = createIndexedDbJsonStorage('learning-reconnect-test');

    await storage.setItem('learning-reconnect-test', {
      state: {
        activeDeckId: 'deck-a',
      },
      version: 0,
    });
    await waitForPersistStorageIdle('learning-reconnect-test');

    expect(indexedDbHarness.getOpenCount()).toBe(1);

    indexedDbHarness.dispatchVersionChange();

    await storage.setItem('learning-reconnect-test', {
      state: {
        activeDeckId: 'deck-c',
      },
      version: 0,
    });
    await waitForPersistStorageIdle('learning-reconnect-test');

    expect(indexedDbHarness.getOpenCount()).toBe(2);
    expect(await storage.getItem('learning-reconnect-test')).toEqual({
      state: {
        activeDeckId: 'deck-c',
      },
      version: 0,
    });
  });
});
