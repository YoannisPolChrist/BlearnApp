import { registerPlugin, type PermissionState as CapacitorPermissionState } from "@capacitor/core";
import type { BlockTargetType, GateRule } from "@/lib/learning";
import type { ActiveModeId, TargetModeId } from "@/lib/targetModes";
import type { NotificationPreferences } from "@/store/appStore.types";

export type NotificationChannelKey = keyof NotificationPreferences;

export interface NotificationDispatchOptions {
  category: NotificationChannelKey;
  title: string;
  body: string;
  id?: string;
}

export interface NotificationSyncOptions {
  enabled: boolean;
  preferences: NotificationPreferences;
  preview?: NotificationDispatchOptions | null;
}

export interface NotificationPermissionStatus {
  state: CapacitorPermissionState | "unsupported";
  enabled: boolean;
}

export interface AppUsageEntry {
  appId: string;
  label: string;
  totalTimeMs: number;
  lastUsedTimestamp: number;
  icon?: string;
  processName?: string;
  executablePath?: string;
  windowTitle?: string;
  packageName?: string;
  appName?: string;
}

export interface ScreenTimeSummary {
  totalScreenTimeMs: number;
  unlockCount: number;
  entries: AppUsageEntry[];
}

export interface InstalledApp {
  appId: string;
  label: string;
  processName?: string;
  executablePath?: string;
  icon?: string;
  packageName?: string;
  appName?: string;
}

export interface DevicePolicyTarget {
  id: string;
  type: BlockTargetType;
  mode: ActiveModeId;
  deckId?: string;
  requiredCorrectReviews: number;
  unlockDurationMinutes: number;
  enabled: boolean;
}

export interface DevicePolicySnapshot {
  activeModes: ActiveModeId[];
  gateRule: GateRule;
  blockedPackages: string[];
  blockedDomains: string[];
  blockedSearchTerms: string[];
  targets: DevicePolicyTarget[];
  unlockedTargets?: Record<string, number>;
  strictLockUntil?: number | null;
  strictAddonProtectionUntil?: number | null;
  strictLockScope?: 'full' | 'settings' | null;
  fullLockBlocksAllApps?: boolean;
  penaltyAmountSats?: number | null;
  accountabilityPartnerName?: string;
}

export interface MonitoringStatus {
  monitoringActive: boolean;
  vpnActive: boolean;
  overlayPermission: boolean;
  accessibilityPermission: boolean;
  accessibilityServiceReady?: boolean;
  accessibilityServiceConnectedAt?: number;
  accessibilityServiceDisconnectedAt?: number;
  websiteBlockingAvailable: boolean;
  websiteBlockingEnabled: boolean;
  websiteBlockingPermission: boolean;
  handoffInProgress: boolean;
  overlayVisible: boolean;
  lastTriggerTarget?: string;
  lastTriggerType?: BlockTargetType;
  lastTriggerAt?: number;
  pendingTargetId?: string;
  currentAppId?: string | null;
  foregroundSource?: 'accessibility' | 'usage' | '' | null;
  foregroundObservedAt?: number;
  pendingQueueLength?: number;
  activeBlockingSessionId?: string | null;
  activeBlockingTargetId?: string | null;
  activeBlockingStage?: 'consumed' | 'handoff_complete' | 'abandoned' | '' | null;
  recentBlockingEvents?: NativeBlockingRuntimeEvent[];
  taskDiagnostics?: NativeTaskDiagnostics | null;
}

export interface NativeBlockingRuntimeEvent {
  stage: string;
  message?: string;
  sessionId?: string;
  targetId?: string;
  targetType?: BlockTargetType | '';
  at?: number;
}

export interface NativeTaskSnapshot {
  baseActivity?: string;
  topActivity?: string;
  baseIntentComponent?: string;
}

export interface NativeTaskDiagnostics {
  currentActivityClass?: string | null;
  currentTaskId?: number;
  mainTaskAvailable: boolean;
  blockingTaskActive: boolean;
  appTasks: NativeTaskSnapshot[];
}

