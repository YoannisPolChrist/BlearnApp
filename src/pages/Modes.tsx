import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ModesPageView } from '@/components/modes/ModesPageView';
import { StrictLockedModeScreen } from '@/components/modes/StrictLockedModeScreen';
import { useAppTour } from '@/components/setup/appTourContext';
import { isStrictAddonModeId } from '@/lib/targetModes';
import { useInlineFeedback } from '@/hooks/useInlineFeedback';
import { useModesActivationState } from '@/modules/modes/useModesActivationState';
import { useModesAssignmentHandlers } from '@/modules/modes/useModesAssignmentHandlers';
import { useModesDraftControls, usePersistModesDraft } from '@/modules/modes/useModesDraftControls';
import { useModesPersistence } from '@/modules/modes/useModesPersistence';
import { useModesRuntime } from '@/modules/modes/useModesRuntime';
import { useModesSaveActions } from '@/modules/modes/useModesSaveActions';
import { useModesPageStoreState } from '@/modules/modes/useModesPageStoreState';
import { buildModeDefinitions, type BlockTabId } from '@/modules/modes/modesPageDefinitions';
import { useModesActiveUnlocks } from '@/modules/modes/useModesActiveUnlocks';
import { useModesComputedViewData } from '@/modules/modes/useModesComputedViewData';
import { useModesDebugLogger } from '@/modules/modes/useModesDebugLogger';
import { getCommittedModeSelection } from '@/modules/modes/modesPageModel';
import { useModesRuntimeIssueMessages } from '@/modules/modes/useModesRuntimeIssueMessages';
import { useModesInitialDraft } from '@/modules/modes/useModesInitialDraft';
import { useI18n } from '@/hooks/useI18n';
import { useModeDraftStore } from '@/store/useModeDraftStore';

