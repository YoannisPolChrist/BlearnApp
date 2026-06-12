import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { ROUTER_FUTURE_FLAGS } from '@/lib/routerFuture';

const preloadRouteMock = vi.fn(() => Promise.resolve());
const consumePendingNavigationMock = vi.fn();
const peekPendingNavigationMock = vi.fn();
const getMonitoringStatusMock = vi.fn();
const nativeRouteReadySubscribers = new Set<() => void>();
const runtimeEvents: Array<Record<string, unknown>> = [];
const recordNativeOverlayRuntimeEventMock = vi.fn((event: Record<string, unknown>) => {
  runtimeEvents.push(event);
});

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
}

function LocationProbe() {
  const location = useLocation();
  return (
    <>
      <div data-testid="location">{location.pathname}</div>
      <div data-testid="location-search">{location.search}</div>
    </>
  );
}

async function loadHarness() {
  vi.resetModules();
  preloadRouteMock.mockClear();
  consumePendingNavigationMock.mockClear();
  peekPendingNavigationMock.mockReset();
  peekPendingNavigationMock.mockResolvedValue(null);
  getMonitoringStatusMock.mockReset();
  getMonitoringStatusMock.mockResolvedValue({
    handoffInProgress: false,
    overlayVisible: false,
    activeBlockingStage: null,
  });
  nativeRouteReadySubscribers.clear();
  runtimeEvents.length = 0;
  recordNativeOverlayRuntimeEventMock.mockClear();

  vi.doMock('@/lib/platform', () => ({
    isAndroidPlatform: true,
  }));
  vi.doMock('@/lib/routeLoaders', () => ({
    preloadRoute: preloadRouteMock,
    preloadCriticalBlockingRoutes: vi.fn().mockResolvedValue(undefined),
  }));
  vi.doMock('@/lib/nativeOverlayRuntime', () => ({
    recordNativeOverlayRuntimeEvent: recordNativeOverlayRuntimeEventMock,
    subscribeToNativeRouteReady: (listener: () => void) => {
      nativeRouteReadySubscribers.add(listener);
      return () => {
        nativeRouteReadySubscribers.delete(listener);
      };
    },
  }));
  vi.doMock('@/services/screenTimeService', () => ({
    consumePendingNavigation: consumePendingNavigationMock,
    peekPendingNavigation: peekPendingNavigationMock,
    getMonitoringStatus: getMonitoringStatusMock,
  }));
  const { useNativePendingNavigation } = await import('@/hooks/useNativePendingNavigation');

  function Harness() {
    const pending = useNativePendingNavigation();

    return (
      <>
        <LocationProbe />
        <div data-testid="pending-active">{String(pending.active)}</div>
        <div data-testid="pending-priming">{String(pending.priming)}</div>
        <div data-testid="pending-fallback">{String(pending.fallbackVisible)}</div>
      </>
    );
  }

  return {
    Harness,
    runtimeEvents,
    recordNativeOverlayRuntimeEventMock,
  };
}

