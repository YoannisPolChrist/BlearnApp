import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useAppStore } from '@/store/useAppStore';
import { buildDevicePolicySnapshot } from '@/lib/nativePolicy';
import { getInstalledApps } from '@/services/screenTimeInstalledApps';

vi.mock('@/services/screenTimeInstalledApps', () => ({
  getInstalledApps: vi.fn(),
}));

describe('remote blocking store & policy logic', () => {
  beforeEach(() => {
    useAppStore.setState(useAppStore.getInitialState(), true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('defaults to remoteBlockingEnabled: true and resolves categories when instruction is set', async () => {
    const store = useAppStore.getState();

    // Mock installed apps database
    const mockedApps = [
      { packageName: 'com.instagram.android', appId: 'com.instagram.android', label: 'Instagram' },
      { packageName: 'com.candycrush.game', appId: 'com.candycrush.game', label: 'Candy Crush' },
      { packageName: 'com.netflix.mediaclient', appId: 'com.netflix.mediaclient', label: 'Netflix' },
      { packageName: 'com.android.chrome', appId: 'com.android.chrome', label: 'Chrome' },
      { packageName: 'com.google.android.googlequicksearchbox', appId: 'com.google.android.googlequicksearchbox', label: 'Google Search' },
      { packageName: 'com.other.app', appId: 'com.other.app', label: 'Other App' },
    ];
    vi.mocked(getInstalledApps).mockResolvedValue(mockedApps);

    // Initial state check
    expect(useAppStore.getState().remoteBlockingEnabled).toBe(true);
    expect(useAppStore.getState().remoteBlockingInstruction).toBeNull();
    expect(useAppStore.getState().resolvedRemoteBlockedApps).toEqual([]);

    // Set remote blocking instruction
    const futureExpiry = Date.now() + 10_000;
    await store.setRemoteBlockingInstruction({
      expiresAt: futureExpiry,
      blockedApps: ['com.other.app'],
      blockedCategories: ['social_media', 'games'],
      mode: 'strict',
    });

    const updatedState = useAppStore.getState();
    expect(updatedState.remoteBlockingInstruction).toEqual({
      expiresAt: futureExpiry,
      blockedApps: ['com.other.app'],
      blockedCategories: ['social_media', 'games'],
      mode: 'strict',
    });

    // Should contain both explicitly blocked apps and resolved categories
    // com.instagram.android (social_media)
    // com.candycrush.game (games)
    // com.other.app (explicit)
    expect(updatedState.resolvedRemoteBlockedApps).toContain('com.instagram.android');
    expect(updatedState.resolvedRemoteBlockedApps).toContain('com.candycrush.game');
    expect(updatedState.resolvedRemoteBlockedApps).toContain('com.other.app');
    expect(updatedState.resolvedRemoteBlockedApps).not.toContain('com.netflix.mediaclient');
  });

  it('resolves games from the Android application category even when their name has no game marker', async () => {
    vi.mocked(getInstalledApps).mockResolvedValue([
      {
        packageName: 'com.example.balatro',
        appId: 'com.example.balatro',
        label: 'Balatro',
        category: 0,
      },
      {
        packageName: 'com.example.notes',
        appId: 'com.example.notes',
        label: 'Notes',
        category: 7,
      },
    ]);

    await useAppStore.getState().setRemoteBlockingInstruction({
      id: 'games-by-os-category',
      createdAt: Date.now(),
      expiresAt: Date.now() + 60_000,
      blockedCategories: ['games'],
      mode: 'strict',
    });

    expect(useAppStore.getState().resolvedRemoteBlockedApps).toContain('com.example.balatro');
    expect(useAppStore.getState().resolvedRemoteBlockedApps).not.toContain('com.example.notes');
  });

  it('clears resolved blocked apps immediately when remoteBlockingEnabled is toggled off', async () => {
    const store = useAppStore.getState();

    const mockedApps = [
      { packageName: 'com.instagram.android', appId: 'com.instagram.android', label: 'Instagram' },
    ];
    vi.mocked(getInstalledApps).mockResolvedValue(mockedApps);

    const futureExpiry = Date.now() + 10_000;
    await store.setRemoteBlockingInstruction({
      expiresAt: futureExpiry,
      blockedApps: ['com.instagram.android'],
      blockedCategories: [],
      mode: 'learn',
    });

    expect(useAppStore.getState().resolvedRemoteBlockedApps).toEqual(['com.instagram.android']);

    // Toggle off remote blocking
    store.setRemoteBlockingEnabled(false);

    const updatedState = useAppStore.getState();
    expect(updatedState.remoteBlockingEnabled).toBe(false);
    expect(updatedState.remoteBlockingInstruction).toBeNull();
    expect(updatedState.resolvedRemoteBlockedApps).toEqual([]);
  });

  it('builds device policy snapshot with remote blocked apps included', async () => {
    const mockedApps = [
      { packageName: 'com.instagram.android', appId: 'com.instagram.android', label: 'Instagram' },
    ];
    vi.mocked(getInstalledApps).mockResolvedValue(mockedApps);

    const futureExpiry = Date.now() + 10_000;
    const store = useAppStore.getState();
    await store.setRemoteBlockingInstruction({
      expiresAt: futureExpiry,
      blockedApps: ['com.instagram.android'],
      blockedCategories: [],
      mode: 'learn',
    });

    const state = useAppStore.getState();

    const snapshot = buildDevicePolicySnapshot({
      activeModes: ['learn'],
      gateRule: {
        requiredCorrectReviews: 5,
        unlockDurationMinutes: 15,
        typedAnswerMaxWords: 3,
        typedAnswerEnabled: true,
      },
      blockedApps: [],
      blockedAppModes: {},
      blockedWebsites: [],
      blockedWebsiteModes: {},
      blockedSearchTerms: [],
      blockedSearchTermModes: {},
      assignments: [],
      unlockedTargets: {},
      remoteBlockingEnabled: state.remoteBlockingEnabled,
      remoteBlockingInstruction: state.remoteBlockingInstruction,
      resolvedRemoteBlockedApps: state.resolvedRemoteBlockedApps,
    });

    // Verify snapshot includes remote blocked apps
    expect(snapshot.blockedPackages).toContain('com.instagram.android');
    expect(snapshot.targets).toContainEqual({
      id: 'com.instagram.android',
      type: 'app',
      mode: 'learn',
      deckId: undefined,
      requiredCorrectReviews: 5,
      unlockDurationMinutes: 15,
      enabled: true,
    });
  });

  it('ignores remote blocking in snapshot if expired', async () => {
    const mockedApps = [
      { packageName: 'com.instagram.android', appId: 'com.instagram.android', label: 'Instagram' },
    ];
    vi.mocked(getInstalledApps).mockResolvedValue(mockedApps);

    const pastExpiry = Date.now() - 5_000;
    const store = useAppStore.getState();
    await store.setRemoteBlockingInstruction({
      expiresAt: pastExpiry,
      blockedApps: ['com.instagram.android'],
      blockedCategories: [],
      mode: 'learn',
    });

    const state = useAppStore.getState();

    const snapshot = buildDevicePolicySnapshot({
      activeModes: ['learn'],
      gateRule: {
        requiredCorrectReviews: 5,
        unlockDurationMinutes: 15,
        typedAnswerMaxWords: 3,
        typedAnswerEnabled: true,
      },
      blockedApps: [],
      blockedAppModes: {},
      blockedWebsites: [],
      blockedWebsiteModes: {},
      blockedSearchTerms: [],
      blockedSearchTermModes: {},
      assignments: [],
      unlockedTargets: {},
      remoteBlockingEnabled: state.remoteBlockingEnabled,
      remoteBlockingInstruction: state.remoteBlockingInstruction,
      resolvedRemoteBlockedApps: state.resolvedRemoteBlockedApps,
    });

    expect(snapshot.blockedPackages).not.toContain('com.instagram.android');
    expect(snapshot.targets).toEqual([]);
  });
  
  it('sets remoteBlockingActive: true and does not append remoteMode to activeModes in snapshot when activeModes is empty', async () => {
    const mockedApps = [
      { packageName: 'com.instagram.android', appId: 'com.instagram.android', label: 'Instagram' },
    ];
    vi.mocked(getInstalledApps).mockResolvedValue(mockedApps);

    const futureExpiry = Date.now() + 10_000;
    const store = useAppStore.getState();
    await store.setRemoteBlockingInstruction({
      expiresAt: futureExpiry,
      blockedApps: ['com.instagram.android'],
      blockedCategories: [],
      mode: 'learn',
    });

    const state = useAppStore.getState();

    const snapshot = buildDevicePolicySnapshot({
      activeModes: [],
      gateRule: {
        requiredCorrectReviews: 5,
        unlockDurationMinutes: 15,
        typedAnswerMaxWords: 3,
        typedAnswerEnabled: true,
      },
      blockedApps: [],
      blockedAppModes: {},
      blockedWebsites: [],
      blockedWebsiteModes: {},
      blockedSearchTerms: [],
      blockedSearchTermModes: {},
      assignments: [],
      unlockedTargets: {},
      remoteBlockingEnabled: state.remoteBlockingEnabled,
      remoteBlockingInstruction: state.remoteBlockingInstruction,
      resolvedRemoteBlockedApps: state.resolvedRemoteBlockedApps,
    });

    expect(snapshot.remoteBlockingActive).toBe(true);
    expect(snapshot.activeModes).toEqual([]);
    expect(snapshot.blockedPackages).toContain('com.instagram.android');
  });

  it('displays remote block details on the InterventionPage when app is remote-blocked', async () => {
    // Dynamic import to isolate store changes
    const { default: InterventionPage } = await import('@/pages/Intervention');
    const store = useAppStore.getState();

    // Mock instruction in the store
    const expiresAt = Date.now() + 60 * 60 * 1000; // 1 hour from now
    useAppStore.setState({
      remoteBlockingInstruction: {
        id: 'remote_test_1',
        blockedApps: ['com.instagram.android'],
        blockedCategories: [],
        expiresAt,
        createdAt: Date.now(),
        mode: 'lock',
      },
      resolvedRemoteBlockedApps: ['com.instagram.android'],
    });

    const route = `/intervention?targetId=com.instagram.android&targetType=app&targetLabel=Instagram&mode=lock&overlaySessionId=sess_1`;

    render(
      React.createElement(
        MemoryRouter,
        { initialEntries: [route] },
        React.createElement(
          Routes,
          null,
          React.createElement(Route, {
            path: '/intervention',
            element: React.createElement(InterventionPage),
          })
        )
      )
    );

    // Verify custom title and description are rendered
    expect(screen.getByText('Vom Coach gesperrt')).toBeInTheDocument();
    expect(screen.getByText(/vorübergehend gesperrt/)).toBeInTheDocument();
    expect(screen.getByText(/Instagram/)).toBeInTheDocument();
    expect(screen.getByText(/in ca. 60 Minuten/)).toBeInTheDocument();
  });

  it('correctly clears remote blocking snapshot when instruction is set to null', async () => {
    const store = useAppStore.getState();
    const futureExpiry = Date.now() + 10_000;
    
    // Set active remote block
    await store.setRemoteBlockingInstruction({
      id: 'inst_1',
      expiresAt: futureExpiry,
      blockedApps: ['com.whatsapp'],
      blockedCategories: [],
      mode: 'strict',
    });

    let snapshot = buildDevicePolicySnapshot({
      activeModes: [],
      gateRule: {
        requiredCorrectReviews: 5,
        unlockDurationMinutes: 15,
        typedAnswerMaxWords: 3,
        typedAnswerEnabled: true,
      },
      blockedApps: [],
      blockedAppModes: {},
      blockedWebsites: [],
      blockedWebsiteModes: {},
      blockedSearchTerms: [],
      blockedSearchTermModes: {},
      assignments: [],
      unlockedTargets: {},
      remoteBlockingEnabled: store.remoteBlockingEnabled,
      remoteBlockingInstruction: useAppStore.getState().remoteBlockingInstruction,
      resolvedRemoteBlockedApps: useAppStore.getState().resolvedRemoteBlockedApps,
    });

    expect(snapshot.remoteBlockingActive).toBe(true);
    expect(snapshot.blockedPackages).toContain('com.whatsapp');

    // Now clear it (set to null)
    await store.setRemoteBlockingInstruction(null);

    const clearedState = useAppStore.getState();
    expect(clearedState.remoteBlockingInstruction).toBeNull();
    expect(clearedState.resolvedRemoteBlockedApps).toEqual([]);

    snapshot = buildDevicePolicySnapshot({
      activeModes: [],
      gateRule: {
        requiredCorrectReviews: 5,
        unlockDurationMinutes: 15,
        typedAnswerMaxWords: 3,
        typedAnswerEnabled: true,
      },
      blockedApps: [],
      blockedAppModes: {},
      blockedWebsites: [],
      blockedWebsiteModes: {},
      blockedSearchTerms: [],
      blockedSearchTermModes: {},
      assignments: [],
      unlockedTargets: {},
      remoteBlockingEnabled: store.remoteBlockingEnabled,
      remoteBlockingInstruction: clearedState.remoteBlockingInstruction,
      resolvedRemoteBlockedApps: clearedState.resolvedRemoteBlockedApps,
    });

    expect(snapshot.remoteBlockingActive).toBe(false);
    expect(snapshot.blockedPackages).not.toContain('com.whatsapp');
  });

  it('automatically dismisses and navigates to home when remote block is cleared and no local block is active', async () => {
    const { default: InterventionPage } = await import('@/pages/Intervention');

    // 1. Setup active remote block in store
    const expiresAt = Date.now() + 60 * 60 * 1000; // 1 hour from now
    useAppStore.setState({
      remoteBlockingInstruction: {
        id: 'remote_test_auto_dismiss',
        blockedApps: ['com.whatsapp'],
        blockedCategories: [],
        expiresAt,
        createdAt: Date.now(),
        mode: 'strict',
      },
      resolvedRemoteBlockedApps: ['com.whatsapp'],
      blockedApps: [], // no local block
    });

    const route = `/intervention?targetId=com.whatsapp&targetType=app&targetLabel=WhatsApp&mode=strict&overlaySessionId=sess_2`;

    render(
      React.createElement(
        MemoryRouter,
        { initialEntries: [route] },
        React.createElement(
          Routes,
          null,
          React.createElement(Route, {
            path: '/intervention',
            element: React.createElement(InterventionPage),
          }),
          React.createElement(Route, {
            path: '/',
            element: React.createElement('div', null, 'Home Screen'),
          })
        )
      )
    );

    // Verify it currently shows the coach block screen
    expect(screen.getByText('Vom Coach gesperrt')).toBeInTheDocument();
    expect(screen.queryByText('Home Screen')).not.toBeInTheDocument();

    // 2. Clear remote block in store
    act(() => {
      useAppStore.setState({
        remoteBlockingInstruction: null,
        resolvedRemoteBlockedApps: [],
      });
    });

    // Wait for the effect and verify it navigated to Home
    expect(await screen.findByText('Home Screen')).toBeInTheDocument();
    expect(screen.queryByText('Vom Coach gesperrt')).not.toBeInTheDocument();
  });

  it('does NOT auto-dismiss when remote block is cleared but local block remains active', async () => {
    const { default: InterventionPage } = await import('@/pages/Intervention');

    // 1. Setup active remote block AND local block in store
    const expiresAt = Date.now() + 60 * 60 * 1000;
    useAppStore.setState({
      remoteBlockingInstruction: {
        id: 'remote_test_no_dismiss',
        blockedApps: ['com.whatsapp'],
        blockedCategories: [],
        expiresAt,
        createdAt: Date.now(),
        mode: 'strict',
      },
      resolvedRemoteBlockedApps: ['com.whatsapp'],
      blockedApps: ['com.whatsapp'], // local block active!
      blockedAppModes: { 'com.whatsapp': 'strict' },
    });

    const route = `/intervention?targetId=com.whatsapp&targetType=app&targetLabel=WhatsApp&mode=strict&overlaySessionId=sess_3`;

    render(
      React.createElement(
        MemoryRouter,
        { initialEntries: [route] },
        React.createElement(
          Routes,
          null,
          React.createElement(Route, {
            path: '/intervention',
            element: React.createElement(InterventionPage),
          }),
          React.createElement(Route, {
            path: '/',
            element: React.createElement('div', null, 'Home Screen'),
          })
        )
      )
    );

    // Verify it currently shows the coach block screen
    expect(screen.getByText('Vom Coach gesperrt')).toBeInTheDocument();

    // 2. Clear remote block in store
    act(() => {
      useAppStore.setState({
        remoteBlockingInstruction: null,
        resolvedRemoteBlockedApps: [],
      });
    });

    // Since a local block is active, it should transition to the standard intervention overlay screen, NOT navigate to Home.
    await new Promise((resolve) => setTimeout(resolve, 100)); // wait brief moment for effects
    expect(screen.queryByText('Home Screen')).not.toBeInTheDocument();
    expect(screen.queryByText('Vom Coach gesperrt')).not.toBeInTheDocument();
  });

  it('renders CoachRemoteBlockScreen on LearnReviewPage when app is remote-blocked', async () => {
    const { default: LearnReviewPage } = await import('@/pages/LearnReview');

    // 1. Setup active remote block for com.instagram.android in store
    const expiresAt = Date.now() + 60 * 60 * 1000;
    useAppStore.setState({
      remoteBlockingInstruction: {
        id: 'remote_test_learn',
        blockedApps: ['com.instagram.android'],
        blockedCategories: [],
        expiresAt,
        createdAt: Date.now(),
        mode: 'strict',
      },
      resolvedRemoteBlockedApps: ['com.instagram.android'],
    });

    const route = `/learn/review?targetId=com.instagram.android&targetType=app&targetLabel=Instagram&mode=learn&overlaySessionId=sess_learn`;

    await act(async () => {
      render(
        React.createElement(
          MemoryRouter,
          { initialEntries: [route] },
          React.createElement(
            Routes,
            null,
            React.createElement(Route, {
              path: '/learn/review',
              element: React.createElement(LearnReviewPage),
            }),
            React.createElement(Route, {
              path: '/',
              element: React.createElement('div', null, 'Home Screen'),
            })
          )
        )
      );
    });

    // Verify it shows the coach block screen instead of vocabulary review content
    expect(screen.getByText('Vom Coach gesperrt')).toBeInTheDocument();
    expect(screen.queryByText('Vokabel fuer Vokabel')).not.toBeInTheDocument();
  });
});