export default function ModesPage() {
  const navigate = useNavigate();
  const { t, locale } = useI18n();
  const {
    accountabilityPartner, activeDeckId, activeModes, activateStrictAddon, activateStrictLock,
    albyConnection, albyConnectionTest, blockedAppModes, blockedApps, blockedSearchTermModes,
    blockedSearchTerms, blockedWebsiteModes, blockedWebsites, blockSchedules, breathingRounds,
    cards, decks, gateRule, getDueCardsForDecks, getStrictLockRemaining, getResolvedPresetForDeck,
    interventionInterval, interventionPatternId, isStrictLocked, nativeRuntimeIssues,
    penaltyAmountSats, penaltyEnabled, presets, reviewLogs, savedModeSelection, setBreathingRounds,
    setDeckReviewMix, setInterventionInterval, setInterventionPatternId, setPenaltyEnabled,
    setSavedModeSelection, setStrictAddonState, setStrictSchedule, strictAddons, strictEndTime,
    strictLockScope, strictStartTime, unlockedTargets,
  } = useModesPageStoreState();
  const modeDefinitions = useMemo(() => buildModeDefinitions(t), [t]);
  const storedDraft = useModeDraftStore((state) => state.snapshot);
  const committedModeSelection = getCommittedModeSelection(savedModeSelection, activeModes);
  const initialDraft = useModesInitialDraft({
    activeDeckId,
    blockSchedules,
    blockedAppModes,
    blockedApps,
    blockedSearchTermModes,
    blockedSearchTerms,
    blockedWebsiteModes,
    blockedWebsites,
    breathingRounds,
    committedModeSelection,
    gateRule,
    interventionInterval,
    interventionPatternId,
    strictAddons,
    strictEndTime,
    strictStartTime,
    storedDraft,
  });

  const locked = isStrictLocked();
  const [remaining, setRemaining] = useState(getStrictLockRemaining());
  const {
    draftBlockingState, draftBlockedApps, draftBlockedAppModes, draftBlockedWebsites,
    draftBlockedWebsiteModes, draftBlockedSearchTerms, draftBlockedSearchTermModes, draftBlockSchedules,
    replaceDraftBlockingState, applyBlockingDraftMutation, blockingDraftRef, commitBreathingRoundsDraft,
    commitIntervalDraft, commitSessionCreditsRequiredDraft, commitUnlockDurationMinutesDraft, endTime,
    handleBreathingRoundsDraftChange, handleIntervalDraftChange, handleSelectedModeStrictAddonChange,
    handleSessionCreditsRequiredDraftChange, handleStrictWindowEndChange, handleStrictWindowStartChange,
    handleUnlockDurationMinutesDraftChange, localActiveDeckId, localBreathingRounds,
    localBreathingRoundsDraft, localInterval, localIntervalDraft, localPatternId,
    localSessionCreditsRequired, localStrictAddons, localTypedAnswerEnabled, localUnlockDurationMinutes,
    penaltyReadyConfirmed, selectedMode, selectedModeStrictWindowEnd, selectedModeStrictWindowStart,
    sessionCreditsRequiredDraft, setLocalActiveDeckId, setLocalPatternId, setLocalTypedAnswerEnabled,
    setPenaltyReadyConfirmed, setSelectedMode, startTime, unlockDurationMinutesDraft,
  } = useModesDraftControls({
    activeDeckId,
    gateRule,
    initialDraft,
    strictAddons,
    storedDraft,
  });
  const [showBlockConfig, setShowBlockConfig] = useState(true);
  const [blockTab, setBlockTab] = useState<BlockTabId>('apps');
  const [newWebsite, setNewWebsite] = useState('');
  const [newSearchTerm, setNewSearchTerm] = useState('');
  const [expandedApp, setExpandedApp] = useState<string | null>(null);
  const [appSearch, setAppSearch] = useState('');
  const [showAllApps, setShowAllApps] = useState(false);
  const [learnLibraryOpen, setLearnLibraryOpen] = useState(false);
  const [showConfirmStep1, setShowConfirmStep1] = useState(false);
  const [showConfirmStep2, setShowConfirmStep2] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const { isOpen: isTourOpen, currentStepId } = useAppTour();
  const penaltyConfirmFeedback = useInlineFeedback<'confirmed'>();
  const [isSaving, setIsSaving] = useState(false);
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);
  const isGerman = locale.toLowerCase().startsWith('de');
  const confirmCode = useMemo(() => t('modes.confirm.finalCode').toUpperCase(), [t]);
  const {
    installedApps,
    usage,
    permissionErrorMessage,
    runtimeStatusMessage,
    permissionStatus,
    retryRuntimeChecks,
  } = useModesRuntime({ isGerman });
  const deferredAppSearch = useDeferredValue(appSearch);
  const runtimeIssueMessages = useModesRuntimeIssueMessages({
    isGerman,
    nativeRuntimeIssues,
    permissionErrorMessage,
    runtimeStatusMessage,
  });

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  useEffect(() => {
    if (!isTourOpen || currentStepId !== 'modes-blocking') return;
    setShowBlockConfig(true);
  }, [currentStepId, isTourOpen]);

  useEffect(() => {
    if (!locked) return;
    const timer = window.setInterval(() => setRemaining(getStrictLockRemaining()), 1000);
    return () => window.clearInterval(timer);
  }, [getStrictLockRemaining, locked]);

  const activeUnlocks = useModesActiveUnlocks({
    blockedApps,
    blockedAppModes,
    blockedSearchTerms,
    blockedSearchTermModes,
    blockedWebsites,
    blockedWebsiteModes,
    installedApps,
    unlockedTargets,
  });

  useEffect(() => setShowAllApps(false), [deferredAppSearch]);

  const {
    availableApps,
    displayedAvailableApps,
    assignedToOtherModes,
    assignedToSelectedMode,
    albyReady,
    blockTabs,
    connectionStatusMessage,
    connectionTestPassed,
    currentModeConfig,
    deckStats,
    editableMode,
    lockedAppIdsByMode,
    normalizedBreathingRounds,
    normalizedInterval,
    normalizedSessionCreditsRequired,
    normalizedUnlockDurationMinutes,
    penaltySetupReady,
    persistedBlockingState,
    recipientAddress,
    recipientName,
    recipientVerified,
    remainingAvailableCount,
    resolvedLearnDeck,
    satsFormatter,
    selectedModePalette,
    shouldShowFullAppList,
    strictPalette,
    warningPalette,
  } = useModesComputedViewData({
    accountabilityPartner,
    activeDeckId,
    albyConnection,
    albyConnectionTestStatus: albyConnectionTest.status,
    blockSchedules,
    blockedAppModes,
    blockedApps,
    blockedSearchTermModes,
    blockedSearchTerms,
    blockedWebsiteModes,
    blockedWebsites,
    breathingRounds,
    cards,
    decks,
    deferredAppSearch,
    draftBlockedAppModes,
    draftBlockedApps,
    draftBlockedSearchTerms,
    draftBlockedWebsites,
    gateRule,
    getDueCardsForDecks,
    getResolvedPresetForDeck,
    installedApps,
    interventionInterval,
    interventionPatternId,
    localActiveDeckId,
    localBreathingRoundsDraft,
    localIntervalDraft,
    localPatternId,
    localStrictAddons,
    locale,
    modeDefinitions,
    penaltyAmountSats,
    presets,
    reviewLogs,
    selectedMode,
    sessionCreditsRequiredDraft,
    showAllApps,
    strictAddons,
    strictEndTime,
    strictStartTime,
    t,
    unlockDurationMinutesDraft,
    usage,
  });
  const {
    totalBlocked,
    selectedModeCount,
    selectedModeAssignedAppCount,
    penaltyTargetsCount,
    strictDurationHours,
    strictDurationTooLong,
    strictAddonEnabledForSelectedMode,
    strictAddonActiveForSelectedMode,
    selectedModeUsesStrictWindow: selectedModeUsesStrictWindowState,
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
  } = useModesActivationState({
    isGerman,
    selectedMode,
    committedModeSelection,
    activeModes,
    currentModeName: currentModeConfig?.name,
    persistedStrictAddons: strictAddons,
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
    gateSessionCreditsRequired: gateRule.sessionCreditsRequired,
    normalizedUnlockDurationMinutes,
    gateUnlockDurationMinutes: gateRule.unlockDurationMinutes,
    localTypedAnswerEnabled,
    gateTypedAnswerEnabled: gateRule.typedAnswerEnabled,
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
  });
  const selectedModeUsesStrictWindow = selectedModeUsesStrictWindowState;
  const logModesDebug = useModesDebugLogger({
    committedModeSelection,
    hasAssignmentChanges,
    hasChanges,
    hasGlobalChanges,
    hasLearnGateChanges,
    hasModeSelectionChange,
    hasRequiredPermissions,
    isSaving,
    needsPenaltyActivation,
    penaltyReadyConfirmed,
    penaltySetupReady,
    selectedMode,
    selectedModeAssignedAppCount,
    selectedModeCount,
    selectedModeHasRequiredApp,
    selectedModeNeedsAssignedApp,
    strictDurationTooLong,
  });
  const handleActivateStrictAddon = useCallback(() => {
    if (!isStrictAddonModeId(selectedMode)) return;

    const lockedAppIds = draftBlockedApps.filter((appId) => draftBlockedAppModes[appId] === selectedMode);
    activateStrictAddon(selectedMode, lockedAppIds);
  }, [activateStrictAddon, draftBlockedAppModes, draftBlockedApps, selectedMode]);
  const setSelectedModeStrictAddonEnabled = useCallback(
    (enabled: boolean) => handleSelectedModeStrictAddonChange(enabled, strictAddonActiveForSelectedMode),
    [handleSelectedModeStrictAddonChange, strictAddonActiveForSelectedMode],
  );
  const setSelectedModeStrictWindowStart = useCallback(
    (value: string) => handleStrictWindowStartChange(value, strictAddonActiveForSelectedMode),
    [handleStrictWindowStartChange, strictAddonActiveForSelectedMode],
  );
  const setSelectedModeStrictWindowEnd = useCallback(
    (value: string) => handleStrictWindowEndChange(value, strictAddonActiveForSelectedMode),
    [handleStrictWindowEndChange, strictAddonActiveForSelectedMode],
  );
  const clearDraftSnapshot = usePersistModesDraft({
    blocking: draftBlockingState,
    endTime,
    hasChanges,
    localActiveDeckId,
    localBreathingRounds,
    localInterval,
    localPatternId,
    localSessionCreditsRequired,
    localStrictAddons,
    localTypedAnswerEnabled,
    localUnlockDurationMinutes,
    penaltyReadyConfirmed,
    selectedMode,
    startTime,
  });

  useEffect(() => {
    if (hasAssignmentChanges) return;
    replaceDraftBlockingState({
      blockedApps,
      blockedAppModes,
      blockedWebsites,
      blockedWebsiteModes,
      blockedSearchTerms,
      blockedSearchTermModes,
      blockSchedules,
    });
  }, [blockSchedules, blockedAppModes, blockedApps, blockedSearchTermModes, blockedSearchTerms, blockedWebsiteModes, blockedWebsites, hasAssignmentChanges, replaceDraftBlockingState]);

  useEffect(() => setPenaltyReadyConfirmed(false), [albyReady, accountabilityPartner?.lightningAddress, accountabilityPartner?.name, connectionTestPassed, penaltyAmountSats, penaltyTargetsCount]);

  const { persistModeChanges } = useModesPersistence({
    blockingDraftRef,
    localActiveDeckId,
    setLocalActiveDeckId,
    blockedApps,
    blockedWebsites,
    blockedSearchTerms,
    commitBreathingRoundsDraft,
    commitIntervalDraft,
    commitSessionCreditsRequiredDraft,
    commitUnlockDurationMinutesDraft,
    localTypedAnswerEnabled,
    selectedMode,
    localStrictAddons,
    setSavedModeSelection,
    setStrictAddonState,
    startTime,
    endTime,
    setStrictSchedule,
    setBreathingRounds,
    setInterventionInterval,
    localPatternId,
    setInterventionPatternId,
  });

  const {
    handleToggleAppTarget,
    handleAssignAppsToSelectedMode,
    handleClearAppsFromSelectedMode,
    handleToggleWebsiteTarget,
    handleToggleSearchTarget,
    handleAddWebsite,
    handleAddSearchTerm,
    handleRemoveWebsite,
    handleRemoveSearchTerm,
    handleSetDraftBlockSchedule,
    handleRemoveDraftBlockSchedule,
  } = useModesAssignmentHandlers({
    isGerman,
    editableMode,
    selectedMode,
    draftBlockedAppModes,
    draftBlockedWebsiteModes,
    draftBlockedSearchTermModes,
    selectedModeAssignedAppCount,
    assignmentsLocked: strictAddonActiveForSelectedMode,
    lockedAppIdsByMode,
    applyBlockingDraftMutation,
    setExpandedApp,
    newWebsite,
    setNewWebsite,
    newSearchTerm,
    setNewSearchTerm,
  });

  const handlePenaltyReadyConfirm = () => {
    setPenaltyReadyConfirmed(true);
    penaltyConfirmFeedback.trigger('confirmed');
  };
  const { handleActivate, handleConfirmStep2 } = useModesSaveActions({
    isGerman,
    selectedMode,
    strictDurationTooLong,
    selectedModeUsesStrictWindow,
    strictAddonEnabledForSelectedMode,
    hasRequiredPermissions,
    selectedModeNeedsAssignedApp,
    selectedModeHasRequiredApp,
    needsPenaltyActivation,
    penaltySetupReady,
    penaltyReadyConfirmed,
    hasChanges,
    confirmText,
    confirmCode,
    setShowConfirmStep1,
    setShowConfirmStep2,
    setConfirmText,
    setIsSaving,
    setSaveErrorMessage,
    clearDraftSnapshot,
    persistModeChanges,
    activateStrictLock,
    activateStrictAddon: handleActivateStrictAddon,
    enablePenaltyMode: () => setPenaltyEnabled(true),
    logModesDebug,
    missingPermissionsMessage: t('modes.toasts.missingPermissions'),
  });

  if (locked) {
    return (
      <StrictLockedModeScreen
        remaining={remaining}
        strictLockScope={strictLockScope}
        iconClassName={strictPalette.icon}
        textClassName={strictPalette.text}
        t={t}
      />
    );
  }

  return <ModesPageView {...{
    activeModes, activeUnlocks, activateButtonDisabled, albyConnection, albyReady, appSearch,
    assignedToOtherModes, assignedToSelectedMode, availableApps, blockTab, blockTabs,
    commitBreathingRoundsDraft, commitIntervalDraft, commitSessionCreditsRequiredDraft,
    commitUnlockDurationMinutesDraft, confirmCode, confirmFeedbackVisible: penaltyConfirmFeedback.active,
    confirmText, connectionStatusMessage, currentModeConfig, deckStats, disabledButtonReason,
    displayedAvailableApps, draftBlockedSearchTermModes, draftBlockedSearchTerms,
    draftBlockedWebsiteModes, draftBlockedWebsites, draftBlockSchedules, endTime, expandedApp,
    gateRule, handleActivate, handleAddSearchTerm, handleAddWebsite, handleAssignAppsToSelectedMode,
    handleBreathingRoundsDraftChange, handleClearAppsFromSelectedMode, handleConfirmStep2,
    handleIntervalDraftChange, handlePenaltyReadyConfirm, handleRemoveDraftBlockSchedule,
    handleRemoveSearchTerm, handleRemoveWebsite, handleSessionCreditsRequiredDraftChange,
    handleSetDraftBlockSchedule, handleToggleAppTarget, handleToggleSearchTarget,
    handleToggleWebsiteTarget, handleUnlockDurationMinutesDraftChange, isGerman, isSaving,
    learnLibraryOpen, localBreathingRoundsDraft, localIntervalDraft, localPatternId,
    localTypedAnswerEnabled, lockedAppIdsByMode, modeDefinitions, navigate, needsPenaltyActivation,
    newSearchTerm, newWebsite, penaltyAmountSats, penaltyReadyConfirmed, penaltySetupReady,
    pendingAssignmentHint, permissionWarningActive, permissionWarningText, recipientAddress,
    recipientName, recipientVerified, remainingAvailableCount, resolvedLearnDeck, retryRuntimeChecks,
    runtimeIssueMessages, satsFormatter, saveErrorMessage, savedModeSelection, selectedMode,
    selectedModeAssignedAppCount, selectedModeCount, selectedModeHasRequiredApp, selectedModePalette,
    selectedModeRequiresTargets, selectedModeStrictWindowEnd, selectedModeStrictWindowStart,
    sessionCreditsRequiredDraft, setAppSearch, setBlockTab, setConfirmText, setDeckReviewMix,
    setExpandedApp, setLearnLibraryOpen, setLocalActiveDeckId, setLocalPatternId,
    setLocalTypedAnswerEnabled, setNewSearchTerm, setNewWebsite, setSelectedMode,
    setSelectedModeStrictAddonEnabled, setSelectedModeStrictWindowEnd,
    setSelectedModeStrictWindowStart, setShowAllApps, setShowBlockConfig, setShowConfirmStep1,
    setShowConfirmStep2, shouldShowFullAppList, showBlockConfig, showConfirmStep1,
    showConfirmStep2, showSavedStateHint, startTime, strictAddonActiveForSelectedMode,
    strictAddonEnabledForSelectedMode, strictDurationHours, strictDurationTooLong, t,
    totalBlocked, unlockDurationMinutesDraft, warningPalette,
  }} />;
}
