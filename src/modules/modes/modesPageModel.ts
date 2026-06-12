import type { Dispatch, SetStateAction } from 'react';
import type { InstalledApp } from '@/plugins/ScreenTimePlugin';
import { getAppId, getAppLabel } from '@/services/screenTimeNormalization';
import type { NativeRuntimeIssueKey } from '@/store/useAppStore';
import { normalizeTargetValue, type TargetModeId } from '@/lib/targetModes';
import { parseUnlockedTargetKey } from '@/lib/unlockedTargets';
import type { ModeId } from '@/modules/modes/modeTypes';

export type NumericDraftConstraints = {
  min: number;
  max: number;
};

export const BREATHING_ROUNDS_CONSTRAINTS: NumericDraftConstraints = { min: 1, max: 12 };
export const BREATHING_INTERVAL_CONSTRAINTS: NumericDraftConstraints = { min: 5, max: 240 };
export const SESSION_CREDITS_CONSTRAINTS: NumericDraftConstraints = { min: 1, max: 20 };
export const UNLOCK_DURATION_CONSTRAINTS: NumericDraftConstraints = { min: 1, max: 120 };

export const NATIVE_RUNTIME_LABELS: Record<NativeRuntimeIssueKey, { de: string; en: string }> = {
  blockingService: { de: 'App-Blocking', en: 'App blocking' },
  websiteBlocking: { de: 'Website-Filter', en: 'Website filter' },
  searchTermSync: { de: 'Suchbegriff-Filter', en: 'Search term filter' },
  policySync: { de: 'Policy-Sync', en: 'Policy sync' },
};

export function getCommittedModeSelection(
  savedModeSelection: ModeId | null,
  activeModes: ReadonlyArray<ModeId | 'lock'>,
): ModeId {
  if (savedModeSelection) {
    return savedModeSelection;
  }

  const firstNonLockMode = activeModes.find((mode): mode is Exclude<ModeId, 'lock'> => mode !== 'lock');
  return firstNonLockMode ?? activeModes[0] ?? 'strict';
}

export function normalizeIntegerDraft(draft: string, constraints: NumericDraftConstraints) {
  const parsed = Number.parseInt(draft.trim(), 10);
  const fallback = constraints.min;

  if (!Number.isFinite(parsed)) return fallback;

  return Math.min(constraints.max, Math.max(constraints.min, Math.round(parsed)));
}

export function updateIntegerDraft(
  nextDraft: string,
  setDraft: Dispatch<SetStateAction<string>>,
  setValue: Dispatch<SetStateAction<number>>,
) {
  setDraft(nextDraft);

  const parsed = Number.parseInt(nextDraft.trim(), 10);
  if (Number.isFinite(parsed)) {
    setValue(parsed);
  }
}

export function commitIntegerDraft(
  draft: string,
  setDraft: Dispatch<SetStateAction<string>>,
  setValue: Dispatch<SetStateAction<number>>,
  constraints: NumericDraftConstraints,
) {
  const nextValue = normalizeIntegerDraft(draft, constraints);
  setValue(nextValue);
  setDraft(String(nextValue));
  return nextValue;
}

export type ActiveUnlockDisplayEntry = {
  targetId: string;
  targetType: 'app' | 'website' | 'search' | 'target';
  label: string;
  expiresAt: number;
  remainingMs: number;
};

export function buildActiveUnlockDisplayEntries(options: {
  unlockedTargets: Record<string, number>;
  installedApps: InstalledApp[];
  blockedApps: string[];
  blockedAppModes: Record<string, TargetModeId>;
  blockedWebsites: string[];
  blockedWebsiteModes: Record<string, TargetModeId>;
  blockedSearchTerms: string[];
  blockedSearchTermModes: Record<string, TargetModeId>;
  now: number;
}): ActiveUnlockDisplayEntry[] {
  const installedAppLabels = new Map(
    options.installedApps.map((app) => [normalizeTargetValue('app', getAppId(app)), getAppLabel(app)] as const),
  );

  return Object.entries(options.unlockedTargets)
    .filter((entry): entry is [string, number] => typeof entry[1] === 'number' && entry[1] > options.now)
    .map(([targetKey, expiresAt]) => {
      const parsedTarget = parseUnlockedTargetKey(targetKey);
      if (!parsedTarget) {
        return {
          targetId: targetKey,
          targetType: 'target' as const,
          label: targetKey,
          expiresAt,
          remainingMs: expiresAt - options.now,
        };
      }

      const { targetId, targetType } = parsedTarget;

      if (targetType === 'app') {
        return {
          targetId,
          targetType,
          label: installedAppLabels.get(targetId) ?? targetId,
          expiresAt,
          remainingMs: expiresAt - options.now,
        };
      }

      if (targetType === 'website') {
        return {
          targetId,
          targetType,
          label: targetId,
          expiresAt,
          remainingMs: expiresAt - options.now,
        };
      }

      if (targetType === 'search') {
        return {
          targetId,
          targetType,
          label: targetId,
          expiresAt,
          remainingMs: expiresAt - options.now,
        };
      }

      return {
        targetId,
        targetType: 'target' as const,
        label: targetId,
        expiresAt,
        remainingMs: expiresAt - options.now,
      };
    })
    .sort((left, right) => left.expiresAt - right.expiresAt);
}
