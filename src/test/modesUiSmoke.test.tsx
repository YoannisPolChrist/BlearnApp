import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { buildEntitiesFromRows, getDefaultGateRule, getDefaultLearningPresets } from '@/lib/learning';
import { ROUTER_FUTURE_FLAGS } from '@/lib/routerFuture';
import ModesPage from '@/pages/Modes';
import { SuccessFeedbackHost } from '@/components/ui/SuccessFeedbackHost';
import * as screenTimeService from '@/services/screenTimeService';
import { useAppStore } from '@/store/useAppStore';
import { useLearningStore } from '@/store/useLearningStore';
import { useModeDraftStore } from '@/store/useModeDraftStore';
import { toRecordById } from './helpers/storeTestUtils';

const navigateMock = vi.hoisted(() => vi.fn());
const recheckCurrentForegroundTargetMock = vi.hoisted(() => vi.fn().mockResolvedValue({ matched: false }));
const syncPoliciesMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const getMonitoringStatusMock = vi.hoisted(() => vi.fn().mockResolvedValue({
  monitoringActive: true,
  vpnActive: false,
  overlayPermission: true,
  accessibilityPermission: true,
  accessibilityServiceReady: true,
  websiteBlockingAvailable: true,
  websiteBlockingEnabled: false,
  websiteBlockingPermission: true,
  handoffInProgress: false,
  overlayVisible: false,
}));
const permissionStatusResolved = vi.hoisted(() => ({
  usageStats: true,
  overlay: true,
  accessibility: true,
  vpnPermission: true,
  websiteBlockingAvailable: false,
  websiteBlockingActive: false,
}));
const realDateNow = Date.now;

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');

  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('@/services/screenTimeService', async () => {
  const actual = await vi.importActual<typeof import('@/services/screenTimeService')>('@/services/screenTimeService');

  return {
    ...actual,
    checkPermissions: vi.fn().mockResolvedValue(permissionStatusResolved),
    getInstalledApps: vi.fn().mockResolvedValue([
      {
        appId: 'com.google.android.youtube',
        label: 'YouTube',
        packageName: 'com.google.android.youtube',
        appName: 'YouTube',
      },
      {
        appId: 'com.instagram.android',
        label: 'Instagram',
        packageName: 'com.instagram.android',
        appName: 'Instagram',
      },
      {
        appId: 'com.reddit.frontpage',
        label: 'Reddit',
        packageName: 'com.reddit.frontpage',
        appName: 'Reddit',
      },
    ]),
    getUsageForRange: vi.fn().mockResolvedValue(null),
    getTodayUsage: vi.fn().mockResolvedValue(null),
    getMonitoringStatus: getMonitoringStatusMock,
    isNative: true,
    recheckCurrentForegroundTarget: recheckCurrentForegroundTargetMock,
    syncPolicies: syncPoliciesMock,
  };
});

function resetStores() {
  window.localStorage.clear();
  useAppStore.setState(useAppStore.getInitialState(), true);
  useLearningStore.setState(useLearningStore.getInitialState(), true);
  useModeDraftStore.setState(useModeDraftStore.getInitialState(), true);
}

function restoreDateNow() {
  Object.defineProperty(Date, 'now', {
    configurable: true,
    writable: true,
    value: realDateNow,
  });
}

function seedLearnDeck() {
  useLearningStore.getState().seedStarterDeck();
}

