import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useNativeSync } from '@/hooks/useNativeSync';
import { suppressKnownActWarnings } from '@/test/support/suppressActWarnings';
import { useLearningStore } from '@/store/useLearningStore';
import { useAppStore } from '@/store/useAppStore';

const syncPoliciesMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const recheckCurrentForegroundTargetMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const startBlockingServiceMock = vi.hoisted(() => vi.fn());
const stopBlockingServiceMock = vi.hoisted(() => vi.fn());
const updateBlockedAppsMock = vi.hoisted(() => vi.fn());
const startWebsiteBlockingMock = vi.hoisted(() => vi.fn());
const stopWebsiteBlockingMock = vi.hoisted(() => vi.fn());
const updateBlockedDomainsMock = vi.hoisted(() => vi.fn());
const updateBlockedSearchTermsMock = vi.hoisted(() => vi.fn());
let consoleErrorSpy: ReturnType<typeof vi.spyOn> | null = null;

vi.mock('@/services/screenTimeService', () => ({
  isNative: true,
  syncPolicies: syncPoliciesMock,
  recheckCurrentForegroundTarget: recheckCurrentForegroundTargetMock,
  startBlockingService: startBlockingServiceMock,
  stopBlockingService: stopBlockingServiceMock,
  updateBlockedApps: updateBlockedAppsMock,
  startWebsiteBlocking: startWebsiteBlockingMock,
  stopWebsiteBlocking: stopWebsiteBlockingMock,
  updateBlockedDomains: updateBlockedDomainsMock,
  updateBlockedSearchTerms: updateBlockedSearchTermsMock,
}));

function NativeSyncProbe() {
  useNativeSync(true);
  return null;
}

function buildBaseAppState() {
  return {
    ...useAppStore.getInitialState(),
    hasHydrated: true,
    setNativeRuntimeIssue: vi.fn(),
    clearNativeRuntimeIssue: vi.fn(),
  };
}

