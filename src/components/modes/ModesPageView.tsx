import { lazy, Suspense } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import PageTransition from '@/components/PageTransition';
import { getModeSelectionClasses } from '@/lib/semanticTones';
import { getAppBadge } from '@/lib/view-models/modes';
import { BREATHING_PATTERNS } from '@/store/useAppStore';
import { ActiveUnlocksSection } from './ActiveUnlocksSection';
import {
  BlockingTargetsSection,
  LearnModeSection,
  ModeChooserSection,
  PenaltySetupSection,
  StrictProtectionSection,
} from './ModesSections';
import { ModesSavePanel } from './ModesSavePanel';
import { StrictConfirmDialogs } from './StrictConfirmDialogs';

const LearnDeckLibraryDialog = lazy(() => import('@/components/learn/LearnDeckLibraryDialog'));

type ModesPageViewProps = Record<string, any>;

export function ModesPageView(props: ModesPageViewProps) {
  const {
    activeModes,
    activeUnlocks,
    activateButtonDisabled,
    albyConnection,
    albyReady,
    appSearch,
    assignedToOtherModes,
    assignedToSelectedMode,
    availableApps,
    blockTab,
    blockTabs,
    commitBreathingRoundsDraft,
    commitIntervalDraft,
    commitSessionCreditsRequiredDraft,
    commitUnlockDurationMinutesDraft,
    confirmCode,
    confirmFeedbackVisible,
    confirmText,
    connectionStatusMessage,
    currentModeConfig,
    deckStats,
    disabledButtonReason,
    displayedAvailableApps,
    draftBlockedSearchTermModes,
    draftBlockedSearchTerms,
    draftBlockedWebsiteModes,
    draftBlockedWebsites,
    draftBlockSchedules,
    endTime,
    expandedApp,
    gateRule,
    handleActivate,
    handleAddSearchTerm,
    handleAddWebsite,
    handleAssignAppsToSelectedMode,
    handleBreathingRoundsDraftChange,
    handleClearAppsFromSelectedMode,
    handleConfirmStep2,
    handleIntervalDraftChange,
    handlePenaltyReadyConfirm,
    handleRemoveDraftBlockSchedule,
    handleRemoveSearchTerm,
    handleRemoveWebsite,
    handleSessionCreditsRequiredDraftChange,
    handleSetDraftBlockSchedule,
    handleToggleAppTarget,
    handleToggleSearchTarget,
    handleToggleWebsiteTarget,
    handleUnlockDurationMinutesDraftChange,
    isGerman,
    isSaving,
    learnLibraryOpen,
    localBreathingRoundsDraft,
    localIntervalDraft,
    localPatternId,
    localTypedAnswerEnabled,
    lockedAppIdsByMode,
    modeDefinitions,
    navigate,
    needsPenaltyActivation,
    newSearchTerm,
    newWebsite,
    penaltyAmountSats,
    penaltyReadyConfirmed,
    penaltySetupReady,
    pendingAssignmentHint,
    permissionWarningActive,
    permissionWarningText,
    recipientAddress,
    recipientName,
    recipientVerified,
    remainingAvailableCount,
    resolvedLearnDeck,
    retryRuntimeChecks,
    runtimeIssueMessages,
    satsFormatter,
    saveErrorMessage,
    savedModeSelection,
    selectedMode,
    selectedModeAssignedAppCount,
    selectedModeCount,
    selectedModeHasRequiredApp,
    selectedModePalette,
    selectedModeRequiresTargets,
    selectedModeStrictWindowEnd,
    selectedModeStrictWindowStart,
    sessionCreditsRequiredDraft,
    setAppSearch,
    setBlockTab,
    setConfirmText,
    setLearnLibraryOpen,
    setLocalActiveDeckId,
    setLocalPatternId,
    setLocalTypedAnswerEnabled,
    setNewSearchTerm,
    setNewWebsite,
    setSelectedMode,
    setSelectedModeStrictAddonEnabled,
    setSelectedModeStrictWindowEnd,
    setSelectedModeStrictWindowStart,
    setShowAllApps,
    setShowBlockConfig,
    setShowConfirmStep1,
    setShowConfirmStep2,
    setDeckReviewMix,
    setExpandedApp,
    shouldShowFullAppList,
    showBlockConfig,
    showConfirmStep1,
    showConfirmStep2,
    showSavedStateHint,
    startTime,
    strictAddonActiveForSelectedMode,
    strictAddonEnabledForSelectedMode,
    strictDurationHours,
    strictDurationTooLong,
    t,
    totalBlocked,
    unlockDurationMinutesDraft,
    warningPalette,
  } = props;

  const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
  const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };

  return (
    <PageTransition>
      <div className="app-page">
        <div className="page-header">
          <button onClick={() => navigate(-1)} className="rounded-full p-2 text-muted-foreground hover:text-foreground"><ArrowLeft size={22} /></button>
          <h1 className="page-header-title">{t('modes.page.title')}</h1>
          <div className="w-10" />
        </div>

        <motion.div variants={container} initial="hidden" animate="show">
          <ModeChooserSection modes={modeDefinitions} activeModes={activeModes} savedModeSelection={savedModeSelection} selectedMode={selectedMode} setSelectedMode={setSelectedMode} getModeSelectionClasses={getModeSelectionClasses} variants={item} />
          <PenaltySetupSection selectedMode={selectedMode} variants={item} albyReady={albyReady} recipientVerified={recipientVerified} walletLabel={albyConnection?.walletLabel} recipientName={recipientName} recipientAddress={recipientAddress} penaltyAmountLabel={penaltyAmountSats ? `${satsFormatter.format(penaltyAmountSats)} sats` : 'Noch nicht gesetzt'} connectionStatusLabel={connectionStatusMessage} penaltySetupReady={penaltySetupReady} penaltyReadyConfirmed={penaltyReadyConfirmed} confirmFeedbackVisible={confirmFeedbackVisible} strictAddonEnabled={strictAddonEnabledForSelectedMode} onStrictAddonChange={setSelectedModeStrictAddonEnabled} strictAddonLocked={strictAddonActiveForSelectedMode} strictDurationHours={strictDurationHours} strictDurationTooLong={strictDurationTooLong} assignedAppCount={selectedModeAssignedAppCount} startTime={selectedModeStrictWindowStart} setStartTime={setSelectedModeStrictWindowStart} endTime={selectedModeStrictWindowEnd} setEndTime={setSelectedModeStrictWindowEnd} onOpenWallet={() => navigate(penaltySetupReady ? '/wallet' : '/wallet?setup=penalty&return=/modes')} onConfirm={handlePenaltyReadyConfirm} />
          {currentModeConfig?.showBlockConfig ? <BlockingTargetsSection variants={item} selectedMode={selectedMode} showBlockConfig={showBlockConfig} setShowBlockConfig={setShowBlockConfig} totalBlocked={totalBlocked} totalAssignedToSelectedMode={selectedModeCount} blockedWebsites={draftBlockedWebsites} blockedWebsiteModes={draftBlockedWebsiteModes} blockedSearchTerms={draftBlockedSearchTerms} blockedSearchTermModes={draftBlockedSearchTermModes} blockTabs={blockTabs} blockTab={blockTab} setBlockTab={setBlockTab} appSearch={appSearch} setAppSearch={setAppSearch} availableApps={availableApps} displayedAvailableApps={displayedAvailableApps} assignedToSelectedMode={assignedToSelectedMode} assignedToOtherModes={assignedToOtherModes} remainingAvailableCount={remainingAvailableCount} expandedApp={expandedApp} setExpandedApp={setExpandedApp} blockSchedules={draftBlockSchedules} toggleBlockedApp={handleToggleAppTarget} setBlockedAppsMode={handleAssignAppsToSelectedMode} clearBlockedAppsMode={handleClearAppsFromSelectedMode} toggleBlockedWebsite={handleToggleWebsiteTarget} setBlockSchedule={handleSetDraftBlockSchedule} removeBlockSchedule={handleRemoveDraftBlockSchedule} getAppBadge={getAppBadge} shouldShowFullAppList={shouldShowFullAppList} setShowAllApps={setShowAllApps} newWebsite={newWebsite} setNewWebsite={setNewWebsite} handleAddWebsite={handleAddWebsite} removeBlockedWebsite={handleRemoveWebsite} newSearchTerm={newSearchTerm} setNewSearchTerm={setNewSearchTerm} handleAddSearchTerm={handleAddSearchTerm} toggleBlockedSearchTerm={handleToggleSearchTarget} removeBlockedSearchTerm={handleRemoveSearchTerm} assignmentsLocked={strictAddonActiveForSelectedMode} lockedAppIdsByMode={lockedAppIdsByMode} /> : null}
          <StrictProtectionSection selectedMode={selectedMode} strictAddonEnabled={strictAddonEnabledForSelectedMode} onStrictAddonChange={setSelectedModeStrictAddonEnabled} strictAddonLocked={strictAddonActiveForSelectedMode} assignedAppCount={selectedModeAssignedAppCount} variants={item} startTime={selectedModeStrictWindowStart} setStartTime={setSelectedModeStrictWindowStart} endTime={selectedModeStrictWindowEnd} setEndTime={setSelectedModeStrictWindowEnd} strictDurationHours={strictDurationHours} strictDurationTooLong={strictDurationTooLong} localPatternId={localPatternId} setLocalPatternId={setLocalPatternId} localBreathingRoundsDraft={localBreathingRoundsDraft} setLocalBreathingRoundsDraft={handleBreathingRoundsDraftChange} commitLocalBreathingRoundsDraft={commitBreathingRoundsDraft} localIntervalDraft={localIntervalDraft} setLocalIntervalDraft={handleIntervalDraftChange} commitLocalIntervalDraft={commitIntervalDraft} breathingPatterns={BREATHING_PATTERNS} />
          <LearnModeSection selectedMode={selectedMode} variants={item} resolvedLearnDeck={resolvedLearnDeck} onUseLatestDeck={() => { if (resolvedLearnDeck) setLocalActiveDeckId(resolvedLearnDeck.id); }} onOpenLibrary={() => setLearnLibraryOpen(true)} onOpenLearnHub={() => navigate('/learn')} onReviewMixChange={(reviewsBetweenNewCards) => { if (resolvedLearnDeck) setDeckReviewMix(resolvedLearnDeck.id, reviewsBetweenNewCards); }} gateRule={gateRule} strictAddonEnabled={strictAddonEnabledForSelectedMode} onStrictAddonChange={setSelectedModeStrictAddonEnabled} strictAddonLocked={strictAddonActiveForSelectedMode} strictDurationHours={strictDurationHours} strictDurationTooLong={strictDurationTooLong} assignedAppCount={selectedModeAssignedAppCount} startTime={selectedModeStrictWindowStart} setStartTime={setSelectedModeStrictWindowStart} endTime={selectedModeStrictWindowEnd} setEndTime={setSelectedModeStrictWindowEnd} sessionCreditsRequiredDraft={sessionCreditsRequiredDraft} setSessionCreditsRequiredDraft={handleSessionCreditsRequiredDraftChange} commitSessionCreditsRequiredDraft={commitSessionCreditsRequiredDraft} unlockDurationMinutesDraft={unlockDurationMinutesDraft} setUnlockDurationMinutesDraft={handleUnlockDurationMinutesDraftChange} commitUnlockDurationMinutesDraft={commitUnlockDurationMinutesDraft} typedAnswerEnabledDraft={localTypedAnswerEnabled} setTypedAnswerEnabledDraft={setLocalTypedAnswerEnabled} />

          <ActiveUnlocksSection activeUnlocks={activeUnlocks} isGerman={isGerman} variants={item} />

          {learnLibraryOpen ? (
            <Suspense fallback={null}>
              <LearnDeckLibraryDialog open={learnLibraryOpen} onOpenChange={setLearnLibraryOpen} decks={deckStats} activeDeckId={resolvedLearnDeck?.id} onSelectDeck={setLocalActiveDeckId} onReviewMixChange={setDeckReviewMix} onStartLearning={(reviewDeckId) => navigate(`/learn/review?deckId=${reviewDeckId}`)} title={t('modes.library.title')} description={t('modes.library.description')} />
            </Suspense>
          ) : null}

          <ModesSavePanel
            activateButtonDisabled={activateButtonDisabled}
            currentModeName={currentModeConfig?.name}
            disabledButtonReason={disabledButtonReason}
            handleActivate={handleActivate}
            isGerman={isGerman}
            isSaving={isSaving}
            needsPenaltyActivation={needsPenaltyActivation}
            pendingAssignmentHint={pendingAssignmentHint}
            permissionWarningActive={permissionWarningActive}
            permissionWarningText={permissionWarningText}
            retryRuntimeChecks={retryRuntimeChecks}
            runtimeIssueMessages={runtimeIssueMessages}
            saveErrorMessage={saveErrorMessage}
            selectedMode={selectedMode}
            selectedModePalette={selectedModePalette}
            selectedModeRequiresTargets={selectedModeRequiresTargets}
            selectedModeHasRequiredApp={selectedModeHasRequiredApp}
            showSavedStateHint={showSavedStateHint}
            t={t}
            warningPalette={warningPalette}
            navigateToPermissions={() => navigate('/settings#permissions')}
          />
        </motion.div>
      </div>

      <StrictConfirmDialogs
        showConfirmStep1={showConfirmStep1}
        showConfirmStep2={showConfirmStep2}
        startTime={startTime}
        endTime={endTime}
        confirmText={confirmText}
        confirmCode={confirmCode}
        setShowConfirmStep1={setShowConfirmStep1}
        setShowConfirmStep2={setShowConfirmStep2}
        setConfirmText={setConfirmText}
        onConfirmStep2={handleConfirmStep2}
        t={t}
      />
    </PageTransition>
  );
}