function seedLearnDeckWithProgress() {
  const now = 1_700_000_000_000;
  vi.spyOn(Date, 'now').mockReturnValue(now);
  const { decks, notes, cards } = buildEntitiesFromRows(
    [{ deck: 'Progress Deck', front: 'house', back: 'Haus', type: 'basic' }],
    now - 10_000,
  );
  const reviewedCard = {
    ...cards[0],
    state: 'review' as const,
    dueAt: now + 86_400_000,
    lastReviewedAt: now - 1_000,
    updatedAt: now - 1_000,
  };
  const reviewLog = {
    id: 'review-log-1',
    deckId: decks[0].id,
    cardId: reviewedCard.id,
    reviewedAt: now - 1_000,
    rating: 'good' as const,
    previousState: 'learning' as const,
    newState: 'review' as const,
    scheduledDays: 1,
    elapsedDays: 1,
    wasCorrect: true,
    memoryStateBefore: null,
    memoryStateAfter: null,
  };

  useLearningStore.setState({
    ...useLearningStore.getInitialState(),
    activeDeckId: decks[0].id,
    activeDeckUpdatedAt: now - 1_000,
    decks: toRecordById(decks),
    notes: toRecordById(notes),
    cards: toRecordById([reviewedCard]),
    reviewLogs: toRecordById([reviewLog]),
    presets: toRecordById(getDefaultLearningPresets()),
    gateRule: getDefaultGateRule(),
  }, true);

  return {
    deckId: decks[0].id,
    cardId: reviewedCard.id,
    reviewLogId: reviewLog.id,
  };
}

function clickLearnModeCard() {
  fireEvent.click(screen.getByText(/^Learn$/i, { selector: 'h3' }).closest('button')!);
}

function renderModesPage() {
  render(
    <MemoryRouter future={ROUTER_FUTURE_FLAGS}>
      <SuccessFeedbackHost />
      <ModesPage />
    </MemoryRouter>,
  );
}

const checkPermissionsMock = vi.mocked(screenTimeService.checkPermissions);

async function waitForPermissionsReady() {
  await waitFor(() => {
    expect(screen.queryByText(/berechtigungen fehlen/i)).not.toBeInTheDocument();
  });
}

async function expectAppRequirementHint() {
  await waitFor(() => {
    expect(document.body.textContent).toMatch(/mindestens eine app|at least one app/i);
  });
}

