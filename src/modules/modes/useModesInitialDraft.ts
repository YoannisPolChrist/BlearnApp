import { useMemo } from 'react';
import type { StrictAddonMap } from '@/lib/targetModes';
import type { ModeId } from '@/components/modes/ModesSections';
import type { GateRule } from '@/lib/learning';
import type { DraftBlockingState, ModeDraftSnapshot } from '@/store/useModeDraftStore';

interface UseModesInitialDraftOptions {
  activeDeckId?: string;
  blockSchedules: DraftBlockingState['blockSchedules'];
  blockedAppModes: DraftBlockingState['blockedAppModes'];
  blockedApps: DraftBlockingState['blockedApps'];
  blockedSearchTermModes: DraftBlockingState['blockedSearchTermModes'];
  blockedSearchTerms: DraftBlockingState['blockedSearchTerms'];
  blockedWebsiteModes: DraftBlockingState['blockedWebsiteModes'];
  blockedWebsites: DraftBlockingState['blockedWebsites'];
  breathingRounds: number;
  committedModeSelection: ModeId;
  gateRule: GateRule;
  interventionInterval: number;
  interventionPatternId: string;
  strictAddons: StrictAddonMap;
  strictEndTime: string;
  strictStartTime: string;
  storedDraft: ModeDraftSnapshot | null;
}

export function useModesInitialDraft({
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
}: UseModesInitialDraftOptions) {
  return useMemo<ModeDraftSnapshot>(() => {
    if (storedDraft) {
      return {
        ...storedDraft,
        activeDeckId: storedDraft.activeDeckId ?? activeDeckId,
        strictAddons: storedDraft.strictAddons ?? { ...strictAddons },
      };
    }

    return {
      selectedMode: committedModeSelection,
      strictAddons: { ...strictAddons },
      startTime: strictStartTime,
      endTime: strictEndTime,
      breathingRounds,
      interventionInterval,
      activeDeckId,
      sessionCreditsRequired: gateRule.sessionCreditsRequired,
      unlockDurationMinutes: gateRule.unlockDurationMinutes,
      typedAnswerEnabled: gateRule.typedAnswerEnabled,
      interventionPatternId,
      blocking: {
        blockedApps: [...blockedApps],
        blockedAppModes: { ...blockedAppModes },
        blockedWebsites: [...blockedWebsites],
        blockedWebsiteModes: { ...blockedWebsiteModes },
        blockedSearchTerms: [...blockedSearchTerms],
        blockedSearchTermModes: { ...blockedSearchTermModes },
        blockSchedules: { ...blockSchedules },
      },
      penaltyReadyConfirmed: false,
    };
  }, [
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
    gateRule.sessionCreditsRequired,
    gateRule.typedAnswerEnabled,
    gateRule.unlockDurationMinutes,
    interventionInterval,
    interventionPatternId,
    strictAddons,
    strictEndTime,
    strictStartTime,
    storedDraft,
  ]);
}
