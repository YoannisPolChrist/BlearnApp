import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { StrictAddonMap, StrictAddonModeId, StrictAddonState } from '@/lib/targetModes';
import type { DraftBlockingState } from '@/modules/modes/draftBlocking';
import { commitLearningState } from '@/modules/modes/learningAssignments';
import type { ModeId } from '@/modules/modes/modeTypes';
import { useAppStore, type SavedModeSelection } from '@/store/useAppStore';

type GateRuleDraft = {
  sessionCreditsRequired: number;
  unlockDurationMinutes: number;
  typedAnswerEnabled: boolean;
};

type UseModesPersistenceOptions = {
  blockingDraftRef: MutableRefObject<DraftBlockingState>;
  localActiveDeckId: string | null;
  setLocalActiveDeckId: Dispatch<SetStateAction<string | null>>;
  blockedApps: string[];
  blockedWebsites: string[];
  blockedSearchTerms: string[];
  commitBreathingRoundsDraft: () => number;
  commitIntervalDraft: () => number;
  commitSessionCreditsRequiredDraft: () => number;
  commitUnlockDurationMinutesDraft: () => number;
  localTypedAnswerEnabled: boolean;
  selectedMode: ModeId;
  localStrictAddons: StrictAddonMap;
  setSavedModeSelection: (mode: SavedModeSelection) => void;
  setStrictAddonState: (mode: StrictAddonModeId, next: StrictAddonState) => void;
  startTime: string;
  endTime: string;
  setStrictSchedule: (start: string, end: string) => void;
  setBreathingRounds: (value: number) => void;
  setInterventionInterval: (value: number) => void;
  localPatternId: string;
  setInterventionPatternId: (value: string) => void;
};

export function useModesPersistence({
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
}: UseModesPersistenceOptions) {
  const commitDraftBlockingState = useCallback((nextGateRule: GateRuleDraft) => {
    const nextDraftState = blockingDraftRef.current;
    useAppStore.getState().replaceBlockingState(nextDraftState);
    commitLearningState({
      localActiveDeckId,
      setLocalActiveDeckId,
      nextGateRule,
      nextDraftState,
      blockedApps,
      blockedWebsites,
      blockedSearchTerms,
    });
  }, [
    blockedApps,
    blockedSearchTerms,
    blockedWebsites,
    blockingDraftRef,
    localActiveDeckId,
    setLocalActiveDeckId,
  ]);

  const persistModeChanges = useCallback(() => {
    const nextBreathingRounds = commitBreathingRoundsDraft();
    const nextInterval = commitIntervalDraft();
    const nextSessionCreditsRequired = commitSessionCreditsRequiredDraft();
    const nextUnlockDurationMinutes = commitUnlockDurationMinutesDraft();

    commitDraftBlockingState({
      sessionCreditsRequired: nextSessionCreditsRequired,
      unlockDurationMinutes: nextUnlockDurationMinutes,
      typedAnswerEnabled: localTypedAnswerEnabled,
    });

    if (selectedMode !== 'lock') {
      setSavedModeSelection(selectedMode);
    }

    (['strict', 'learn', 'penalty'] as const).forEach((mode) => {
      setStrictAddonState(mode, localStrictAddons[mode]);
    });

    setStrictSchedule(startTime, endTime);
    setBreathingRounds(nextBreathingRounds);
    setInterventionInterval(nextInterval);
    setInterventionPatternId(localPatternId);
  }, [
    commitBreathingRoundsDraft,
    commitDraftBlockingState,
    commitIntervalDraft,
    commitSessionCreditsRequiredDraft,
    commitUnlockDurationMinutesDraft,
    localTypedAnswerEnabled,
    endTime,
    localPatternId,
    localStrictAddons,
    selectedMode,
    setBreathingRounds,
    setInterventionInterval,
    setInterventionPatternId,
    setSavedModeSelection,
    setStrictAddonState,
    setStrictSchedule,
    startTime,
  ]);

  return {
    persistModeChanges,
  };
}