describe('modes UI smoke', () => {
  beforeEach(() => {
    resetStores();
    navigateMock.mockReset();
    recheckCurrentForegroundTargetMock.mockClear();
    syncPoliciesMock.mockClear();
    getMonitoringStatusMock.mockClear();
    getMonitoringStatusMock.mockResolvedValue({
      monitoringActive: true,
      vpnActive: false,
      overlayPermission: true,
      accessibilityPermission: true,
      accessibilityServiceReady: true,
      websiteBlockingAvailable: true,
      websiteBlockingEnabled: false,
      websiteBlockingPermission: true,
      handoffInProgress: false,
      overlayVisible: false,
    });
    checkPermissionsMock.mockResolvedValue(permissionStatusResolved);
  });

  afterEach(() => {
    vi.useRealTimers();
    restoreDateNow();
  });

  it('keeps strict mode blocked until at least one app is assigned', async () => {
    renderModesPage();
    await waitForPermissionsReady();

    const saveButton = await screen.findByRole('button', { name: /speichern/i });
    expect(saveButton).toBeDisabled();
    await expectAppRequirementHint();
  }, 12000);

  it('prefers the reflection mode card over the red lock card when both are active', async () => {
    useAppStore.setState({
      activeModes: ['lock', 'strict'],
      activeMode: 'lock',
      strictLockUntil: null,
      savedModeSelection: null,
    });

    renderModesPage();
    await waitForPermissionsReady();

    expect(await screen.findByRole('button', { name: /speichern/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /strict lock|sperre/i })).not.toBeInTheDocument();
    await expectAppRequirementHint();
  }, 12000);

  it('does not let another mode take over apps frozen by an active strict add-on', async () => {
    useAppStore.setState((state) => ({
      ...state,
      blockedApps: ['com.google.android.youtube'],
      blockedAppModes: { 'com.google.android.youtube': 'strict' },
      blockSchedules: { 'com.google.android.youtube': { from: '00:00', to: '23:59' } },
      strictAddons: {
        ...state.strictAddons,
        strict: {
          ...state.strictAddons.strict,
          enabled: true,
          lockUntil: Date.now() + 60_000,
          lockedAppIds: ['com.google.android.youtube'],
        },
      },
    }));

    renderModesPage();
    await waitForPermissionsReady();

    clickLearnModeCard();

    const youtubeRow = await screen.findByText('YouTube');
    const appCard = youtubeRow.closest('div[class*="space-y-2"]');
    expect(appCard).not.toBeNull();

    const takeOverButton = within(appCard as HTMLElement).getByRole('button', { name: /übernehmen|take over/i });
    expect(takeOverButton).toBeDisabled();
    expect(within(appCard as HTMLElement).getByText(/strict|reflexion/i)).toBeInTheDocument();
  }, 12000);

  it('does not count websites alone as a valid strict target', async () => {
    renderModesPage();
    await waitForPermissionsReady();

    fireEvent.click(screen.getByRole('button', { name: /^websites/i }));
    fireEvent.change(screen.getByPlaceholderText(/example\.com/i), { target: { value: 'youtube.com' } });
    fireEvent.click(screen.getByRole('button', { name: /hinzuf/i }));

    const saveButton = await screen.findByRole('button', { name: /speichern/i });
    expect(saveButton).toBeDisabled();
    await waitFor(() => {
      expect(document.body.textContent).toMatch(/websites oder suchbegriffe allein reichen nicht|websites or search terms alone are not enough/i);
    });
  }, 12000);

  it('treats a mode-card switch as a saveable change and persists it', async () => {
    renderModesPage();
    await waitForPermissionsReady();

    fireEvent.click(screen.getByRole('button', { name: /normal/i }));

    const saveButton = await screen.findByRole('button', { name: /speichern/i });
    expect(saveButton).not.toBeDisabled();

    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(syncPoliciesMock).toHaveBeenCalledTimes(1);
    });

    expect(recheckCurrentForegroundTargetMock).not.toHaveBeenCalled();
    expect(useAppStore.getState().savedModeSelection).toBe('normal');
  });

  it('shows the global save tile and runs the strict foreground recheck once an app is assigned', async () => {
    renderModesPage();
    await waitForPermissionsReady();

    fireEvent.click((await screen.findByText('YouTube')).closest('button')!);

    const saveButton = await screen.findByRole('button', { name: /speichern/i });
    expect(saveButton).not.toBeDisabled();

    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(syncPoliciesMock).toHaveBeenCalledTimes(1);
    });
    expect(syncPoliciesMock).toHaveBeenCalledWith(expect.objectContaining({
      activeModes: ['strict'],
      blockedPackages: ['com.google.android.youtube'],
      targets: [
        expect.objectContaining({
          id: 'com.google.android.youtube',
          type: 'app',
          mode: 'strict',
        }),
      ],
    }));
    expect(getMonitoringStatusMock).toHaveBeenCalledTimes(1);
    expect(recheckCurrentForegroundTargetMock).toHaveBeenCalledTimes(1);
    expect(navigateMock).not.toHaveBeenCalled();
    expect(await screen.findByText(/^gespeichert$|^saved$/i)).toBeInTheDocument();
    expect(screen.getByTestId('success-feedback-host')).toHaveAttribute('data-feedback-layout', 'compact');
    expect(screen.queryByTestId('inline-confirmation-badge')).not.toBeInTheDocument();
    expect(await screen.findByText(/die aktuellen einstellungen sind aktiv/i)).toBeInTheDocument();
    expect((await screen.findAllByText(/reflexion/i)).length).toBeGreaterThan(0);
  }, 12000);

  it('finishes saving when syncPolicies throws but monitoring is already active', async () => {
    syncPoliciesMock.mockRejectedValueOnce(new Error('sync failed'));

    renderModesPage();
    await waitForPermissionsReady();

    fireEvent.click((await screen.findByText('YouTube')).closest('button')!);

    const saveButton = await screen.findByRole('button', { name: /speichern/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(getMonitoringStatusMock).toHaveBeenCalledTimes(2);
    });
    expect(recheckCurrentForegroundTargetMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/schutz konnte noch nicht mit android synchronisiert werden|protection could not yet be synced with android/i)).toBeNull();
    expect(await screen.findByText(/^gespeichert$|^saved$/i)).toBeInTheDocument();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('treats inactive native monitoring after sync as a save error', async () => {
    getMonitoringStatusMock.mockResolvedValueOnce({
      monitoringActive: false,
      vpnActive: false,
      overlayPermission: true,
      accessibilityPermission: true,
      accessibilityServiceReady: false,
      websiteBlockingAvailable: true,
      websiteBlockingEnabled: false,
      websiteBlockingPermission: true,
    });

    renderModesPage();
    await waitForPermissionsReady();

    fireEvent.click((await screen.findByText('YouTube')).closest('button')!);

    const saveButton = await screen.findByRole('button', { name: /speichern/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText(/schutz konnte noch nicht mit android synchronisiert werden|protection could not yet be synced with android/i)).toBeInTheDocument();
    });

    expect(recheckCurrentForegroundTargetMock).not.toHaveBeenCalled();
  });

  it('accepts a recent accessibility reconnect window even if the live ready flag is momentarily false', async () => {
    const now = new Date('2026-04-17T12:00:00.000Z').getTime();
    const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(now);
    getMonitoringStatusMock.mockResolvedValueOnce({
      monitoringActive: true,
      vpnActive: false,
      overlayPermission: true,
      accessibilityPermission: true,
      accessibilityServiceReady: false,
      accessibilityServiceConnectedAt: now - 2_000,
      accessibilityServiceDisconnectedAt: now - 1_000,
      websiteBlockingAvailable: true,
      websiteBlockingEnabled: false,
      websiteBlockingPermission: true,
      handoffInProgress: false,
      overlayVisible: false,
    });

    try {
      renderModesPage();
      await waitForPermissionsReady();

      fireEvent.click((await screen.findByText('YouTube')).closest('button')!);

      const saveButton = await screen.findByRole('button', { name: /speichern/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(syncPoliciesMock).toHaveBeenCalledTimes(1);
      });
      expect(recheckCurrentForegroundTargetMock).toHaveBeenCalledTimes(1);
      expect(screen.queryByText(/schutz konnte noch nicht mit android synchronisiert werden|protection could not yet be synced with android/i)).toBeNull();
      expect(await screen.findByText(/^gespeichert$|^saved$/i)).toBeInTheDocument();
    } finally {
      dateNowSpy.mockRestore();
    }
  });

  it('rejects stale historical accessibility connections when the runtime is no longer ready', async () => {
    const now = new Date('2026-04-17T12:00:00.000Z').getTime();
    const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(now);
    getMonitoringStatusMock.mockResolvedValueOnce({
      monitoringActive: true,
      vpnActive: false,
      overlayPermission: true,
      accessibilityPermission: true,
      accessibilityServiceReady: false,
      accessibilityServiceConnectedAt: now - 60_000,
      accessibilityServiceDisconnectedAt: now - 50_000,
      websiteBlockingAvailable: true,
      websiteBlockingEnabled: false,
      websiteBlockingPermission: true,
      handoffInProgress: false,
      overlayVisible: false,
    });

    try {
      renderModesPage();
      await waitForPermissionsReady();

      fireEvent.click((await screen.findByText('YouTube')).closest('button')!);

      const saveButton = await screen.findByRole('button', { name: /speichern/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/schutz konnte noch nicht mit android synchronisiert werden|protection could not yet be synced with android/i)).toBeInTheDocument();
      });
      expect(recheckCurrentForegroundTargetMock).not.toHaveBeenCalled();
    } finally {
      dateNowSpy.mockRestore();
    }
  });

  it('shows the global save tile for draft target assignments', async () => {
    renderModesPage();
    await waitForPermissionsReady();

    fireEvent.click((await screen.findByText('YouTube')).closest('button')!);

    expect(await screen.findByText(/app diesem modus zugewiesen|app assigned to this mode/i)).toBeInTheDocument();
    expect(screen.getByTestId('success-feedback-host')).toHaveAttribute('data-feedback-layout', 'compact');
    expect(screen.queryByTestId('inline-confirmation-badge')).not.toBeInTheDocument();
  });

  it('shows a visible retry state when Android permission refresh fails', async () => {
    checkPermissionsMock.mockRejectedValueOnce(new Error('permission refresh failed'));

    renderModesPage();

    expect(await screen.findByText(/android-schutz prüfen|check android protection/i)).toBeInTheDocument();

    checkPermissionsMock.mockResolvedValue(permissionStatusResolved);
    fireEvent.click(screen.getByRole('button', { name: /erneut prüfen|retry checks/i }));

    await waitFor(() => {
      expect(screen.queryByText(/android-schutz prüfen|check android protection/i)).not.toBeInTheDocument();
    });
  });

  it('allows learn mode itself to be saved before any app is assigned', async () => {
    seedLearnDeck();
    renderModesPage();
    await waitForPermissionsReady();

    clickLearnModeCard();

    const saveButton = await screen.findByRole('button', { name: /speichern/i });
    expect(saveButton).not.toBeDisabled();
  });

  it('lets the learn mode adjust the spacing for new cards directly in the mode settings', async () => {
    seedLearnDeck();
    renderModesPage();
    await waitForPermissionsReady();

    clickLearnModeCard();

    expect(await screen.findByText(/neue karten abstand|new-card spacing/i)).toBeInTheDocument();
    expect(screen.getAllByText(/mix 1:15/i).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: '1:10' }));

    await waitFor(() => {
      const activeDeckId = useLearningStore.getState().activeDeckId;
      expect(activeDeckId).toBeTruthy();
      expect(useLearningStore.getState().getResolvedPresetForDeck(activeDeckId!).reviewsBetweenNewCards).toBe(10);
    });
  });

  it('clears only the current mode assignments and keeps other blocked apps pinned above free ones', async () => {
    useAppStore.setState({
      blockedApps: ['com.google.android.youtube', 'com.instagram.android'],
      blockedAppModes: {
        'com.google.android.youtube': 'strict',
        'com.instagram.android': 'learn',
      },
      blockedWebsites: [],
      blockedWebsiteModes: {},
      blockedSearchTerms: [],
      blockedSearchTermModes: {},
      blockSchedules: {},
    });
    seedLearnDeck();

    renderModesPage();
    await waitForPermissionsReady();

    clickLearnModeCard();
    fireEvent.click(screen.getAllByRole('button', { name: /reflexion|reflection/i })[0]);

    expect(screen.getByText(/^diesem modus zugewiesen$|^assigned to this mode$/i)).toBeInTheDocument();
    expect(screen.getByText(/anderen modi blockiert|other modes/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /alle in diesem modus aufheben|clear all in this mode/i }));

    await waitFor(() => {
      expect(screen.queryByText(/^diesem modus zugewiesen$|^assigned to this mode$/i)).not.toBeInTheDocument();
    });

    expect(screen.getByText(/anderen modi blockiert|other modes/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /alle in diesem modus aufheben|clear all in this mode/i })).not.toBeInTheDocument();
  }, 12000);

  it('lets strict number fields stay empty while editing and clamps on blur', async () => {
    renderModesPage();
    await waitForPermissionsReady();

    const [roundsInput, intervalInput] = await screen.findAllByRole('spinbutton');

    fireEvent.change(roundsInput, { target: { value: '' } });
    expect((roundsInput as HTMLInputElement).value).toBe('');

    fireEvent.change(roundsInput, { target: { value: '12' } });
    expect((roundsInput as HTMLInputElement).value).toBe('12');

    fireEvent.change(intervalInput, { target: { value: '' } });
    expect((intervalInput as HTMLInputElement).value).toBe('');

    fireEvent.blur(intervalInput);
    await waitFor(() => {
      expect((intervalInput as HTMLInputElement).value).toBe('5');
    });
  });

  it('keeps strict add-on time inputs hidden until the add-on is enabled', async () => {
    renderModesPage();
    await waitForPermissionsReady();

    expect(screen.queryByLabelText(/^von$|^from$/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^bis$|^to$/i)).not.toBeInTheDocument();
  });

  it('keeps learn gate fields editable as multi-digit drafts and clamps oversized values', async () => {
    seedLearnDeck();
    renderModesPage();
    await waitForPermissionsReady();

    clickLearnModeCard();

    const creditsInput = await screen.findByLabelText(/karten pro freischaltung|cards per unlock/i);
    const unlockInput = await screen.findByLabelText(/freigabe \(minuten\)|unlock/i);

    fireEvent.change(creditsInput, { target: { value: '15' } });
    expect((creditsInput as HTMLInputElement).value).toBe('15');

    fireEvent.change(unlockInput, { target: { value: '999' } });
    fireEvent.blur(unlockInput);

    await waitFor(() => {
      expect((unlockInput as HTMLInputElement).value).toBe('120');
    });
  });

  it('commits the latest learn draft value when saving without blur', async () => {
    seedLearnDeck();
    renderModesPage();
    await waitForPermissionsReady();

    clickLearnModeCard();
    fireEvent.click((await screen.findByText('YouTube')).closest('button')!);

    const creditsInput = await screen.findByLabelText(/karten pro freischaltung|cards per unlock/i);
    fireEvent.change(creditsInput, { target: { value: '15' } });

    const saveButton = await screen.findByRole('button', { name: /speichern/i });
    expect(saveButton).not.toBeDisabled();

    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(useLearningStore.getState().gateRule.sessionCreditsRequired).toBe(15);
    });
  });

  it('allows saving less than three cards for the learn gate', async () => {
    seedLearnDeck();
    renderModesPage();
    await waitForPermissionsReady();

    clickLearnModeCard();
    fireEvent.click((await screen.findByText('YouTube')).closest('button')!);

    const creditsInput = await screen.findByLabelText(/karten pro freischaltung|cards per unlock/i);
    fireEvent.change(creditsInput, { target: { value: '2' } });

    const saveButton = await screen.findByRole('button', { name: /speichern/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(useLearningStore.getState().gateRule.sessionCreditsRequired).toBe(2);
    });
    expect(
      useLearningStore.getState().getAssignmentForTarget('com.google.android.youtube', 'app')?.sessionCreditsRequired,
    ).toBe(2);
  });

  it('writes the selected card count into every assigned learn target on save', async () => {
    seedLearnDeck();
    renderModesPage();
    await waitForPermissionsReady();

    clickLearnModeCard();

    fireEvent.click((await screen.findByText('YouTube')).closest('button')!);
    fireEvent.click((await screen.findByText('Instagram')).closest('button')!);

    const cardsPerUnlockInput = await screen.findByLabelText(/karten pro freischaltung|cards per unlock/i);
    fireEvent.change(cardsPerUnlockInput, { target: { value: '5' } });
    fireEvent.blur(cardsPerUnlockInput);

    const saveButton = await screen.findByRole('button', { name: /speichern/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(useLearningStore.getState().getAssignmentForTarget('com.google.android.youtube', 'app')?.sessionCreditsRequired).toBe(5);
    });
    expect(useLearningStore.getState().getAssignmentForTarget('com.instagram.android', 'app')?.sessionCreditsRequired).toBe(5);
    expect(useLearningStore.getState().getAssignmentForTarget('com.reddit.frontpage', 'app')).toBeUndefined();
  });

  it('rehydrates learning data before saving learn assignments so vocab is not replaced by fallback defaults', async () => {
    const persistedDeckId = 'persisted-deck';
    let hydrated = false;
    const hasHydratedSpy = vi.spyOn(useLearningStore.persist, 'hasHydrated').mockImplementation(() => hydrated);
    const rehydrateSpy = vi.spyOn(useLearningStore.persist, 'rehydrate').mockImplementation(async () => {
      hydrated = true;
      useLearningStore.setState({
        activeDeckId: persistedDeckId,
        activeDeckUpdatedAt: 123,
        decks: {
          [persistedDeckId]: {
            id: persistedDeckId,
            name: 'Persisted Deck',
            description: '',
            language: 'de',
            tags: [],
            cardIds: [],
            createdAt: 123,
            updatedAt: 123,
          },
        },
        cards: {},
        notes: {},
        reviewLogs: {},
      });
    });

    try {
      renderModesPage();
      await waitForPermissionsReady();

      clickLearnModeCard();
      fireEvent.click((await screen.findByText('YouTube')).closest('button')!);

      const saveButton = await screen.findByRole('button', { name: /speichern/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(rehydrateSpy).toHaveBeenCalledTimes(1);
      });
      await waitFor(() => {
        expect(useLearningStore.getState().getAssignmentForTarget('com.google.android.youtube', 'app')?.deckId).toBe(persistedDeckId);
      });
      expect(Object.keys(useLearningStore.getState().decks)).toEqual([persistedDeckId]);
    } finally {
      hasHydratedSpy.mockRestore();
      rehydrateSpy.mockRestore();
    }
  });

  it('keeps existing vocab progress intact when saving mode settings', async () => {
    const seeded = seedLearnDeckWithProgress();
    renderModesPage();
    await waitForPermissionsReady();

    clickLearnModeCard();
    fireEvent.click((await screen.findByText('YouTube')).closest('button')!);

    const saveButton = await screen.findByRole('button', { name: /speichern/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(syncPoliciesMock).toHaveBeenCalledTimes(1);
    });

    const nextState = useLearningStore.getState();
    expect(nextState.activeDeckId).toBe(seeded.deckId);
    expect(nextState.cards[seeded.cardId]?.state).toBe('review');
    expect(nextState.cards[seeded.cardId]?.lastReviewedAt).toBe(1_700_000_000_000 - 1_000);
    expect(nextState.reviewLogs[seeded.reviewLogId]?.cardId).toBe(seeded.cardId);
    expect(Object.keys(nextState.reviewLogs)).toHaveLength(1);
  });

  it('keeps the type-answer toggle as a draft until saving', async () => {
    seedLearnDeck();
    renderModesPage();
    await waitForPermissionsReady();

    clickLearnModeCard();

    const toggleButton = await screen.findByRole('button', { name: /type your answer|antwort eintippen/i });
    fireEvent.click(toggleButton);

    expect(useLearningStore.getState().gateRule.typedAnswerEnabled).toBe(false);

    const saveButton = await screen.findByRole('button', { name: /speichern/i });
    expect(saveButton).not.toBeDisabled();

    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(useLearningStore.getState().gateRule.typedAnswerEnabled).toBe(true);
    });
  });

  it('explains the type-answer rule inside the learn mode section', async () => {
    seedLearnDeck();
    renderModesPage();
    await waitForPermissionsReady();

    clickLearnModeCard();

    expect(
      await screen.findByText(/die ersten 3 richtigen buchstaben pro wort reichen zum bestehen/i),
    ).toBeInTheDocument();
  });

  it('can add strict mode on top of learn mode', async () => {
    // Pin the clock to 12:00 (noon) so the activateStrictAddon time-window guard
    // (default: 08:00–17:00) passes regardless of when tests actually run.
    // vi.useFakeTimers intercepts both Date.now() AND new Date() (the latter is
    // used directly inside activateStrictAddon in appStore.slices.ts).
    const midday = new Date('2026-01-15T12:00:00.000Z').getTime();
    vi.useFakeTimers({ now: midday, shouldAdvanceTime: true });

    try {
      seedLearnDeck();
      renderModesPage();
      await waitForPermissionsReady();

      clickLearnModeCard();
      fireEvent.click((await screen.findByText('YouTube')).closest('button')!);
      const strictAddonLabel = await screen.findByText(/strikt-zusatz|strict add-on/i);
      const strictAddonHeader = strictAddonLabel.closest('div')?.parentElement;
      expect(strictAddonHeader).not.toBeNull();
      fireEvent.click(within(strictAddonHeader).getByRole('button', { name: /aus|off/i }));

      expect(
        await screen.findByText(/deinstallations-|uninstall/i),
      ).toBeInTheDocument();
      expect(screen.getByLabelText(/^von$|^from$/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^bis$|^to$/i)).toBeInTheDocument();

      const saveButton = await screen.findByRole('button', { name: /speichern/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(useAppStore.getState().strictAddons.learn.enabled).toBe(true);
      });
      expect(useAppStore.getState().activeModes).toEqual(['learn', 'strict']);
      expect(syncPoliciesMock).toHaveBeenCalledWith(expect.objectContaining({
        activeModes: ['learn', 'strict'],
        blockedPackages: expect.arrayContaining([
          'com.google.android.youtube',
          'com.android.settings',
        ]),
      }));
      expect(await screen.findByText(/^gespeichert$|^saved$/i)).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('blocks strict saves when the schedule exceeds 20 hours', async () => {
    renderModesPage();
    await waitForPermissionsReady();

    clickLearnModeCard();
    fireEvent.click((await screen.findByText('YouTube')).closest('button')!);
    const strictAddonLabel = await screen.findByText(/strikt-zusatz|strict add-on/i);
    const strictAddonHeader = strictAddonLabel.closest('div')?.parentElement;
    expect(strictAddonHeader).not.toBeNull();
    fireEvent.click(within(strictAddonHeader).getByRole('button', { name: /aus|off/i }));

    const fromInput = await screen.findByLabelText(/^von$|^from$/i);
    const toInput = screen.getByLabelText(/^bis$|^to$/i);

    fireEvent.change(fromInput, { target: { value: '08:00' } });
    fireEvent.change(toInput, { target: { value: '05:00' } });

    expect(await screen.findAllByText(/mehr als 20 stunden/i)).toHaveLength(2);
    expect(screen.getByRole('button', { name: /speichern/i })).toBeDisabled();
  });

  it('surfaces native runtime issues from the store', async () => {
    renderModesPage();
    await waitForPermissionsReady();

    act(() => {
      useAppStore.getState().setNativeRuntimeIssue('blockingService', 'test error');
    });

    expect(
      await screen.findByText(/app-blocking: test error|app blocking: test error/i),
    ).toBeInTheDocument();
  });

  it('shows separate active unlock countdowns per target', async () => {
    const now = Date.now();

    useAppStore.setState({
      blockedApps: ['com.google.android.youtube', 'com.instagram.android'],
      blockedAppModes: {
        'com.google.android.youtube': 'strict',
        'com.instagram.android': 'learn',
      },
      unlockedTargets: {
        'app:com.google.android.youtube': now + 12 * 60 * 1000,
        'app:com.instagram.android': now + 4 * 60 * 1000,
      },
    });

    renderModesPage();
    await waitForPermissionsReady();

    expect(await screen.findByText(/aktive freigaben|active unlocks/i)).toBeInTheDocument();
    const activeUnlockSection = screen
      .getByText(/jedes ziel läuft mit eigener uhr|each target keeps its own timer/i)
      .closest('section');

    expect(activeUnlockSection).not.toBeNull();
    const unlockScope = within(activeUnlockSection!);

    expect(unlockScope.getByText('YouTube')).toBeInTheDocument();
    expect(unlockScope.getByText('Instagram')).toBeInTheDocument();
    expect(unlockScope.getAllByText(/freigabe endet in|unlock ends in/i)).toHaveLength(2);
    expect(unlockScope.getAllByText(/\d{2}:\d{2}:\d{2}/)).toHaveLength(2);
  });

  it('allows penalty mode itself to be saved before any app is assigned', async () => {
    renderModesPage();
    await waitForPermissionsReady();

    fireEvent.click(screen.getByRole('button', { name: /strafmodus/i }));

    const saveButton = await screen.findByRole('button', { name: /speichern/i });
    expect(saveButton).not.toBeDisabled();
  });
});
