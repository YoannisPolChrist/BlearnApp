import ScreenTime, {
  type DevicePolicySnapshot,
  type ForegroundRecheckResult,
  type InstalledApp,
  type ManualOverrideStatus,
  type MonitoringStatus,
  type PendingNativeNavigationPayload,
  type ScreenTimeSummary,
  type WebsiteBlockingStatus,
} from "@/plugins/ScreenTimePlugin";
import { getPlatform, isAndroidPlatform, isNativePlatform } from "@/lib/platform";
import {
  EMPTY_MONITORING_STATUS,
  EMPTY_PERMISSION_STATUS,
  ensureArray,
  formatScreenTime,
  getAppId,
  getAppLabel,
  hasAccessibilityRuntimeReady,
  normalizeAppEntry,
  normalizeMonitoringStatus,
  normalizeStringList,
  normalizeText,
  normalizeUsageEntry,
} from '@/services/screenTimeNormalization';
import type { PermissionStatus } from '@/services/screenTimeNormalization';
import { getInstalledApps } from '@/services/screenTimeInstalledApps';
import {
  UnsupportedPlatformError,
  isUnsupportedPlatformError,
} from '@/services/screenTimePlatformError';

export {
  EMPTY_MONITORING_STATUS,
  EMPTY_PERMISSION_STATUS,
  formatScreenTime,
  getAppId,
  getAppLabel,
  hasAccessibilityRuntimeReady,
  normalizeMonitoringStatus,
};
export type { PermissionStatus };
export { getInstalledApps };
export { UnsupportedPlatformError, isUnsupportedPlatformError };

function ensureAndroidSupport(feature: string) {
  if (!isAndroidPlatform) {
    throw new UnsupportedPlatformError(feature);
  }
}

export async function checkPermissions(): Promise<{
  usageStats: boolean;
  overlay: boolean;
  accessibility: boolean;
  vpnPermission: boolean;
  websiteBlockingAvailable: boolean;
  websiteBlockingActive: boolean;
}> {
  ensureAndroidSupport("Permission status");

  const [usage, overlay, access, websiteBlocking] = await Promise.all([
    ScreenTime.hasUsagePermission(),
    ScreenTime.hasOverlayPermission(),
    ScreenTime.hasAccessibilityPermission(),
    ScreenTime.getWebsiteBlockingStatus(),
  ]);

  return {
    usageStats: Boolean(usage?.granted),
    overlay: Boolean(overlay?.granted),
    accessibility: Boolean(access?.granted),
    vpnPermission: Boolean(websiteBlocking?.permissionGranted),
    websiteBlockingAvailable: Boolean(websiteBlocking?.available),
    websiteBlockingActive: Boolean(websiteBlocking?.active),
  };
}

export async function requestUsagePermission(): Promise<void> {
  ensureAndroidSupport("Usage permission requests");
  await ScreenTime.requestUsagePermission();
}

export async function requestOverlayPermission(): Promise<void> {
  ensureAndroidSupport("Overlay permission requests");
  await ScreenTime.requestOverlayPermission();
}

export async function requestAccessibilityPermission(): Promise<void> {
  ensureAndroidSupport("Accessibility permission requests");
  await ScreenTime.requestAccessibilityPermission();
}

export async function getTodayUsage(): Promise<ScreenTimeSummary> {
  ensureAndroidSupport("Screen-time usage");

  const usage = await ScreenTime.getTodayUsage();
  return {
    ...usage,
    entries: ensureArray(usage.entries).map(normalizeUsageEntry),
  };
}

export async function getUsageForRange(startMs: number, endMs: number): Promise<ScreenTimeSummary> {
  ensureAndroidSupport("Historic screen-time usage");

  const usage = await ScreenTime.getUsageForRange({ startMs, endMs });
  return {
    ...usage,
    entries: ensureArray(usage.entries).map(normalizeUsageEntry),
  };
}

export async function getCurrentApp(): Promise<string> {
  ensureAndroidSupport("Foreground app detection");
  const result = await ScreenTime.getCurrentApp();
  return normalizeText(result.appId || result.packageName);
}

export async function startBlockingService(_blockedPackages: string[]): Promise<void> {
  ensureAndroidSupport("Blocking service control");
  await ScreenTime.startMonitoringService({ blockedPackages: normalizeStringList(_blockedPackages) });
}

export async function stopBlockingService(): Promise<void> {
  ensureAndroidSupport("Blocking service control");
  await ScreenTime.stopMonitoringService();
}

export async function updateBlockedApps(blockedPackages: string[]): Promise<void> {
  ensureAndroidSupport("Blocked app updates");
  await ScreenTime.updateBlockedPackages({ blockedPackages: normalizeStringList(blockedPackages) });
}

export async function startWebsiteBlocking(blockedDomains: string[]): Promise<void> {
  ensureAndroidSupport("Website blocking control");
  await ScreenTime.startVpnFilter({ blockedDomains: normalizeStringList(blockedDomains) });
}

export async function requestWebsiteBlockingPermission(): Promise<void> {
  ensureAndroidSupport("Website blocking permission requests");
  await ScreenTime.startVpnFilter({ blockedDomains: [] });
}

export async function stopWebsiteBlocking(): Promise<void> {
  ensureAndroidSupport("Website blocking control");
  await ScreenTime.stopVpnFilter();
}

export async function updateBlockedDomains(blockedDomains: string[]): Promise<void> {
  ensureAndroidSupport("Blocked domain updates");
  await ScreenTime.updateBlockedDomains({ blockedDomains: normalizeStringList(blockedDomains) });
}