async function flushHookEffects() {
  for (let index = 0; index < 3; index += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

describe('useNativeSync', () => {
  beforeEach(() => {
    consoleErrorSpy = suppressKnownActWarnings();
    syncPoliciesMock.mockClear();
    recheckCurrentForegroundTargetMock.mockClear();
    startBlockingServiceMock.mockClear();
    stopBlockingServiceMock.mockClear();
    updateBlockedAppsMock.mockClear();
    startWebsiteBlockingMock.mockClear();
    stopWebsiteBlockingMock.mockClear();
    updateBlockedDomainsMock.mockClear();
    updateBlockedSearchTermsMock.mockClear();

    useAppStore.setState(buildBaseAppState(), true);
    useLearningStore.setState(useLearningStore.getInitialState(), true);
  });

  afterEach(() => {
    consoleErrorSpy?.mockRestore();
    consoleErrorSpy = null;
    useAppStore.setState(buildBaseAppState(), true);
    useLearningStore.setState(useLearningStore.getInitialState(), true);
  });

  it('does not overwrite native policy before the app store has hydrated', async () => {
    useAppStore.setState(
      {
        ...buildBaseAppState(),
        hasHydrated: false,
        activeMode: 'learn',
        activeModes: ['learn'],
        blockedApps: ['com.android.deskclock'],
        blockedAppModes: { 'com.android.deskclock': 'learn' },
      },
      true,
    );

    await act(async () => {
      renderHook(() => useNativeSync(true));
    });
    await flushHookEffects();

    expect(syncPoliciesMock).not.toHaveBeenCalled();

    await act(async () => {
      useAppStore.setState({ hasHydrated: true });
    });
    await flushHookEffects();

    await waitFor(() => expect(syncPoliciesMock).toHaveBeenCalledTimes(1));
    expect(syncPoliciesMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        activeModes: ['learn'],
        blockedPackages: ['com.android.deskclock'],
      }),
    );
  });

  it('syncs the native snapshot without touching the legacy granular control paths', async () => {
    const now = Date.UTC(2026, 2, 23, 20, 0, 0);

    useAppStore.setState(
      {
        ...buildBaseAppState(),
        activeMode: 'strict',
        activeModes: ['strict'],
        blockedApps: ['com.instagram.android'],
        blockedAppModes: { 'com.instagram.android': 'strict' },
        blockedWebsites: ['youtube.com'],
        blockedWebsiteModes: { 'youtube.com': 'learn' },
        blockedSearchTerms: ['doomscrolling'],
        blockedSearchTermModes: { doomscrolling: 'strict' },
        unlockedTargets: { 'app:com.instagram.android': now + 15 * 60 * 1000 },
      },
      true,
    );

    await act(async () => {
      renderHook(() => useNativeSync(true));
    });
    await flushHookEffects();

    await waitFor(() => expect(syncPoliciesMock).toHaveBeenCalledTimes(1));

    expect(syncPoliciesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        activeModes: ['strict'],
        blockedPackages: ['com.instagram.android'],
        blockedDomains: ['youtube.com'],
        blockedSearchTerms: ['doomscrolling'],
        unlockedTargets: {
          'app:com.instagram.android': now + 15 * 60 * 1000,
        },
      }),
    );
    expect(startBlockingServiceMock).not.toHaveBeenCalled();
    expect(stopBlockingServiceMock).not.toHaveBeenCalled();
    expect(updateBlockedAppsMock).not.toHaveBeenCalled();
    expect(startWebsiteBlockingMock).not.toHaveBeenCalled();
    expect(stopWebsiteBlockingMock).not.toHaveBeenCalled();
    expect(updateBlockedDomainsMock).not.toHaveBeenCalled();
    expect(updateBlockedSearchTermsMock).not.toHaveBeenCalled();
  });

  it('re-syncs target-specific unlock timers through the single snapshot path', async () => {
    const now = Date.UTC(2026, 2, 23, 20, 30, 0);

    useAppStore.setState(
      {
        ...buildBaseAppState(),
        activeMode: 'learn',
        activeModes: ['learn'],
        blockedApps: ['com.instagram.android', 'com.google.android.youtube'],
        blockedAppModes: {
          'com.instagram.android': 'learn',
          'com.google.android.youtube': 'learn',
        },
        unlockedTargets: {
          'app:com.instagram.android': now + 5 * 60 * 1000,
        },
      },
      true,
    );

    await act(async () => {
      renderHook(() => useNativeSync(true));
    });
    await flushHookEffects();

    await waitFor(() => expect(syncPoliciesMock).toHaveBeenCalledTimes(1));

    await act(async () => {
      useAppStore.setState((state) => ({
        ...state,
        unlockedTargets: {
          ...state.unlockedTargets,
          'app:com.google.android.youtube': now + 9 * 60 * 1000,
        },
      }));
    });
    await flushHookEffects();

    await waitFor(() => expect(syncPoliciesMock).toHaveBeenCalledTimes(2));

    expect(syncPoliciesMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        unlockedTargets: {
          'app:com.instagram.android': now + 5 * 60 * 1000,
          'app:com.google.android.youtube': now + 9 * 60 * 1000,
        },
      }),
    );
    expect(startBlockingServiceMock).not.toHaveBeenCalled();
    expect(updateBlockedAppsMock).not.toHaveBeenCalled();
    expect(startWebsiteBlockingMock).not.toHaveBeenCalled();
    expect(updateBlockedDomainsMock).not.toHaveBeenCalled();
    expect(updateBlockedSearchTermsMock).not.toHaveBeenCalled();
  });

  it('includes strict lock protection packages while the lock window is active', async () => {
    const strictLockUntil = Date.now() + 60 * 60 * 1000;

    useAppStore.setState(
      {
        ...buildBaseAppState(),
        activeMode: 'lock',
        activeModes: ['lock'],
        strictLockUntil,
        strictLockScope: 'full',
      },
      true,
    );

    await act(async () => {
      renderHook(() => useNativeSync(true));
    });
    await flushHookEffects();

    await waitFor(() => expect(syncPoliciesMock).toHaveBeenCalledTimes(1));

    expect(syncPoliciesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        activeModes: ['lock'],
        fullLockBlocksAllApps: true,
        strictLockScope: 'full',
        blockedPackages: expect.arrayContaining([
          'com.android.settings',
          'com.android.packageinstaller',
          'com.google.android.packageinstaller',
          'com.google.android.permissioncontroller',
          'com.android.permissioncontroller',
          'com.miui.securitycenter',
          'com.miui.packageinstaller',
          'com.xiaomi.mipicks',
          'com.sec.android.app.myfiles',
          'com.sec.android.app.packageinstaller',
          'com.samsung.android.packageinstaller',
        ]),
        targets: expect.arrayContaining([
          expect.objectContaining({
            id: 'com.android.settings',
            mode: 'lock',
          }),
        ]),
      }),
    );
  });

  it('keeps the settings-only strict scope limited to Android settings', async () => {
    const strictLockUntil = Date.now() + 60 * 60 * 1000;

    useAppStore.setState(
      {
        ...buildBaseAppState(),
        activeMode: 'lock',
        activeModes: ['lock'],
        strictLockUntil,
        strictLockScope: 'settings',
      },
      true,
    );

    await act(async () => {
      renderHook(() => useNativeSync(true));
    });
    await flushHookEffects();

    await waitFor(() => expect(syncPoliciesMock).toHaveBeenCalledTimes(1));

    expect(syncPoliciesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        activeModes: ['lock'],
        fullLockBlocksAllApps: false,
        strictLockScope: 'settings',
        blockedPackages: ['com.android.settings'],
        targets: expect.arrayContaining([
          expect.objectContaining({
            id: 'com.android.settings',
            mode: 'lock',
          }),
        ]),
      }),
    );
    expect(syncPoliciesMock.mock.calls[0]?.[0].blockedPackages).not.toContain('com.google.android.packageinstaller');
  });
});
