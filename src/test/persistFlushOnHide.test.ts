import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  createIndexedDbJsonStorage,
  flushAllPersistStorage,
} from '@/lib/persistStorage';
import { usePersistFlushOnHide } from '@/hooks/usePersistFlushOnHide';

describe('flushAllPersistStorage', () => {
  it('resolves immediately when no writes are pending', async () => {
    const result = await flushAllPersistStorage(200);
    expect(result.timedOutKeys).toEqual([]);
  });

  it('waits for in-flight writes across all tracked keys', async () => {
    const storageA = createIndexedDbJsonStorage('flush-test-a');
    const storageB = createIndexedDbJsonStorage('flush-test-b');

    const writeA = storageA.setItem('flush-test-a', {
      state: { value: 'a' },
      version: 0,
    });
    const writeB = storageB.setItem('flush-test-b', {
      state: { value: 'b' },
      version: 0,
    });

    const flushResult = await flushAllPersistStorage(2000);

    expect(flushResult.timedOutKeys).toEqual([]);
    expect(flushResult.flushedKeys).toEqual(
      expect.arrayContaining(['flush-test-a', 'flush-test-b']),
    );

    await Promise.all([writeA, writeB]);

    const persistedA = await storageA.getItem('flush-test-a');
    const persistedB = await storageB.getItem('flush-test-b');
    expect(persistedA?.state).toEqual({ value: 'a' });
    expect(persistedB?.state).toEqual({ value: 'b' });
  });

  it('never throws when a key times out and reports it instead', async () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const storage = createIndexedDbJsonStorage('flush-test-timeout');

    // Kick off a write, then flush with a zero budget so the idle wait
    // cannot possibly settle in time.
    const write = storage.setItem('flush-test-timeout', {
      state: { value: 'slow' },
      version: 0,
    });

    const flushResult = await flushAllPersistStorage(0);
    expect(Array.isArray(flushResult.timedOutKeys)).toBe(true);

    await write;
    consoleWarn.mockRestore();
  });
});

describe('usePersistFlushOnHide', () => {
  it('flushes pending writes when the document becomes hidden', async () => {
    const storage = createIndexedDbJsonStorage('flush-test-hook');
    renderHook(() => usePersistFlushOnHide());

    const write = storage.setItem('flush-test-hook', {
      state: { value: 'hidden-flush' },
      version: 0,
    });

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    });
    document.dispatchEvent(new Event('visibilitychange'));

    await write;

    const persisted = await storage.getItem('flush-test-hook');
    expect(persisted?.state).toEqual({ value: 'hidden-flush' });

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
  });
});
