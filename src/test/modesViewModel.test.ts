import { describe, expect, it } from 'vitest';
import { buildModeAppLists, buildVisibleApps } from '@/lib/view-models/modes';

describe('mode app lists', () => {
  it('separates available apps from selected-mode and other-mode assignments', () => {
    const result = buildModeAppLists({
      filteredVisibleApps: [
        {
          packageName: 'com.instagram.android',
          appName: 'Instagram',
          totalTimeMs: 100,
          lastUsedTimestamp: 1,
        },
        {
          packageName: 'com.youtube.android',
          appName: 'YouTube',
          totalTimeMs: 200,
          lastUsedTimestamp: 2,
        },
        {
          packageName: 'com.reddit.frontpage',
          appName: 'Reddit',
          totalTimeMs: 300,
          lastUsedTimestamp: 3,
        },
      ],
      blockedAppModes: {
        'com.youtube.android': 'learn',
        'com.reddit.frontpage': 'penalty',
      },
      editableMode: 'learn',
      shouldShowFullAppList: true,
    });

    expect(result.availableApps.map((app) => app.packageName)).toEqual(['com.instagram.android']);
    expect(result.assignedToSelectedMode.map((app) => app.packageName)).toEqual(['com.youtube.android']);
    expect(result.assignedToOtherModes.map((app) => ({ id: app.packageName, mode: app.mode }))).toEqual([
      { id: 'com.reddit.frontpage', mode: 'penalty' },
    ]);
  });

  it('keeps blocked apps above free apps and sorts each section by usage time', () => {
    const visibleApps = buildVisibleApps({
      installedApps: [
        { appId: 'com.youtube.android', label: 'YouTube' },
        { appId: 'com.instagram.android', label: 'Instagram' },
        { appId: 'com.reddit.frontpage', label: 'Reddit' },
      ],
      usage: {
        totalScreenTimeMs: 1_500,
        unlockCount: 0,
        entries: [
          { appId: 'com.reddit.frontpage', label: 'Reddit', totalTimeMs: 200, lastUsedTimestamp: 3 },
          { appId: 'com.instagram.android', label: 'Instagram', totalTimeMs: 900, lastUsedTimestamp: 2 },
          { appId: 'com.youtube.android', label: 'YouTube', totalTimeMs: 400, lastUsedTimestamp: 1 },
        ],
      },
      blockedApps: ['com.youtube.android', 'com.instagram.android'],
      query: '',
      showAllApps: true,
    }).filteredVisibleApps;

    const result = buildModeAppLists({
      filteredVisibleApps: visibleApps,
      blockedAppModes: {
        'com.youtube.android': 'learn',
        'com.instagram.android': 'penalty',
      },
      editableMode: 'learn',
      shouldShowFullAppList: true,
    });

    expect(result.assignedToSelectedMode.map((app) => app.packageName)).toEqual(['com.youtube.android']);
    expect(result.assignedToOtherModes.map((app) => app.packageName)).toEqual(['com.instagram.android']);
    expect(result.availableApps.map((app) => app.packageName)).toEqual(['com.reddit.frontpage']);
    expect(visibleApps.map((app) => app.packageName)).toEqual([
      'com.instagram.android',
      'com.youtube.android',
      'com.reddit.frontpage',
    ]);
  });

  it('filters system apps from the visible list', () => {
    const visibleApps = buildVisibleApps({
      installedApps: [
        { appId: 'com.android.systemui', label: 'System UI' },
        { appId: 'com.android.launcher', label: 'Launcher' },
        { appId: 'com.instagram.android', label: 'Instagram' },
      ],
      usage: {
        totalScreenTimeMs: 1000,
        unlockCount: 0,
        entries: [
          { appId: 'com.android.systemui', label: 'System UI', totalTimeMs: 900, lastUsedTimestamp: 3 },
          { appId: 'com.instagram.android', label: 'Instagram', totalTimeMs: 100, lastUsedTimestamp: 2 },
        ],
      },
      blockedApps: [],
      query: '',
      showAllApps: true,
    }).filteredVisibleApps;

    expect(visibleApps.map((app) => app.packageName)).toEqual(['com.instagram.android']);
  });

  it('does not surface self or Android ghost packages from usage-only entries', () => {
    const visibleApps = buildVisibleApps({
      installedApps: [
        { appId: 'com.google.android.youtube', label: 'YouTube' },
      ],
      usage: {
        totalScreenTimeMs: 1000,
        unlockCount: 0,
        entries: [
          { appId: 'app.blearn.mobile', label: 'Blearn', totalTimeMs: 300, lastUsedTimestamp: 3 },
          { appId: 'android', label: 'Android', totalTimeMs: 200, lastUsedTimestamp: 2 },
          { appId: 'com.android.vpndialogs', label: 'VPN', totalTimeMs: 100, lastUsedTimestamp: 1 },
          { appId: 'com.google.android.youtube', label: 'YouTube', totalTimeMs: 400, lastUsedTimestamp: 4 },
        ],
      },
      blockedApps: [],
      query: '',
      showAllApps: true,
    }).filteredVisibleApps;

    expect(visibleApps.map((app) => app.packageName)).toEqual(['com.google.android.youtube']);
  });

  it('does not surface Blearn self-app variants from installed or label-only entries', () => {
    const visibleApps = buildVisibleApps({
      installedApps: [
        { appId: 'app.blearn.mobile.debug', label: 'Blearn Debug' },
        { label: 'Blearn' },
        { appId: 'com.google.android.youtube', label: 'YouTube' },
      ],
      usage: {
        totalScreenTimeMs: 1000,
        unlockCount: 0,
        entries: [
          { appId: 'app.blearn.mobile.debug', label: 'Blearn Debug', totalTimeMs: 300, lastUsedTimestamp: 3 },
          { label: 'Blearn', totalTimeMs: 200, lastUsedTimestamp: 2 },
          { appId: 'com.google.android.youtube', label: 'YouTube', totalTimeMs: 500, lastUsedTimestamp: 4 },
        ],
      },
      blockedApps: [],
      query: '',
      showAllApps: true,
    }).filteredVisibleApps;

    expect(visibleApps.map((app) => app.packageName)).toEqual(['com.google.android.youtube']);
  });
});
