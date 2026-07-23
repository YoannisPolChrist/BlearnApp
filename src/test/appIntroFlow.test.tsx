import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { ThemeProvider } from 'next-themes';
import AppIntroDialog from '@/components/setup/AppIntroDialog';
import { AppTourProvider } from '@/components/setup/AppTourProvider';
import {
  APP_TOUR_DISMISSED_STORAGE_KEY,
  FIRST_LAUNCH_ANIMATION_SEEN_STORAGE_KEY,
} from '@/components/setup/appTourStorage';
import { APP_TOUR_STEPS } from '@/components/setup/appTourSteps';
import AppSettings from '@/pages/AppSettings';
import IndexPage from '@/pages/Index';
import LearnPage from '@/pages/Learn';
import ModesPage from '@/pages/Modes';
import StatsPage from '@/pages/Stats';
import { ROUTER_FUTURE_FLAGS } from '@/lib/routerFuture';
import { useAppStore } from '@/store/useAppStore';
import { useLearningStore } from '@/store/useLearningStore';
import { useModeDraftStore } from '@/store/useModeDraftStore';

const runtimeFlags = vi.hoisted(() => ({ isNative: false }));
const checkPermissionsMock = vi.hoisted(() => vi.fn());
const getMonitoringStatusMock = vi.hoisted(() => vi.fn());
const requestUsagePermissionMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

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
    formatScreenTime: vi.fn().mockReturnValue('0m'),
    getInstalledApps: vi.fn().mockResolvedValue([]),
    getTodayUsage: vi.fn().mockResolvedValue({ totalScreenTimeMs: 0 }),
  };
});

function resetStores() {
  window.localStorage.clear();
  window.localStorage.setItem(FIRST_LAUNCH_ANIMATION_SEEN_STORAGE_KEY, 'true');
  useAppStore.setState({ ...useAppStore.getInitialState(), hasHydrated: true }, true);
  useLearningStore.setState(useLearningStore.getInitialState(), true);
  useModeDraftStore.setState(useModeDraftStore.getInitialState(), true);
}

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location-probe">{location.pathname}</div>;
}

function renderWithProviders(node: ReactNode) {
  return render(<ThemeProvider attribute="class" forcedTheme="light">{node}</ThemeProvider>);
}

