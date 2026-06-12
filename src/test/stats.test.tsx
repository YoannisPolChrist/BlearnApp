import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ROUTER_FUTURE_FLAGS } from '@/lib/routerFuture';
import StatsPage from '@/pages/Stats';
import { suppressKnownActWarnings } from '@/test/support/suppressActWarnings';
import { useAppStore } from '@/store/useAppStore';
import { useLearningStore } from '@/store/useLearningStore';

let consoleErrorSpy: ReturnType<typeof vi.spyOn> | null = null;

vi.mock('@/services/screenTimeService', async () => {
  const actual = await vi.importActual<typeof import('@/services/screenTimeService')>('@/services/screenTimeService');

  return {
    ...actual,
    formatScreenTime: vi.fn((value: number) => `${Math.round(value / 60000)}m`),
    getTodayUsage: vi.fn().mockResolvedValue({
      totalScreenTimeMs: 7_200_000,
      entries: [
        {
          packageName: 'com.youtube',
          appName: 'YouTube',
          totalTimeMs: 4_200_000,
          lastUsedTimestamp: Date.now(),
        },
      ],
    }),
    getMonitoringStatus: vi.fn().mockResolvedValue({
      monitoringActive: true,
      overlayPermission: true,
      accessibilityPermission: true,
      websiteBlockingAvailable: true,
      websiteBlockingEnabled: true,
      websiteBlockingPermission: true,
      lastTriggerType: 'app',
      lastTriggerTarget: 'com.youtube',
      taskDiagnostics: {
        currentActivityClass: 'app.blearn.mobile.BlockingOverlayActivity',
        mainTaskAvailable: true,
        blockingTaskActive: true,
        appTasks: [
          {
            baseActivity: 'app.blearn.mobile/.MainActivity',
            topActivity: 'app.blearn.mobile/.MainActivity',
            baseIntentComponent: 'app.blearn.mobile/.MainActivity',
          },
          {
            baseActivity: 'app.blearn.mobile/.BlockingOverlayActivity',
            topActivity: 'app.blearn.mobile/.BlockingOverlayActivity',
          },
        ],
      },
    }),
    getInstalledApps: vi.fn().mockResolvedValue([
      {
        packageName: 'com.youtube',
        appName: 'YouTube',
        label: 'YouTube',
        icon: 'data:image/png;base64,yt-icon',
      },
      { packageName: 'com.spotify', appName: 'Spotify', label: 'Spotify' },
    ]),
    getCurrentApp: vi.fn().mockResolvedValue('com.youtube'),
    getAppId: vi.fn((entry: { packageName?: string }) => entry.packageName || ''),
    getAppLabel: vi.fn((entry: { appName?: string; label?: string; packageName?: string }) => entry.appName || entry.label || entry.packageName || ''),
  };
});

const baselineAppState = {
  activeMode: useAppStore.getState().activeMode,
  blockedApps: useAppStore.getState().blockedApps,
  blockedSearchTerms: useAppStore.getState().blockedSearchTerms,
  blockedWebsites: useAppStore.getState().blockedWebsites,
  dailyStats: useAppStore.getState().dailyStats,
  streak: useAppStore.getState().streak,
  checkins: useAppStore.getState().checkins,
  userProfile: useAppStore.getState().userProfile,
};

const baselineLearningState = useLearningStore.getState();

afterEach(() => {
  consoleErrorSpy?.mockRestore();
  consoleErrorSpy = null;
  useAppStore.setState({
    activeMode: baselineAppState.activeMode,
    blockedApps: baselineAppState.blockedApps,
    blockedSearchTerms: baselineAppState.blockedSearchTerms,
    blockedWebsites: baselineAppState.blockedWebsites,
    dailyStats: baselineAppState.dailyStats,
    streak: baselineAppState.streak,
    checkins: baselineAppState.checkins,
    userProfile: baselineAppState.userProfile,
  });
  useLearningStore.setState(baselineLearningState, true);
  vi.clearAllMocks();
});

beforeEach(() => {
  consoleErrorSpy = suppressKnownActWarnings();
});