describe('useNativePendingNavigation', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('preloads the concrete blocking route before navigating', async () => {
    consumePendingNavigationMock.mockResolvedValue({
      route: '/intervention?target=instagram',
    });

    const { Harness } = await loadHarness();

    render(
      <MemoryRouter future={ROUTER_FUTURE_FLAGS} initialEntries={['/']}>
        <Harness />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/intervention');
    });

    expect(consumePendingNavigationMock.mock.calls.length).toBeGreaterThanOrEqual(1);
    expect(preloadRouteMock).toHaveBeenCalledWith('/intervention');
    expect(screen.getByTestId('pending-active')).toHaveTextContent('true');
    expect(screen.getByTestId('pending-priming')).toHaveTextContent('false');

    act(() => {
      nativeRouteReadySubscribers.forEach((listener) => listener());
    });

    await waitFor(() => {
      expect(screen.getByTestId('pending-active')).toHaveTextContent('false');
    });
  });

  it('navigates to the blocking route without waiting for preload completion', async () => {
    const deferredPreload = createDeferred<void>();
    preloadRouteMock.mockImplementationOnce(() => deferredPreload.promise);
    consumePendingNavigationMock.mockResolvedValue({
      route: '/intervention?target=instagram&overlaySessionId=session-slow-preload',
      sessionId: 'session-slow-preload',
    });

    const { Harness } = await loadHarness();

    render(
      <MemoryRouter future={ROUTER_FUTURE_FLAGS} initialEntries={['/']}>
        <Harness />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/intervention');
      expect(screen.getByTestId('location-search')).toHaveTextContent('overlaySessionId=session-slow-preload');
    });

    expect(preloadRouteMock).toHaveBeenCalledWith('/intervention');
    expect(screen.getByTestId('pending-active')).toHaveTextContent('true');

    act(() => {
      nativeRouteReadySubscribers.forEach((listener) => listener());
    });

    await waitFor(() => {
      expect(screen.getByTestId('pending-active')).toHaveTextContent('false');
    });

    deferredPreload.resolve();
  });

  it('keeps a buffered handoff active even if visibility events fire again immediately after consume', async () => {
    const deferred = createDeferred<{ route: string } | null>();
    consumePendingNavigationMock.mockImplementationOnce(() => deferred.promise);

    const { Harness } = await loadHarness();

    render(
      <MemoryRouter future={ROUTER_FUTURE_FLAGS} initialEntries={['/']}>
        <Harness />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('pending-active')).toHaveTextContent('false');
    expect(screen.getByTestId('pending-priming')).toHaveTextContent('true');
    await waitFor(() => {
      expect(consumePendingNavigationMock).toHaveBeenCalledTimes(1);
    });

    act(() => {
      window.dispatchEvent(new Event('focus'));
      fireEvent(document, new Event('visibilitychange'));
    });

    expect(consumePendingNavigationMock).toHaveBeenCalledTimes(1);

    deferred.resolve({ route: '/intervention?target=instagram' });

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/intervention');
    });

    expect(preloadRouteMock).toHaveBeenCalledWith('/intervention');

    act(() => {
      window.dispatchEvent(new Event('focus'));
      fireEvent(document, new Event('visibilitychange'));
    });

    expect(consumePendingNavigationMock).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('pending-active')).toHaveTextContent('true');

    act(() => {
      nativeRouteReadySubscribers.forEach((listener) => listener());
    });

    await waitFor(() => {
      expect(screen.getByTestId('pending-active')).toHaveTextContent('false');
    });
  });

  it('keeps idle polling on a sub-second visible-state interval instead of backing off into multi-second gaps', async () => {
    vi.useFakeTimers();
    consumePendingNavigationMock.mockResolvedValue(null);

    const { Harness } = await loadHarness();

    render(
      <MemoryRouter future={ROUTER_FUTURE_FLAGS} initialEntries={['/']}>
        <Harness />
      </MemoryRouter>,
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByTestId('pending-priming')).toHaveTextContent('false');

    expect(consumePendingNavigationMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(249);
    });

    expect(consumePendingNavigationMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });

    expect(consumePendingNavigationMock).toHaveBeenCalledTimes(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(consumePendingNavigationMock).toHaveBeenCalledTimes(3);
  }, 10_000);

  it('clears the pending flag on failures and retries on the next visibility event', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    consumePendingNavigationMock
      .mockRejectedValueOnce(new Error('native queue failed'))
      .mockResolvedValueOnce(null);

    const { Harness } = await loadHarness();

    render(
      <MemoryRouter future={ROUTER_FUTURE_FLAGS} initialEntries={['/']}>
        <Harness />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('pending-active')).toHaveTextContent('false');
      expect(screen.getByTestId('pending-priming')).toHaveTextContent('false');
    });

    expect(warnSpy).toHaveBeenCalled();
    expect(consumePendingNavigationMock).toHaveBeenCalledTimes(1);

    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    await waitFor(() => {
      expect(consumePendingNavigationMock).toHaveBeenCalledTimes(2);
    });

    await waitFor(() => {
      expect(screen.getByTestId('pending-active')).toHaveTextContent('false');
      expect(screen.getByTestId('pending-priming')).toHaveTextContent('false');
    });
  });

  it('ignores stale pending navigations that target the Blearn app itself', async () => {
    consumePendingNavigationMock
      .mockResolvedValueOnce({
        route: '/intervention?targetId=app.blearn.mobile.debug',
        targetId: 'app.blearn.mobile.debug',
        targetType: 'app',
        sessionId: 'self-target',
      })
      .mockResolvedValueOnce(null);

    const { Harness } = await loadHarness();

    render(
      <MemoryRouter future={ROUTER_FUTURE_FLAGS} initialEntries={['/']}>
        <Harness />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/');
      expect(screen.getByTestId('pending-active')).toHaveTextContent('false');
      expect(screen.getByTestId('pending-priming')).toHaveTextContent('false');
    });

    expect(preloadRouteMock).not.toHaveBeenCalled();

    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    await waitFor(() => {
      expect(consumePendingNavigationMock).toHaveBeenCalledTimes(2);
    });
  });

  it('keeps waiting for a slow initial native consume instead of dropping the eventual result', async () => {
    vi.useFakeTimers();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const deferred = createDeferred<{ route: string } | null>();
    consumePendingNavigationMock.mockImplementationOnce(() => deferred.promise);

    const { Harness } = await loadHarness();

    render(
      <MemoryRouter future={ROUTER_FUTURE_FLAGS} initialEntries={['/']}>
        <Harness />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('pending-priming')).toHaveTextContent('true');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_600);
      await Promise.resolve();
    });

    expect(screen.getByTestId('pending-priming')).toHaveTextContent('true');
    expect(screen.getByTestId('pending-active')).toHaveTextContent('false');

    await act(async () => {
      deferred.resolve({ route: '/intervention?target=instagram' });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByTestId('location')).toHaveTextContent('/intervention');
    expect(screen.getByTestId('pending-active')).toHaveTextContent('true');
    expect(screen.getByTestId('pending-priming')).toHaveTextContent('false');

    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('recovers from a truly stuck initial native consume after the safety timeout', async () => {
    vi.useFakeTimers();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const deferred = createDeferred<{ route: string } | null>();
    consumePendingNavigationMock
      .mockImplementationOnce(() => deferred.promise);

    const { Harness } = await loadHarness();

    render(
      <MemoryRouter future={ROUTER_FUTURE_FLAGS} initialEntries={['/']}>
        <Harness />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('pending-priming')).toHaveTextContent('true');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(12_300);
      await Promise.resolve();
    });

    expect(screen.getByTestId('pending-priming')).toHaveTextContent('false');
    expect(screen.getByTestId('pending-active')).toHaveTextContent('false');
    expect(screen.getByTestId('pending-fallback')).toHaveTextContent('false');

    expect(warnSpy).toHaveBeenCalled();
    expect(consumePendingNavigationMock).toHaveBeenCalledTimes(1);
  });

  it('continues consuming later native navigations after the first blocking flow is finished', async () => {
    consumePendingNavigationMock
      .mockResolvedValueOnce({ route: '/intervention?target=instagram' })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ route: '/learn/review?target=youtube' });

    const { Harness } = await loadHarness();

    render(
      <MemoryRouter future={ROUTER_FUTURE_FLAGS} initialEntries={['/']}>
        <Harness />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/intervention');
    });

    act(() => {
      nativeRouteReadySubscribers.forEach((listener) => listener());
    });

    await waitFor(() => {
      expect(screen.getByTestId('pending-active')).toHaveTextContent('false');
    });

    await waitFor(
      () => {
        expect(consumePendingNavigationMock).toHaveBeenCalledTimes(3);
        expect(screen.getByTestId('location')).toHaveTextContent('/learn/review');
      },
      { timeout: 4000 },
    );

    expect(screen.getByTestId('pending-active')).toHaveTextContent('true');
  });

  it('keeps re-consuming sequential intervention overlays for penalty and lock modes', async () => {
    consumePendingNavigationMock
      .mockResolvedValueOnce({ route: '/intervention?mode=penalty&target=instagram&overlaySessionId=session-penalty' })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ route: '/intervention?mode=lock&target=youtube&overlaySessionId=session-lock' });

    const { Harness } = await loadHarness();

    render(
      <MemoryRouter future={ROUTER_FUTURE_FLAGS} initialEntries={['/']}>
        <Harness />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/intervention');
      expect(screen.getByTestId('location-search')).toHaveTextContent('mode=penalty');
    });

    expect(preloadRouteMock).toHaveBeenCalledWith('/intervention');

    act(() => {
      nativeRouteReadySubscribers.forEach((listener) => listener());
    });

    await waitFor(() => {
      expect(screen.getByTestId('pending-active')).toHaveTextContent('false');
    });

    await waitFor(
      () => {
        expect(consumePendingNavigationMock).toHaveBeenCalledTimes(3);
        expect(screen.getByTestId('location')).toHaveTextContent('/intervention');
        expect(screen.getByTestId('location-search')).toHaveTextContent('mode=lock');
      },
      { timeout: 4000 },
    );

    expect(screen.getByTestId('pending-active')).toHaveTextContent('true');
  });

  it('emits a readable runtime trail from pending navigation to the next pending item', async () => {
    consumePendingNavigationMock
      .mockResolvedValueOnce({ route: '/intervention?target=instagram&overlaySessionId=session-1' })
      .mockResolvedValueOnce({ route: '/learn/review?target=youtube&overlaySessionId=session-2' });

    const { Harness, runtimeEvents, recordNativeOverlayRuntimeEventMock } = await loadHarness();

    render(
      <MemoryRouter future={ROUTER_FUTURE_FLAGS} initialEntries={['/']}>
        <Harness />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/intervention');
    });

    act(() => {
      nativeRouteReadySubscribers.forEach((listener) => listener());
    });

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/learn/review');
    });

    const stages = runtimeEvents.map((event) => event.stage);
    expect(stages).toEqual(
      expect.arrayContaining(['pending-navigation', 'route-preload', 'handoff-complete', 'next-pending-item']),
    );
    expect(recordNativeOverlayRuntimeEventMock).toHaveBeenCalled();
  });
});
