import type {
  AppUsageEntry,
  InstalledApp,
  MonitoringStatus,
  NativeBlockingRuntimeEvent,
} from '@/plugins/ScreenTimePlugin';

export type PermissionStatus = {
  usageStats: boolean;
  overlay: boolean;
  accessibility: boolean;
  vpnPermission: boolean;
  websiteBlockingAvailable: boolean;
  websiteBlockingActive: boolean;
};

export const EMPTY_PERMISSION_STATUS: PermissionStatus = {
  usageStats: false,
  overlay: false,
  accessibility: false,
  vpnPermission: false,
  websiteBlockingAvailable: false,
  websiteBlockingActive: false,
};

export const EMPTY_MONITORING_STATUS: MonitoringStatus = {
  monitoringActive: false,
  vpnActive: false,
  overlayPermission: false,
  accessibilityPermission: false,
  accessibilityServiceReady: false,
  websiteBlockingAvailable: false,
  websiteBlockingEnabled: false,
  websiteBlockingPermission: false,
  handoffInProgress: false,
  overlayVisible: false,
  pendingQueueLength: 0,
  recentBlockingEvents: [],
  currentAppId: null,
  taskDiagnostics: null,
};

const ACCESSIBILITY_RUNTIME_RECONNECT_GRACE_MS = 10_000;

const GENERIC_PACKAGE_SEGMENTS = new Set([
  'android',
  'app',
  'apps',
  'mobile',
  'launcher',
  'global',
  'google',
  'system',
  'service',
  'services',
  'mi',
  'miui',
  'redwood',
]);

const KNOWN_APP_LABELS = new Map([
  ['globallauncher', 'Launcher'],
  ['instagram', 'Instagram'],
  ['whatsapp', 'WhatsApp'],
  ['tiktok', 'TikTok'],
  ['twitter', 'X'],
  ['x', 'X'],
  ['snapchat', 'Snapchat'],
  ['youtube', 'YouTube'],
  ['spotify', 'Spotify'],
  ['reddit', 'Reddit'],
  ['facebook', 'Facebook'],
  ['discord', 'Discord'],
]);

const KNOWN_ACTIVE_BLOCKING_STAGES = new Set<NonNullable<MonitoringStatus['activeBlockingStage']>>([
  'consumed',
  'handoff_complete',
  'abandoned',
]);

export function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function normalizeStringList(values: string[]): string[] {
  const uniqueValues = new Set<string>();
  for (const value of values) {
    const normalized = normalizeText(value);
    if (normalized) {
      uniqueValues.add(normalized);
    }
  }
  return [...uniqueValues];
}

export function ensureArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function normalizeRuntimeEvent(event: NativeBlockingRuntimeEvent): NativeBlockingRuntimeEvent {
  return {
    stage: normalizeText(event.stage) || 'unknown',
    message: normalizeText(event.message),
    sessionId: normalizeText(event.sessionId),
    targetId: normalizeText(event.targetId),
    targetType: normalizeText(event.targetType) as NativeBlockingRuntimeEvent['targetType'],
    at: typeof event.at === 'number' && Number.isFinite(event.at) ? event.at : 0,
  };
}

function normalizeActiveBlockingStage(
  value: unknown,
): MonitoringStatus['activeBlockingStage'] {
  const normalizedValue = normalizeText(value);
  if (!KNOWN_ACTIVE_BLOCKING_STAGES.has(normalizedValue as NonNullable<MonitoringStatus['activeBlockingStage']>)) {
    return null;
  }

  return normalizedValue as MonitoringStatus['activeBlockingStage'];
}

function normalizeTaskSnapshot(
  task: NonNullable<NonNullable<MonitoringStatus['taskDiagnostics']>['appTasks']>[number],
): NonNullable<NonNullable<MonitoringStatus['taskDiagnostics']>['appTasks']>[number] {
  return {
    baseActivity: normalizeText(task.baseActivity),
    topActivity: normalizeText(task.topActivity),
    baseIntentComponent: normalizeText(task.baseIntentComponent),
  };
}

