import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  resetCloudSyncRuntimeForTests,
  useCloudSyncRuntimeStore,
} from '@/lib/cloudSyncRuntime';
import {
  resetLearningCloudImmediateSaveForTests,
  setLearningCloudImmediateSaveHandler,
} from '@/lib/learningCloudImmediateSave';
import { useLearningCloudSaveRetry } from '../useLearningCloudSaveRetry';

describe('useLearningCloudSaveRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetCloudSyncRuntimeForTests();
    resetLearningCloudImmediateSaveForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
    resetLearningCloudImmediateSaveForTests();
  });

  it('retryt im Fehlerzustand mit exponentiellem Backoff, bis der Save gelingt', async () => {
    const flush = vi.fn(async () => {
      // Zweiter Versuch gelingt und setzt den Status wie der echte Save-Pfad.
      if (flush.mock.calls.length >= 2) {
        useCloudSyncRuntimeStore.getState().setLearning({ status: 'ready', currentError: null });
        return true;
      }
      return false;
    });
    setLearningCloudImmediateSaveHandler(flush);

    act(() => {
      useCloudSyncRuntimeStore.getState().setLearning({ status: 'error', currentError: 'offline' });
    });
    renderHook(() => useLearningCloudSaveRetry(true));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(flush).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(flush).toHaveBeenCalledTimes(2);

    // Nach Erfolg: keine weiteren Versuche mehr.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(120_000);
    });
    expect(flush).toHaveBeenCalledTimes(2);
  });

  it('retryt sofort bei Netz-Rückkehr (online-Event)', async () => {
    const flush = vi.fn(async () => false);
    setLearningCloudImmediateSaveHandler(flush);

    act(() => {
      useCloudSyncRuntimeStore.getState().setLearning({ status: 'error', currentError: 'offline' });
    });
    renderHook(() => useLearningCloudSaveRetry(true));

    await act(async () => {
      window.dispatchEvent(new Event('online'));
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(flush).toHaveBeenCalledWith('connectivity_recovered_retry');
  });

  it('tut nichts, wenn der Sync nicht im Fehlerzustand ist', async () => {
    const flush = vi.fn(async () => true);
    setLearningCloudImmediateSaveHandler(flush);

    renderHook(() => useLearningCloudSaveRetry(true));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600_000);
    });
    expect(flush).not.toHaveBeenCalled();
  });
});
