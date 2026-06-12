import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const initializeAppMock = vi.hoisted(() => vi.fn(() => ({ kind: 'app' })));
const getAuthMock = vi.hoisted(() => vi.fn(() => ({ kind: 'auth' })));
const initializeFirestoreMock = vi.hoisted(() => vi.fn(() => ({ kind: 'firestore' })));
const memoryLocalCacheMock = vi.hoisted(() => vi.fn(() => ({ kind: 'memory-cache' })));
const persistentLocalCacheMock = vi.hoisted(() => vi.fn(() => ({ kind: 'persistent-cache' })));

vi.mock('firebase/app', () => ({
  initializeApp: initializeAppMock,
}));

vi.mock('firebase/auth', () => ({
  getAuth: getAuthMock,
}));

vi.mock('firebase/firestore', () => ({
  initializeFirestore: initializeFirestoreMock,
  memoryLocalCache: memoryLocalCacheMock,
  persistentLocalCache: persistentLocalCacheMock,
}));

function stubFirebaseEnv() {
  vi.stubEnv('VITE_FIREBASE_API_KEY', 'key');
  vi.stubEnv('VITE_FIREBASE_AUTH_DOMAIN', 'auth');
  vi.stubEnv('VITE_FIREBASE_PROJECT_ID', 'project');
  vi.stubEnv('VITE_FIREBASE_STORAGE_BUCKET', 'bucket');
  vi.stubEnv('VITE_FIREBASE_MESSAGING_SENDER_ID', 'sender');
  vi.stubEnv('VITE_FIREBASE_APP_ID', 'app');
}

describe('firebase concurrent initialization', () => {
  beforeEach(() => {
    vi.resetModules();
    initializeAppMock.mockClear();
    getAuthMock.mockClear();
    initializeFirestoreMock.mockClear();
    memoryLocalCacheMock.mockClear();
    persistentLocalCacheMock.mockClear();
    stubFirebaseEnv();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('deduplicates concurrent auth initialization', async () => {
    const { ensureFirebaseAuth } = await import('./firebase');

    const [first, second] = await Promise.all([
      ensureFirebaseAuth(),
      ensureFirebaseAuth(),
    ]);

    expect(first).toBe(second);
    expect(initializeAppMock).toHaveBeenCalledTimes(1);
    expect(getAuthMock).toHaveBeenCalledTimes(1);
  });

  it('deduplicates concurrent firestore initialization', async () => {
    const { ensureFirebaseFirestore } = await import('./firebase');

    const [first, second] = await Promise.all([
      ensureFirebaseFirestore(),
      ensureFirebaseFirestore(),
    ]);

    expect(first).toBe(second);
    expect(initializeAppMock).toHaveBeenCalledTimes(1);
    expect(initializeFirestoreMock).toHaveBeenCalledTimes(1);
    expect(memoryLocalCacheMock.mock.calls.length + persistentLocalCacheMock.mock.calls.length).toBe(1);
  });
});
