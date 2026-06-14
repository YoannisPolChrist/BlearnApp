import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_APP_LANGUAGE } from '@/lib/languages';
import { APP_STORE_PERSIST_VERSION } from '@/store/appStore.shared';
import { useAppStore } from '@/store/useAppStore';

describe('useAppStore behavior', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useAppStore.setState(useAppStore.getInitialState(), true);
  });

  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
    useAppStore.setState(useAppStore.getInitialState(), true);
  });

  it('normalizes blocked apps and removes schedules when a target is toggled off', () => {
    const store = useAppStore.getState();

    store.toggleBlockedApp('  Com.Example.YouTube  ', 'strict');
    store.setBlockSchedule('Com.Example.YouTube', '08:00', '18:00');

    expect(useAppStore.getState().blockedApps).toEqual(['com.example.youtube']);
    expect(useAppStore.getState().blockedAppModes).toMatchObject({
      'com.example.youtube': 'strict',
    });
    expect(useAppStore.getState().blockSchedules).toEqual({
      'com.example.youtube': { from: '08:00', to: '18:00' },
    });
    expect(store.getTargetMode('COM.EXAMPLE.YOUTUBE', 'app')).toBe('strict');

    store.toggleBlockedApp('com.example.youtube', 'strict');

    expect(useAppStore.getState().blockedApps).toEqual([]);
    expect(useAppStore.getState().blockedAppModes).toEqual({});
    expect(useAppStore.getState().blockSchedules).toEqual({});
    expect(store.getTargetMode('com.example.youtube', 'app')).toBeNull();
  });

  it('normalizes a blocking snapshot and keeps language selection aligned with installed packs', () => {
    const store = useAppStore.getState();

    store.replaceBlockingState({
      blockedApps: ['  Com.Example.YouTube  ', 'com.spotify', 'com.spotify'],
      blockedAppModes: {
        'Com.Example.YouTube': 'strict',
        'com.spotify': 'learn',
      },
      blockedWebsites: [' Example.com ', 'example.com'],
      blockedWebsiteModes: {
        'Example.com': 'penalty',
      },
      blockedSearchTerms: [' Doomscrolling ', 'doomscrolling'],
      blockedSearchTermModes: {
        ' Doomscrolling ': 'penalty',
      },
      blockSchedules: {
        'Com.Example.YouTube': { from: '08:00', to: '18:00' },
        'unused.app': { from: '09:00', to: '10:00' },
      },
    });

    expect(useAppStore.getState().blockedApps).toEqual(['com.example.youtube', 'com.spotify']);
    expect(useAppStore.getState().blockedWebsites).toEqual(['example.com']);
    expect(useAppStore.getState().blockedSearchTerms).toEqual(['doomscrolling']);
    expect(useAppStore.getState().blockSchedules).toEqual({
      'com.example.youtube': { from: '08:00', to: '18:00' },
    });
    expect(store.getTargetMode('EXAMPLE.COM', 'website')).toBe('penalty');
    expect(store.getTargetMode('doomscrolling', 'search')).toBe('penalty');

    expect(useAppStore.getState().appLanguage).toBe(DEFAULT_APP_LANGUAGE);
    store.installAppLanguagePack('es');
    store.setAppLanguage('es');

    expect(useAppStore.getState().appLanguage).toBe('es');
    expect(useAppStore.getState().installedAppLanguagePacks).toContain('es');

    store.removeAppLanguagePack('es');

    expect(useAppStore.getState().appLanguage).toBe(DEFAULT_APP_LANGUAGE);
    expect(useAppStore.getState().installedAppLanguagePacks).not.toContain('es');
  });

  it('keeps unlock timers isolated per target', () => {
    const store = useAppStore.getState();
    const nowSpy = vi.spyOn(Date, 'now');

    nowSpy.mockReturnValue(1_000);
    store.unlockTarget('com.example.youtube', 'app', 12);

    nowSpy.mockReturnValue(8_000);
    store.unlockTarget('com.example.instagram', 'app', 4);

    expect(useAppStore.getState().unlockedTargets).toEqual({
      'app:com.example.youtube': 1_000 + 12 * 60 * 1000,
      'app:com.example.instagram': 8_000 + 4 * 60 * 1000,
    });

    nowSpy.mockReturnValue(200_000);
    expect(store.isTargetUnlocked('com.example.youtube', 'app')).toBe(true);
    expect(store.isTargetUnlocked('com.example.instagram', 'app')).toBe(true);

    nowSpy.mockReturnValue(8_000 + 4 * 60 * 1000 + 1);
    expect(store.isTargetUnlocked('com.example.instagram', 'app')).toBe(false);
    expect(store.isTargetUnlocked('com.example.youtube', 'app')).toBe(true);
  });

  it('zählt Freischaltungen für "Entsperrungen heute"', () => {
    useAppStore.setState({ unlockHistory: [] });
    const store = useAppStore.getState();
    const nowSpy = vi.spyOn(Date, 'now');
    const todayNoon = new Date();
    todayNoon.setHours(12, 0, 0, 0);

    // Zwei Freischaltungen heute, eine "gestern".
    nowSpy.mockReturnValue(todayNoon.getTime() - 26 * 60 * 60 * 1000);
    store.unlockTarget('com.example.youtube', 'app', 12);
    nowSpy.mockReturnValue(todayNoon.getTime());
    store.unlockTarget('com.example.youtube', 'app', 12);
    nowSpy.mockReturnValue(todayNoon.getTime() + 60_000);
    store.unlockTarget('com.example.instagram', 'app', 4);

    expect(useAppStore.getState().getUnlocksToday()).toBe(2);
    nowSpy.mockRestore();
  });

  it('records progress interactions with syncable ids and breathing metadata', () => {
    const store = useAppStore.getState();
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);

    store.incrementBreathingSessions(8);
    store.addInteraction({
      timestamp: Date.now(),
      type: 'learning',
      emotions: ['calm'],
      intention: 'Spanish deck',
      completed: true,
      targetApp: 'com.youtube',
    });

    const nextState = useAppStore.getState();

    expect(nextState.dailyStats.breathingSessions).toBe(1);
    expect(nextState.dailyStats.totalBreathingMinutes).toBe(8);
    expect(nextState.userProfile.recentInteractions[0]).toMatchObject({
      id: expect.any(String),
      type: 'learning',
      completed: true,
      emotions: ['calm'],
      intention: 'Spanish deck',
    });
    expect(nextState.userProfile.recentInteractions[1]).toMatchObject({
      id: expect.any(String),
      type: 'breathing',
      completed: true,
      durationMinutes: 8,
    });

    nowSpy.mockRestore();
  });

  it('updates streaks using the local day boundary instead of UTC midnight', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2023-11-14T23:30:00Z'));
    const timezoneSpy = vi.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValue(-60);

    useAppStore.setState({
      streak: 1,
      lastCheckinDate: '2023-11-14',
    });

    useAppStore.getState().updateStreak();

    expect(useAppStore.getState().streak).toBe(2);
    expect(useAppStore.getState().lastCheckinDate).toBe('2023-11-15');

    timezoneSpy.mockRestore();
    vi.useRealTimers();
  });

  it('clears legacy local blocking runtime state during persisted store migration', async () => {
    const migrate = useAppStore.persist.getOptions().migrate;

    expect(migrate).toBeTypeOf('function');

    const migrated = await migrate?.({
      savedModeSelection: 'strict',
      strictAddons: {
        strict: {
          enabled: true,
          startTime: '06:00',
          endTime: '22:00',
          lockUntil: 123_456,
          lockedAppIds: ['com.example.instagram'],
        },
        learn: {
          enabled: false,
          startTime: '08:00',
          endTime: '17:00',
          lockUntil: null,
          lockedAppIds: [],
        },
        penalty: {
          enabled: false,
          startTime: '08:00',
          endTime: '17:00',
          lockUntil: null,
          lockedAppIds: [],
        },
      },
      strictLockUntil: 999_999,
      strictLockScope: 'full',
      blockedApps: ['com.example.instagram'],
      blockedAppModes: { 'com.example.instagram': 'strict' },
      blockedWebsites: ['youtube.com'],
      blockedWebsiteModes: { 'youtube.com': 'learn' },
      blockedSearchTerms: ['doomscrolling'],
      blockedSearchTermModes: { doomscrolling: 'penalty' },
      unlockedTargets: { 'app:com.example.instagram': 55_000 },
      blockSchedules: {
        'com.example.instagram': { from: '08:00', to: '18:00' },
      },
      appIntroSeen: true,
      notificationPermissionPromptSeen: true,
    }, 0);

    expect(migrated).toMatchObject({
      savedModeSelection: null,
      strictLockUntil: null,
      strictLockScope: null,
      blockedApps: [],
      blockedAppModes: {},
      blockedWebsites: [],
      blockedWebsiteModes: {},
      blockedSearchTerms: [],
      blockedSearchTermModes: {},
      unlockedTargets: {},
      blockSchedules: {},
      appIntroSeen: true,
      notificationPermissionPromptSeen: true,
    });
    expect(migrated?.strictAddons).toMatchObject({
      strict: {
        enabled: false,
        lockUntil: null,
        lockedAppIds: [],
      },
      learn: {
        enabled: false,
        lockUntil: null,
        lockedAppIds: [],
      },
      penalty: {
        enabled: false,
        lockUntil: null,
        lockedAppIds: [],
      },
    });
  });

  it('preserves current persisted blocking state once the migration version is current', async () => {
    const migrate = useAppStore.persist.getOptions().migrate;

    const migrated = await migrate?.({
      savedModeSelection: 'learn',
      blockedApps: ['com.example.instagram'],
      blockedAppModes: { 'com.example.instagram': 'learn' },
      unlockedTargets: { 'app:com.example.instagram': 55_000 },
      blockSchedules: {
        'com.example.instagram': { from: '08:00', to: '18:00' },
      },
    }, APP_STORE_PERSIST_VERSION);

    expect(migrated).toMatchObject({
      savedModeSelection: 'learn',
      blockedApps: ['com.example.instagram'],
      blockedAppModes: { 'com.example.instagram': 'learn' },
      unlockedTargets: { 'app:com.example.instagram': 55_000 },
      blockSchedules: {
        'com.example.instagram': { from: '08:00', to: '18:00' },
      },
    });
  });
});
