import { useShallow } from 'zustand/react/shallow';
import { DEFAULT_APP_LANGUAGE } from '@/lib/languages';
import { defaultNotificationPreferences, defaultProfile } from '@/store/appStore.shared';
import { useLearningStore } from '@/store/useLearningStore';
import { useAppStore, type AppLanguage } from '@/store/useAppStore';

const EMPTY_APP_LANGUAGE_PACKS: AppLanguage[] = [];
const EMPTY_STRING_LIST: string[] = [];

export function useLockState() {
  return useAppStore(
    useShallow((state) => ({
      isStrictLocked: state.isStrictLocked,
      getStrictLockRemaining: state.getStrictLockRemaining,
      strictLockScope: state.strictLockScope,
      strictAddons: state.strictAddons,
    })),
  );
}

export function useModeSettings() {
  return useAppStore(
    useShallow((state) => ({
      activeMode: state.activeMode,
      activeModes: state.activeModes,
      savedModeSelection: state.savedModeSelection,
      strictAddons: state.strictAddons,
      strictStartTime: state.strictStartTime,
      strictEndTime: state.strictEndTime,
      breathingRounds: state.breathingRounds,
      interventionInterval: state.interventionInterval,
      interventionPatternId: state.interventionPatternId,
      modeProtection: state.modeProtection,
      penaltyEnabled: state.penaltyEnabled,
      strictLockScope: state.strictLockScope,
      isStrictLocked: state.isStrictLocked,
      getStrictLockRemaining: state.getStrictLockRemaining,
    })),
  );
}

export function useModeActions() {
  return useAppStore(
    useShallow((state) => ({
      setSavedModeSelection: state.setSavedModeSelection,
      setStrictAddonState: state.setStrictAddonState,
      setStrictAddonConfig: state.setStrictAddonConfig,
      setStrictSchedule: state.setStrictSchedule,
      setBreathingRounds: state.setBreathingRounds,
      setInterventionInterval: state.setInterventionInterval,
      setInterventionPatternId: state.setInterventionPatternId,
      setModeProtection: state.setModeProtection,
      activateStrictLock: state.activateStrictLock,
      activateStrictAddon: state.activateStrictAddon,
      forceReleaseLock: state.forceReleaseLock,
      setPenaltyEnabled: state.setPenaltyEnabled,
    })),
  );
}

export function useBlockingTargets() {
  return useAppStore(
    useShallow((state) => ({
      blockedApps: state.blockedApps,
      blockedAppModes: state.blockedAppModes,
      blockedWebsites: state.blockedWebsites,
      blockedWebsiteModes: state.blockedWebsiteModes,
      blockedSearchTerms: state.blockedSearchTerms,
      blockedSearchTermModes: state.blockedSearchTermModes,
      blockSchedules: state.blockSchedules,
      getTargetMode: state.getTargetMode,
    })),
  );
}

export function useBlockingCounts() {
  return useAppStore(
    useShallow((state) => ({
      blockedAppsCount: Array.isArray(state.blockedApps) ? state.blockedApps.length : 0,
      blockedWebsitesCount: Array.isArray(state.blockedWebsites) ? state.blockedWebsites.length : 0,
      blockedSearchTermsCount: Array.isArray(state.blockedSearchTerms) ? state.blockedSearchTerms.length : 0,
    })),
  );
}

export function useBlockingActions() {
  return useAppStore(
    useShallow((state) => ({
      toggleBlockedApp: state.toggleBlockedApp,
      setBlockedAppsMode: state.setBlockedAppsMode,
      replaceBlockingState: state.replaceBlockingState,
      toggleBlockedWebsite: state.toggleBlockedWebsite,
      addBlockedWebsite: state.addBlockedWebsite,
      removeBlockedWebsite: state.removeBlockedWebsite,
      toggleBlockedSearchTerm: state.toggleBlockedSearchTerm,
      addBlockedSearchTerm: state.addBlockedSearchTerm,
      removeBlockedSearchTerm: state.removeBlockedSearchTerm,
      setBlockSchedule: state.setBlockSchedule,
      removeBlockSchedule: state.removeBlockSchedule,
    })),
  );
}

