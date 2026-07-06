import type { BlockTargetType, GateRule } from "@/lib/learning";
import { resolveSessionCreditsRequired } from "@/lib/learning";
import type { DevicePolicySnapshot, DevicePolicyTarget } from "@/plugins/ScreenTimePlugin";
import { deriveEffectiveBlockingTargets } from "@/lib/effectiveBlockingTargets";
import type {
  ActiveModeId,
  StrictAddonMap,
  StrictAddonModeId,
  TargetModeId,
} from "@/lib/targetModes";
import {
  getActiveStrictAddonModes,
} from "@/lib/targetModes";
import { sanitizeBlockedAppTargetIds } from "@/lib/blockableApps";
import { normalizeUnlockedTargets } from "@/lib/unlockedTargets";
import type { RemoteBlockingInstruction } from "@/store/appStore.types";

export interface NativePolicyAssignment {
  targetId: string;
  targetType: BlockTargetType;
  deckId: string;
  requiredCorrectReviews: number;
  unlockDurationMinutes: number;
  enabled: boolean;
}

export interface BuildDevicePolicySnapshotOptions {
  activeModes: ActiveModeId[];
  gateRule: GateRule;
  blockedApps: string[];
  blockedAppModes: Record<string, TargetModeId>;
  blockedWebsites: string[];
  blockedWebsiteModes: Record<string, TargetModeId>;
  blockedSearchTerms: string[];
  blockedSearchTermModes: Record<string, TargetModeId>;
  assignments: NativePolicyAssignment[];
  unlockedTargets: Record<string, number>;
  strictLockUntil?: number | null;
  strictLockScope?: "full" | "settings" | null;
  strictAddons?: StrictAddonMap;
  penaltyRuntimeActive?: boolean;
  penaltyAmountSats?: number | null;
  accountabilityPartnerName?: string;
  remoteBlockingEnabled?: boolean;
  remoteBlockingInstruction?: RemoteBlockingInstruction | null;
  resolvedRemoteBlockedApps?: string[];
}

const STRICT_LOCK_SETTINGS_PACKAGE = "com.android.settings";
const STRICT_SYSTEM_PROTECTED_PACKAGES = [
  STRICT_LOCK_SETTINGS_PACKAGE,
  "com.android.packageinstaller",
  "com.google.android.packageinstaller",
  "com.google.android.permissioncontroller",
  "com.android.permissioncontroller",
  "com.miui.securitycenter",
  "com.miui.packageinstaller",
  "com.xiaomi.mipicks",
  "com.sec.android.app.myfiles",
  "com.sec.android.app.packageinstaller",
  "com.samsung.android.packageinstaller",
] as const;
const STRICT_LOCK_FULL_PROTECTED_PACKAGES = STRICT_SYSTEM_PROTECTED_PACKAGES;
const STRICT_ADDON_PROTECTED_PACKAGES = STRICT_SYSTEM_PROTECTED_PACKAGES;

function getStrictLockProtectedPackages(
  activeModes: ActiveModeId[],
  strictLockScope?: "full" | "settings" | null,
) {
  if (!activeModes.includes("lock") || !strictLockScope) {
    return [];
  }

  if (strictLockScope === "settings") {
    return [STRICT_LOCK_SETTINGS_PACKAGE];
  }

  return [...STRICT_LOCK_FULL_PROTECTED_PACKAGES];
}

function getStrictAddonProtectedPackages(strictAddons?: StrictAddonMap) {
  const activeAddonModes = getActiveStrictAddonModes(strictAddons);
  if (activeAddonModes.length === 0) {
    return [];
  }

  return [...STRICT_ADDON_PROTECTED_PACKAGES];
}

function getStrictAddonProtectionMode(strictAddons?: StrictAddonMap): ActiveModeId | null {
  return getActiveStrictAddonModes(strictAddons).length > 0 ? "strict" : null;
}

function getStrictAddonProtectionUntil(strictAddons?: StrictAddonMap): number | null {
  const now = Date.now();
  const activeAddonModes = getActiveStrictAddonModes(strictAddons, now);
  if (activeAddonModes.length === 0 || !strictAddons) {
    return null;
  }

  return activeAddonModes.reduce<number | null>((latestExpiry, mode) => {
    const expiresAt = strictAddons[mode].lockUntil;
    if (typeof expiresAt !== "number" || expiresAt <= now) {
      return latestExpiry;
    }

    return latestExpiry === null ? expiresAt : Math.max(latestExpiry, expiresAt);
  }, null);
}

