import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { ThemeProvider } from 'next-themes';
import AppSettings from '@/pages/AppSettings';
import IndexPage from '@/pages/Index';
import LearnPage from '@/pages/Learn';
import ModesPage from '@/pages/Modes';
import AppIntroDialog from '@/components/setup/AppIntroDialog';
import { AppTourProvider } from '@/components/setup/AppTourProvider';
import { APP_TOUR_DISMISSED_STORAGE_KEY } from '@/components/setup/appTourStorage';
import { APP_TOUR_STEPS } from '@/components/setup/appTourSteps';
import { ROUTER_FUTURE_FLAGS } from '@/lib/routerFuture';
import { useAppStore } from '@/store/useAppStore';
import { useLearningStore } from '@/store/useLearningStore';
import { useModeDraftStore } from '@/store/useModeDraftStore';

const runtimeFlags = vi.hoisted(() => ({
  isNative: false,
}));

const checkPermissionsMock = vi.hoisted(() => vi.fn());
const getMonitoringStatusMock = vi.hoisted(() => vi.fn());
const requestUsagePermissionMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const requestOverlayPermissionMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const requestAccessibilityPermissionMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const realDateNow = Date.now;

const monitoringStatusResolved = {
  monitoringActive: true,
  vpnActive: false,
  overlayPermission: true,
  accessibilityPermission: true,
  accessibilityServiceReady: true,
  websiteBlockingAvailable: false,
  websiteBlockingEnabled: false,
  websiteBlockingPermission: false,
  handoffInProgress: false,
  overlayVisible: false,
  pendingQueueLength: 0,
  recentBlockingEvents: [],
  currentAppId: 'com.example.focus',
};

const grantedPermissionStatus = {
  usageStats: true,
  overlay: true,
  accessibility: true,
  vpnPermission: false,
  websiteBlockingAvailable: false,
  websiteBlockingActive: false,
};

vi.mock('@/services/screenTimeService', async () => {
  const actual = await vi.importActual<typeof import('@/services/screenTimeService')>('@/services/screenTimeService');

  return {
    ...actual,
    get isNative() {
      return runtimeFlags.isNative;
    },
    checkPermissions: checkPermissionsMock,
    getMonitoringStatus: getMonitoringStatusMock,
    requestUsagePermission: requestUsagePermissionMock,
    requestOverlayPermission: requestOverlayPermissionMock,
    requestAccessibilityPermission: requestAccessibilityPermissionMock,
    formatScreenTime: vi.fn().mockReturnValue('0m'),
    getInstalledApps: vi.fn().mockResolvedValue([
      {
        appId: 'com.google.android.youtube',
        label: 'YouTube',
        packageName: 'com.google.android.youtube',
        appName: 'YouTube',
      },
    ]),
    getTodayUsage: vi.fn().mockResolvedValue({ totalScreenTimeMs: 0 }),
  };
});

function renderWithProviders(node: ReactNode) {
  return render(
    <ThemeProvider attribute="class" forcedTheme="light">
      {node}
    </ThemeProvider>,
  );
}

async function renderTourApp(initialEntries: string[]) {
  let view: ReturnType<typeof render> | undefined;

  await act(async () => {
    view = renderWithProviders(
      <MemoryRouter future={ROUTER_FUTURE_FLAGS} initialEntries={initialEntries}>
        <AppTourProvider steps={APP_TOUR_STEPS}>
          <Routes>
            <Route path="/" element={<IndexPage />} />
            <Route path="/settings" element={<AppSettings />} />
            <Route path="/modes" element={<ModesPage />} />
            <Route path="/learn" element={<LearnPage />} />
          </Routes>
          <AppIntroDialog />
          <LocationProbe />
        </AppTourProvider>
      </MemoryRouter>,
    );

    await Promise.resolve();
  });

  return view as ReturnType<typeof render>;
}

function LocationProbe() {
  const location = useLocation();

  return <div data-testid="location-probe">{location.pathname}</div>;
}

function setViewportWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: width,
  });
}

function installMatchMediaMock() {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: window.innerWidth < 768,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function restoreDateNow() {
  Object.defineProperty(Date, 'now', {
    configurable: true,
    writable: true,
    value: realDateNow,
  });
}

function resetStores() {
  window.localStorage.clear();
  delete (window as Window & { __blearnNativeHandoffActive?: boolean }).__blearnNativeHandoffActive;

  const initialAppState = useAppStore.getInitialState();
  useAppStore.setState(
    {
      ...initialAppState,
      hasHydrated: true,
    },
    true,
  );
  useLearningStore.setState(useLearningStore.getInitialState(), true);
  useModeDraftStore.setState(useModeDraftStore.getInitialState(), true);
}

async function clickButton(name: RegExp) {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name }));
    await Promise.resolve();
  });
}