export function usePenaltyStatus() {
  return useAppStore(
    useShallow((state) => ({
      penaltyAmountSats: state.penaltyAmountSats,
      penaltyEnabled: state.penaltyEnabled,
      accountabilityPartner: state.accountabilityPartner,
      albyConnection: state.albyConnection,
      albyConnectionTest: state.albyConnectionTest,
      getTotalPenalties: state.getTotalPenalties,
      getWeeklyPenalties: state.getWeeklyPenalties,
    })),
  );
}

export function usePenaltyActions() {
  return useAppStore(
    useShallow((state) => ({
      deductPenalty: state.deductPenalty,
      testAlbyConnection: state.testAlbyConnection,
    })),
  );
}

export function usePreferenceSettings() {
  return useAppStore(
    useShallow((state) => ({
      appLanguage: state.appLanguage ?? DEFAULT_APP_LANGUAGE,
      installedAppLanguagePacks: Array.isArray(state.installedAppLanguagePacks)
        ? state.installedAppLanguagePacks
        : EMPTY_APP_LANGUAGE_PACKS,
      notificationsEnabled: state.notificationsEnabled ?? false,
      notificationPreferences: state.notificationPreferences ?? defaultNotificationPreferences,
      notificationPermissionPromptSeen: state.notificationPermissionPromptSeen ?? false,
    })),
  );
}

export function usePreferenceActions() {
  return useAppStore(
    useShallow((state) => ({
      setAppLanguage: state.setAppLanguage,
      installAppLanguagePack: state.installAppLanguagePack,
      removeAppLanguagePack: state.removeAppLanguagePack,
      setNotificationsEnabled: state.setNotificationsEnabled,
      setNotificationPreference: state.setNotificationPreference,
      setNotificationPermissionPromptSeen: state.setNotificationPermissionPromptSeen,
    })),
  );
}

export function useThemeSettings() {
  return useAppStore(
    useShallow((state) => ({
      appLanguage: state.appLanguage,
    })),
  );
}

export function useDashboardSummary() {
  return useAppStore(
    useShallow((state) => ({
      activeMode: state.activeMode,
      activeModes: state.activeModes,
      lastModeActivation: state.lastModeActivation,
      strictLockScope: state.strictLockScope,
      blockedAppsCount: state.blockedApps.length,
      blockedWebsitesCount: state.blockedWebsites.length,
      blockedSearchTermsCount: state.blockedSearchTerms.length,
      dailyStats: state.dailyStats,
      isStrictLocked: state.isStrictLocked,
    })),
  );
}

export function usePermissionStatus() {
  return useAppStore(
    useShallow((state) => ({
      activeMode: state.activeMode,
      activeModes: state.activeModes,
      penaltyAmountSats: state.penaltyAmountSats,
      penaltyEnabled: state.penaltyEnabled,
      appLanguage: state.appLanguage ?? DEFAULT_APP_LANGUAGE,
      installedAppLanguagePacks: Array.isArray(state.installedAppLanguagePacks)
        ? state.installedAppLanguagePacks
        : EMPTY_APP_LANGUAGE_PACKS,
      notificationsEnabled: state.notificationsEnabled ?? false,
      blockedWebsites: Array.isArray(state.blockedWebsites) ? state.blockedWebsites : EMPTY_STRING_LIST,
      blockedAppsCount: Array.isArray(state.blockedApps) ? state.blockedApps.length : 0,
      blockedWebsitesCount: Array.isArray(state.blockedWebsites) ? state.blockedWebsites.length : 0,
      blockedSearchTermsCount: Array.isArray(state.blockedSearchTerms) ? state.blockedSearchTerms.length : 0,
      strictLockScope: state.strictLockScope,
      userProfile: state.userProfile ?? defaultProfile,
      isStrictLocked: state.isStrictLocked,
    })),
  );
}

