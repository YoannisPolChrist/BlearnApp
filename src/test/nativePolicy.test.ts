import { describe, expect, it } from 'vitest';
import { buildDevicePolicySnapshot } from '@/lib/nativePolicy';
import { createDefaultStrictAddonMap } from '@/lib/targetModes';
import { resolveUnlockedTargets } from '@/lib/unlockedTargets';
import * as screenTimeService from '@/services/screenTimeService';

describe('native policy helpers', () => {
  it('omits inactive penalty targets from the stable device policy snapshot shape', () => {
    const snapshot = buildDevicePolicySnapshot({
      activeModes: ['lock', 'learn'],
      gateRule: {
        requiredCorrectReviews: 5,
        unlockDurationMinutes: 15,
        typedAnswerMaxWords: 3,
        typedAnswerEnabled: true,
      },
      blockedApps: ['com.instagram.android'],
      blockedAppModes: { 'com.instagram.android': 'strict' },
      blockedWebsites: ['youtube.com'],
      blockedWebsiteModes: { 'youtube.com': 'learn' },
      blockedSearchTerms: ['doomscrolling'],
      blockedSearchTermModes: { doomscrolling: 'penalty' },
      assignments: [
        {
          targetId: 'youtube.com',
          targetType: 'website',
          deckId: 'deck_focus',
          requiredCorrectReviews: 7,
          unlockDurationMinutes: 20,
          enabled: true,
        },
      ],
      unlockedTargets: { 'app:com.instagram.android': Date.now() + 60_000 },
      penaltyRuntimeActive: false,
      penaltyAmountSats: 200,
      accountabilityPartnerName: 'Alex',
    });

    expect(snapshot).toEqual({
      activeModes: ['learn'],
      gateRule: {
        requiredCorrectReviews: 5,
        unlockDurationMinutes: 15,
        typedAnswerMaxWords: 3,
        typedAnswerEnabled: true,
      },
      blockedPackages: ['com.instagram.android'],
      blockedDomains: ['youtube.com'],
      blockedSearchTerms: [],
      strictLockScope: null,
      fullLockBlocksAllApps: false,
      unlockedTargets: { 'app:com.instagram.android': expect.any(Number) },
      penaltyAmountSats: 200,
      accountabilityPartnerName: 'Alex',
      targets: [
        {
          id: 'com.instagram.android',
          type: 'app',
          mode: 'strict',
          deckId: undefined,
          requiredCorrectReviews: 5,
          unlockDurationMinutes: 15,
          enabled: true,
        },
        {
          id: 'youtube.com',
          type: 'website',
          mode: 'learn',
          deckId: 'deck_focus',
          requiredCorrectReviews: 7,
          unlockDurationMinutes: 20,
          enabled: true,
        },
      ],
    });
  });

  it('keeps active penalty targets in the native snapshot', () => {
    const snapshot = buildDevicePolicySnapshot({
      activeModes: ['penalty'],
      gateRule: {
        requiredCorrectReviews: 4,
        unlockDurationMinutes: 10,
        typedAnswerMaxWords: 3,
        typedAnswerEnabled: true,
      },
      blockedApps: [],
      blockedAppModes: {},
      blockedWebsites: [],
      blockedWebsiteModes: {},
      blockedSearchTerms: ['doomscrolling'],
      blockedSearchTermModes: { doomscrolling: 'penalty' },
      assignments: [],
      unlockedTargets: {},
      penaltyRuntimeActive: true,
      penaltyAmountSats: 200,
      accountabilityPartnerName: 'Alex',
    });

    expect(snapshot.blockedSearchTerms).toEqual(['doomscrolling']);
    expect(snapshot.targets).toEqual([
      expect.objectContaining({
        id: 'doomscrolling',
        type: 'search',
        mode: 'penalty',
      }),
    ]);
  });

  it('normalizes unlockedTargets and falls back to legacy unlockedApps', () => {
    expect(resolveUnlockedTargets({ youtube: 123 }, { instagram: 456 })).toEqual({ 'app:youtube': 123 });
    expect(resolveUnlockedTargets({ 'website:YouTube.com': 222, ' app:YouTube ': 333 }, undefined)).toEqual({
      'website:youtube.com': 222,
      'app:youtube': 333,
    });
    expect(resolveUnlockedTargets(undefined, { instagram: 456 })).toEqual({ 'app:instagram': 456 });
    expect(resolveUnlockedTargets(undefined, undefined)).toEqual({});
  });

  it('no longer exports native consumeUnlockGrant bridge helpers', () => {
    expect('consumeUnlockGrant' in screenTimeService).toBe(false);
  });

  it('filters dangerous non-user app packages out of the native snapshot', () => {
    const snapshot = buildDevicePolicySnapshot({
      activeModes: ['learn'],
      gateRule: {
        requiredCorrectReviews: 3,
        unlockDurationMinutes: 15,
        typedAnswerMaxWords: 3,
        typedAnswerEnabled: false,
      },
      blockedApps: [
        'app.blearn.mobile',
        'app.blearn.mobile.debug',
        'blearn',
        'android',
        'com.google.android.youtube',
        'com.android.vpndialogs',
      ],
      blockedAppModes: {
        'app.blearn.mobile': 'learn',
        'app.blearn.mobile.debug': 'learn',
        blearn: 'learn',
        android: 'learn',
        'com.google.android.youtube': 'learn',
        'com.android.vpndialogs': 'learn',
      },
      blockedWebsites: [],
      blockedWebsiteModes: {},
      blockedSearchTerms: [],
      blockedSearchTermModes: {},
      assignments: [],
      unlockedTargets: {},
      penaltyAmountSats: null,
    });

    expect(snapshot.blockedPackages).toEqual(['com.google.android.youtube']);
    expect(snapshot.targets).toEqual([
      expect.objectContaining({
        id: 'com.google.android.youtube',
        type: 'app',
        mode: 'learn',
      }),
    ]);
  });

  it('keeps unlocked app timers isolated when syncing the native snapshot', () => {
    const now = Date.now();
    const snapshot = buildDevicePolicySnapshot({
      activeModes: ['learn'],
      gateRule: {
        requiredCorrectReviews: 3,
        unlockDurationMinutes: 15,
        typedAnswerMaxWords: 3,
        typedAnswerEnabled: false,
      },
      blockedApps: ['com.android.chrome', 'com.instagram.android'],
      blockedAppModes: {
        'com.android.chrome': 'learn',
        'com.instagram.android': 'learn',
      },
      blockedWebsites: [],
      blockedWebsiteModes: {},
      blockedSearchTerms: [],
      blockedSearchTermModes: {},
      assignments: [],
      unlockedTargets: {
        'app:com.android.chrome': now + 12 * 60_000,
        'app:com.instagram.android': now + 4 * 60_000,
      },
      penaltyAmountSats: null,
    });

    expect(snapshot.unlockedTargets).toEqual({
      'app:com.android.chrome': now + 12 * 60_000,
      'app:com.instagram.android': now + 4 * 60_000,
    });
  });

  it('adds strict lock system protection targets during full lock windows', () => {
    const strictLockUntil = Date.now() + 60_000;
    const snapshot = buildDevicePolicySnapshot({
      activeModes: ['lock'],
      gateRule: {
        requiredCorrectReviews: 3,
        unlockDurationMinutes: 15,
        typedAnswerMaxWords: 3,
        typedAnswerEnabled: false,
      },
      blockedApps: ['com.instagram.android'],
      blockedAppModes: { 'com.instagram.android': 'strict' },
      blockedWebsites: [],
      blockedWebsiteModes: {},
      blockedSearchTerms: [],
      blockedSearchTermModes: {},
      assignments: [],
      unlockedTargets: {},
      strictLockUntil,
      strictLockScope: 'full',
      penaltyAmountSats: null,
    });

    expect(snapshot.blockedPackages).toEqual(
      expect.arrayContaining([
        'com.instagram.android',
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
    );
    expect(snapshot.fullLockBlocksAllApps).toBe(true);
    expect(snapshot.strictLockScope).toBe('full');
    expect(snapshot.targets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'com.android.settings',
          type: 'app',
          mode: 'lock',
        }),
        expect.objectContaining({
          id: 'com.google.android.packageinstaller',
          type: 'app',
          mode: 'lock',
        }),
      ]),
    );
    expect(snapshot.strictLockUntil).toBe(strictLockUntil);
  });

  it('does not export stale strict lock expiry metadata when no lock is active', () => {
    const snapshot = buildDevicePolicySnapshot({
      activeModes: ['learn'],
      gateRule: {
        requiredCorrectReviews: 3,
        unlockDurationMinutes: 15,
        typedAnswerMaxWords: 3,
        typedAnswerEnabled: false,
      },
      blockedApps: ['com.instagram.android'],
      blockedAppModes: { 'com.instagram.android': 'learn' },
      blockedWebsites: [],
      blockedWebsiteModes: {},
      blockedSearchTerms: [],
      blockedSearchTermModes: {},
      assignments: [],
      unlockedTargets: {},
      strictLockUntil: Date.now() + 60_000,
      penaltyAmountSats: null,
    });

    expect(snapshot.strictLockUntil).toBeUndefined();
  });

  it('adds strict add-on system protection packages while add-ons are active', () => {
    const strictAddons = createDefaultStrictAddonMap();
    const strictAddonUntil = Date.now() + 60_000;
    strictAddons.learn = {
      ...strictAddons.learn,
      enabled: true,
      lockUntil: strictAddonUntil,
      lockedAppIds: ['com.google.android.youtube'],
    };

    const snapshot = buildDevicePolicySnapshot({
      activeModes: ['learn', 'strict'],
      gateRule: {
        requiredCorrectReviews: 3,
        unlockDurationMinutes: 15,
        typedAnswerMaxWords: 3,
        typedAnswerEnabled: false,
      },
      blockedApps: ['com.google.android.youtube'],
      blockedAppModes: { 'com.google.android.youtube': 'learn' },
      blockedWebsites: [],
      blockedWebsiteModes: {},
      blockedSearchTerms: [],
      blockedSearchTermModes: {},
      assignments: [],
      unlockedTargets: {},
      strictAddons,
      penaltyAmountSats: null,
    });

    expect(snapshot.blockedPackages).toEqual(
      expect.arrayContaining([
        'com.google.android.youtube',
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
    );
    expect(snapshot.strictAddonProtectionUntil).toBe(strictAddonUntil);
    expect(snapshot.targets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'com.android.settings',
          type: 'app',
          mode: 'strict',
        }),
        expect.objectContaining({
          id: 'com.google.android.packageinstaller',
          type: 'app',
          mode: 'strict',
        }),
      ]),
    );
  });

  it('limits the settings-only strict lock scope to Android settings', () => {
    const strictLockUntil = Date.now() + 60_000;
    const snapshot = buildDevicePolicySnapshot({
      activeModes: ['lock', 'learn'],
      gateRule: {
        requiredCorrectReviews: 3,
        unlockDurationMinutes: 15,
        typedAnswerMaxWords: 3,
        typedAnswerEnabled: false,
      },
      blockedApps: ['com.instagram.android'],
      blockedAppModes: { 'com.instagram.android': 'learn' },
      blockedWebsites: [],
      blockedWebsiteModes: {},
      blockedSearchTerms: [],
      blockedSearchTermModes: {},
      assignments: [],
      unlockedTargets: {},
      strictLockUntil,
      strictLockScope: 'settings',
      penaltyAmountSats: null,
    });

    expect(snapshot.blockedPackages).toEqual([
      'com.instagram.android',
      'com.android.settings',
    ]);
    expect(snapshot.fullLockBlocksAllApps).toBe(false);
    expect(snapshot.strictLockScope).toBe('settings');
    expect(snapshot.targets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'com.android.settings',
          type: 'app',
          mode: 'lock',
        }),
      ]),
    );
    expect(snapshot.targets).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'com.google.android.packageinstaller',
        }),
      ]),
    );
  });
});
