import { describe, expect, it } from 'vitest';
import { areFirebaseWritesEnabled, loadFirebaseEnv } from './firebase';

describe('loadFirebaseEnv', () => {
  it('returns null when any key is missing', () => {
    const result = loadFirebaseEnv({
      VITE_FIREBASE_API_KEY: 'key',
      VITE_FIREBASE_PROJECT_ID: '',
    });

    expect(result).toBeNull();
  });

  it('normalizes env values when all keys exist', () => {
    const config = loadFirebaseEnv({
      VITE_FIREBASE_API_KEY: 'key',
      VITE_FIREBASE_AUTH_DOMAIN: 'auth',
      VITE_FIREBASE_PROJECT_ID: 'pid',
      VITE_FIREBASE_STORAGE_BUCKET: 'bucket',
      VITE_FIREBASE_MESSAGING_SENDER_ID: 'sender',
      VITE_FIREBASE_APP_ID: 'app',
    });

    expect(config).not.toBeNull();
    expect(config?.VITE_FIREBASE_PROJECT_ID).toBe('pid');
  });

  it('keeps Firebase writes disabled by default in non-test builds', () => {
    expect(areFirebaseWritesEnabled({}, 'development')).toBe(false);
    expect(areFirebaseWritesEnabled({ VITE_ENABLE_FIREBASE_WRITES: 'false' }, 'production')).toBe(false);
  });

  it('only enables Firebase writes explicitly or in test mode', () => {
    expect(areFirebaseWritesEnabled({ VITE_ENABLE_FIREBASE_WRITES: 'true' }, 'development')).toBe(true);
    expect(areFirebaseWritesEnabled({}, 'test')).toBe(true);
  });
});