export async function getWebsiteBlockingStatus(): Promise<WebsiteBlockingStatus> {
  ensureAndroidSupport("Website blocking status");
  return ScreenTime.getWebsiteBlockingStatus();
}

export async function updateBlockedSearchTerms(terms: string[]): Promise<void> {
  ensureAndroidSupport("Blocked search term updates");
  await ScreenTime.updateBlockedSearchTerms({ terms: normalizeStringList(terms) });
}

export async function syncPolicies(snapshot: DevicePolicySnapshot): Promise<void> {
  ensureAndroidSupport("Policy sync");
  await ScreenTime.syncPolicies({ snapshot });
}

export async function recheckCurrentForegroundTarget(): Promise<ForegroundRecheckResult> {
  ensureAndroidSupport("Foreground target recheck");
  return ScreenTime.recheckCurrentForegroundTarget();
}

export async function getMonitoringStatus(): Promise<MonitoringStatus> {
  ensureAndroidSupport("Monitoring status");
  return normalizeMonitoringStatus(await ScreenTime.getMonitoringStatus());
}

export async function isBatteryOptimizationExempt(): Promise<boolean> {
  ensureAndroidSupport("Battery optimization status");
  const result = await ScreenTime.isBatteryOptimizationExempt();
  return Boolean(result?.granted);
}

export async function requestBatteryOptimizationExemption(): Promise<void> {
  ensureAndroidSupport("Battery optimization exemption requests");
  await ScreenTime.requestBatteryOptimizationExemption();
}

export async function clearVpnBootInterruption(): Promise<void> {
  ensureAndroidSupport("VPN boot interruption state");
  await ScreenTime.clearVpnBootInterruption();
}

export async function openGate(
  targetId: string,
  targetType: "app" | "website" | "search",
  deckId?: string,
): Promise<void> {
  ensureAndroidSupport("Gate handoff");
  await ScreenTime.openGate({ targetId, targetType, deckId });
}

export async function consumePendingNavigation(): Promise<{
  route?: string;
  targetId?: string;
  targetType?: "app" | "website" | "search";
  mode?: string;
  sessionId?: string;
  targetLabel?: string;
  deckId?: string;
  unlockDurationMinutes?: number;
  penaltyAmountSats?: number;
} | null> {
  ensureAndroidSupport("Pending native navigation");
  const result = await ScreenTime.consumePendingNavigation();
  return result ?? null;
}

export async function peekPendingNavigation(): Promise<PendingNativeNavigationPayload | null> {
  ensureAndroidSupport("Pending native navigation");
  const result = await ScreenTime.peekPendingNavigation();
  return result ?? null;
}

export async function completePendingNavigation(sessionId?: string | null): Promise<void> {
  ensureAndroidSupport("Pending native navigation completion");
  await ScreenTime.completePendingNavigation(
    sessionId?.trim()
      ? {
          sessionId: sessionId.trim(),
        }
      : undefined,
  );
}

export async function abandonPendingNavigation(sessionId?: string | null): Promise<void> {
  ensureAndroidSupport("Pending native navigation abandon");
  await ScreenTime.abandonPendingNavigation(
    sessionId?.trim()
      ? {
          sessionId: sessionId.trim(),
        }
      : undefined,
  );
}

export async function dismissBlockingOverlay(sessionId?: string | null): Promise<void> {
  ensureAndroidSupport("Blocking overlay dismissal");
  await ScreenTime.dismissBlockingOverlay(
    sessionId?.trim()
      ? {
          sessionId: sessionId.trim(),
        }
      : undefined,
  );
}

export async function getManualOverrideStatus(
  targetId: string,
  targetType: "app" | "website" | "search",
): Promise<ManualOverrideStatus> {
  const normalizedTargetId = normalizeText(targetId);
  if (!normalizedTargetId) {
    return {
      supported: true,
      active: false,
      attemptsUsed: 0,
      attemptsRemaining: 0,
      maxAttempts: 0,
      reason: "invalid_target",
    };
  }
  ensureAndroidSupport("Manual override status");
  return ScreenTime.getManualOverrideStatus({ targetId: normalizedTargetId, targetType });
}

export async function grantManualOverride(
  targetId: string,
  targetType: "app" | "website" | "search",
  unlockDurationMinutes?: number,
): Promise<ManualOverrideStatus> {
  const normalizedTargetId = normalizeText(targetId);
  if (!normalizedTargetId) {
    return {
      supported: true,
      active: false,
      granted: false,
      attemptsUsed: 0,
      attemptsRemaining: 0,
      maxAttempts: 0,
      reason: "invalid_target",
    };
  }
  ensureAndroidSupport("Manual override grant");
  return ScreenTime.grantManualOverride({
    targetId: normalizedTargetId,
    targetType,
    unlockDurationMinutes,
  });
}

export async function openTarget(
  targetId: string,
  targetType: "app" | "website" | "search",
): Promise<void> {
  const normalizedTargetId = normalizeText(targetId);
  if (!normalizedTargetId) return;
  ensureAndroidSupport("Target handoff");
  await ScreenTime.openTarget({ targetId: normalizedTargetId, targetType });
}

export async function reportTriggerEvent(
  targetId: string,
  targetType: "app" | "website" | "search",
): Promise<void> {
  const normalizedTargetId = normalizeText(targetId);
  if (!normalizedTargetId) return;
  ensureAndroidSupport("Trigger reporting");
  await ScreenTime.reportTriggerEvent({ targetId: normalizedTargetId, targetType, triggeredAt: Date.now() });
}

export const platform = getPlatform();
export const isNative = isNativePlatform;