async function clickEnabledButton(name: RegExp) {
  const button = await screen.findByRole('button', { name });

  await waitFor(() => {
    expect(button).not.toBeDisabled();
  });

  await clickButton(name);
}

describe('App intro flow', () => {
  beforeEach(() => {
    runtimeFlags.isNative = false;
    setViewportWidth(1280);
    installMatchMediaMock();
    resetStores();
    checkPermissionsMock.mockReset();
    getMonitoringStatusMock.mockReset();
    requestUsagePermissionMock.mockReset();
    requestOverlayPermissionMock.mockReset();
    requestAccessibilityPermissionMock.mockReset();
    checkPermissionsMock.mockResolvedValue(grantedPermissionStatus);
    getMonitoringStatusMock.mockResolvedValue(monitoringStatusResolved);
    requestUsagePermissionMock.mockResolvedValue(undefined);
    requestOverlayPermissionMock.mockResolvedValue(undefined);
    requestAccessibilityPermissionMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
    resetStores();
    vi.useRealTimers();
    restoreDateNow();
    vi.clearAllMocks();
  });

  it('opens on the first dashboard visit and starts with what Blearn can do', async () => {
    await renderTourApp(['/']);

    await screen.findByText('0m');
    expect(await screen.findByRole('dialog', { name: 'Blearn starten' })).toBeInTheDocument();
    expect((await screen.findAllByText(/block and learn/i)).length).toBeGreaterThan(0);
    expect(await screen.findByText('Apps erkennen')).toBeInTheDocument();
    expect(await screen.findByText('Direkt stoppen')).toBeInTheDocument();

    await clickButton(/dialog schlie/i);

    await waitFor(() => {
      expect(useAppStore.getState().appIntroSeen).toBe(true);
    });
    expect(window.localStorage.getItem(APP_TOUR_DISMISSED_STORAGE_KEY)).toBe('true');
  });

  it('does not auto-open before hydration, then opens once hydration finishes', async () => {
    useAppStore.setState({ hasHydrated: false });

    await renderTourApp(['/']);
    await screen.findByText('0m');

    expect(screen.queryByRole('dialog', { name: 'Blearn starten' })).not.toBeInTheDocument();

    act(() => {
      useAppStore.setState({ hasHydrated: true });
    });

    expect(await screen.findByRole('dialog', { name: 'Blearn starten' })).toBeInTheDocument();
    expect((await screen.findAllByText(/block and learn/i)).length).toBeGreaterThan(0);
  });

  it('does not reopen the intro after it was already seen', async () => {
    useAppStore.setState(
      {
        ...useAppStore.getInitialState(),
        appIntroSeen: true,
        hasHydrated: true,
      },
      true,
    );

    await renderTourApp(['/']);

    await screen.findByText('0m');
    expect(screen.queryByRole('dialog', { name: 'Blearn starten' })).not.toBeInTheDocument();
  });

  it('keeps the intro dismissed across remounts even if store state is reset', async () => {
    const firstView = await renderTourApp(['/']);

    await screen.findByRole('dialog', { name: 'Blearn starten' });
    await clickButton(/dialog schlie/i);

    await waitFor(() => {
      expect(window.localStorage.getItem(APP_TOUR_DISMISSED_STORAGE_KEY)).toBe('true');
    });

    firstView.unmount();

    useAppStore.setState(
      {
        ...useAppStore.getInitialState(),
        appIntroSeen: false,
        hasHydrated: true,
      },
      true,
    );

    await renderTourApp(['/']);
    await screen.findByText('0m');

    expect(screen.queryByRole('dialog', { name: 'Blearn starten' })).not.toBeInTheDocument();
  });

  it('waits with auto-opening the intro while a native blocking handoff is active', async () => {
    (window as Window & { __blearnNativeHandoffActive?: boolean }).__blearnNativeHandoffActive = true;

    await renderTourApp(['/']);
    await screen.findByText('0m');

    expect(screen.queryByRole('dialog', { name: 'Blearn starten' })).not.toBeInTheDocument();

    await act(async () => {
      (window as Window & { __blearnNativeHandoffActive?: boolean }).__blearnNativeHandoffActive = false;
      await new Promise((resolve) => window.setTimeout(resolve, 250));
    });

    expect(await screen.findByRole('dialog', { name: 'Blearn starten' })).toBeInTheDocument();
  });

  it('can reopen the guided intro from settings even when the dismiss key is already set', async () => {
    window.localStorage.setItem(APP_TOUR_DISMISSED_STORAGE_KEY, 'true');
    useAppStore.setState(
      {
        ...useAppStore.getInitialState(),
        appIntroSeen: true,
        hasHydrated: true,
      },
      true,
    );

    await renderTourApp(['/settings']);

    const openIntroLabel = await screen.findByText(/app-einf/i);
    fireEvent.click(openIntroLabel.closest('button') as HTMLButtonElement);

    expect(await screen.findByRole('dialog', { name: 'Blearn starten' })).toBeInTheDocument();
    expect((await screen.findAllByText(/block and learn/i)).length).toBeGreaterThan(0);
  });

  it('returns to the app root after the tour is completed', async () => {
    window.localStorage.setItem(APP_TOUR_DISMISSED_STORAGE_KEY, 'true');
    useAppStore.setState(
      {
        ...useAppStore.getInitialState(),
        appIntroSeen: true,
        hasHydrated: true,
      },
      true,
    );

    await renderTourApp(['/settings']);

    await clickEnabledButton(/app-einf/i);
    expect(await screen.findByRole('dialog', { name: 'Blearn starten' })).toBeInTheDocument();

    await clickEnabledButton(/^weiter$/i);
    await clickEnabledButton(/^weiter$/i);
    await clickEnabledButton(/^weiter$/i);
    await clickEnabledButton(/^loslegen$/i);

    await waitFor(() => {
      expect(screen.getByTestId('location-probe')).toHaveTextContent('/');
    });
  });

  it('guides native users through permissions and rechecks usage access after returning from Android settings', async () => {
    runtimeFlags.isNative = true;
    checkPermissionsMock
      .mockResolvedValueOnce({
        ...grantedPermissionStatus,
        usageStats: false,
        overlay: false,
        accessibility: false,
      })
      .mockResolvedValue({
        ...grantedPermissionStatus,
        usageStats: true,
        overlay: false,
        accessibility: false,
      });

    await renderTourApp(['/']);

    expect(await screen.findByRole('dialog', { name: 'Blearn starten' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /dialog schlie/i })).toBeDisabled();

    await clickButton(/^weiter/i);
    expect(await screen.findByText('Nutzungszugriff freigeben')).toBeInTheDocument();
    expect(await screen.findByText('Fehlt')).toBeInTheDocument();

    await clickButton(/nutzungszugriff .ffnen/i);
    expect(requestUsagePermissionMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      window.dispatchEvent(new Event('focus'));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(checkPermissionsMock.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
    expect((await screen.findAllByText('Aktiv')).length).toBeGreaterThan(0);
  }, 15_000);

  it('does not finish native setup before the accessibility service is really ready', async () => {
    runtimeFlags.isNative = true;
    checkPermissionsMock.mockResolvedValue(grantedPermissionStatus);
    getMonitoringStatusMock.mockResolvedValue({
      ...monitoringStatusResolved,
      accessibilityServiceReady: false,
    });

    await renderTourApp(['/']);

    expect(await screen.findByRole('dialog', { name: 'Blearn starten' })).toBeInTheDocument();
    await clickButton(/^weiter$/i);
    await clickButton(/^weiter$/i);
    await clickButton(/^weiter$/i);

    expect(await screen.findByRole('heading', { name: 'Bedienungshilfe aktivieren' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /rechte fehlen noch/i })).toBeDisabled();

    getMonitoringStatusMock.mockResolvedValue({
      ...monitoringStatusResolved,
      accessibilityServiceReady: true,
    });

    await act(async () => {
      window.dispatchEvent(new Event('focus'));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^loslegen$/i })).not.toBeDisabled();
    });
  });

  it('accepts a recent accessibility reconnect window during native setup', async () => {
    runtimeFlags.isNative = true;
    const now = new Date('2026-04-17T12:00:00.000Z').getTime();
    const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(now);
    checkPermissionsMock.mockResolvedValue(grantedPermissionStatus);
    getMonitoringStatusMock.mockResolvedValue({
      ...monitoringStatusResolved,
      accessibilityServiceReady: false,
      accessibilityServiceConnectedAt: now - 2_000,
      accessibilityServiceDisconnectedAt: now - 1_000,
    });

    try {
      await renderTourApp(['/']);

      expect(await screen.findByRole('dialog', { name: 'Blearn starten' })).toBeInTheDocument();
      await clickButton(/^weiter$/i);
      await clickButton(/^weiter$/i);
      await clickButton(/^weiter$/i);

      expect(await screen.findByRole('heading', { name: 'Bedienungshilfe aktivieren' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^loslegen$/i })).not.toBeDisabled();
    } finally {
      dateNowSpy.mockRestore();
    }
  });
});