function normalizeTaskDiagnostics(
  value: MonitoringStatus['taskDiagnostics'],
): MonitoringStatus['taskDiagnostics'] {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const currentActivityClass = normalizeText(value.currentActivityClass);

  return {
    currentActivityClass: currentActivityClass || null,
    currentTaskId:
      typeof value.currentTaskId === 'number' && Number.isFinite(value.currentTaskId)
        ? Math.trunc(value.currentTaskId)
        : undefined,
    mainTaskAvailable: Boolean(value.mainTaskAvailable),
    blockingTaskActive: Boolean(value.blockingTaskActive),
    appTasks: ensureArray(value.appTasks).map(normalizeTaskSnapshot),
  };
}

export function normalizeMonitoringStatus(status?: Partial<MonitoringStatus> | null): MonitoringStatus {
  const currentAppId = normalizeText(status?.currentAppId || '');
  const foregroundSource = normalizeText(status?.foregroundSource || '') as MonitoringStatus['foregroundSource'];
  const activeBlockingSessionId = normalizeText(status?.activeBlockingSessionId || '');
  const activeBlockingTargetId = normalizeText(status?.activeBlockingTargetId || '');
  const activeBlockingStage = normalizeActiveBlockingStage(status?.activeBlockingStage);

  return {
    ...EMPTY_MONITORING_STATUS,
    ...status,
    monitoringActive: Boolean(status?.monitoringActive),
    vpnActive: Boolean(status?.vpnActive),
    overlayPermission: Boolean(status?.overlayPermission),
    accessibilityPermission: Boolean(status?.accessibilityPermission),
    accessibilityServiceReady: Boolean(status?.accessibilityServiceReady),
    accessibilityServiceConnectedAt:
      typeof status?.accessibilityServiceConnectedAt === 'number' && Number.isFinite(status.accessibilityServiceConnectedAt)
        ? status.accessibilityServiceConnectedAt
        : undefined,
    accessibilityServiceDisconnectedAt:
      typeof status?.accessibilityServiceDisconnectedAt === 'number' && Number.isFinite(status.accessibilityServiceDisconnectedAt)
        ? status.accessibilityServiceDisconnectedAt
        : undefined,
    websiteBlockingAvailable: Boolean(status?.websiteBlockingAvailable),
    websiteBlockingEnabled: Boolean(status?.websiteBlockingEnabled),
    websiteBlockingPermission: Boolean(status?.websiteBlockingPermission),
    handoffInProgress: Boolean(status?.handoffInProgress),
    overlayVisible: Boolean(status?.overlayVisible),
    lastTriggerTarget: normalizeText(status?.lastTriggerTarget),
    lastTriggerType: normalizeText(status?.lastTriggerType) as MonitoringStatus['lastTriggerType'],
    lastTriggerAt: typeof status?.lastTriggerAt === 'number' ? status.lastTriggerAt : undefined,
    pendingTargetId: normalizeText(status?.pendingTargetId),
    currentAppId: currentAppId || null,
    foregroundSource: foregroundSource || null,
    foregroundObservedAt:
      typeof status?.foregroundObservedAt === 'number' && Number.isFinite(status.foregroundObservedAt)
        ? status.foregroundObservedAt
        : undefined,
    pendingQueueLength:
      typeof status?.pendingQueueLength === 'number' && Number.isFinite(status.pendingQueueLength)
        ? Math.max(0, Math.trunc(status.pendingQueueLength))
        : 0,
    activeBlockingSessionId: activeBlockingSessionId || null,
    activeBlockingTargetId: activeBlockingTargetId || null,
    activeBlockingStage,
    recentBlockingEvents: ensureArray(status?.recentBlockingEvents).map(normalizeRuntimeEvent),
    taskDiagnostics: normalizeTaskDiagnostics(status?.taskDiagnostics),
  };
}

