import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

const completeNativeRouteHandoffMock = vi.fn();
const learningStoreRehydrationMock = vi.fn();
const learningCloudSyncMock = vi.fn();
const learningBackgroundRuntimeMock = vi.fn();
const nativeSyncMock = vi.fn();
const globalRuntimeManagersEnabledMock = vi.fn();
const runtimeEvents: Array<Record<string, unknown>> = [];
const routeLoaderPrimeSkipKeys = new Set<string>();
const recordNativeOverlayRuntimeEventMock = vi.fn((event: Record<string, unknown>) => {
  runtimeEvents.push(event);
});

afterEach(() => {
  cleanup();
  window.location.hash = '#/';
  vi.doUnmock('@/lib/platform');
  vi.doUnmock('@/lib/nativeOverlayRuntime');
  vi.doUnmock('@/lib/nativeRouteHandoff');
  vi.doUnmock('@/lib/routeLoaders');
  vi.doUnmock('@/components/setup/AppTourProvider');
  vi.doUnmock('@/components/setup/appTourContext');
  vi.doUnmock('@/components/setup/appTourSteps');
  vi.doUnmock('@/components/setup/AppIntroDialog');
  vi.doUnmock('@/components/runtime/GlobalRuntimeManagers');
  vi.doUnmock('@/components/settings/NotificationPermissionPrompt');
  vi.doUnmock('@/components/BottomNav');
  vi.doUnmock('@/hooks/useLearningCloudSync');
  vi.doUnmock('@/hooks/useLearningBackgroundRuntime');
  vi.doUnmock('@/hooks/useNativePendingNavigation');
  vi.doUnmock('@/hooks/useNativeSync');
  vi.doUnmock('@/hooks/useStrictLockExpirySync');
  vi.doUnmock('@/services/notificationService');
  vi.resetModules();
  vi.restoreAllMocks();
  runtimeEvents.length = 0;
});

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  window.location.hash = '#/';
  routeLoaderPrimeSkipKeys.clear();
});

function mockSharedAppShell(
  pendingRef: { current: { active: boolean; priming: boolean } },
  routeLoadersOverride: Record<string, () => Promise<{ default: () => ReactNode }>> = {},
) {
  routeLoaderPrimeSkipKeys.clear();
  for (const [key, loader] of Object.entries(routeLoadersOverride)) {
    if (typeof loader === 'function') {
      routeLoaderPrimeSkipKeys.add(key);
    }
  }
  vi.doMock('@/lib/platform', () => ({
    getPlatform: () => 'android',
    platform: 'android',
    isAndroidPlatform: true,
    isNativePlatform: true,
  }));
  vi.doMock('@/lib/nativeRouteHandoff', () => ({
    completeNativeRouteHandoff: completeNativeRouteHandoffMock,
  }));
  vi.doMock('@/lib/nativeOverlayRuntime', () => ({
    recordNativeOverlayRuntimeEvent: recordNativeOverlayRuntimeEventMock,
  }));
  vi.doMock('@/lib/routeLoaders', () => ({
    routeLoaders: {
      index: async () => ({ default: () => <div>Index screen</div> }),
      intervention: async () => ({ default: () => <div>Intervention screen</div> }),
      breathing: async () => ({ default: () => <div>Breathing screen</div> }),
      checkin: async () => ({ default: () => <div>Checkin screen</div> }),
      stats: async () => ({ default: () => <div>Stats screen</div> }),
      modes: async () => ({ default: () => <div>Modes screen</div> }),
      pause: async () => ({ default: () => <div>Pause screen</div> }),
      settings: async () => ({ default: () => <div>Settings screen</div> }),
      screenTime: async () => ({ default: () => <div>ScreenTime screen</div> }),
      learn: async () => ({ default: () => <div>Learn screen</div> }),
      learnTemplates: async () => ({ default: () => <div>Learn templates screen</div> }),
      learnStudio: async () => ({ default: () => <div>Learn studio screen</div> }),
      learnBrowser: async () => ({ default: () => <div>Learn browser screen</div> }),
      learnFilteredDeck: async () => ({ default: () => <div>Learn filtered deck screen</div> }),
      learnReview: async () => ({ default: () => <div>Learn review screen</div> }),
      wallet: async () => ({ default: () => <div>Wallet screen</div> }),
      notFound: async () => ({ default: () => <div>Not found screen</div> }),
      ...routeLoadersOverride,
    },
    preloadCriticalBlockingRoutes: vi.fn().mockResolvedValue(undefined),
    preloadMainTabRoutes: vi.fn(),
  }));
  vi.doMock('@/components/setup/AppTourProvider', () => ({
    AppTourProvider: ({ children }: { children: ReactNode; steps?: unknown[] }) => <>{children}</>,
  }));
  vi.doMock('@/components/setup/appTourContext', () => ({
    useAppTour: () => ({
      isOpen: false,
      currentStepId: null,
      openTour: vi.fn(),
    }),
  }));
  vi.doMock('@/components/setup/appTourSteps', () => ({
    APP_TOUR_STEPS: [],
  }));
  vi.doMock('@/components/setup/AppIntroDialog', () => ({
    default: () => null,
  }));
  vi.doMock('@/components/runtime/GlobalRuntimeManagers', () => ({
    default: ({ enabled }: { enabled: boolean }) => {
      globalRuntimeManagersEnabledMock(enabled);
      return null;
    },
  }));
  vi.doMock('@/components/settings/NotificationPermissionPrompt', () => ({
    default: () => null,
  }));
  vi.doMock('@/components/BottomNav', () => ({
    default: () => <nav>Bottom nav</nav>,
  }));
  vi.doMock('@/hooks/useNativePendingNavigation', () => ({
    useNativePendingNavigation: () => pendingRef.current,
  }));
  vi.doMock('@/hooks/useLearningCloudSync', () => ({
    useLearningStoreRehydration: learningStoreRehydrationMock,
    useLearningCloudSync: learningCloudSyncMock,
  }));
  vi.doMock('@/hooks/useLearningBackgroundRuntime', () => ({
    useLearningBackgroundRuntime: learningBackgroundRuntimeMock,
  }));
  vi.doMock('@/hooks/useNativeSync', () => ({
    useNativeSync: nativeSyncMock,
  }));
  vi.doMock('@/hooks/useStrictLockExpirySync', () => ({
    useStrictLockExpirySync: () => undefined,
  }));
  vi.doMock('@/services/notificationService', () => ({
    getNotificationPermissionState: vi.fn().mockResolvedValue('default'),
  }));
  vi.doMock('@/components/sync/SyncReminderDialog', () => ({
    SyncReminderDialog: () => null,
  }));
}