export function usePermissionCounts() {
  return useAppStore(
    useShallow((state) => ({
      blockedAppsCount: state.blockedApps.length,
      blockedWebsitesCount: state.blockedWebsites.length,
      blockedSearchTermsCount: state.blockedSearchTerms.length,
      penaltyAmountSats: state.penaltyAmountSats,
      penaltyEnabled: state.penaltyEnabled,
    })),
  );
}

export function useLearningGateSummary() {
  return useLearningStore(
    useShallow((state) => ({
      gateRule: state.gateRule,
      activeDeckId: state.activeDeckId,
      decks: Object.values(state.decks),
      cards: Object.values(state.cards),
      presets: Object.values(state.presets),
      reviewLogs: Object.values(state.reviewLogs),
      assignments: state.assignments,
      getDueCardsForDecks: state.getDueCardsForDecks,
      getAssignmentForTarget: state.getAssignmentForTarget,
      getResolvedPresetForDeck: state.getResolvedPresetForDeck,
      getDeckStats: state.getDeckStats,
    })),
  );
}

export function useLearningGateActions() {
  return useLearningStore(
    useShallow((state) => ({
      seedStarterDeck: state.seedStarterDeck,
      upsertAssignment: state.upsertAssignment,
      removeAssignment: state.removeAssignment,
      setActiveDeck: state.setActiveDeck,
      setDeckReviewMix: state.setDeckReviewMix,
      setGateRule: state.setGateRule,
    })),
  );
}

export function useLearnHubSummary() {
  return useLearningStore(
    useShallow((state) => ({
      activeDeckId: state.activeDeckId,
      decks: Object.values(state.decks),
      getDeckStats: state.getDeckStats,
      getResolvedPresetForDeck: state.getResolvedPresetForDeck,
    })),
  );
}

export function useLearnHubActions() {
  return useLearningStore(
    useShallow((state) => ({
      seedStarterDeck: state.seedStarterDeck,
      exportDeckToJson: state.exportDeckToJson,
      setActiveDeck: state.setActiveDeck,
      setDeckReviewMix: state.setDeckReviewMix,
    })),
  );
}

export function useLearnStudioSummary() {
  return useLearningStore(
    useShallow((state) => ({
      decks: Object.values(state.decks),
      importJobs: state.importJobs,
    })),
  );
}

export function useLearnStudioActions() {
  return useLearningStore(
    useShallow((state) => ({
      importFromCsv: state.importFromCsv,
      importFromJson: state.importFromJson,
      importFromAnkiPackage: state.importFromAnkiPackage,
      createManualCard: state.createManualCard,
      importTemplateDeck: state.importTemplateDeck,
    })),
  );
}

export function useLearningMediaSummary() {
  return useLearningStore(
    useShallow((state) => ({
      mediaRegistry: state.mediaRegistry,
      mediaTransferQueue: state.mediaTransferQueue,
      mediaAssetCount: state.mediaRegistry.assets.length,
      pendingMediaAssetCount: state.mediaRegistry.assets.filter(
        (asset) => asset.state === 'draft' || asset.state === 'pending',
      ).length,
      failedMediaAssetCount: state.mediaRegistry.assets.filter((asset) => asset.state === 'failed').length,
      queuedTransferJobCount: state.mediaTransferQueue.jobs.filter((job) => job.status === 'queued').length,
      runningTransferJobCount: state.mediaTransferQueue.jobs.filter((job) => job.status === 'running').length,
    })),
  );
}

export function useLearnReviewSummary() {
  return useLearningStore(
    useShallow((state) => ({
      activeDeckId: state.activeDeckId,
      decks: Object.values(state.decks),
      cards: Object.values(state.cards),
      reviewLogs: Object.values(state.reviewLogs),
      gateRule: state.gateRule,
    })),
  );
}

export function useLearnReviewLookups() {
  return useLearningStore(
    useShallow((state) => ({
      getAssignmentForTarget: state.getAssignmentForTarget,
      getDeckById: state.getDeckById,
      getNoteByCardId: state.getNoteByCardId,
      getResolvedPresetForDeck: state.getResolvedPresetForDeck,
    })),
  );
}

