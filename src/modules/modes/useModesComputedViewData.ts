import { useMemo } from 'react';
import { getActiveStrictAddonLockedAppsByMode, type StrictAddonMap } from '@/lib/targetModes';
import { getModePalette, tonePalettes } from '@/lib/semanticTones';
import { buildDeckStats, buildModeAppLists, buildVisibleApps, getPenaltySetupStatus } from '@/lib/view-models/modes';
import { isAlbyReady } from '@/services/albyWalletService';
import { isVerifiedAccountabilityPartner, type AccountabilityPartner } from '@/store/useAppStore';
import type { ModeDefinition, ModeId } from '@/components/modes/ModesSections';
import type { DraftBlockingState } from '@/store/useModeDraftStore';
import type { GateRule } from '@/lib/learning';
import type { AlbyConnectionState } from '@/services/albyWalletService';
import type { LearningCard, LearningDeck, LearningPreset, ReviewLogEntry } from '@/lib/learning';
import type { ScreenTimeSummary } from '@/plugins/ScreenTimePlugin';
import {
  BREATHING_INTERVAL_CONSTRAINTS,
  BREATHING_ROUNDS_CONSTRAINTS,
  SESSION_CREDITS_CONSTRAINTS,
  UNLOCK_DURATION_CONSTRAINTS,
  normalizeIntegerDraft,
} from '@/modules/modes/modesPageModel';
import { buildBlockTabs } from '@/modules/modes/modesPageDefinitions';

type Translate = (key: string, values?: Record<string, unknown>) => string;

