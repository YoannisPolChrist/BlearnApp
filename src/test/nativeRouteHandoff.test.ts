import { afterEach, describe, expect, it, vi } from 'vitest';

const completePendingNavigationMock = vi.fn<() => Promise<void>>();
const notifyNativeRouteReadyMock = vi.fn();

async function loadModule() {
  vi.resetModules();

  vi.doMock('@/services/screenTimeService', () => ({
    completePendingNavigation: completePendingNavigationMock,
  }));
  vi.doMock('@/lib/nativeOverlayRuntime', () => ({
    notifyNativeRouteReady: notifyNativeRouteReadyMock,
  }));

  return import('@/lib/nativeRouteHandoff');
}

afterEach(() => {
  completePendingNavigationMock.mockReset();
  notifyNativeRouteReadyMock.mockReset();
  vi.doUnmock('@/services/screenTimeService');
  vi.doUnmock('@/lib/nativeOverlayRuntime');
  vi.restoreAllMocks();
  vi.resetModules();
});

describe('completeNativeRouteHandoff', () => {
  it('does not re-emit route ready for an already completed overlay session', async () => {
    completePendingNavigationMock.mockResolvedValue(undefined);
    const { completeNativeRouteHandoff } = await loadModule();

    await completeNativeRouteHandoff('session-1');
    expect(completePendingNavigationMock).toHaveBeenCalledTimes(1);
    expect(notifyNativeRouteReadyMock).toHaveBeenCalledTimes(1);

    await completeNativeRouteHandoff('session-1');
    expect(completePendingNavigationMock).toHaveBeenCalledTimes(1);
    expect(notifyNativeRouteReadyMock).toHaveBeenCalledTimes(1);
  });

  it('still completes distinct overlay sessions independently', async () => {
    completePendingNavigationMock.mockResolvedValue(undefined);
    const { completeNativeRouteHandoff } = await loadModule();

    await completeNativeRouteHandoff('session-1');
    await completeNativeRouteHandoff('session-2');

    expect(completePendingNavigationMock).toHaveBeenCalledTimes(2);
    expect(notifyNativeRouteReadyMock).toHaveBeenCalledTimes(2);
  });

  it('does not emit route ready when native completion fails and retries the same session later', async () => {
    completePendingNavigationMock
      .mockRejectedValueOnce(new Error('bridge unavailable'))
      .mockResolvedValueOnce(undefined);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { completeNativeRouteHandoff } = await loadModule();

    await completeNativeRouteHandoff('session-1');
    expect(completePendingNavigationMock).toHaveBeenCalledTimes(1);
    expect(notifyNativeRouteReadyMock).not.toHaveBeenCalled();

    await completeNativeRouteHandoff('session-1');
    expect(completePendingNavigationMock).toHaveBeenCalledTimes(2);
    expect(notifyNativeRouteReadyMock).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalled();
  });
});
