import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from '@/store/useAppStore';
import { mergePersistedAppState } from '@/store/appStore.shared';
import type { TargetModeId } from '@/lib/targetModes';

const validPenaltyConnection = {
  walletLabel: 'Blearn Strafkonto',
  nwcConnectionUri: 'nostr+walletconnect://wallet.example?relay=wss://relay.example&secret=test-secret',
  budgetSats: 5000,
  budgetRenewal: 'daily' as const,
};

const verifiedPartner = {
  name: 'Alex',
  lightningAddress: 'alex@getalby.com',
  normalizedLightningAddress: 'alex@getalby.com',
  validationStatus: 'verified' as const,
  notifyOnPenalty: true,
};

describe('useAppStore', () => {
  beforeEach(() => {
    useAppStore.setState(useAppStore.getInitialState(), true);
  });

  it('normalizes blocking state payloads and keeps derived modes in sync', () => {
    useAppStore.getState().replaceBlockingState({
      blockedApps: [' App One ', 'app one', ''],
      blockedAppModes: {
        ' App One ': 'learn',
        '  APP ONE  ': 'learn',
      } as Record<string, TargetModeId>,
      blockedWebsites: [' Example.com ', 'example.com'],
      blockedWebsiteModes: {
        ' Example.com ': 'penalty',
      },
      blockedSearchTerms: [' Search Term ', 'search term'],
      blockedSearchTermModes: {
        ' Search Term ': 'strict',
      },
      blockSchedules: {
        ' App One ': { from: ' 08:00 ', to: ' 17:00 ' },
        ' Other App ': { from: '09:00', to: '10:00' },
      },
    });

    const state = useAppStore.getState();

    expect(state.blockedApps).toEqual(['app one']);
    expect(state.blockedWebsites).toEqual(['example.com']);
    expect(state.blockedSearchTerms).toEqual(['search term']);
    expect(state.blockedAppModes).toEqual({ 'app one': 'learn' });
    expect(state.blockSchedules).toEqual({ 'app one': { from: '08:00', to: '17:00' } });
    expect(state.activeMode).toBe('learn');
    expect(state.activeModes).toEqual(['learn', 'strict']);
  });

  it('only derives penalty as an active runtime mode when the penalty setup is active and ready', () => {
    useAppStore.getState().replaceBlockingState({
      blockedApps: [],
      blockedAppModes: {},
      blockedWebsites: [' Example.com '],
      blockedWebsiteModes: {
        ' Example.com ': 'penalty',
      },
      blockedSearchTerms: [],
      blockedSearchTermModes: {},
      blockSchedules: {},
    });

    expect(useAppStore.getState().activeModes).toEqual([]);
    expect(useAppStore.getState().activeMode).toBe('normal');

    useAppStore.setState({
      penaltyAmountSats: 500,
      albyConnection: validPenaltyConnection,
      accountabilityPartner: verifiedPartner,
      albyConnectionTest: {
        status: 'passed',
        testedAt: Date.now(),
      },
    });

    useAppStore.getState().setPenaltyEnabled(true);

    expect(useAppStore.getState().penaltyEnabled).toBe(true);
    expect(useAppStore.getState().activeMode).toBe('penalty');
    expect(useAppStore.getState().activeModes).toEqual(['penalty']);
  });

  it('ignores empty block schedule and unlock inputs', () => {
    useAppStore.getState().setBlockSchedule('   ', '08:00', '17:00');
    useAppStore.getState().unlockTarget('   ', 'app', 30);

    expect(useAppStore.getState().blockSchedules).toEqual({});
    expect(useAppStore.getState().unlockedTargets).toEqual({});
  });

  it('assigns app targets as all-day by default', () => {
    useAppStore.getState().toggleBlockedApp(' App One ', 'learn');

    expect(useAppStore.getState().blockedAppModes).toEqual({ 'app one': 'learn' });
    expect(useAppStore.getState().blockSchedules).toEqual({
      'app one': { from: '00:00', to: '23:59' },
    });
  });

  it('does not let an active strict add-on be weakened through direct state persistence', () => {
    useAppStore.getState().toggleBlockedApp(' App One ', 'learn');
    useAppStore.getState().setStrictAddonState('learn', {
      enabled: true,
      startTime: '08:00',
      endTime: '17:00',
      lockUntil: Date.now() + 60_000,
      lockedAppIds: ['app one'],
    });

    useAppStore.getState().setStrictAddonState('learn', {
      enabled: false,
      startTime: '10:00',
      endTime: '12:00',
      lockUntil: null,
      lockedAppIds: [],
    });

    expect(useAppStore.getState().strictAddons.learn).toEqual({
      enabled: true,
      startTime: '08:00',
      endTime: '17:00',
      lockUntil: expect.any(Number),
      lockedAppIds: ['app one'],
    });
  });

  it('freezes app assignments for the mode while its strict add-on is active', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2023, 1, 1, 12, 0, 0)); // 12:00 PM, which is within default 08:00 - 17:00

    useAppStore.getState().toggleBlockedApp(' App One ', 'learn');
    useAppStore.getState().activateStrictAddon('learn', ['app one']);

    useAppStore.getState().toggleBlockedApp(' App One ', 'learn');
    useAppStore.getState().toggleBlockedApp(' App One ', 'strict');
    useAppStore.getState().toggleBlockedApp(' App Two ', 'learn');
    useAppStore.getState().setBlockedAppsMode(['App Three'], 'learn');

    expect(useAppStore.getState().blockedApps).toEqual(['app one']);
    expect(useAppStore.getState().blockedAppModes).toEqual({ 'app one': 'learn' });

    vi.useRealTimers();
  });

  it('clears orphaned legacy blocking lists instead of reviving them as active app blocks', () => {
    const merged = mergePersistedAppState({
      activeMode: 'strict',
      blockedApps: ['com.google.android.youtube'],
      blockedWebsites: ['youtube.com'],
      blockedSearchTerms: ['doomscrolling'],
      blockSchedules: {
        'com.google.android.youtube': { from: '00:00', to: '23:59' },
      },
      blockedAppModes: {},
      blockedWebsiteModes: {},
      blockedSearchTermModes: {},
    }, useAppStore.getInitialState());

    expect(merged.blockedApps).toEqual([]);
    expect(merged.blockedWebsites).toEqual([]);
    expect(merged.blockedSearchTerms).toEqual([]);
    expect(merged.blockSchedules).toEqual({});
    expect(merged.blockedAppModes).toEqual({});
    expect(merged.blockedWebsiteModes).toEqual({});
    expect(merged.blockedSearchTermModes).toEqual({});
    expect(merged.savedModeSelection).toBeNull();
    expect(merged.activeModes).toEqual([]);
    expect(merged.activeMode).toBe('normal');
  });

  it('keeps explicit modern blocking assignments during persistence merge', () => {
    const merged = mergePersistedAppState({
      savedModeSelection: 'strict',
      blockedApps: ['com.google.android.youtube'],
      blockedAppModes: {
        'com.google.android.youtube': 'strict',
      },
      blockSchedules: {
        'com.google.android.youtube': { from: '00:00', to: '23:59' },
      },
    }, useAppStore.getInitialState());

    expect(merged.blockedApps).toEqual(['com.google.android.youtube']);
    expect(merged.blockedAppModes).toEqual({ 'com.google.android.youtube': 'strict' });
    expect(merged.blockSchedules).toEqual({
      'com.google.android.youtube': { from: '00:00', to: '23:59' },
    });
    expect(merged.savedModeSelection).toBe('strict');
    expect(merged.activeModes).toEqual(['strict']);
    expect(merged.activeMode).toBe('strict');
  });
});