function getStrictAddonLockedApps(strictAddons?: StrictAddonMap) {
  if (!strictAddons) return [];
  const activeAddonModes = getActiveStrictAddonModes(strictAddons);
  return activeAddonModes.flatMap((mode) => strictAddons[mode].lockedAppIds);
}

const TARGET_MODE_PRIORITY: Record<TargetModeId | "lock", number> = {
  lock: 5,
  strict: 4,
  penalty: 3,
  learn: 2,
  reflection: 1,
};

function applyStrictAddonModeOverrides(
  blockedAppModes: Record<string, TargetModeId>,
  strictAddons?: StrictAddonMap,
) {
  if (!strictAddons) return blockedAppModes;
  const next = { ...blockedAppModes };
  getActiveStrictAddonModes(strictAddons).forEach((mode) => {
    strictAddons[mode].lockedAppIds.forEach((appId) => {
      const currentMode = next[appId];
      if (!currentMode || TARGET_MODE_PRIORITY[mode] > TARGET_MODE_PRIORITY[currentMode]) {
        next[appId] = mode;
      }
    });
  });
  return next;
}

function applyRemoteModeOverrides(
  blockedAppModes: Record<string, TargetModeId>,
  remoteBlockedApps: string[],
  remoteMode: TargetModeId,
) {
  const next = { ...blockedAppModes };
  remoteBlockedApps.forEach((appId) => {
    const currentMode = next[appId];
    if (!currentMode || TARGET_MODE_PRIORITY[remoteMode] > TARGET_MODE_PRIORITY[currentMode]) {
      next[appId] = remoteMode;
    }
  });
  return next;
}

