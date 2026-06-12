import { afterEach, describe, expect, it, vi } from 'vitest';

const pluginMock = {
  hasUsagePermission: vi.fn().mockResolvedValue({ granted: true }),
  hasOverlayPermission: vi.fn().mockResolvedValue({ granted: false }),
  hasAccessibilityPermission: vi.fn().mockResolvedValue({ granted: true }),
  getWebsiteBlockingStatus: vi.fn().mockResolvedValue({
    permissionGranted: true,
    available: false,
    active: true,
  }),
  getTodayUsage: vi.fn().mockResolvedValue({
    totalScreenTimeMs: 7_500,
    entries: [
      {
        packageName: 'com.example.reader',
        appName: 'Reader',
        totalTimeMs: 5_000,
        lastUsedTimestamp: 1,
      },
      {
        processName: 'com.example.music',
        label: 'Music',
        totalTimeMs: 2_500,
        lastUsedTimestamp: 2,
      },
    ],
  }),
  getUsageForRange: vi.fn().mockResolvedValue({
    totalScreenTimeMs: 9_000,
    entries: [
      {
        appId: 'com.example.video',
        label: 'Video',
        totalTimeMs: 9_000,
        lastUsedTimestamp: 3,
      },
    ],
  }),
  getInstalledApps: vi.fn().mockResolvedValue({
    apps: [
      {
        packageName: 'com.example.reader',
        appName: 'Reader',
        icon: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB',
      },
      {
        processName: 'com.example.music',
        label: 'Music',
        icon: 'data:image/png;base64,already-normalized',
      },
    ],
  }),
  getCurrentApp: vi.fn().mockResolvedValue({
    packageName: 'com.example.reader',
  }),
  requestUsagePermission: vi.fn().mockResolvedValue(undefined),
  requestOverlayPermission: vi.fn().mockResolvedValue(undefined),
  requestAccessibilityPermission: vi.fn().mockResolvedValue(undefined),
  startMonitoringService: vi.fn().mockResolvedValue(undefined),
  stopMonitoringService: vi.fn().mockResolvedValue(undefined),
  updateBlockedPackages: vi.fn().mockResolvedValue(undefined),
  startVpnFilter: vi.fn().mockResolvedValue(undefined),
  stopVpnFilter: vi.fn().mockResolvedValue(undefined),
  updateBlockedDomains: vi.fn().mockResolvedValue(undefined),
  updateBlockedSearchTerms: vi.fn().mockResolvedValue(undefined),
  syncPolicies: vi.fn().mockResolvedValue(undefined),
  recheckCurrentForegroundTarget: vi.fn().mockResolvedValue({
    targetId: 'com.example.reader',
    targetType: 'app',
    shouldBlock: true,
  }),
  getMonitoringStatus: vi.fn().mockResolvedValue({
    monitoringActive: true,
    vpnActive: false,
    overlayPermission: true,
    accessibilityPermission: true,
    accessibilityServiceReady: true,
    accessibilityServiceConnectedAt: 5678,
    websiteBlockingAvailable: true,
    websiteBlockingEnabled: true,
    websiteBlockingPermission: true,
    handoffInProgress: false,
    overlayVisible: false,
    lastTriggerType: 'app',
    lastTriggerTarget: 'com.example.reader',
    currentAppId: ' com.example.reader ',
    foregroundSource: 'usage',
    foregroundObservedAt: 1234,
    pendingQueueLength: 2.7,
    activeBlockingSessionId: ' session-1 ',
    activeBlockingTargetId: ' com.example.reader ',
    activeBlockingStage: 'consumed',
    recentBlockingEvents: [
      {
        stage: 'queued',
        message: ' added ',
        sessionId: ' session-1 ',
        targetId: ' com.example.reader ',
        targetType: 'app',
        at: 99,
      },
    ],
    taskDiagnostics: {
      currentActivityClass: ' app.blearn.mobile.BlockingOverlayActivity ',
      currentTaskId: 12.7,
      mainTaskAvailable: true,
      blockingTaskActive: true,
      appTasks: [
        {
          baseActivity: ' app.blearn.mobile/.MainActivity ',
          topActivity: ' app.blearn.mobile/.MainActivity ',
          baseIntentComponent: ' app.blearn.mobile/.MainActivity ',
        },
        {
          baseActivity: ' app.blearn.mobile/.BlockingOverlayActivity ',
          topActivity: ' app.blearn.mobile/.BlockingOverlayActivity ',
        },
      ],
    },
  }),
  openGate: vi.fn().mockResolvedValue(undefined),
  consumePendingNavigation: vi.fn().mockResolvedValue(null),
  peekPendingNavigation: vi.fn().mockResolvedValue(null),
  completePendingNavigation: vi.fn().mockResolvedValue(undefined),
  abandonPendingNavigation: vi.fn().mockResolvedValue(undefined),
  dismissBlockingOverlay: vi.fn().mockResolvedValue(undefined),
  getManualOverrideStatus: vi.fn().mockResolvedValue({
    supported: true,
    active: false,
    attemptsUsed: 0,
    attemptsRemaining: 2,
    maxAttempts: 2,
  }),
  grantManualOverride: vi.fn().mockResolvedValue({
    supported: true,
    active: true,
    granted: true,
    attemptsUsed: 1,
    attemptsRemaining: 1,
    maxAttempts: 2,
    reason: 'granted',
  }),
  openTarget: vi.fn().mockResolvedValue(undefined),
  reportTriggerEvent: vi.fn().mockResolvedValue(undefined),
};

