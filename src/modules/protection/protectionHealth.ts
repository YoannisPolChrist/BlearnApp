import type { MonitoringStatus } from '@/plugins/ScreenTimePlugin';
import { hasAccessibilityRuntimeReady } from '@/services/screenTimeNormalization';

export type ProtectionItemKey =
  | 'accessibility'
  | 'overlay'
  | 'usageStats'
  | 'battery'
  | 'notifications'
  | 'vpn'
  | 'vpnPermission'
  | 'privateDns'
  | 'deviceAdmin';

export type ProtectionItemState = 'ok' | 'warn' | 'error';

export type ProtectionOverallState = 'inactive' | 'ok' | 'warn' | 'error';

export interface ProtectionConfig {
  /** App-/Suchbegriff-Blocking ist konfiguriert (Modi aktiv + Ziele vorhanden). */
  appBlockingConfigured: boolean;
  /** Website-Blocking via DNS-VPN ist konfiguriert. */
  websiteBlockingConfigured: boolean;
  /** Ein Strict Lock läuft gerade. */
  strictLockActive: boolean;
}

export interface ProtectionHealthItem {
  key: ProtectionItemKey;
  state: ProtectionItemState;
}

export interface ProtectionHealth {
  overall: ProtectionOverallState;
  items: ProtectionHealthItem[];
}

/**
 * Konfigurationsabhängiges Health-Modell (Masterplan 1.1): nur die Pfade, die
 * die aktive Konfiguration tatsächlich braucht, zählen für den Schutzstatus.
 * Wer nur App-Blocking nutzt, braucht kein VPN-Grün.
 */
export function buildProtectionHealth(
  status: MonitoringStatus,
  config: ProtectionConfig,
): ProtectionHealth {
  const items: ProtectionHealthItem[] = [];

  if (!config.appBlockingConfigured && !config.websiteBlockingConfigured) {
    return { overall: 'inactive', items };
  }

  if (config.appBlockingConfigured) {
    items.push({
      key: 'accessibility',
      state: hasAccessibilityRuntimeReady(status) ? 'ok' : 'error',
    });
    items.push({
      key: 'overlay',
      state: status.overlayPermission ? 'ok' : 'error',
    });
    items.push({
      key: 'usageStats',
      state: status.usageStatsPermission ? 'ok' : 'warn',
    });
    items.push({
      key: 'battery',
      state: status.batteryOptimizationExempt ? 'ok' : 'warn',
    });
    items.push({
      key: 'notifications',
      state: status.notificationsEnabled ? 'ok' : 'warn',
    });
  }

  if (config.websiteBlockingConfigured) {
    items.push({
      key: 'vpnPermission',
      state: status.websiteBlockingPermission ? 'ok' : 'error',
    });
    items.push({
      key: 'vpn',
      state: status.vpnActive ? 'ok' : 'error',
    });
    if (status.privateDnsMode === 'hostname') {
      // Private DNS (DoT) verdeckt Hostnamen vor dem VPN-Pfad; Text-Matching
      // im Browser bleibt aktiv. Einschränkung ehrlich anzeigen.
      items.push({ key: 'privateDns', state: 'warn' });
    }
  }

  if (config.strictLockActive) {
    items.push({
      key: 'deviceAdmin',
      state: status.deviceAdminActive ? 'ok' : 'warn',
    });
  }

  const hasError = items.some((item) => item.state === 'error');
  const hasWarn = items.some((item) => item.state === 'warn');
  return {
    overall: hasError ? 'error' : hasWarn ? 'warn' : 'ok',
    items,
  };
}