export function buildDevicePolicySnapshot({
  activeModes,
  gateRule,
  blockedApps,
  blockedAppModes,
  blockedWebsites,
  blockedWebsiteModes,
  blockedSearchTerms,
  blockedSearchTermModes,
  assignments,
  unlockedTargets,
  strictLockUntil,
  strictLockScope,
  strictAddons,
  penaltyRuntimeActive = true,
  penaltyAmountSats,
  accountabilityPartnerName,
  remoteBlockingEnabled,
  remoteBlockingInstruction,
  resolvedRemoteBlockedApps,
}: BuildDevicePolicySnapshotOptions): DevicePolicySnapshot {
  const strictLockExpiresAt =
    activeModes.includes("lock") && strictLockUntil && strictLockUntil > Date.now()
      ? strictLockUntil
      : null;
  const initialActiveModes = strictLockExpiresAt
    ? activeModes
    : activeModes.filter((mode) => mode !== "lock");
  const strictAddonLockedApps = getStrictAddonLockedApps(strictAddons);
  const strictAddonProtectionMode = getStrictAddonProtectionMode(strictAddons);
  const strictAddonProtectionUntil = getStrictAddonProtectionUntil(strictAddons);
  const strictAddonProtectedPackages = strictAddonProtectionMode
    ? getStrictAddonProtectedPackages(strictAddons)
    : [];

  const isRemoteActive = Boolean(
    remoteBlockingEnabled &&
      remoteBlockingInstruction &&
      remoteBlockingInstruction.expiresAt > Date.now()
  );
  const remoteBlockedApps = isRemoteActive ? (resolvedRemoteBlockedApps || []) : [];
  const remoteMode = (remoteBlockingInstruction?.mode as TargetModeId) || "strict";

  const effectiveActiveModes = initialActiveModes;

  const extendedBlockedApps = [...blockedApps, ...strictAddonLockedApps, ...remoteBlockedApps];
  let extendedBlockedAppModes = applyStrictAddonModeOverrides(blockedAppModes, strictAddons);
  if (isRemoteActive) {
    extendedBlockedAppModes = applyRemoteModeOverrides(extendedBlockedAppModes, remoteBlockedApps, remoteMode);
  }
  const effectiveBlockingTargets = deriveEffectiveBlockingTargets({
    blockedApps: extendedBlockedApps,
    blockedAppModes: extendedBlockedAppModes,
    blockedWebsites,
    blockedWebsiteModes,
    blockedSearchTerms,
    blockedSearchTermModes,
    penaltyRuntimeActive,
  });
  const strictLockProtectedPackages = getStrictLockProtectedPackages(effectiveActiveModes, strictLockScope);
  const sanitizedBlockedApps = sanitizeBlockedAppTargetIds(effectiveBlockingTargets.blockedApps);
  const blockedPackages = [...new Set([
    ...sanitizedBlockedApps,
    ...strictLockProtectedPackages,
    ...strictAddonProtectedPackages,
  ])];
  const activeRemoteBlockedApps = isRemoteActive ? (resolvedRemoteBlockedApps || []) : [];
  const filteredUnlockedTargets = { ...unlockedTargets };
  if (isRemoteActive) {
    activeRemoteBlockedApps.forEach((appId) => {
      const lowerAppId = appId.toLowerCase();
      delete filteredUnlockedTargets[lowerAppId];
      delete filteredUnlockedTargets[`app:${lowerAppId}`];
    });
  }

  // Apps, die ausschliesslich wegen der Remote-Sperre geblockt sind: Die native
  // Seite kann sie nach remoteBlockingExpiresAt selbst freigeben, auch wenn die
  // JS-Runtime (App gekillt / Geraet neu gestartet) keinen neuen Snapshot pusht.
  const locallyBlockedLower = new Set(
    [...blockedApps, ...strictAddonLockedApps].map((appId) => appId.toLowerCase()),
  );
  const remoteOnlyBlockedApps = activeRemoteBlockedApps
    .map((appId) => appId.toLowerCase())
    .filter((appId) => !locallyBlockedLower.has(appId));

  const assignmentByTarget = new Map(
    assignments.map((assignment) => [`${assignment.targetType}:${assignment.targetId}`, assignment]),
  );
  const normalizedUnlockedTargets = normalizeUnlockedTargets(filteredUnlockedTargets);
  const targets: DevicePolicyTarget[] = [
    ...sanitizedBlockedApps.map((id) => ({
      id,
      type: "app" as const,
      mode: effectiveBlockingTargets.blockedAppModes[id],
    })),
    ...strictLockProtectedPackages.map((id) => ({
      id,
      type: "app" as const,
      mode: "lock" as const,
    })),
    ...strictAddonProtectedPackages.map((id) => ({
      id,
      type: "app" as const,
      mode: strictAddonProtectionMode ?? "strict",
    })),
    ...effectiveBlockingTargets.blockedWebsites.map((id) => ({
      id,
      type: "website" as const,
      mode: effectiveBlockingTargets.blockedWebsiteModes[id],
    })),
    ...effectiveBlockingTargets.blockedSearchTerms.map((id) => ({
      id,
      type: "search" as const,
      mode: effectiveBlockingTargets.blockedSearchTermModes[id],
    })),
  ]
    .filter((target) => Boolean(target.mode))
    .map((target) => {
      const assignment = assignmentByTarget.get(`${target.type}:${target.id}`);

      return {
        id: target.id,
        type: target.type,
        mode: target.mode,
        deckId: assignment?.deckId,
        requiredCorrectReviews: resolveSessionCreditsRequired(
          assignment,
          resolveSessionCreditsRequired(gateRule),
        ),
        unlockDurationMinutes: assignment?.unlockDurationMinutes ?? gateRule.unlockDurationMinutes,
        enabled: assignment?.enabled ?? true,
      };
    });

  return {
    activeModes: effectiveActiveModes,
    gateRule,
    blockedPackages,
    blockedDomains: effectiveBlockingTargets.blockedWebsites,
    blockedSearchTerms: effectiveBlockingTargets.blockedSearchTerms,
    unlockedTargets: normalizedUnlockedTargets,
    ...(strictLockExpiresAt ? { strictLockUntil: strictLockExpiresAt } : {}),
    ...(strictAddonProtectionUntil ? { strictAddonProtectionUntil } : {}),
    strictLockScope: strictLockExpiresAt ? (strictLockScope ?? null) : null,
    fullLockBlocksAllApps: effectiveActiveModes.includes("lock") && strictLockScope === "full",
    penaltyAmountSats,
    accountabilityPartnerName,
    remoteBlockingActive: isRemoteActive,
    ...(isRemoteActive && remoteBlockingInstruction
      ? {
          remoteBlockingExpiresAt: remoteBlockingInstruction.expiresAt,
          remoteOnlyBlockedApps,
        }
      : {}),
    targets,
  };
}
