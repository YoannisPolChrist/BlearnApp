import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { resetCloudSyncRuntimeForTests } from '@/lib/cloudSyncRuntime';

const isFirebaseWriteEnabledMock = vi.hoisted(() => vi.fn(() => true));
const loadProgressCloudStateMock = vi.hoisted(() => vi.fn());
const saveProgressCloudStateMock = vi.hoisted(() => vi.fn(async () => undefined));
const subscribeToProgressCloudStateMock = vi.hoisted(() => vi.fn());
const getProgressSyncDeviceIdMock = vi.hoisted(() => vi.fn(() => 'device-test'));

vi.mock('@/lib/firebase', () => ({
  isFirebaseConfigured: vi.fn(() => true),
  isFirebaseWriteEnabled: isFirebaseWriteEnabledMock,
  getFirebaseGoogleWebClientId: vi.fn(() => 'web-client-id'),
}));

vi.mock('@/services/firebaseProgressSyncService', () => ({
  getProgressSyncDeviceId: getProgressSyncDeviceIdMock,
  loadProgressCloudState: loadProgressCloudStateMock,
  saveProgressCloudState: saveProgressCloudStateMock,
  subscribeToProgressCloudState: subscribeToProgressCloudStateMock,
}));

import { useAppProgressCloudSync } from '@/hooks/useAppProgressCloudSync';
import { suppressKnownActWarnings } from '@/test/support/suppressActWarnings';
import { useAppStore } from '@/store/useAppStore';
import { useAuthStore } from '@/store/useAuthStore';

let consoleErrorSpy: ReturnType<typeof vi.spyOn> | null = null;

async function flushHookEffects() {
  for (let index = 0; index < 3; index += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

describe('useAppProgressCloudSync', () => {
  beforeEach(() => {
    consoleErrorSpy = suppressKnownActWarnings();
    window.localStorage.clear();
    isFirebaseWriteEnabledMock.mockClear();
    loadProgressCloudStateMock.mockReset();
    saveProgressCloudStateMock.mockClear();
    subscribeToProgressCloudStateMock.mockReset();
    getProgressSyncDeviceIdMock.mockClear();
    subscribeToProgressCloudStateMock.mockImplementation(() => () => undefined);
    resetCloudSyncRuntimeForTests();
    useAppStore.setState(useAppStore.getInitialState(), true);
    useAuthStore.setState({
      authReady: false,
      status: 'idle',
      user: null,
      error: undefined,
      onboardingRequired: false,
      authDialogOpen: false,
    });
  });

  afterEach(() => {
    consoleErrorSpy?.mockRestore();
    consoleErrorSpy = null;
    window.localStorage.clear();
    vi.restoreAllMocks();
    resetCloudSyncRuntimeForTests();
    useAppStore.setState(useAppStore.getInitialState(), true);
    useAuthStore.setState({
      authReady: false,
      status: 'idle',
      user: null,
      error: undefined,
      onboardingRequired: false,
      authDialogOpen: false,
    });
  });

  it('hydrates merged progress state and swaps account snapshots when the active user changes', async () => {
    const cloudSyncRuntime = await import('@/lib/cloudSyncRuntime');
    cloudSyncRuntime.resetCloudSyncRuntimeForTests();
    const localTimestamp = 1_700_000_000_000;
    const remoteTimestamp = localTimestamp + 3_600_000;
    const userARemoteState = {
      checkins: [
        {
          id: 'checkin-a',
          timestamp: localTimestamp,
          emotions: ['calm'],
          reflection: 'A',
          chatHistory: [],
          breathingCompleted: true,
        },
      ],
      interactions: [],
    };
    const userBRemoteState = {
      checkins: [
        {
          id: 'checkin-b',
          timestamp: remoteTimestamp + 3_600_000,
          emotions: ['focused'],
          reflection: 'B',
          chatHistory: [],
          breathingCompleted: false,
        },
      ],
      interactions: [],
    };

    loadProgressCloudStateMock.mockImplementation(async (userId: string) => {
      if (userId === 'user-a') return userARemoteState;
      if (userId === 'user-b') return userBRemoteState;
      return null;
    });

    useAppStore.setState({
      checkins: [
        {
          id: 'checkin-a',
          timestamp: localTimestamp,
          emotions: ['calm'],
          reflection: 'A',
          chatHistory: [],
          breathingCompleted: true,
        },
      ],
      userProfile: {
        commonEmotions: { calm: 1 },
        triggerTimes: [8],
        recentInteractions: [
          {
            id: 'interaction-a',
            timestamp: remoteTimestamp,
            type: 'breathing',
            emotions: ['calm'],
            completed: true,
            durationMinutes: 7,
          },
        ],
        totalSessions: 1,
        totalChallengesCompleted: 0,
        consecutiveDays: 1,
        completedChallenges: [],
      },
      dailyStats: {
        breathingSessions: 0,
        totalBreathingMinutes: 0,
        checkinsCompleted: 1,
        challengesCompleted: 0,
        pausesTaken: 0,
      },
      streak: 1,
      lastCheckinDate: '2023-11-14',
    });
    window.localStorage.setItem('blearn-progress-storage-owner', 'user-a');

    useAuthStore.setState({
      authReady: true,
      status: 'authenticated',
      user: {
        uid: 'user-a',
        email: 'user-a@example.com',
      },
    });

    function Harness() {
      useAppProgressCloudSync(true);
      return null;
    }

    await act(async () => {
      renderHook(() => useAppProgressCloudSync(true));
    });
    await flushHookEffects();

    await waitFor(() => {
      expect(loadProgressCloudStateMock).toHaveBeenCalledWith('user-a', { source: 'server' });
    });

    await act(async () => {
      useAuthStore.setState({
        authReady: true,
        status: 'authenticated',
        user: {
          uid: 'user-b',
          email: 'user-b@example.com',
        },
      });
    });
    await flushHookEffects();

    await waitFor(() => {
      expect(useAppStore.getState().checkins[0]?.id).toBe('checkin-b');
      expect(loadProgressCloudStateMock).toHaveBeenCalledWith('user-b', { source: 'server' });
    });

    const backup = window.localStorage.getItem('blearn-progress-storage-backup:user-a');
    expect(backup).toContain('interaction-a');
    expect(backup).toContain('checkin-a');
    expect(cloudSyncRuntime.useCloudSyncRuntimeStore.getState().progress.status).toBe('ready');
  });
});