async function renderTourApp(initialEntries: string[]) {
  let view: ReturnType<typeof render> | undefined;
  await act(async () => {
    view = renderWithProviders(
      <MemoryRouter future={ROUTER_FUTURE_FLAGS} initialEntries={initialEntries}>
        <AppTourProvider steps={APP_TOUR_STEPS}>
          <Routes>
            <Route path="/" element={<IndexPage />} />
            <Route path="/modes" element={<ModesPage />} />
            <Route path="/learn" element={<LearnPage />} />
            <Route path="/stats" element={<StatsPage />} />
            <Route path="/settings" element={<AppSettings />} />
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

async function clickButton(name: RegExp) {
  const button = await screen.findByRole('button', { name });
  await act(async () => {
    fireEvent.click(button);
    await Promise.resolve();
  });
}

async function openPermissionSetup() {
  await clickButton(/überspringen/i);
  await screen.findByRole('dialog', { name: /jetzt machen wir deinen schutz bereit/i });
}

describe('App intro flow', () => {
  beforeEach(() => {
    runtimeFlags.isNative = false;
    resetStores();
    checkPermissionsMock.mockReset();
    getMonitoringStatusMock.mockReset();
    requestUsagePermissionMock.mockReset();
    checkPermissionsMock.mockResolvedValue(grantedPermissionStatus);
    getMonitoringStatusMock.mockResolvedValue(monitoringStatusResolved);
    requestUsagePermissionMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
    resetStores();
    vi.clearAllMocks();
  });

  it('orders the stats highlights from overview through learning', () => {
    const statsStart = APP_TOUR_STEPS.findIndex((step) => step.id === 'stats-overview');

    expect(APP_TOUR_STEPS.slice(statsStart, statsStart + 4)).toMatchObject([
      { id: 'stats-overview' },
      { id: 'stats-usage', targetId: 'tour-stats-usage' },
      { id: 'stats-emotions', targetId: 'tour-stats-emotions' },
      { id: 'stats-vocab', targetId: 'tour-stats-vocab' },
    ]);
  });

  it('walks reflection from its card through the configurable protection steps without covering them', () => {
    expect(APP_TOUR_STEPS.slice(4, 8)).toMatchObject([
      { id: 'modes-reflection', targetId: 'tour-mode-reflection', placement: 'top' },
      { id: 'modes-reflection-settings', targetId: 'tour-reflection-settings', placement: 'top' },
      { id: 'modes-reflection-pattern', targetId: 'tour-reflection-pattern', placement: 'top' },
      { id: 'modes-reflection-strict-addon', targetId: 'tour-reflection-strict-addon', placement: 'top' },
    ]);
  });

  it('walks Learn from its card through gate settings before penalty mode', () => {
    const learnStart = APP_TOUR_STEPS.findIndex((step) => step.id === 'modes-learn');

    expect(APP_TOUR_STEPS.slice(learnStart, learnStart + 5)).toMatchObject([
      { id: 'modes-learn', targetId: 'tour-mode-learn', placement: 'top' },
      { id: 'modes-learn-gate-settings', targetId: 'tour-learn-gate-settings', placement: 'top' },
      { id: 'modes-learn-new-cards', targetId: 'tour-learn-new-cards', placement: 'top' },
      { id: 'modes-learn-typed-answer', targetId: 'tour-learn-typed-answer', placement: 'top' },
      { id: 'modes-penalty', targetId: 'tour-mode-penalty' },
    ]);
  });

  it('explains the global strict protection and binds every mode step to its displayed mode', () => {
    expect(APP_TOUR_STEPS.filter((step) => step.id.startsWith('modes-lock'))).toMatchObject([
      { id: 'modes-lock', targetId: 'tour-mode-lock', modeId: 'lock' },
      { id: 'modes-lock-settings', targetId: 'tour-lock-settings', modeId: 'lock' },
    ]);
    expect(APP_TOUR_STEPS.filter((step) => step.id.startsWith('modes-')).every((step) => (
      !step.targetId || step.id === 'modes-selector' || step.id === 'modes-targets' || Boolean(step.modeId)
    ))).toBe(true);
  });

  it('places the selected mode settings before the target assignment section', async () => {
    await renderTourApp(['/modes']);

    const learnMode = document.querySelector<HTMLElement>('[data-tour-id="tour-mode-learn"]');
    expect(learnMode).not.toBeNull();
    fireEvent.click(learnMode!);

    await waitFor(() => {
      expect(document.querySelector('[data-tour-id="tour-learn-gate-settings"]')).not.toBeNull();
    });
    const learnSettings = document.querySelector<HTMLElement>('[data-tour-id="tour-learn-gate-settings"]');
    const targetAssignment = document.querySelector<HTMLElement>('[data-tour-id="tour-modes-blocking"]');
    expect(learnSettings).not.toBeNull();
    expect(targetAssignment).not.toBeNull();
    expect(learnSettings!.compareDocumentPosition(targetAssignment!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('opens on first launch and moves through real highlighted areas', async () => {
    await renderTourApp(['/']);

    expect(await screen.findByRole('dialog', { name: /aus reflex wird eine bewusste entscheidung/i })).toBeInTheDocument();
    expect(APP_TOUR_STEPS[0]).toMatchObject({
      id: 'welcome',
      route: '/',
    });
    expect(APP_TOUR_STEPS[0]?.targetId).toBeUndefined();
    expect(APP_TOUR_STEPS[1]).toMatchObject({
      targetId: 'tour-bottom-nav',
      placement: 'top',
    });
    expect(APP_TOUR_STEPS[2]).toMatchObject({
      id: 'home',
      targetId: 'tour-dashboard-focus',
      placement: 'top',
    });
    expect(APP_TOUR_STEPS[3]).toMatchObject({
      id: 'modes-selector',
      title: 'Zielmodus auswählen.',
    });
    expect(APP_TOUR_STEPS.find((step) => step.id === 'learn-hero')).toMatchObject({ id: 'learn-hero' });
    expect(APP_TOUR_STEPS.find((step) => step.id === 'learn-hero')?.targetId).toBeUndefined();
    expect(APP_TOUR_STEPS.find((step) => step.id === 'stats-overview')?.targetId).toBeUndefined();
    expect(APP_TOUR_STEPS.find((step) => step.id === 'settings')?.targetId).toBeUndefined();

    await clickButton(/^weiter$/i);
    expect(await screen.findByRole('heading', { name: /deine bereiche auf einen blick/i })).toBeInTheDocument();
    expect(screen.getByText(/orientierung · 2\/23/i)).toBeInTheDocument();

    await clickButton(/^weiter$/i);
    await clickButton(/^weiter$/i);
    await waitFor(() => expect(screen.getByTestId('location-probe')).toHaveTextContent('/modes'));
    expect((await screen.findAllByRole('heading', { name: /zielmodus auswählen/i })).length).toBeGreaterThan(0);
  });

  it('shows the first-launch moment once, supports a tap-to-skip, and never repeats it', async () => {
    window.localStorage.removeItem(FIRST_LAUNCH_ANIMATION_SEEN_STORAGE_KEY);
    const firstView = await renderTourApp(['/']);

    const skipButton = await screen.findByRole('button', {
      name: 'Einführung überspringen',
    });
    expect(window.localStorage.getItem(FIRST_LAUNCH_ANIMATION_SEEN_STORAGE_KEY)).toBe('true');

    fireEvent.pointerDown(skipButton);
    expect(
      await screen.findByRole('dialog', {
        name: /aus reflex wird eine bewusste entscheidung/i,
      }),
    ).toBeInTheDocument();

    firstView.unmount();
    useAppStore.setState({ ...useAppStore.getInitialState(), hasHydrated: true }, true);
    await renderTourApp(['/']);

    expect(
      screen.queryByRole('button', { name: 'Einführung überspringen' }),
    ).not.toBeInTheDocument();
  });

  it('skips the explanations into the final setup and persists completion', async () => {
    await renderTourApp(['/']);
    await openPermissionSetup();

    await clickButton(/^weiter$/i);
    await clickButton(/^weiter$/i);
    await clickButton(/^weiter$/i);
    await clickButton(/^loslegen$/i);

    await waitFor(() => expect(useAppStore.getState().appIntroSeen).toBe(true));
    expect(window.localStorage.getItem(APP_TOUR_DISMISSED_STORAGE_KEY)).toBe('true');
    expect(screen.getByTestId('location-probe')).toHaveTextContent('/');
  });

  it('can be reopened from settings after completion', async () => {
    window.localStorage.setItem(APP_TOUR_DISMISSED_STORAGE_KEY, 'true');
    useAppStore.setState({ ...useAppStore.getInitialState(), appIntroSeen: true, hasHydrated: true }, true);
    await renderTourApp(['/settings']);

    await clickButton(/app-einf/i);
    expect(await screen.findByRole('dialog', { name: /aus reflex wird eine bewusste entscheidung/i })).toBeInTheDocument();
  });

  it('keeps native setup locked until the required permissions are ready', async () => {
    runtimeFlags.isNative = true;
    checkPermissionsMock.mockResolvedValue({ ...grantedPermissionStatus, usageStats: false, overlay: false, accessibility: false });
    await renderTourApp(['/']);
    await openPermissionSetup();

    expect(screen.getByRole('button', { name: /dialog schlie/i })).toBeDisabled();
    expect(screen.getByText('Fehlt')).toBeInTheDocument();
    await clickButton(/nutzungszugriff öffnen/i);
    expect(requestUsagePermissionMock).toHaveBeenCalledTimes(1);
  });

  it('rechecks Android permissions when the app regains focus', async () => {
    runtimeFlags.isNative = true;
    checkPermissionsMock
      .mockResolvedValueOnce({ ...grantedPermissionStatus, usageStats: false, overlay: false, accessibility: false })
      .mockResolvedValue({ ...grantedPermissionStatus, usageStats: true, overlay: false, accessibility: false });
    await renderTourApp(['/']);
    await openPermissionSetup();
    await clickButton(/nutzungszugriff öffnen/i);

    await act(async () => {
      window.dispatchEvent(new Event('focus'));
      await Promise.resolve();
    });

    await waitFor(() => expect(checkPermissionsMock.mock.calls.length).toBeGreaterThanOrEqual(2));
    expect((await screen.findAllByText('Aktiv')).length).toBeGreaterThan(0);
  });
});