async function flushAsyncUi() {
  for (let index = 0; index < 3; index += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

async function renderStatsPage() {
  await act(async () => {
    render(
      <MemoryRouter future={ROUTER_FUTURE_FLAGS}>
        <StatsPage />
      </MemoryRouter>,
    );
  });
  await flushAsyncUi();
}

describe('StatsPage', () => {
  it('switches between app usage, emotion, and vocab sections', async () => {
    const now = Date.now();

    useAppStore.setState({
      activeMode: 'strict',
      blockedApps: ['com.youtube'],
      blockedWebsites: ['youtube.com'],
      blockedSearchTerms: ['doomscrolling'],
      dailyStats: {
        breathingSessions: 3,
        totalBreathingMinutes: 12,
        checkinsCompleted: 4,
        challengesCompleted: 2,
        pausesTaken: 1,
      },
      streak: 5,
      checkins: [
        {
          id: 'checkin-1',
          timestamp: now,
          emotions: ['calm', 'focused'],
          reflection: 'Ich bleibe bei meinem Fokus.',
          chatHistory: [],
          breathingCompleted: true,
          targetApp: 'youtube',
        },
      ],
      userProfile: {
        commonEmotions: {
          calm: 4,
          focused: 3,
          anxious: 1,
        },
        triggerTimes: [9, 14, 21],
        recentInteractions: [
          {
            timestamp: now,
            type: 'checkin',
            emotions: ['calm'],
            completed: true,
            targetApp: 'youtube',
          },
        ],
        totalSessions: 9,
        totalChallengesCompleted: 2,
        consecutiveDays: 5,
        completedChallenges: ['breathing-reset'],
      },
    });

    useLearningStore.setState(useLearningStore.getInitialState(), true);
    useLearningStore.getState().seedStarterDeck();

    await renderStatsPage();

    expect(await screen.findByText('Deine Stats')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /^app-nutzung$/i })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByRole('tab', { name: /^regeln$/i })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'App-Nutzung' })).toBeInTheDocument();
    expect(screen.getByText('Gesamtzeit')).toBeInTheDocument();
    expect(screen.getByText('Entsperrt')).toBeInTheDocument();
    expect(screen.getByText('Top-App')).toBeInTheDocument();
    expect(screen.getByText('Nutzung heute')).toBeInTheDocument();
    expect(screen.getByText('Aktive App')).toBeInTheDocument();
    expect(screen.getByText('Zuletzt aktualisiert')).toBeInTheDocument();
    expect(screen.getByText('Android Runtime')).toBeInTheDocument();
    expect(screen.getByText(/Main-Task bereit/i)).toBeInTheDocument();
    expect(screen.getByText(/Blocking-Task aktiv/i)).toBeInTheDocument();
    expect(screen.getAllByText(/MainActivity/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('YouTube').length).toBeGreaterThan(0);

    await act(async () => {
      fireEvent.click(screen.getByRole('tab', { name: /^stimmung$/i }));
    });
    await flushAsyncUi();
    expect(screen.getByText('Aktivit\u00e4t - Woche')).toBeInTheDocument();
    expect(screen.getByText('Stimmungsverlauf')).toBeInTheDocument();
    expect(screen.getByText('Emotions-Profil')).toBeInTheDocument();
    expect(screen.getByText('H\u00e4ufigste Emotionen')).toBeInTheDocument();
    expect(screen.getByText('Letzte Stimmungen')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('tab', { name: /^lernen$/i }));
    });
    await flushAsyncUi();
    expect(screen.getByText('Lernfortschritt')).toBeInTheDocument();
    expect(screen.getByText('Heute gelernt')).toBeInTheDocument();
    expect(screen.getByText('Letzte 7 Tage')).toBeInTheDocument();
    expect(screen.getByText('Diesen Monat')).toBeInTheDocument();
    expect(screen.getByText('Offen')).toBeInTheDocument();
    expect(screen.getByText('Kartenstatus')).toBeInTheDocument();
    expect(screen.queryByText('Offene Vokabeln pro Deck')).not.toBeInTheDocument();
  });

  it('shows learn-session emotions inside the mood stats section', async () => {
    const now = Date.now();

    useAppStore.setState({
      checkins: [],
      userProfile: {
        commonEmotions: {},
        triggerTimes: [11],
        recentInteractions: [
          {
            timestamp: now,
            type: 'learning',
            emotions: ['relieved', 'hopeful'],
            intention: 'Spanish Deck',
            completed: true,
            targetApp: 'youtube',
          },
        ],
        totalSessions: 0,
        totalChallengesCompleted: 0,
        consecutiveDays: 1,
        completedChallenges: [],
      },
    });

    await renderStatsPage();

    await act(async () => {
      fireEvent.click(await screen.findByRole('tab', { name: /^stimmung$/i }));
    });
    await flushAsyncUi();

    expect(screen.getByText('Erleichtert')).toBeInTheDocument();
    expect(screen.getByText('Hoffnungsvoll')).toBeInTheDocument();
    expect(screen.getByText('Lernsession')).toBeInTheDocument();
    expect(screen.getByText('Spanish Deck')).toBeInTheDocument();
  });

  it('deduplicates learn-session mood entries when checkin and learning records describe the same moment', async () => {
    const now = Date.now();

    useAppStore.setState({
      checkins: [
        {
          id: 'learning-checkin-1',
          timestamp: now,
          emotions: ['relieved'],
          reflection: 'Starter Vokabeln',
          chatHistory: [],
          breathingCompleted: false,
          targetApp: 'youtube',
        },
      ],
      userProfile: {
        commonEmotions: {
          relieved: 1,
        },
        triggerTimes: [11],
        recentInteractions: [
          {
            timestamp: now,
            type: 'learning',
            emotions: ['relieved'],
            intention: 'Starter Vokabeln',
            completed: true,
            targetApp: 'youtube',
          },
        ],
        totalSessions: 0,
        totalChallengesCompleted: 0,
        consecutiveDays: 1,
        completedChallenges: [],
      },
    });

    await renderStatsPage();

    await act(async () => {
      fireEvent.click(await screen.findByRole('tab', { name: /^stimmung$/i }));
    });
    await flushAsyncUi();

    expect(screen.getByText('Erleichtert')).toBeInTheDocument();
    expect(screen.getAllByText('Starter Vokabeln')).toHaveLength(1);
    expect(screen.getAllByText('Lernsession')).toHaveLength(1);
    expect(screen.getByText('1x')).toBeInTheDocument();
    expect(screen.queryByText('2x')).not.toBeInTheDocument();
  });

  it('uses installed-app icons as the fallback artwork for usage rows', async () => {
    await renderStatsPage();

    const icon = await screen.findByAltText('YouTube Icon');
    expect(icon).toHaveAttribute('src', 'data:image/png;base64,yt-icon');
  });
});

