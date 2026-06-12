import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from 'next-themes';
import { buildEntitiesFromRows, getDefaultLearningPresets } from '@/lib/learning';
import { normalizeLearningCloudState } from '@/lib/learningCloudSync';
import { resetCloudSyncRuntimeForTests, useCloudSyncRuntimeStore } from '@/lib/cloudSyncRuntime';
import { ROUTER_FUTURE_FLAGS } from '@/lib/routerFuture';
import { SuccessFeedbackHost } from '@/components/ui/SuccessFeedbackHost';
import AppSettings from '@/pages/AppSettings';
import { suppressKnownActWarnings } from '@/test/support/suppressActWarnings';
import { useAppStore } from '@/store/useAppStore';
import { resetAuthStoreForTests, useAuthStore } from '@/store/useAuthStore';
import { useLearningStore } from '@/store/useLearningStore';

const permissionStatusResolved = {
  usageStats: true,
  overlay: true,
  accessibility: true,
  vpnPermission: true,
  websiteBlockingAvailable: false,
  websiteBlockingActive: false,
};

const checkPermissionsMock = vi.hoisted(() => vi.fn());
const getMonitoringStatusMock = vi.hoisted(() => vi.fn());
const requestAccessibilityPermissionMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const loadLearningCloudMetadataMock = vi.hoisted(() => vi.fn());
const loadLearningCloudStateMock = vi.hoisted(() => vi.fn());
const loadLearningCloudSyncCursorMock = vi.hoisted(() => vi.fn());
const saveLearningCloudStateMock = vi.hoisted(() => vi.fn());
const getLearningSyncDeviceIdMock = vi.hoisted(() => vi.fn(() => 'device-test'));
const getNotificationPermissionStateMock = vi.hoisted(() => vi.fn());
const requestNotificationPermissionMock = vi.hoisted(() => vi.fn());
const syncNotificationPreferencesMock = vi.hoisted(() => vi.fn());
const syncLearningCloudMock = vi.hoisted(() => vi.fn().mockResolvedValue(true));
let consoleErrorSpy: ReturnType<typeof vi.spyOn> | null = null;

vi.mock('@/services/screenTimeService', async () => {
  const actual = await vi.importActual<typeof import('@/services/screenTimeService')>('@/services/screenTimeService');

  return {
    ...actual,
    checkPermissions: checkPermissionsMock,
    getMonitoringStatus: getMonitoringStatusMock,
    requestAccessibilityPermission: requestAccessibilityPermissionMock,
    isNative: true,
  };
});

vi.mock('@/services/firebaseLearningSyncService', async () => {
  const actual = await vi.importActual<typeof import('@/services/firebaseLearningSyncService')>('@/services/firebaseLearningSyncService');

  return {
    ...actual,
    getLearningSyncDeviceId: getLearningSyncDeviceIdMock,
    loadLearningCloudMetadata: loadLearningCloudMetadataMock,
    loadLearningCloudState: loadLearningCloudStateMock,
    loadLearningCloudSyncCursor: loadLearningCloudSyncCursorMock,
    saveLearningCloudState: saveLearningCloudStateMock,
  };
});

vi.mock('@/services/notificationService', async () => {
  const actual = await vi.importActual<typeof import('@/services/notificationService')>('@/services/notificationService');

  return {
    ...actual,
    getNotificationPermissionState: getNotificationPermissionStateMock,
    requestNotificationPermission: requestNotificationPermissionMock,
    syncNotificationPreferences: syncNotificationPreferencesMock,
  };
});

vi.mock('@/hooks/useManualLearningCloudSync', () => ({
  useManualLearningCloudSync: () => ({
    canSync: true,
    firebaseWritesEnabled: true,
    syncing: false,
    syncError: null,
    syncCapabilityReason: null,
    syncCapabilityState: 'ready',
    syncLearningCloud: syncLearningCloudMock,
  }),
}));

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });

  return { promise, resolve };
}

