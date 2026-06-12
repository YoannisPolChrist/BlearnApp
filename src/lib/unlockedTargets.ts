import type { BlockTargetType } from '@/lib/learning';
import { normalizeTargetValue } from '@/lib/targetModes';

const DEFAULT_UNLOCK_TARGET_TYPE: BlockTargetType = 'app';

function isBlockTargetType(value: string): value is BlockTargetType {
  return value === 'app' || value === 'website' || value === 'search';
}

export function buildUnlockedTargetKey(targetId: string, targetType: BlockTargetType): string {
  const normalizedTargetId = normalizeTargetValue(targetType, targetId);
  if (!normalizedTargetId) {
    return '';
  }

  return `${targetType}:${normalizedTargetId}`;
}

export function parseUnlockedTargetKey(
  rawKey: string,
  fallbackTargetType: BlockTargetType = DEFAULT_UNLOCK_TARGET_TYPE,
): { targetId: string; targetType: BlockTargetType } | null {
  const trimmedKey = rawKey.trim();
  if (!trimmedKey) {
    return null;
  }

  const separatorIndex = trimmedKey.indexOf(':');
  if (separatorIndex > 0) {
    const rawTargetType = trimmedKey.slice(0, separatorIndex).trim().toLowerCase();
    const rawTargetId = trimmedKey.slice(separatorIndex + 1);
    if (isBlockTargetType(rawTargetType)) {
      const normalizedTargetId = normalizeTargetValue(rawTargetType, rawTargetId);
      if (!normalizedTargetId) {
        return null;
      }

      return {
        targetId: normalizedTargetId,
        targetType: rawTargetType,
      };
    }
  }

  const normalizedTargetId = normalizeTargetValue(fallbackTargetType, trimmedKey);
  if (!normalizedTargetId) {
    return null;
  }

  return {
    targetId: normalizedTargetId,
    targetType: fallbackTargetType,
  };
}

export function normalizeUnlockedTargets(
  unlockedTargets?: Record<string, number> | null,
  fallbackTargetType: BlockTargetType = DEFAULT_UNLOCK_TARGET_TYPE,
): Record<string, number> {
  if (!unlockedTargets) {
    return {};
  }

  const normalizedEntries: Record<string, number> = {};
  for (const [rawKey, expiresAt] of Object.entries(unlockedTargets)) {
    if (!Number.isFinite(expiresAt)) {
      continue;
    }

    const parsedTarget = parseUnlockedTargetKey(rawKey, fallbackTargetType);
    if (!parsedTarget) {
      continue;
    }

    const targetKey = buildUnlockedTargetKey(parsedTarget.targetId, parsedTarget.targetType);
    if (!targetKey) {
      continue;
    }

    normalizedEntries[targetKey] = Math.max(normalizedEntries[targetKey] ?? 0, expiresAt);
  }

  return normalizedEntries;
}

export function resolveUnlockedTargets(
  unlockedTargets?: Record<string, number> | null,
  legacyUnlockedApps?: Record<string, number> | null,
): Record<string, number> {
  const normalizedUnlockedTargets = normalizeUnlockedTargets(unlockedTargets);
  if (Object.keys(normalizedUnlockedTargets).length > 0) {
    return normalizedUnlockedTargets;
  }

  return normalizeUnlockedTargets(legacyUnlockedApps, 'app');
}