async function loadService() {
  vi.resetModules();
  vi.doMock('@/lib/platform', () => ({
    getPlatform: () => 'android',
    platform: 'android',
    isAndroidPlatform: true,
    isNativePlatform: true,
  }));
  vi.doMock('@/plugins/ScreenTimePlugin', () => ({
    __esModule: true,
    default: pluginMock,
  }));

  return import('@/services/screenTimeService');
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  vi.resetModules();
});

describe('screenTimeService behavior', () => {
  it('normalizes usage and installed app records before exposing them to the UI', async () => {
    const service = await loadService();

    const usage = await service.getTodayUsage();
    expect(usage.entries).toEqual([
      {
        packageName: 'com.example.reader',
        appName: 'Reader',
        appId: 'com.example.reader',
        label: 'Reader',
        totalTimeMs: 5_000,
        lastUsedTimestamp: 1,
      },
      {
        processName: 'com.example.music',
        label: 'Music',
        appId: 'com.example.music',
        packageName: 'com.example.music',
        appName: 'Music',
        totalTimeMs: 2_500,
        lastUsedTimestamp: 2,
      },
    ]);

    const installedApps = await service.getInstalledApps();
    expect(installedApps).toEqual([
      {
        packageName: 'com.example.reader',
        appName: 'Reader',
        appId: 'com.example.reader',
        label: 'Reader',
        icon: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB',
      },
      {
        processName: 'com.example.music',
        label: 'Music',
        appId: 'com.example.music',
        packageName: 'com.example.music',
        appName: 'Music',
        icon: 'data:image/png;base64,already-normalized',
      },
    ]);

    const rangedUsage = await service.getUsageForRange(0, 10_000);
    expect(rangedUsage.entries[0]).toMatchObject({
      appId: 'com.example.video',
      label: 'Video',
      packageName: 'com.example.video',
      appName: 'Video',
    });

    expect(service.getAppLabel({ label: 'Reader', packageName: 'com.example.reader' })).toBe('Reader');
    expect(service.getAppLabel({ packageName: 'com.mi.android.globallauncher' })).toBe('Launcher');
  });

  it('deduplicates installed-app fetches and reuses the cached result within the service ttl', async () => {
    pluginMock.getInstalledApps.mockResolvedValue({
      apps: [
        {
          packageName: 'com.example.reader',
          appName: 'Reader',
          icon: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB',
        },
      ],
    });
    const service = await loadService();

    const [first, second] = await Promise.all([
      service.getInstalledApps(),
      service.getInstalledApps(),
    ]);

    expect(pluginMock.getInstalledApps).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);

    const third = await service.getInstalledApps();
    expect(pluginMock.getInstalledApps).toHaveBeenCalledTimes(1);
    expect(third).toEqual(first);
  });

  it('normalizes manual override targets before delegating to the native plugin', async () => {
    const service = await loadService();
    pluginMock.getManualOverrideStatus.mockResolvedValueOnce({
      supported: true,
      active: false,
      attemptsUsed: 0,
      attemptsRemaining: 2,
      maxAttempts: 2,
    });
    pluginMock.grantManualOverride.mockResolvedValueOnce({
      supported: true,
      active: true,
      granted: true,
      attemptsUsed: 1,
      attemptsRemaining: 1,
      maxAttempts: 2,
      reason: 'granted',
    });

    const status = await service.getManualOverrideStatus('  Com.Example.Reader  ', 'app');
    expect(pluginMock.getManualOverrideStatus).toHaveBeenCalledWith({
      targetId: 'Com.Example.Reader',
      targetType: 'app',
    });
    expect(status).toMatchObject({
      supported: true,
      active: false,
      attemptsRemaining: 2,
    });

    const grant = await service.grantManualOverride('  youtube.com  ', 'website', 12);
    expect(pluginMock.grantManualOverride).toHaveBeenCalledWith({
      targetId: 'youtube.com',
      targetType: 'website',
      unlockDurationMinutes: 12,
    });
    expect(grant).toMatchObject({
      granted: true,
      active: true,
      attemptsRemaining: 1,
    });
  });

  it('normalizes monitoring status fields from the native runtime', async () => {
    pluginMock.getMonitoringStatus.mockResolvedValueOnce({
      monitoringActive: true,
      vpnActive: false,
      overlayPermission: true,
      accessibilityPermission: true,
      accessibilityServiceReady: true,
      accessibilityServiceConnectedAt: 5678,
      websiteBlockingAvailable: true,
      websiteBlockingEnabled: true,
      websiteBlockingPermission: true,
      handoffInProgress: false,
      overlayVisible: false,
      lastTriggerType: 'app',
      lastTriggerTarget: 'com.example.reader',
      currentAppId: ' com.example.reader ',
      foregroundSource: 'usage',
      foregroundObservedAt: 1234,
      pendingQueueLength: 2.7,
      activeBlockingSessionId: ' session-1 ',
      activeBlockingTargetId: ' com.example.reader ',
      activeBlockingStage: 'consumed',
      recentBlockingEvents: [
        {
          stage: 'queued',
          message: ' added ',
          sessionId: ' session-1 ',
          targetId: ' com.example.reader ',
          targetType: 'app',
          at: 99,
        },
      ],
      taskDiagnostics: {
        currentActivityClass: ' app.blearn.mobile.BlockingOverlayActivity ',
        currentTaskId: 12.7,
        mainTaskAvailable: true,
        blockingTaskActive: true,
        appTasks: [
          {
            baseActivity: ' app.blearn.mobile/.MainActivity ',
            topActivity: ' app.blearn.mobile/.MainActivity ',
            baseIntentComponent: ' app.blearn.mobile/.MainActivity ',
          },
          {
            baseActivity: ' app.blearn.mobile/.BlockingOverlayActivity ',
            topActivity: ' app.blearn.mobile/.BlockingOverlayActivity ',
          },
        ],
      },
    });
    const service = await loadService();

    const status = await service.getMonitoringStatus();

    expect(status).toMatchObject({
      monitoringActive: true,
      accessibilityServiceReady: true,
      accessibilityServiceConnectedAt: 5678,
      currentAppId: 'com.example.reader',
      foregroundSource: 'usage',
      foregroundObservedAt: 1234,
      pendingQueueLength: 2,
      activeBlockingSessionId: 'session-1',
      activeBlockingTargetId: 'com.example.reader',
      activeBlockingStage: 'consumed',
      taskDiagnostics: {
        currentActivityClass: 'app.blearn.mobile.BlockingOverlayActivity',
        currentTaskId: 12,
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
            baseIntentComponent: '',
          },
        ],
      },
    });
    expect(status.recentBlockingEvents).toEqual([
      {
        stage: 'queued',
        message: 'added',
        sessionId: 'session-1',
        targetId: 'com.example.reader',
        targetType: 'app',
        at: 99,
      },
    ]);
  });

  it('preserves the abandoned lifecycle stage and drops unknown stage values', async () => {
    pluginMock.getMonitoringStatus
      .mockResolvedValueOnce({
        accessibilityServiceReady: false,
        activeBlockingStage: ' abandoned ',
      })
      .mockResolvedValueOnce({
        accessibilityServiceReady: false,
        activeBlockingStage: 'unexpected_native_stage',
      });
    const service = await loadService();

    const abandonedStatus = await service.getMonitoringStatus();
    const unknownStatus = await service.getMonitoringStatus();

    expect(abandonedStatus.activeBlockingStage).toBe('abandoned');
    expect(unknownStatus.activeBlockingStage).toBeNull();
  });

  it('returns a structured invalid-target result instead of calling native override APIs', async () => {
    const service = await loadService();

    expect(await service.getManualOverrideStatus('   ', 'app')).toMatchObject({
      supported: true,
      active: false,
      reason: 'invalid_target',
    });
    expect(await service.grantManualOverride('   ', 'search')).toMatchObject({
      supported: true,
      active: false,
      granted: false,
      reason: 'invalid_target',
    });

    expect(pluginMock.getManualOverrideStatus).not.toHaveBeenCalledWith({
      targetId: '',
      targetType: 'app',
    });
    expect(pluginMock.grantManualOverride).not.toHaveBeenCalledWith({
      targetId: '',
      targetType: 'search',
      unlockDurationMinutes: undefined,
    });
  });

  it('forwards explicit pending-navigation abandons to the native plugin', async () => {
    const service = await loadService();

    await service.abandonPendingNavigation(' session-abandon ');

    expect(pluginMock.abandonPendingNavigation).toHaveBeenCalledWith({
      sessionId: 'session-abandon',
    });
  });
});
