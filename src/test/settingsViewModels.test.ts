import { afterEach, describe, expect, it, vi } from 'vitest';
import { getPermissionCheckpointState } from '@/lib/view-models/settings';

describe('settings permission checkpoint state', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('treats accessibility as granted during a recent reconnect grace window', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-17T12:00:00.000Z'));

    const state = getPermissionCheckpointState({
      key: 'accessibility',
      permissions: {
        usageStats: true,
        overlay: true,
        accessibility: true,
        vpnPermission: false,
        websiteBlockingAvailable: false,
        websiteBlockingActive: false,
      },
      monitoringStatus: {
        monitoringActive: true,
        vpnActive: false,
        overlayPermission: true,
        accessibilityPermission: true,
        accessibilityServiceReady: false,
        accessibilityServiceConnectedAt: Date.now() - 2_000,
        accessibilityServiceDisconnectedAt: Date.now() - 1_000,
        websiteBlockingAvailable: false,
        websiteBlockingEnabled: false,
        websiteBlockingPermission: false,
        handoffInProgress: false,
        overlayVisible: false,
      },
    });

    expect(state).toBe('granted');
  });

  it('asks for recovery when the last accessibility reconnect window has gone stale', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-17T12:00:00.000Z'));

    const state = getPermissionCheckpointState({
      key: 'accessibility',
      permissions: {
        usageStats: true,
        overlay: true,
        accessibility: true,
        vpnPermission: false,
        websiteBlockingAvailable: false,
        websiteBlockingActive: false,
      },
      monitoringStatus: {
        monitoringActive: true,
        vpnActive: false,
        overlayPermission: true,
        accessibilityPermission: true,
        accessibilityServiceReady: false,
        accessibilityServiceConnectedAt: Date.now() - 60_000,
        accessibilityServiceDisconnectedAt: Date.now() - 50_000,
        websiteBlockingAvailable: false,
        websiteBlockingEnabled: false,
        websiteBlockingPermission: false,
        handoffInProgress: false,
        overlayVisible: false,
      },
    });

    expect(state).toBe('needs-recovery');
  });
});