async function primeLazyModules() {
  const [{ routeLoaders }] = await Promise.all([
    import('@/lib/routeLoaders'),
    import('@/components/runtime/GlobalRuntimeManagers'),
    import('@/components/setup/AppIntroDialog'),
    import('@/components/setup/AuthDialog'),
  ]);

  await Promise.all(
    Object.entries(routeLoaders).map(async ([key, loader]) => {
      if (routeLoaderPrimeSkipKeys.has(key)) {
        return;
      }
      await loader();
    }),
  );
}

async function renderAppShell() {
  await primeLazyModules();
  const { default: App } = await import('@/App');
  let view!: ReturnType<typeof render>;

  await act(async () => {
    view = render(<App />);
    await settleAsyncUi();
  });

  await act(async () => {
    await settleAsyncUi();
  });

  return { App, ...view };
}

async function settleAsyncUi() {
  for (let index = 0; index < 3; index += 1) {
    await Promise.resolve();
    await Promise.resolve();
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  }
}

async function findTextInAct(text: string | RegExp) {
  let element!: Awaited<ReturnType<typeof screen.findByText>>;

  await act(async () => {
    element = await screen.findByText(text);
    await settleAsyncUi();
  });

  return element;
}

describe('App blocking fallback', () => {
  it('shows the blocking fallback while native navigation is still pending', async () => {
    vi.resetModules();
    completeNativeRouteHandoffMock.mockReset();
    completeNativeRouteHandoffMock.mockResolvedValue(undefined);
    recordNativeOverlayRuntimeEventMock.mockClear();
    learningStoreRehydrationMock.mockClear();
    learningCloudSyncMock.mockClear();
    learningBackgroundRuntimeMock.mockClear();
    nativeSyncMock.mockClear();
    const pendingRef = { current: { active: true, priming: false } };
    mockSharedAppShell(pendingRef);

    await renderAppShell();

    expect(screen.getByTestId('blocking-handoff-shell')).toBeInTheDocument();
    expect(screen.queryByTestId('route-loading-fallback')).toBeNull();
    expect(screen.queryByText('Index screen')).toBeNull();
    expect(screen.queryByRole('navigation')).toBeNull();
    expect(globalRuntimeManagersEnabledMock).toHaveBeenLastCalledWith(false);
    expect(learningStoreRehydrationMock).not.toHaveBeenCalled();
    expect(learningCloudSyncMock).not.toHaveBeenCalled();
    expect(learningBackgroundRuntimeMock).not.toHaveBeenCalled();
    expect(nativeSyncMock).not.toHaveBeenCalled();
  }, 10_000);

  it('shows a lightweight route fallback while a non-blocking screen is still lazy-loading', async () => {
    vi.resetModules();
    completeNativeRouteHandoffMock.mockReset();
    completeNativeRouteHandoffMock.mockResolvedValue(undefined);
    recordNativeOverlayRuntimeEventMock.mockClear();
    const pendingRef = { current: { active: false, priming: false } };
    let resolveIndexLoader!: (value: { default: () => ReactNode }) => void;
    const indexLoader = new Promise<{ default: () => ReactNode }>((resolve) => {
      resolveIndexLoader = resolve;
    });
    mockSharedAppShell(pendingRef, {
      index: async () => indexLoader,
    });

    await renderAppShell();

    expect(await screen.findByTestId('route-loading-fallback')).toBeInTheDocument();
    expect(screen.getByText(/bereich wird geladen/i)).toBeInTheDocument();
    expect(screen.getByRole('navigation')).toBeInTheDocument();

    await act(async () => {
      resolveIndexLoader({ default: () => <div>Index screen</div> });
      await settleAsyncUi();
    });

    expect(await findTextInAct('Index screen')).toBeInTheDocument();
  }, 10_000);

  it('shows a stable loading shell once a concrete blocking route is already known', async () => {
    vi.resetModules();
    completeNativeRouteHandoffMock.mockReset();
    completeNativeRouteHandoffMock.mockResolvedValue(undefined);
    recordNativeOverlayRuntimeEventMock.mockClear();
    const pendingRef = {
      current: {
        active: true,
        priming: false,
        route: '/learn/review?overlaySessionId=session-learn',
        mode: 'learn',
        targetLabel: 'Instagram',
        targetType: 'app',
      },
    };
    mockSharedAppShell(pendingRef as { current: { active: boolean; priming: boolean } });

    await renderAppShell();

    expect(screen.getByTestId('blocking-handoff-shell')).toBeInTheDocument();
    expect(screen.queryByTestId('route-loading-fallback')).toBeNull();
    expect(screen.queryByText('Index screen')).toBeNull();
  }, 10_000);

  it('returns to the normal app shell once pending navigation clears', async () => {
    vi.resetModules();
    completeNativeRouteHandoffMock.mockReset();
    completeNativeRouteHandoffMock.mockResolvedValue(undefined);
    recordNativeOverlayRuntimeEventMock.mockClear();
    const pendingRef = { current: { active: true, priming: false } };
    mockSharedAppShell(pendingRef);

    const { App, rerender } = await renderAppShell();

    expect(screen.getByTestId('blocking-handoff-shell')).toBeInTheDocument();

    pendingRef.current = { active: false, priming: false, handoffActive: false, fallbackVisible: false };
    await act(async () => {
      rerender(<App key="ready" />);
      await settleAsyncUi();
    });

    await waitFor(() => {
      expect(screen.queryByTestId('route-loading-fallback')).toBeNull();
    });
    expect(await findTextInAct('Index screen')).toBeInTheDocument();
    expect(screen.getByRole('navigation')).toBeInTheDocument();
  }, 10_000);

  it('shows the neutral loading shell when the handoff explicitly times out', async () => {
    vi.resetModules();
    completeNativeRouteHandoffMock.mockReset();
    completeNativeRouteHandoffMock.mockResolvedValue(undefined);
    recordNativeOverlayRuntimeEventMock.mockClear();
    const pendingRef = {
      current: {
        active: false,
        priming: false,
        handoffActive: false,
        fallbackVisible: true,
        fallbackReason: 'timeout',
      },
    };
    mockSharedAppShell(pendingRef as { current: { active: boolean; priming: boolean } });

    await renderAppShell();

    expect(screen.getByTestId('blocking-loading-shell')).toBeInTheDocument();
    expect(screen.getByText(/blearn schützt gerade deinen fokus/i)).toBeInTheDocument();
    expect(screen.queryByText('Index screen')).toBeNull();
  }, 10_000);

  it('keeps the normal app shell visible while native navigation is only priming', async () => {
    vi.resetModules();
    completeNativeRouteHandoffMock.mockReset();
    completeNativeRouteHandoffMock.mockResolvedValue(undefined);
    recordNativeOverlayRuntimeEventMock.mockClear();
    const pendingRef = { current: { active: false, priming: true } };
    mockSharedAppShell(pendingRef);

    await renderAppShell();

    expect(screen.queryByTestId('blocking-handoff-shell')).toBeNull();
    expect(await screen.findByText('Index screen')).toBeInTheDocument();
    expect(screen.getByRole('navigation')).toBeInTheDocument();
    expect(globalRuntimeManagersEnabledMock).toHaveBeenLastCalledWith(false);
  }, 10_000);

  it('keeps runtime managers enabled while the emergency fallback shell is visible', async () => {
    vi.resetModules();
    completeNativeRouteHandoffMock.mockReset();
    completeNativeRouteHandoffMock.mockResolvedValue(undefined);
    recordNativeOverlayRuntimeEventMock.mockClear();
    globalRuntimeManagersEnabledMock.mockClear();
    const pendingRef = {
      current: {
        active: false,
        priming: false,
        handoffActive: false,
        fallbackVisible: true,
        fallbackReason: 'timeout',
      },
    };
    mockSharedAppShell(pendingRef as { current: { active: boolean; priming: boolean } });

    await renderAppShell();

    expect(screen.getByTestId('blocking-loading-shell')).toBeInTheDocument();
    expect(globalRuntimeManagersEnabledMock).toHaveBeenLastCalledWith(true);
  }, 10_000);

  it('completes the native handoff once a pending blocking route is mounted', async () => {
    vi.resetModules();
    completeNativeRouteHandoffMock.mockReset();
    completeNativeRouteHandoffMock.mockResolvedValue(undefined);
    recordNativeOverlayRuntimeEventMock.mockClear();
    const pendingRef = { current: { active: true, priming: false } };
    mockSharedAppShell(pendingRef);
    window.location.hash = '#/intervention?overlaySessionId=session-1';

    await renderAppShell();

    expect(await findTextInAct('Intervention screen')).toBeInTheDocument();
    await waitFor(() => {
      expect(completeNativeRouteHandoffMock).toHaveBeenCalledTimes(1);
    });
    expect(runtimeEvents.map((event) => event.stage)).toEqual(
      expect.arrayContaining(['overlay-session', 'route-mounted', 'handoff-complete']),
    );
  }, 10_000);

  it('still completes the native handoff when the blocking route is mounted after the pending flag already cleared', async () => {
    vi.resetModules();
    completeNativeRouteHandoffMock.mockReset();
    completeNativeRouteHandoffMock.mockResolvedValue(undefined);
    recordNativeOverlayRuntimeEventMock.mockClear();
    const pendingRef = { current: { active: false, priming: false } };
    mockSharedAppShell(pendingRef);
    window.location.hash = '#/learn/review?overlaySessionId=session-2';

    await renderAppShell();

    expect(await findTextInAct('Learn review screen')).toBeInTheDocument();
    await waitFor(() => {
      expect(completeNativeRouteHandoffMock).toHaveBeenCalledTimes(1);
    });
    expect(runtimeEvents.map((event) => event.stage)).toEqual(
      expect.arrayContaining(['overlay-session', 'route-mounted', 'handoff-complete']),
    );
  }, 10_000);

  it.each(['penalty', 'lock'] as const)(
    'completes the native handoff for /intervention overlays in %s mode',
    async (mode) => {
      vi.resetModules();
      completeNativeRouteHandoffMock.mockReset();
      completeNativeRouteHandoffMock.mockResolvedValue(undefined);
      recordNativeOverlayRuntimeEventMock.mockClear();
      const pendingRef = { current: { active: false, priming: false } };
      mockSharedAppShell(pendingRef);
      window.location.hash = `#/intervention?mode=${mode}&overlaySessionId=session-${mode}`;

      await renderAppShell();

      expect(await findTextInAct('Intervention screen')).toBeInTheDocument();
      await waitFor(() => {
        expect(completeNativeRouteHandoffMock).toHaveBeenCalledTimes(1);
      });
      expect(runtimeEvents.map((event) => event.stage)).toEqual(
        expect.arrayContaining(['overlay-session', 'route-mounted', 'handoff-complete']),
      );
    },
    10_000,
  );
});