async function flushEffects() {
  for (let index = 0; index < 3; index += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

async function renderSettings(initialEntries = ['/settings']) {
  let renderResult;
  await act(async () => {
    renderResult = render(
      <ThemeProvider attribute="class" forcedTheme="light">
        <MemoryRouter future={ROUTER_FUTURE_FLAGS} initialEntries={initialEntries}>
          <SuccessFeedbackHost />
          <AppSettings />
        </MemoryRouter>
      </ThemeProvider>,
    );
  });
  await flushEffects();
  
  // Radix UI Dialogs from previous tests might leave a global MutationObserver active
  // which hides any newly added DOM nodes (like our test container). Force unhide it here.
  if (renderResult && renderResult.container) {
    renderResult.container.removeAttribute('aria-hidden');
    renderResult.container.removeAttribute('data-aria-hidden');
    // Also unhide parent just in case
    renderResult.container.parentElement?.removeAttribute('aria-hidden');
    renderResult.container.parentElement?.removeAttribute('data-aria-hidden');
  }
  
  // Make sure body is clear of pointer-events block
  document.body.style.pointerEvents = 'auto';
  document.body.removeAttribute('data-scroll-locked');
}

describe('AppSettings', () => {
  beforeEach(() => {
    consoleErrorSpy = suppressKnownActWarnings();
    Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(),
    });
    Object.defineProperty(window.navigator, 'language', {
      configurable: true,
      value: 'de-DE',
    });
    window.localStorage.clear();
    window.localStorage.setItem('blearn-permissions-guide-seen', 'true');
    useAppStore.setState(useAppStore.getInitialState(), true);
    useLearningStore.setState(useLearningStore.getInitialState(), true);
    resetCloudSyncRuntimeForTests();
    resetAuthStoreForTests();
    checkPermissionsMock.mockReset();
    getMonitoringStatusMock.mockReset();
    requestAccessibilityPermissionMock.mockReset();
    loadLearningCloudMetadataMock.mockReset();
    loadLearningCloudStateMock.mockReset();
    loadLearningCloudSyncCursorMock.mockReset();
    saveLearningCloudStateMock.mockReset();
    getLearningSyncDeviceIdMock.mockReset();
    getNotificationPermissionStateMock.mockReset();
    requestNotificationPermissionMock.mockReset();
    syncNotificationPreferencesMock.mockReset();
    syncLearningCloudMock.mockReset();
    requestAccessibilityPermissionMock.mockResolvedValue(undefined);
    checkPermissionsMock.mockResolvedValue(permissionStatusResolved);
    getMonitoringStatusMock.mockResolvedValue({
      monitoringActive: true,
      vpnActive: false,
      overlayPermission: true,
      accessibilityPermission: true,
      websiteBlockingAvailable: true,
      websiteBlockingEnabled: false,
      websiteBlockingPermission: true,
      handoffInProgress: false,
      overlayVisible: false,
      pendingQueueLength: 0,
      recentBlockingEvents: [],
      currentAppId: 'com.example.reader',
      accessibilityServiceReady: true,
    });
    loadLearningCloudMetadataMock.mockResolvedValue(null);
    loadLearningCloudStateMock.mockResolvedValue(null);
    loadLearningCloudSyncCursorMock.mockResolvedValue(null);
    saveLearningCloudStateMock.mockResolvedValue({
      schemaVersion: 2,
      deckCount: 1,
      noteCount: 1,
      cardCount: 1,
      reviewLogCount: 0,
      updatedByDeviceId: 'device-test',
      clientUpdatedAt: Date.now(),
      mutationCursor: null,
    });
    getLearningSyncDeviceIdMock.mockReturnValue('device-test');
    getNotificationPermissionStateMock.mockResolvedValue('default');
    requestNotificationPermissionMock.mockResolvedValue('granted');
    syncNotificationPreferencesMock.mockResolvedValue(undefined);
    syncLearningCloudMock.mockResolvedValue(true);
    useCloudSyncRuntimeStore.setState({
      learning: {
        status: 'ready',
        currentError: null,
        lastSuccessfulSyncAt: Date.now(),
      },
      progress: {
        status: 'ready',
        currentError: null,
        lastSuccessfulSyncAt: Date.now(),
      },
    });
  });

  afterEach(() => {
    useAppStore.setState(useAppStore.getInitialState(), true);
    useLearningStore.setState(useLearningStore.getInitialState(), true);
    resetCloudSyncRuntimeForTests();
    resetAuthStoreForTests();
    cleanup();
    // Radix UI Dialog mutates document.body (data-scroll-locked, pointer-events, aria-hidden on
    // the page wrapper) when a dialog is open. Because Dialogs might animate out, their unmount
    // and cleanup might be delayed.
    document.body.innerHTML = '';
    document.body.removeAttribute('data-scroll-locked');
    document.body.removeAttribute('style');
    document.body.removeAttribute('data-radix-scroll-area-viewport');
    vi.useRealTimers();
    consoleErrorSpy?.mockRestore();
    consoleErrorSpy = null;
    vi.clearAllMocks();
  });

  it('renders the settings page without crashing', async () => {
    await renderSettings();

    expect(screen.getAllByText('Blearn').length).toBeGreaterThan(0);
    expect(await screen.findByRole('button', { name: /dunkler modus|heller modus/i })).toBeInTheDocument();
    const languagePackSummary = screen.getByTestId('language-pack-summary');
    expect(screen.queryByText(/Visuelle Themen/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Android Runtime/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Benachrichtigungsbereiche/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /jetzt konfigurieren/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sprachen verwalten/i })).toBeInTheDocument();
    expect(screen.queryByText(/einmal laden/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/direkt verf/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/extra installiert/i)).not.toBeInTheDocument();
    expect(within(languagePackSummary).getByText('Deutsch')).toBeInTheDocument();
    expect(within(languagePackSummary).queryByText(/^aktiv$/i)).not.toBeInTheDocument();
    expect(within(languagePackSummary).queryByText(/^bereit$/i)).not.toBeInTheDocument();
    expect(within(languagePackSummary).queryByText(/^extra$/i)).not.toBeInTheDocument();
    expect(document.getElementById('account')).not.toBeNull();
  });

  it('opens the redesigned language dialog without the old helper copy', async () => {
    await renderSettings();

    fireEvent.click(screen.getByRole('button', { name: /sprachen verwalten/i }));

    const dialog = await screen.findByRole('dialog', { name: /sprachen verwalten/i });
    expect(within(dialog).getByText(/^sprachpakete$/i)).toBeInTheDocument();
    expect(within(dialog).queryByText(/lade optionale sprachpakete/i)).not.toBeInTheDocument();
    expect(within(dialog).queryByText(/installiere .* nur bei bedarf/i)).not.toBeInTheDocument();
    expect(within(dialog).getAllByRole('button', { name: /installieren/i }).length).toBeGreaterThan(0);
    
    // Close the dialog to prevent Radix UI global state leakage to subsequent tests
    fireEvent.keyDown(dialog, { key: 'Escape', code: 'Escape' });
  });

  it('renders settings even when older persisted preference fields are missing', async () => {
    useAppStore.setState({
      blockedApps: undefined as never,
      blockedWebsites: undefined as never,
      blockedSearchTerms: undefined as never,
      installedAppLanguagePacks: undefined as never,
      notificationPreferences: undefined as never,
      userProfile: undefined as never,
    });

    await renderSettings();

    expect(await screen.findByRole('button', { name: /dunkler modus|heller modus/i })).toBeInTheDocument();
    expect(screen.getByText(/lernfortschritt sichern/i)).toBeInTheDocument();
  });

  it('renders settings even when older persisted profile payloads are malformed', async () => {
    useAppStore.setState({
      userProfile: {
        commonEmotions: null,
        triggerTimes: null,
        recentInteractions: null,
        totalSessions: 'broken',
        totalChallengesCompleted: undefined,
        consecutiveDays: undefined,
        completedChallenges: null,
      } as never,
    });

    await renderSettings();

    expect(await screen.findByRole('button', { name: /dunkler modus|heller modus/i })).toBeInTheDocument();
    expect(screen.getByText(/lernfortschritt sichern/i)).toBeInTheDocument();
  });

  it('shows the global save tile when the theme toggle is pressed', async () => {
    await renderSettings();

    fireEvent.click(await screen.findByRole('button', { name: /dunkler modus|heller modus/i }));

    expect(await screen.findByText(/theme gespeichert/i)).toBeInTheDocument();
    expect(screen.getByTestId('success-feedback-host')).toHaveAttribute('data-feedback-layout', 'compact');
    expect(screen.queryByTestId('inline-confirmation-badge')).not.toBeInTheDocument();
  });

  it('shows a dedicated account and sync card and opens auth from settings', async () => {
    await renderSettings();

    expect(await screen.findByText('Lernfortschritt sichern')).toBeInTheDocument();
    expect(screen.getByText(/Melde dich an und sichere deinen Lernstand/i)).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /anmelden|sign in/i }));
    });

    expect(useAuthStore.getState().authDialogOpen).toBe(true);
    const dialogEl = screen.queryByRole('dialog');
    if (dialogEl) {
      console.log('FOUND DIALOG HTML 2:', dialogEl.outerHTML);
    }
    expect(dialogEl).not.toBeInTheDocument();
  });

  it('keeps the settings account CTA usable when auth is disabled', async () => {
    useAuthStore.setState({
      status: 'disabled',
      authReady: false,
    });

    await renderSettings();

    const setupButton = screen.getByRole('button', { name: /setup ansehen|view setup/i });
    expect(setupButton).toBeEnabled();

    fireEvent.click(setupButton);

    expect(useAuthStore.getState().authDialogOpen).toBe(true);
    const dialogEl = screen.queryByRole('dialog');
    if (dialogEl) {
      console.log('FOUND DIALOG HTML:', dialogEl.outerHTML);
    }
    expect(dialogEl).not.toBeInTheDocument();
  });

  it('allows signing out directly from the settings account card', async () => {
    const signOutMock = vi.fn();
    useAuthStore.setState({
      status: 'authenticated',
      authReady: true,
      user: {
        uid: 'user-123',
        email: 'ich@beispiel.de',
      },
      signOut: signOutMock,
    });

    await renderSettings();
    await flushEffects();

    expect(await screen.findByText('Konto & Sync sind aktiv')).toBeInTheDocument();
    expect(screen.getAllByText('ich@beispiel.de').length).toBeGreaterThan(0);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /abmelden|sign out/i }));
    });

    expect(signOutMock).toHaveBeenCalledTimes(1);
  });

  it('opens the cloud snapshot dialog from settings and shows stored backup data', async () => {
    const now = 1_700_000_000_000;
    const entities = buildEntitiesFromRows(
      [
        { deck: 'Spanish', front: 'hola', back: 'hello', type: 'basic' },
        { deck: 'Spanish', front: 'adios', back: 'bye', type: 'basic' },
      ],
      now,
    );

    useAuthStore.setState({
      status: 'authenticated',
      authReady: true,
      user: {
        uid: 'user-cloud',
        email: 'cloud@example.com',
      },
    });

    loadLearningCloudMetadataMock.mockResolvedValue({
      schemaVersion: 2,
      deckCount: 1,
      noteCount: 2,
      cardCount: 2,
      reviewLogCount: 0,
      updatedByDeviceId: 'device-remote',
      clientUpdatedAt: now + 2_000,
      lastMutationId: 'mutation_remote_1',
      lastMutationAt: now + 2_000,
    });
    loadLearningCloudStateMock.mockResolvedValue(normalizeLearningCloudState({
      activeDeckId: entities.decks[0].id,
      activeDeckUpdatedAt: entities.decks[0].updatedAt,
      decks: entities.decks,
      notes: entities.notes,
      cards: entities.cards,
      reviewLogs: [],
      presets: getDefaultLearningPresets(),
    }));

    await renderSettings();
    await flushEffects();

    fireEvent.click(await screen.findByRole('button', { name: /cloud ansehen|view cloud/i }));

    expect(await screen.findByRole('dialog', { name: /cloud-sicherungsstand/i })).toBeInTheDocument();
    expect(await screen.findByText('Firebase configured')).toBeInTheDocument();
    expect(await screen.findByText('Learning sync')).toBeInTheDocument();
    expect(await screen.findByText('Welche Decks aktuell ueber diesen Account gesichert sind')).toBeInTheDocument();
    expect((await screen.findAllByText('Spanish')).length).toBeGreaterThan(0);
    expect(await screen.findByText('hola')).toBeInTheDocument();
    expect(await screen.findByText('adios')).toBeInTheDocument();

    await waitFor(() => {
      expect(loadLearningCloudMetadataMock).toHaveBeenCalledWith('user-cloud', { source: 'server' });
      expect(loadLearningCloudStateMock).toHaveBeenCalledWith('user-cloud', { source: 'server' });
    });
  }, 15_000);

  it('reloads the cloud snapshot when the dialog refresh button is pressed', async () => {
    const now = 1_700_000_000_000;
    const firstEntities = buildEntitiesFromRows(
      [{ deck: 'Spanish', front: 'hola', back: 'hello', type: 'basic' }],
      now,
    );
    const secondEntities = buildEntitiesFromRows(
      [{ deck: 'Spanish', front: 'gracias', back: 'thanks', type: 'basic' }],
      now + 5_000,
    );

    useAuthStore.setState({
      status: 'authenticated',
      authReady: true,
      user: {
        uid: 'user-cloud-refresh',
        email: 'cloud-refresh@example.com',
      },
    });

    loadLearningCloudMetadataMock
      .mockResolvedValueOnce({
        schemaVersion: 2,
        deckCount: 1,
        noteCount: 1,
        cardCount: 1,
        reviewLogCount: 0,
        updatedByDeviceId: 'device-remote',
        clientUpdatedAt: now,
        lastMutationId: 'mutation_remote_1',
        lastMutationAt: now,
      })
      .mockResolvedValueOnce({
        schemaVersion: 2,
        deckCount: 1,
        noteCount: 1,
        cardCount: 1,
        reviewLogCount: 0,
        updatedByDeviceId: 'device-remote',
        clientUpdatedAt: now + 5_000,
        lastMutationId: 'mutation_remote_2',
        lastMutationAt: now + 5_000,
      });
    loadLearningCloudStateMock
      .mockResolvedValueOnce(normalizeLearningCloudState({
        activeDeckId: firstEntities.decks[0].id,
        activeDeckUpdatedAt: firstEntities.decks[0].updatedAt,
        decks: firstEntities.decks,
        notes: firstEntities.notes,
        cards: firstEntities.cards,
        reviewLogs: [],
        presets: getDefaultLearningPresets(),
      }))
      .mockResolvedValueOnce(normalizeLearningCloudState({
        activeDeckId: secondEntities.decks[0].id,
        activeDeckUpdatedAt: secondEntities.decks[0].updatedAt,
        decks: secondEntities.decks,
        notes: secondEntities.notes,
        cards: secondEntities.cards,
        reviewLogs: [],
        presets: getDefaultLearningPresets(),
      }));

    await renderSettings();
    await flushEffects();

    fireEvent.click(await screen.findByRole('button', { name: /cloud ansehen|view cloud/i }));

    const dialog = await screen.findByRole('dialog', { name: /cloud-sicherungsstand/i });
    expect(await within(dialog).findByText('hola')).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: /^aktualisieren$/i }));

    expect(await within(dialog).findByText('gracias')).toBeInTheDocument();
    await waitFor(() => {
      expect(loadLearningCloudMetadataMock).toHaveBeenCalledTimes(2);
      expect(loadLearningCloudStateMock).toHaveBeenCalledTimes(2);
      expect(loadLearningCloudMetadataMock).toHaveBeenNthCalledWith(2, 'user-cloud-refresh', { source: 'server' });
      expect(loadLearningCloudStateMock).toHaveBeenNthCalledWith(2, 'user-cloud-refresh', { source: 'server' });
    });
  });

  it('allows triggering a manual vocab sync from settings', async () => {
    useAuthStore.setState({
      status: 'authenticated',
      authReady: true,
      user: {
        uid: 'user-sync',
        email: 'sync@example.com',
      },
    });
    useLearningStore.getState().seedStarterDeck();
    useAppStore.setState({ syncAvailable: true, syncCapabilityState: 'ready' });

    await renderSettings();
    await flushEffects();

    fireEvent.click(await screen.findByRole('button', { name: /vokabeln synchronisieren|sync vocabulary/i }));

    await waitFor(() => {
      expect(syncLearningCloudMock).toHaveBeenCalledTimes(1);
    });
  });

  it('does not reopen the permissions guide on settings when it was already dismissed', async () => {
    window.localStorage.setItem('blearn-permissions-guide-seen', 'true');
    const deferredPermissions = createDeferred<typeof permissionStatusResolved>();
    checkPermissionsMock.mockReturnValueOnce(deferredPermissions.promise);

    await renderSettings();
    await flushEffects();

    expect(screen.queryByRole('dialog', { name: /berechtigungen/i })).not.toBeInTheDocument();

    deferredPermissions.resolve(permissionStatusResolved);

    await waitFor(() => {
      expect(checkPermissionsMock).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByRole('dialog', { name: /berechtigungen/i })).not.toBeInTheDocument();
  });

  it('waits for the real permission status before auto-opening the guide', async () => {
    window.localStorage.removeItem('blearn-permissions-guide-seen');
    const deferredPermissions = createDeferred<typeof permissionStatusResolved>();
    checkPermissionsMock.mockReturnValueOnce(deferredPermissions.promise);

    await renderSettings();
    await flushEffects();

    expect(screen.queryByRole('dialog', { name: /berechtigungen/i })).not.toBeInTheDocument();

    deferredPermissions.resolve({
      ...permissionStatusResolved,
      overlay: false,
    });

    await flushEffects();

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /berechtigungen/i })).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('rechecks accessibility permission after returning from Android settings without requiring a second setup pass', async () => {
    window.localStorage.setItem('blearn-permissions-guide-seen', 'true');
    checkPermissionsMock
      .mockResolvedValueOnce({
        ...permissionStatusResolved,
        accessibility: false,
      })
      .mockResolvedValue(permissionStatusResolved);

    await renderSettings();

    fireEvent.click(await screen.findByRole('button', { name: /Systemberechtigungen/i }));

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Freigeben' })).toHaveLength(1);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Freigeben' }));

    expect(requestAccessibilityPermissionMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      window.dispatchEvent(new Event('focus'));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(checkPermissionsMock.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
    expect(screen.queryByRole('button', { name: 'Freigeben' })).not.toBeInTheDocument();
  });

  it('keeps the settings accessibility checkpoint in recovery mode when the runtime reconnect window is stale', async () => {
    window.localStorage.setItem('blearn-permissions-guide-seen', 'true');
    const now = new Date('2026-04-17T12:00:00.000Z').getTime();
    const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(now);
    checkPermissionsMock.mockResolvedValue(permissionStatusResolved);
    getMonitoringStatusMock.mockResolvedValue({
      monitoringActive: true,
      vpnActive: false,
      overlayPermission: true,
      accessibilityPermission: true,
      accessibilityServiceReady: false,
      accessibilityServiceConnectedAt: now - 60_000,
      accessibilityServiceDisconnectedAt: now - 50_000,
      websiteBlockingAvailable: false,
      websiteBlockingEnabled: false,
      websiteBlockingPermission: false,
      handoffInProgress: false,
      overlayVisible: false,
      pendingQueueLength: 0,
      recentBlockingEvents: [],
      currentAppId: 'com.example.reader',
    });

    try {
      await renderSettings();
      await flushEffects();

      expect(await screen.findByText('Systemberechtigungen')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /Systemberechtigungen/i }));
      expect(await screen.findByRole('button', { name: 'Reparieren' })).toBeInTheDocument();
    } finally {
      dateNowSpy.mockRestore();
    }
  });

  it('opens the permissions tile directly when settings are opened with the permissions hash', async () => {
    window.localStorage.setItem('blearn-permissions-guide-seen', 'true');
    checkPermissionsMock.mockResolvedValue({
      ...permissionStatusResolved,
      accessibility: false,
    });

    await renderSettings(['/settings#permissions']);
    await flushEffects();

    expect(await screen.findByText('Bedienungshilfe')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Freigeben' })).toBeInTheDocument();
  });
});
