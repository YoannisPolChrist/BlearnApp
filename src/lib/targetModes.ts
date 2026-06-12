import type { BlockTargetType } from '@/lib/learning';

export type TargetModeId = 'strict' | 'reflection' | 'learn' | 'penalty';
export type ActiveModeId = TargetModeId | 'lock';
export type TargetModeMap = Record<string, TargetModeId>;
export type StrictAddonModeId = Extract<TargetModeId, 'strict' | 'learn' | 'penalty'>;
export type StrictAddonLockedAppsByMode = Partial<Record<StrictAddonModeId, Set<string>>>;

export interface StrictAddonState {
  enabled: boolean;
  startTime: string;
  endTime: string;
  lockUntil: number | null;
  lockedAppIds: string[];
}

export type StrictAddonMap = Record<StrictAddonModeId, StrictAddonState>;

export interface TargetModeCollections {
  blockedAppModes: TargetModeMap;
  blockedWebsiteModes: TargetModeMap;
  blockedSearchTermModes: TargetModeMap;
}

export interface DeriveActiveModesOptions extends TargetModeCollections {
  strictAddons?: StrictAddonMap;
  strictCompanionModes?: Partial<Record<StrictAddonModeId, boolean>> | null;
  strictLockUntil?: number | null;
  now?: number;
}

const MODE_PRIORITY: ActiveModeId[] = ['lock', 'penalty', 'learn', 'strict'];
export const STRICT_ADDON_MODE_IDS: StrictAddonModeId[] = ['strict', 'learn', 'penalty'];

export function createDefaultStrictAddonState(
  overrides: Partial<StrictAddonState> = {},
): StrictAddonState {
  const lockedAppIds = Array.isArray(overrides.lockedAppIds) ? [...overrides.lockedAppIds] : [];

  return {
    enabled: false,
    startTime: '08:00',
    endTime: '17:00',
    lockUntil: null,
    ...overrides,
    lockedAppIds,
  };
}

export function createDefaultStrictAddonMap(
  overrides: Partial<Record<StrictAddonModeId, Partial<StrictAddonState>>> = {},
): StrictAddonMap {
  return {
    strict: createDefaultStrictAddonState(overrides.strict),
    learn: createDefaultStrictAddonState(overrides.learn),
    penalty: createDefaultStrictAddonState(overrides.penalty),
  };
}

export function isStrictAddonModeId(mode: string | null | undefined): mode is StrictAddonModeId {
  return mode === 'strict' || mode === 'learn' || mode === 'penalty';
}

export function isStrictAddonActive(addon: StrictAddonState | null | undefined, now = Date.now()): boolean {
  return Boolean(
    addon?.enabled
    && addon.lockUntil
    && addon.lockUntil > now
    && addon.lockedAppIds.length > 0,
  );
}

export function getActiveStrictAddonModes(strictAddons: StrictAddonMap | null | undefined, now = Date.now()): StrictAddonModeId[] {
  if (!strictAddons) {
    return [];
  }

  return STRICT_ADDON_MODE_IDS.filter((mode) => isStrictAddonActive(strictAddons[mode], now));
}

export function getActiveStrictAddonLockedAppsByMode(
  strictAddons: StrictAddonMap | null | undefined,
  now = Date.now(),
): StrictAddonLockedAppsByMode {
  if (!strictAddons) {
    return {};
  }

  const lockedByMode: StrictAddonLockedAppsByMode = {};

  STRICT_ADDON_MODE_IDS.forEach((mode) => {
    if (!isStrictAddonActive(strictAddons[mode], now)) {
      return;
    }

    lockedByMode[mode] = new Set(
      strictAddons[mode].lockedAppIds
        .map((appId) => normalizeTargetValue('app', appId))
        .filter(Boolean),
    );
  });

  return lockedByMode;
}

