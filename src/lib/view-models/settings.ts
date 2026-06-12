import type { MonitoringStatus } from '@/plugins/ScreenTimePlugin';
import { hasAccessibilityRuntimeReady, type PermissionStatus } from '@/services/screenTimeNormalization';

export function getSettingsSectionIds(showPermissionsSection: boolean) {
  return [
    'account',
    'general',
    'areas',
    ...(showPermissionsSection ? ['permissions'] : []),
    'overview',
  ] as const;
}

export function getNotificationStatusLabel(permissionState: 'default' | 'denied' | 'granted' | 'unsupported') {
  if (permissionState === 'granted') return 'Erlaubt';
  if (permissionState === 'denied') return 'Blockiert';
  if (permissionState === 'unsupported') return 'Nicht verfügbar';
  return 'Offen';
}

export type PermissionCheckpointKey = 'usage' | 'overlay' | 'accessibility' | 'websiteBlocking';
export type PermissionCheckpointState = 'unknown' | 'prompting' | 'granted' | 'blocked' | 'needs-recovery';

interface PermissionCheckpointStateOptions {
  key: PermissionCheckpointKey;
  permissions: PermissionStatus;
  monitoringStatus?: MonitoringStatus | null;
  blockedWebsitesCount?: number;
  prompting?: boolean;
}

export function getPermissionCheckpointState({
  key,
  permissions,
  monitoringStatus,
  blockedWebsitesCount = 0,
  prompting = false,
}: PermissionCheckpointStateOptions): PermissionCheckpointState {
  if (prompting) {
    return 'prompting';
  }

  if (key === 'websiteBlocking') {
    if (!permissions.websiteBlockingAvailable) {
      return 'unknown';
    }
    if (!permissions.vpnPermission) {
      return 'blocked';
    }
    if (blockedWebsitesCount > 0 && !permissions.websiteBlockingActive) {
      return 'needs-recovery';
    }
    if (monitoringStatus?.vpnActive && !permissions.websiteBlockingActive) {
      return 'needs-recovery';
    }
    return 'granted';
  }

  const granted =
    key === 'usage'
      ? permissions.usageStats
      : key === 'overlay'
        ? permissions.overlay
        : permissions.accessibility;

  if (key === 'accessibility' && permissions.accessibility && !hasAccessibilityRuntimeReady(monitoringStatus)) {
    return monitoringStatus ? 'needs-recovery' : 'unknown';
  }

  if (granted) {
    return 'granted';
  }

  if (!monitoringStatus) {
    return 'unknown';
  }

  return 'blocked';
}

export function getPermissionCheckpointStatusLabel(state: PermissionCheckpointState) {
  if (state === 'granted') return 'Aktiv';
  if (state === 'prompting') return 'Wartet';
  if (state === 'needs-recovery') return 'Aktion nötig';
  if (state === 'blocked') return 'Fehlt';
  return 'Unklar';
}

export function getPermissionCheckpointTone(state: PermissionCheckpointState) {
  if (state === 'granted') return 'success' as const;
  if (state === 'prompting') return 'primary' as const;
  if (state === 'needs-recovery') return 'warning' as const;
  if (state === 'blocked') return 'warning' as const;
  return 'muted' as const;
}

export function getPermissionCheckpointButtonLabel(state: PermissionCheckpointState) {
  if (state === 'granted') return 'Prüfen';
  if (state === 'prompting') return 'Wird geprüft';
  if (state === 'needs-recovery') return 'Reparieren';
  return 'Freigeben';
}