export function useLearnReviewActions() {
  return useLearningStore(
    useShallow((state) => ({
      seedStarterDeck: state.seedStarterDeck,
      submitReview: state.submitReview,
      registerUnlockGrant: state.registerUnlockGrant,
      setActiveDeck: state.setActiveDeck,
    })),
  );
}

export function useReviewSessionSummary() {
  return useLearningStore(
    useShallow((state) => ({
      reviewSession: state.reviewSession,
      sessionSnapshot: state.reviewSession.sessionSnapshot,
      reviewHistoryDepth: state.reviewSession.reviewHistoryStack.length,
      feedbackEvents: state.reviewSession.feedbackEvents,
      timerVisible: state.reviewSession.timerVisible,
      reviewStatus: state.reviewSession.status,
      deckUpdatedAtAtStart: state.reviewSession.deckUpdatedAtAtStart,
      lastUpdatedAt: state.reviewSession.lastUpdatedAt,
    })),
  );
}

export function useReviewSessionActions() {
  return useLearningStore(
    useShallow((state) => ({
      startReviewSession: state.startReviewSession,
      updateReviewSessionSnapshot: state.updateReviewSessionSnapshot,
      pushReviewSessionHistory: state.pushReviewSessionHistory,
      undoReviewSession: state.undoReviewSession,
      clearReviewSession: state.clearReviewSession,
      completeReviewSession: state.completeReviewSession,
      setReviewSessionTimerVisible: state.setReviewSessionTimerVisible,
      recordReviewFeedbackEvent: state.recordReviewFeedbackEvent,
      hydrateReviewSessionFromLogs: state.hydrateReviewSessionFromLogs,
    })),
  );
}

export function useCardBrowserSummary() {
  return useLearningStore(
    useShallow((state) => ({
      activeDeckId: state.activeDeckId,
      decks: Object.values(state.decks),
      cards: Object.values(state.cards),
      notes: Object.values(state.notes),
      cardBrowser: state.cardBrowser,
      savedCardQueries: state.savedCardQueries,
    })),
  );
}

export function useCardBrowserActions() {
  return useLearningStore(
    useShallow((state) => ({
      setCardBrowserState: state.setCardBrowserState,
      setCardBrowserSearchDraft: state.setCardBrowserSearchDraft,
      applyCardBrowserSearchDraft: state.applyCardBrowserSearchDraft,
      selectCardBrowserCard: state.selectCardBrowserCard,
      toggleCardBrowserCardSelection: state.toggleCardBrowserCardSelection,
      clearCardBrowserSelection: state.clearCardBrowserSelection,
      upsertSavedCardQuery: state.upsertSavedCardQuery,
      applySavedCardQuery: state.applySavedCardQuery,
      deleteSavedCardQuery: state.deleteSavedCardQuery,
    })),
  );
}

export function useFilteredDeckLiteSummary() {
  return useLearningStore(
    useShallow((state) => ({
      activeDeckId: state.activeDeckId,
      decks: Object.values(state.decks),
      cards: Object.values(state.cards),
      notes: Object.values(state.notes),
      filteredDeckLiteDefinition: state.filteredDeckLiteDefinition,
      filteredDeckLiteDefinitions: state.filteredDeckLiteDefinitions,
      filteredDeckLiteRuns: state.filteredDeckLiteRuns,
    })),
  );
}

export function useFilteredDeckLiteActions() {
  return useLearningStore(
    useShallow((state) => ({
      setFilteredDeckLiteDefinition: state.setFilteredDeckLiteDefinition,
      saveFilteredDeckLiteDefinition: state.saveFilteredDeckLiteDefinition,
      runFilteredDeckLiteDefinition: state.runFilteredDeckLiteDefinition,
      clearFilteredDeckLiteRuns: state.clearFilteredDeckLiteRuns,
    })),
  );
}