export function hasAccessibilityRuntimeReady(
  status?: Pick<
    MonitoringStatus,
    'accessibilityPermission' | 'accessibilityServiceReady' | 'accessibilityServiceConnectedAt' | 'accessibilityServiceDisconnectedAt'
  > | null,
): boolean {
  if (!status?.accessibilityPermission) {
    return false;
  }

  if (status.accessibilityServiceReady) {
    return true;
  }

  const now = Date.now();
  const disconnectedAt = status.accessibilityServiceDisconnectedAt;
  if (
    typeof disconnectedAt === 'number'
    && disconnectedAt > 0
    && now - disconnectedAt <= ACCESSIBILITY_RUNTIME_RECONNECT_GRACE_MS
  ) {
    return true;
  }

  const connectedAt = status.accessibilityServiceConnectedAt;
  if (
    typeof connectedAt === 'number'
    && connectedAt > 0
    && now - connectedAt <= ACCESSIBILITY_RUNTIME_RECONNECT_GRACE_MS
    && (typeof disconnectedAt !== 'number' || connectedAt >= disconnectedAt)
  ) {
    return true;
  }

  return false;
}

function looksLikePackageIdentifier(value?: string): boolean {
  if (!value) return false;
  const normalizedValue = value.trim();
  if (!normalizedValue || normalizedValue.includes(' ')) return false;
  return /^(?:[a-z][a-z0-9_]*\.){1,}[a-z0-9_]+$/i.test(normalizedValue);
}

function humanizePackageIdentifier(value: string): string {
  const segments = value.split('.').filter(Boolean);
  const preferredSegment =
    [...segments].reverse().find((segment) => !GENERIC_PACKAGE_SEGMENTS.has(segment.toLowerCase())) ||
    segments.at(-1) ||
    'App';
  const knownLabel = KNOWN_APP_LABELS.get(preferredSegment.toLowerCase());
  if (knownLabel) return knownLabel;

  const normalizedSegment = preferredSegment
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim();

  const titledSegment = normalizedSegment
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => (part.length <= 3 ? part.toUpperCase() : `${part[0]?.toUpperCase() || ''}${part.slice(1)}`))
    .join(' ');

  return titledSegment || 'App';
}

export function normalizeAppEntry(entry: InstalledApp): InstalledApp {
  const appId = normalizeText(entry.appId || entry.packageName || entry.processName || entry.label) || 'app';
  const label = normalizeText(entry.label || entry.appName || entry.processName || entry.packageName || appId) || appId;
  const icon =
    entry.icon && !entry.icon.startsWith('data:')
      ? `data:image/png;base64,${entry.icon}`
      : entry.icon;
  return {
    ...entry,
    appId,
    label,
    icon,
    packageName: entry.packageName || appId,
    appName: entry.appName || label,
  };
}

export function formatScreenTime(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function normalizeUsageEntry(entry: AppUsageEntry): AppUsageEntry {
  const appId = normalizeText(entry.appId || entry.packageName || entry.processName || entry.label) || 'app';
  const label = normalizeText(entry.label || entry.appName || entry.processName || entry.packageName || appId) || appId;
  const icon =
    entry.icon && !entry.icon.startsWith('data:')
      ? `data:image/png;base64,${entry.icon}`
      : entry.icon;
  return {
    ...entry,
    appId,
    label,
    icon,
    packageName: entry.packageName || appId,
    appName: entry.appName || label,
  };
}

export function getAppId(entry?: { appId?: string; packageName?: string; processName?: string; label?: string }) {
  if (!entry) return '';
  return normalizeText(entry.appId || entry.packageName || entry.processName || entry.label);
}

export function getAppLabel(entry?: { label?: string; appName?: string; processName?: string; packageName?: string }) {
  if (!entry) return '';

  const explicitLabels = [entry.label, entry.appName, entry.processName].map(normalizeText).filter(Boolean);
  const preferredLabel = explicitLabels.find((label) => !looksLikePackageIdentifier(label));
  if (preferredLabel) return preferredLabel;

  const rawIdentifier = normalizeText(entry.packageName || entry.processName || entry.appName || entry.label);
  if (!rawIdentifier) return '';

  return looksLikePackageIdentifier(rawIdentifier) ? humanizePackageIdentifier(rawIdentifier) : rawIdentifier;
}
