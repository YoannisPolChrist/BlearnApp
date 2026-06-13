import { useMemo } from 'react';
import {
  countTargetsForMode,
  isStrictAddonActive,
  isStrictAddonModeId,
  type StrictAddonMap,
} from '@/lib/targetModes';
import { getScheduleDurationHours } from '@/lib/view-models/modes';
import { haveBlockingDraftChanges, type DraftBlockingState } from '@/modules/modes/draftBlocking';
import type { ModeId } from '@/modules/modes/modeTypes';

export { MAX_STRICT_LOCK_DURATION_HOURS } from '@/lib/strictLockLimits';
import { MAX_STRICT_LOCK_DURATION_HOURS } from '@/lib/strictLockLimits';

type PermissionStatus = {
  usageStats: boolean;
  overlay: boolean;
  accessibility: boolean;
  vpnPermission: boolean;
  websiteBlockingAvailable: boolean;
};

type TranslationFn = (key: string, values?: Record<string, unknown>) => string;

type UseModesActivationStateOptions = {
  isGerman: boolean;
  selectedMode: ModeId;
  committedModeSelection: ModeId;
  /** Tatsächlich aktive Modi aus dem Store — Quelle für die Reaktivierungs-Erkennung. */
  activeModes?: ReadonlyArray<ModeId | 'lock'>;
  currentModeName?: string;
  persistedStrictAddons: StrictAddonMap;
  localStrictAddons: StrictAddonMap;
  startTime: string;
  endTime: string;
  strictStartTime: string;
  strictEndTime: string;
  normalizedBreathingRounds: number;
  breathingRounds: number;
  normalizedInterval: number;
  interventionInterval: number;
  localPatternId: string;
  interventionPatternId: string;
  localActiveDeckId: string | null;
  activeDeckId: string | null;
  normalizedSessionCreditsRequired: number;
  gateSessionCreditsRequired: number;
  normalizedUnlockDurationMinutes: number;
  gateUnlockDurationMinutes: number;
  localTypedAnswerEnabled: boolean;
  gateTypedAnswerEnabled: boolean;
  persistedBlockingState: DraftBlockingState;
  draftBlockingState: DraftBlockingState;
  draftBlockedApps: string[];
  draftBlockedAppModes: DraftBlockingState['blockedAppModes'];
  draftBlockedWebsites: string[];
  draftBlockedWebsiteModes: DraftBlockingState['blockedWebsiteModes'];
  draftBlockedSearchTerms: string[];
  draftBlockedSearchTermModes: DraftBlockingState['blockedSearchTermModes'];
  penaltyEnabled: boolean;
  permissionStatus: PermissionStatus;
  penaltySetupReady: boolean;
  penaltyReadyConfirmed: boolean;
  isSaving: boolean;
  saveErrorMessage: string | null;
  t: TranslationFn;
};

function getStrictAddonSchedule(selectedMode: ModeId, strictAddons: StrictAddonMap) {
  if (!isStrictAddonModeId(selectedMode)) {
    return null;
  }

  return strictAddons[selectedMode];
}