export function normalizeTargetModeId(mode: string | null | undefined): TargetModeId | null {
  if (mode === 'strict' || mode === 'reflection' || mode === 'learn' || mode === 'penalty') {
    return mode === 'reflection' ? 'strict' : mode;
  }

  return null;
}

export function isLegacyTargetModeId(mode: string | null | undefined): boolean {
  return mode === 'strict';
}

export function normalizeTargetValue(targetType: BlockTargetType, targetId: string): string {
  const value = targetId.trim();
  return targetType === 'app' ? value.toLowerCase() : value.toLowerCase();
}

export function getTargetMode(
  collections: TargetModeCollections,
  targetType: BlockTargetType,
  targetId: string,
): TargetModeId | null {
  const normalizedTargetId = normalizeTargetValue(targetType, targetId);
  const mode = targetType === 'app'
    ? collections.blockedAppModes[normalizedTargetId]
    : targetType === 'website'
      ? collections.blockedWebsiteModes[normalizedTargetId]
      : collections.blockedSearchTermModes[normalizedTargetId];

  return normalizeTargetModeId(mode) || null;
}

export function setTargetModeRecord(
  record: TargetModeMap,
  targetType: BlockTargetType,
  targetId: string,
  mode: TargetModeId | null,
): TargetModeMap {
  const normalizedTargetId = normalizeTargetValue(targetType, targetId);
  const nextRecord = { ...record };
  const normalizedMode = normalizeTargetModeId(mode);

  if (!normalizedMode) {
    delete nextRecord[normalizedTargetId];
    return nextRecord;
  }

  nextRecord[normalizedTargetId] = normalizedMode;
  return nextRecord;
}

export function deriveActiveModes({
  blockedAppModes,
  blockedWebsiteModes,
  blockedSearchTermModes,
  strictAddons,
  strictCompanionModes,
  strictLockUntil,
  now = Date.now(),
}: DeriveActiveModesOptions): ActiveModeId[] {
  const activeModes = new Set<ActiveModeId>();

  Object.values(blockedAppModes).forEach((mode) => {
    const normalized = normalizeTargetModeId(mode);
    if (normalized) {
      activeModes.add(normalized);
    }
  });
  Object.values(blockedWebsiteModes).forEach((mode) => {
    const normalized = normalizeTargetModeId(mode);
    if (normalized) {
      activeModes.add(normalized);
    }
  });
  Object.values(blockedSearchTermModes).forEach((mode) => {
    const normalized = normalizeTargetModeId(mode);
    if (normalized) {
      activeModes.add(normalized);
    }
  });

  if (strictLockUntil && strictLockUntil > now) {
    activeModes.add('lock');
  }

  const hasLegacyStrictCompanionMode = Boolean(
    strictCompanionModes
    && Object.values(strictCompanionModes).some(Boolean),
  );

  if (getActiveStrictAddonModes(strictAddons, now).length > 0 || hasLegacyStrictCompanionMode) {
    activeModes.add('strict');
  }

  return MODE_PRIORITY.filter((mode) => activeModes.has(mode));
}

export function getPrimaryActiveMode(activeModes: ActiveModeId[]): ActiveModeId | 'normal' {
  return activeModes[0] || 'normal';
}

export function countTargetsForMode(collections: TargetModeCollections, mode: TargetModeId): number {
  const normalizedMode = normalizeTargetModeId(mode) || mode;
  return Object.values(collections.blockedAppModes).filter((entry) => normalizeTargetModeId(entry) === normalizedMode).length
    + Object.values(collections.blockedWebsiteModes).filter((entry) => normalizeTargetModeId(entry) === normalizedMode).length
    + Object.values(collections.blockedSearchTermModes).filter((entry) => normalizeTargetModeId(entry) === normalizedMode).length;
}

export function hasAssignedTargets(collections: TargetModeCollections): boolean {
  return Object.keys(collections.blockedAppModes).length > 0
    || Object.keys(collections.blockedWebsiteModes).length > 0
    || Object.keys(collections.blockedSearchTermModes).length > 0;
}
