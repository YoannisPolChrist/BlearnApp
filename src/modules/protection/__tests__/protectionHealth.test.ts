import { describe, expect, it } from 'vitest';
import { EMPTY_MONITORING_STATUS } from '@/services/screenTimeNormalization';
import type { MonitoringStatus } from '@/plugins/ScreenTimePlugin';
import { buildProtectionHealth } from '../protectionHealth';

const HEALTHY_APP_BLOCKING: MonitoringStatus = {
  ...EMPTY_MONITORING_STATUS,
  monitoringActive: true,
  accessibilityPermission: true,
  accessibilityServiceReady: true,
  overlayPermission: true,
  usageStatsPermission: true,
  batteryOptimizationExempt: true,
  notificationsEnabled: true,
};

describe('buildProtectionHealth', () => {
  it('ist inactive ohne konfiguriertes Blocking', () => {
    const health = buildProtectionHealth(EMPTY_MONITORING_STATUS, {
      appBlockingConfigured: false,
      websiteBlockingConfigured: false,
      strictLockActive: false,
    });
    expect(health.overall).toBe('inactive');
    expect(health.items).toHaveLength(0);
  });

  it('ist grün, wenn alle für App-Blocking nötigen Pfade laufen', () => {
    const health = buildProtectionHealth(HEALTHY_APP_BLOCKING, {
      appBlockingConfigured: true,
      websiteBlockingConfigured: false,
      strictLockActive: false,
    });
    expect(health.overall).toBe('ok');
  });

  it('verlangt kein VPN-Grün, wenn nur App-Blocking konfiguriert ist', () => {
    const health = buildProtectionHealth(
      { ...HEALTHY_APP_BLOCKING, vpnActive: false, websiteBlockingPermission: false },
      { appBlockingConfigured: true, websiteBlockingConfigured: false, strictLockActive: false },
    );
    expect(health.overall).toBe('ok');
    expect(health.items.find((item) => item.key === 'vpn')).toBeUndefined();
  });

  it('meldet error, wenn die Bedienungshilfe tot ist', () => {
    const health = buildProtectionHealth(
      { ...HEALTHY_APP_BLOCKING, accessibilityServiceReady: false, accessibilityPermission: false },
      { appBlockingConfigured: true, websiteBlockingConfigured: false, strictLockActive: false },
    );
    expect(health.overall).toBe('error');
    expect(health.items.find((item) => item.key === 'accessibility')?.state).toBe('error');
  });

  it('stuft fehlende Akku-Ausnahme nur als warn ein', () => {
    const health = buildProtectionHealth(
      { ...HEALTHY_APP_BLOCKING, batteryOptimizationExempt: false },
      { appBlockingConfigured: true, websiteBlockingConfigured: false, strictLockActive: false },
    );
    expect(health.overall).toBe('warn');
  });

  it('meldet inaktives VPN als error, wenn Website-Blocking konfiguriert ist', () => {
    const health = buildProtectionHealth(
      { ...HEALTHY_APP_BLOCKING, vpnActive: false, websiteBlockingPermission: true },
      { appBlockingConfigured: false, websiteBlockingConfigured: true, strictLockActive: false },
    );
    expect(health.overall).toBe('error');
    expect(health.items.find((item) => item.key === 'vpn')?.state).toBe('error');
  });

  it('zeigt Private-DNS (hostname) als Einschränkung', () => {
    const health = buildProtectionHealth(
      {
        ...HEALTHY_APP_BLOCKING,
        vpnActive: true,
        websiteBlockingPermission: true,
        privateDnsMode: 'hostname',
      },
      { appBlockingConfigured: false, websiteBlockingConfigured: true, strictLockActive: false },
    );
    expect(health.overall).toBe('warn');
    expect(health.items.find((item) => item.key === 'privateDns')?.state).toBe('warn');
  });

  it('prüft Device Admin nur bei aktivem Strict Lock', () => {
    const withoutLock = buildProtectionHealth(HEALTHY_APP_BLOCKING, {
      appBlockingConfigured: true,
      websiteBlockingConfigured: false,
      strictLockActive: false,
    });
    expect(withoutLock.items.find((item) => item.key === 'deviceAdmin')).toBeUndefined();

    const withLock = buildProtectionHealth(
      { ...HEALTHY_APP_BLOCKING, deviceAdminActive: false },
      { appBlockingConfigured: true, websiteBlockingConfigured: false, strictLockActive: true },
    );
    expect(withLock.items.find((item) => item.key === 'deviceAdmin')?.state).toBe('warn');
  });
});