export function useModesActivationState({
  isGerman,
  selectedMode,
  committedModeSelection,
  activeModes,
  currentModeName,
  persistedStrictAddons,
  localStrictAddons,
  startTime,
  endTime,
  strictStartTime,
  strictEndTime,
  normalizedBreathingRounds,
  breathingRounds,
  normalizedInterval,
  interventionInterval,
  localPatternId,
  interventionPatternId,
  localActiveDeckId,
  activeDeckId,
  normalizedSessionCreditsRequired,
  gateSessionCreditsRequired,
  normalizedUnlockDurationMinutes,
  gateUnlockDurationMinutes,
  localTypedAnswerEnabled,
  gateTypedAnswerEnabled,
  persistedBlockingState,
  draftBlockingState,
  draftBlockedApps,
  draftBlockedAppModes,
  draftBlockedWebsites,
  draftBlockedWebsiteModes,
  draftBlockedSearchTerms,
  draftBlockedSearchTermModes,
  penaltyEnabled,
  permissionStatus,
  penaltySetupReady,
  penaltyReadyConfirmed,
  isSaving,
  saveErrorMessage,
  t,
}: UseModesActivationStateOptions) {
  const totalBlocked = draftBlockedApps.length + draftBlockedWebsites.length + draftBlockedSearchTerms.length;
  const selectedModeCount =
    selectedMode === 'strict' || selectedMode === 'learn' || selectedMode === 'penalty'
      ? countTargetsForMode(
          {
            blockedAppModes: draftBlockedAppModes,
            blockedWebsiteModes: draftBlockedWebsiteModes,
            blockedSearchTermModes: draftBlockedSearchTermModes,
          },
          selectedMode,
        )
      : 0;
  const selectedModeAssignedAppCount =
    selectedMode === 'strict' || selectedMode === 'learn' || selectedMode === 'penalty'
      ? draftBlockedApps.filter((appId) => draftBlockedAppModes[appId] === selectedMode).length
      : 0;
  const penaltyTargetsCount = countTargetsForMode(
    {
      blockedAppModes: draftBlockedAppModes,
      blockedWebsiteModes: draftBlockedWebsiteModes,
      blockedSearchTermModes: draftBlockedSearchTermModes,
    },
    'penalty',
  );
  const addonSchedule = getStrictAddonSchedule(selectedMode, localStrictAddons);
  const strictWindowStart = selectedMode === 'lock'
    ? startTime
    : addonSchedule?.startTime ?? startTime;
  const strictWindowEnd = selectedMode === 'lock'
    ? endTime
    : addonSchedule?.endTime ?? endTime;
  const strictDurationHours = getScheduleDurationHours(strictWindowStart, strictWindowEnd);
  const strictDurationTooLong = strictDurationHours > MAX_STRICT_LOCK_DURATION_HOURS;
  const strictAddonEnabledForSelectedMode = Boolean(
    addonSchedule?.enabled,
  );
  const selectedModeUsesStrictWindow =
    selectedMode === 'lock' || (isStrictAddonModeId(selectedMode) && strictAddonEnabledForSelectedMode);
  const strictAddonActiveForSelectedMode = isStrictAddonModeId(selectedMode)
    ? isStrictAddonActive(persistedStrictAddons[selectedMode])
    : false;
  const hasGlobalChanges =
    JSON.stringify(localStrictAddons) !== JSON.stringify(persistedStrictAddons)
    || startTime !== strictStartTime
    || endTime !== strictEndTime
    || normalizedBreathingRounds !== breathingRounds
    || normalizedInterval !== interventionInterval
    || localPatternId !== interventionPatternId;
  const hasLearnGateChanges =
    localActiveDeckId !== activeDeckId
    || normalizedSessionCreditsRequired !== gateSessionCreditsRequired
    || normalizedUnlockDurationMinutes !== gateUnlockDurationMinutes
    || localTypedAnswerEnabled !== gateTypedAnswerEnabled;
  const hasAssignmentChanges = useMemo(
    () => haveBlockingDraftChanges(persistedBlockingState, draftBlockingState),
    [draftBlockingState, persistedBlockingState],
  );
  const hasModeSelectionChange = selectedMode !== 'lock' && selectedMode !== committedModeSelection;
  const needsPenaltyActivation = selectedMode === 'penalty' && penaltyTargetsCount > 0 && !penaltyEnabled;
  // Project-Memory-Bug "Einstellungen bereits aktiv": eine gespeicherte, aber
  // nicht (mehr) aktive Auswahl muss reaktivierbar sein — sie zählt als Änderung.
  const needsReactivation =
    activeModes !== undefined
    && selectedMode !== 'lock'
    && selectedMode !== 'normal'
    && selectedMode === committedModeSelection
    && !activeModes.includes(selectedMode);
  const hasChanges =
    hasModeSelectionChange
    || needsReactivation
    || hasGlobalChanges
    || hasLearnGateChanges
    || hasAssignmentChanges
    || needsPenaltyActivation;
  const selectedModeRequiresTargets =
    selectedMode === 'strict' || strictAddonEnabledForSelectedMode;
  const selectedModeNeedsAssignedApp = selectedModeRequiresTargets;
  const selectedModeHasRequiredApp = !selectedModeRequiresTargets || selectedModeAssignedAppCount > 0;
  const pendingAssignmentHint = isGerman
    ? `${currentModeName || 'Dieser Modus'} braucht mindestens eine App in dieser Liste. Websites oder Suchbegriffe allein reichen nicht.`
    : `${currentModeName || 'This mode'} requires at least one app in this list. Websites or search terms alone are not enough.`;
  const websiteBlockingRequired = permissionStatus.websiteBlockingAvailable && draftBlockedWebsites.length > 0;
  const hasRequiredPermissions =
    permissionStatus.usageStats
    && permissionStatus.overlay
    && permissionStatus.accessibility
    && (!websiteBlockingRequired || permissionStatus.vpnPermission);
  const missingPermissionLabels = useMemo(() => {
    const labels: string[] = [];
    if (!permissionStatus.usageStats) labels.push(t('modes.permissions.usage'));
    if (!permissionStatus.overlay) labels.push(t('modes.permissions.overlay'));
    if (!permissionStatus.accessibility) labels.push(t('modes.permissions.accessibility'));
    if (websiteBlockingRequired && !permissionStatus.vpnPermission) labels.push(t('modes.permissions.vpn'));
    return labels;
  }, [
    permissionStatus.accessibility,
    permissionStatus.overlay,
    permissionStatus.usageStats,
    permissionStatus.vpnPermission,
    t,
    websiteBlockingRequired,
  ]);
  const permissionWarningActive = missingPermissionLabels.length > 0;
  const permissionWarningText = missingPermissionLabels.join(', ');
  const activateButtonDisabled =
    selectedMode === 'lock'
      ? isSaving || strictDurationTooLong || !hasRequiredPermissions
      : isSaving
          || !hasRequiredPermissions
          || !hasChanges
    || (selectedModeUsesStrictWindow && strictDurationTooLong)
    || (selectedModeNeedsAssignedApp && !selectedModeHasRequiredApp)
    || (strictAddonEnabledForSelectedMode && selectedModeAssignedAppCount === 0)
    || (needsPenaltyActivation && (!penaltySetupReady || !penaltyReadyConfirmed));
  const disabledButtonReason = useMemo(() => {
    if (!activateButtonDisabled || isSaving) {
      return null;
    }

    if (!hasRequiredPermissions) {
      return t('modes.warnings.description', {
        missing: permissionWarningText || t('modes.permissions.usage'),
      });
    }

    if (selectedModeUsesStrictWindow && strictDurationTooLong) {
      return t('modes.strict.durationTooLong');
    }

    if (selectedModeNeedsAssignedApp && !selectedModeHasRequiredApp) {
      return pendingAssignmentHint;
    }

    if (strictAddonEnabledForSelectedMode && selectedModeAssignedAppCount === 0) {
      return pendingAssignmentHint;
    }

    if (needsPenaltyActivation) {
      if (!penaltySetupReady) {
        return t('modes.penalty.description');
      }

      if (!penaltyReadyConfirmed) {
        return t('modes.penalty.confirm');
      }
    }

    return null;
  }, [
    activateButtonDisabled,
    hasRequiredPermissions,
    isSaving,
    needsPenaltyActivation,
    pendingAssignmentHint,
    penaltyReadyConfirmed,
    penaltySetupReady,
    permissionWarningText,
    selectedModeAssignedAppCount,
    selectedModeHasRequiredApp,
    selectedModeNeedsAssignedApp,
    selectedModeUsesStrictWindow,
    strictAddonEnabledForSelectedMode,
    strictDurationTooLong,
    t,
  ]);
  const showSavedStateHint =
    !isSaving
    && !saveErrorMessage
    && hasRequiredPermissions
    && !hasChanges
    && !(selectedModeUsesStrictWindow && strictDurationTooLong)
    && !(selectedModeNeedsAssignedApp && !selectedModeHasRequiredApp)
    && !(strictAddonEnabledForSelectedMode && selectedModeAssignedAppCount === 0)
    && !(needsPenaltyActivation && (!penaltySetupReady || !penaltyReadyConfirmed));

  return {
    totalBlocked,
    selectedModeCount,
    selectedModeAssignedAppCount,
    penaltyTargetsCount,
    strictDurationHours,
    strictDurationTooLong,
    strictAddonEnabledForSelectedMode,
    strictAddonActiveForSelectedMode,
    selectedModeUsesStrictWindow,
    hasGlobalChanges,
    hasLearnGateChanges,
    hasAssignmentChanges,
    hasModeSelectionChange,
    hasChanges,
    needsPenaltyActivation,
    selectedModeRequiresTargets,
    selectedModeNeedsAssignedApp,
    selectedModeHasRequiredApp,
    pendingAssignmentHint,
    hasRequiredPermissions,
    permissionWarningActive,
    permissionWarningText,
    activateButtonDisabled,
    disabledButtonReason,
    showSavedStateHint,
  };
}