export function useModesComputedViewData(options: {
  accountabilityPartner: AccountabilityPartner | null;
  activeDeckId?: string;
  albyConnection: AlbyConnectionState;
  albyConnectionTestStatus: string;
  blockSchedules: DraftBlockingState['blockSchedules'];
  blockedAppModes: DraftBlockingState['blockedAppModes'];
  blockedApps: DraftBlockingState['blockedApps'];
  blockedSearchTermModes: DraftBlockingState['blockedSearchTermModes'];
  blockedSearchTerms: DraftBlockingState['blockedSearchTerms'];
  blockedWebsiteModes: DraftBlockingState['blockedWebsiteModes'];
  blockedWebsites: DraftBlockingState['blockedWebsites'];
  breathingRounds: number;
  cards: LearningCard[];
  decks: LearningDeck[];
  deferredAppSearch: string;
  draftBlockedAppModes: DraftBlockingState['blockedAppModes'];
  draftBlockedApps: DraftBlockingState['blockedApps'];
  draftBlockedSearchTerms: DraftBlockingState['blockedSearchTerms'];
  draftBlockedWebsites: DraftBlockingState['blockedWebsites'];
  gateRule: GateRule;
  getDueCardsForDecks: (deckIds: string[]) => LearningCard[];
  getResolvedPresetForDeck: (deckId: string) => LearningPreset;
  installedApps: Parameters<typeof buildVisibleApps>[0]['installedApps'];
  interventionInterval: number;
  interventionPatternId: string;
  localActiveDeckId?: string;
  localBreathingRoundsDraft: string;
  localIntervalDraft: string;
  localPatternId: string;
  localStrictAddons: StrictAddonMap;
  locale: string;
  modeDefinitions: ModeDefinition[];
  penaltyAmountSats: number | null;
  presets: LearningPreset[];
  reviewLogs: ReviewLogEntry[];
  selectedMode: ModeId;
  sessionCreditsRequiredDraft: string;
  showAllApps: boolean;
  strictAddons: StrictAddonMap;
  strictEndTime: string;
  strictStartTime: string;
  t: Translate;
  unlockDurationMinutesDraft: string;
  usage: ScreenTimeSummary | null;
}) {
  const persistedBlockingState = useMemo<DraftBlockingState>(() => ({
    blockedApps: options.blockedApps,
    blockedAppModes: options.blockedAppModes,
    blockedWebsites: options.blockedWebsites,
    blockedWebsiteModes: options.blockedWebsiteModes,
    blockedSearchTerms: options.blockedSearchTerms,
    blockedSearchTermModes: options.blockedSearchTermModes,
    blockSchedules: options.blockSchedules,
  }), [options]);

  const { filteredVisibleApps, shouldShowFullAppList } = useMemo(
    () =>
      buildVisibleApps({
        installedApps: options.installedApps,
        usage: options.usage,
        blockedApps: options.draftBlockedApps,
        query: options.deferredAppSearch,
        showAllApps: options.showAllApps,
      }),
    [options],
  );

  const normalizedBreathingRounds = normalizeIntegerDraft(options.localBreathingRoundsDraft, BREATHING_ROUNDS_CONSTRAINTS);
  const normalizedInterval = normalizeIntegerDraft(options.localIntervalDraft, BREATHING_INTERVAL_CONSTRAINTS);
  const normalizedSessionCreditsRequired = normalizeIntegerDraft(options.sessionCreditsRequiredDraft, SESSION_CREDITS_CONSTRAINTS);
  const normalizedUnlockDurationMinutes = normalizeIntegerDraft(options.unlockDurationMinutesDraft, UNLOCK_DURATION_CONSTRAINTS);

  const { deckStats, resolvedLearnDeck } = useMemo(
    () => buildDeckStats({
      decks: options.decks,
      cards: options.cards,
      reviewLogs: options.reviewLogs,
      presets: options.presets,
      gateRule: {
        ...options.gateRule,
        sessionCreditsRequired: normalizedSessionCreditsRequired,
        requiredCorrectReviews: normalizedSessionCreditsRequired,
        unlockDurationMinutes: normalizedUnlockDurationMinutes,
      },
      activeDeckId: options.localActiveDeckId,
      getDueCardsForDecks: options.getDueCardsForDecks,
      getResolvedPresetForDeck: options.getResolvedPresetForDeck,
    }),
    [normalizedSessionCreditsRequired, normalizedUnlockDurationMinutes, options],
  );

  const editableMode = options.selectedMode === 'strict' || options.selectedMode === 'learn' || options.selectedMode === 'penalty'
    ? options.selectedMode
    : null;
  const appLists = useMemo(
    () =>
      buildModeAppLists({
        filteredVisibleApps,
        blockedAppModes: options.draftBlockedAppModes,
        editableMode,
        shouldShowFullAppList,
      }),
    [editableMode, filteredVisibleApps, options.draftBlockedAppModes, shouldShowFullAppList],
  );

  const lockedAppIdsByMode = useMemo(
    () => getActiveStrictAddonLockedAppsByMode(options.localStrictAddons),
    [options.localStrictAddons],
  );
  const currentModeConfig = options.modeDefinitions?.find((mode) => mode.id === options.selectedMode);
  const selectedModePalette = getModePalette(options.selectedMode);
  const strictPalette = getModePalette('lock');
  const warningPalette = tonePalettes.warning;
  const satsFormatter = useMemo(() => new Intl.NumberFormat(options.locale), [options.locale]);
  const albyReady = isAlbyReady(options.albyConnection);
  const recipientVerified = isVerifiedAccountabilityPartner(options.accountabilityPartner);
  const connectionTestPassed = options.albyConnectionTestStatus === 'passed';
  const penaltySetup = getPenaltySetupStatus({
    albyReady,
    connectionTestPassed,
    penaltyAmountSats: options.penaltyAmountSats,
    accountabilityPartner: options.accountabilityPartner,
    recipientVerified,
  });
  const blockTabs = useMemo(
    () =>
      buildBlockTabs({
        t: options.t,
        blockedAppsCount: options.draftBlockedApps.length,
        blockedWebsitesCount: options.draftBlockedWebsites.length,
        blockedSearchTermsCount: options.draftBlockedSearchTerms.length,
      }),
    [options.draftBlockedApps.length, options.draftBlockedSearchTerms.length, options.draftBlockedWebsites.length, options.t],
  );

  return {
    ...appLists,
    ...penaltySetup,
    albyReady,
    blockTabs,
    connectionTestPassed,
    currentModeConfig,
    deckStats,
    editableMode,
    lockedAppIdsByMode,
    normalizedBreathingRounds,
    normalizedInterval,
    normalizedSessionCreditsRequired,
    normalizedUnlockDurationMinutes,
    persistedBlockingState,
    recipientVerified,
    resolvedLearnDeck,
    satsFormatter,
    selectedModePalette,
    shouldShowFullAppList,
    strictPalette,
    warningPalette,
  };
}