export interface ManualOverrideStatus {
  supported: boolean;
  active: boolean;
  attemptsUsed: number;
  attemptsRemaining: number;
  maxAttempts: number;
  granted?: boolean;
  reason?: string;
  unlockedUntil?: number;
  windowStartedAt?: number;
}

export interface WebsiteBlockingStatus {
  available: boolean;
  active: boolean;
  permissionGranted: boolean;
}

export interface PendingNativeNavigationPayload {
  route?: string;
  targetId?: string;
  targetType?: BlockTargetType;
  mode?: string;
  sessionId?: string;
  targetLabel?: string;
  deckId?: string;
  unlockDurationMinutes?: number;
  penaltyAmountSats?: number;
}

export interface ForegroundRecheckResult {
  matched: boolean;
}

export interface ScreenTimePlugin {
  getNotificationPermissionState(): Promise<NotificationPermissionStatus>;
  requestNotificationPermission(): Promise<NotificationPermissionStatus>;
  syncNotificationPreferences(options: NotificationSyncOptions): Promise<{
    enabled: boolean;
    previewSent: boolean;
    state: NotificationPermissionStatus["state"];
  }>;
  dispatchNotification(options: NotificationDispatchOptions): Promise<{
    sent: boolean;
    reason?: string;
  }>;
  hasUsagePermission(): Promise<{ granted: boolean }>;
  requestUsagePermission(): Promise<void>;
  getTodayUsage(): Promise<ScreenTimeSummary>;
  getUsageForRange(options: { startMs: number; endMs: number }): Promise<ScreenTimeSummary>;
  getCurrentApp(): Promise<{
    packageName?: string;
    appId?: string;
    source?: 'accessibility' | 'usage' | '';
    observedAt?: number;
  }>;
  getInstalledApps(): Promise<{ apps: InstalledApp[] }>;
  hasOverlayPermission(): Promise<{ granted: boolean }>;
  requestOverlayPermission(): Promise<void>;
  startMonitoringService(options: { blockedPackages: string[] }): Promise<void>;
  stopMonitoringService(): Promise<void>;
  updateBlockedPackages(options: { blockedPackages: string[] }): Promise<void>;
  hasAccessibilityPermission(): Promise<{ granted: boolean }>;
  requestAccessibilityPermission(): Promise<void>;
  startVpnFilter(options: { blockedDomains: string[] }): Promise<void>;
  stopVpnFilter(): Promise<void>;
  updateBlockedDomains(options: { blockedDomains: string[] }): Promise<void>;
  hasVpnPermission(): Promise<{ granted: boolean }>;
  getWebsiteBlockingStatus(): Promise<WebsiteBlockingStatus>;
  updateBlockedSearchTerms(options: { terms: string[] }): Promise<void>;
  syncPolicies(options: { snapshot: DevicePolicySnapshot }): Promise<void>;
  recheckCurrentForegroundTarget(): Promise<ForegroundRecheckResult>;
  getMonitoringStatus(): Promise<MonitoringStatus>;
  openGate(options: { targetId: string; targetType: BlockTargetType; deckId?: string }): Promise<void>;
  openTarget(options: { targetId: string; targetType: BlockTargetType }): Promise<void>;
  peekPendingNavigation(): Promise<PendingNativeNavigationPayload | void>;
  consumePendingNavigation(): Promise<PendingNativeNavigationPayload | void>;
  completePendingNavigation(options?: { sessionId?: string }): Promise<void>;
  abandonPendingNavigation(options?: { sessionId?: string }): Promise<void>;
  dismissBlockingOverlay(options?: { sessionId?: string }): Promise<void>;
  getManualOverrideStatus(options: { targetId: string; targetType: BlockTargetType }): Promise<ManualOverrideStatus>;
  grantManualOverride(options: {
    targetId: string;
    targetType: BlockTargetType;
    unlockDurationMinutes?: number;
  }): Promise<ManualOverrideStatus>;
  reportTriggerEvent(options: {
    targetId: string;
    targetType: BlockTargetType;
    triggeredAt: number;
  }): Promise<void>;
}

const ScreenTime = registerPlugin<ScreenTimePlugin>("ScreenTime");

export default ScreenTime;
