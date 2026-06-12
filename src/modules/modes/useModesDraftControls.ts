import { useCallback, useEffect, useState } from 'react';
import { isStrictAddonModeId, type StrictAddonMap } from '@/lib/targetModes';
import type { ModeId } from '@/components/modes/ModesSections';
import type { GateRule } from '@/lib/learning';
import { useBlockingDraftState } from '@/modules/modes/useBlockingDraftState';
import {
  BREATHING_INTERVAL_CONSTRAINTS,
  BREATHING_ROUNDS_CONSTRAINTS,
  SESSION_CREDITS_CONSTRAINTS,
  UNLOCK_DURATION_CONSTRAINTS,
  commitIntegerDraft,
  updateIntegerDraft,
} from '@/modules/modes/modesPageModel';
import { useModeDraftStore, type DraftBlockingState, type ModeDraftSnapshot } from '@/store/useModeDraftStore';

interface UseModesDraftControlsOptions {
  activeDeckId?: string;
  gateRule: GateRule;
  initialDraft: ModeDraftSnapshot;
  strictAddons: StrictAddonMap;
  storedDraft: ModeDraftSnapshot | null;
}

export function useModesDraftControls({
  activeDeckId,
  gateRule,
  initialDraft,
  strictAddons,
  storedDraft,
}: UseModesDraftControlsOptions) {
  const [selectedMode, setSelectedMode] = useState<ModeId>(initialDraft.selectedMode);
  const [localStrictAddons, setLocalStrictAddons] = useState<StrictAddonMap>(initialDraft.strictAddons);
  const [startTime, setStartTime] = useState(initialDraft.startTime);
  const [endTime, setEndTime] = useState(initialDraft.endTime);
  const [localBreathingRounds, setLocalBreathingRounds] = useState(initialDraft.breathingRounds);
  const [localBreathingRoundsDraft, setLocalBreathingRoundsDraft] = useState(String(initialDraft.breathingRounds));
  const [localInterval, setLocalInterval] = useState(initialDraft.interventionInterval);
  const [localIntervalDraft, setLocalIntervalDraft] = useState(String(initialDraft.interventionInterval));
  const [localActiveDeckId, setLocalActiveDeckId] = useState(initialDraft.activeDeckId);
  const [localSessionCreditsRequired, setLocalSessionCreditsRequired] = useState(initialDraft.sessionCreditsRequired);
  const [sessionCreditsRequiredDraft, setSessionCreditsRequiredDraft] = useState(String(initialDraft.sessionCreditsRequired));
  const [localUnlockDurationMinutes, setLocalUnlockDurationMinutes] = useState(initialDraft.unlockDurationMinutes);
  const [unlockDurationMinutesDraft, setUnlockDurationMinutesDraft] = useState(String(initialDraft.unlockDurationMinutes));
  const [localPatternId, setLocalPatternId] = useState(initialDraft.interventionPatternId);
  const [localTypedAnswerEnabled, setLocalTypedAnswerEnabled] = useState(initialDraft.typedAnswerEnabled);
  const [penaltyReadyConfirmed, setPenaltyReadyConfirmed] = useState(initialDraft.penaltyReadyConfirmed);
  const blockingDraft = useBlockingDraftState(initialDraft.blocking);

  useEffect(() => {
    if (storedDraft) return;
    setLocalActiveDeckId(activeDeckId);
    setLocalStrictAddons({ ...strictAddons });
    setLocalSessionCreditsRequired(gateRule.sessionCreditsRequired);
    setSessionCreditsRequiredDraft(String(gateRule.sessionCreditsRequired));
    setLocalUnlockDurationMinutes(gateRule.unlockDurationMinutes);
    setUnlockDurationMinutesDraft(String(gateRule.unlockDurationMinutes));
    setLocalTypedAnswerEnabled(gateRule.typedAnswerEnabled);
  }, [activeDeckId, gateRule.sessionCreditsRequired, gateRule.unlockDurationMinutes, gateRule.typedAnswerEnabled, storedDraft, strictAddons]);

  const handleBreathingRoundsDraftChange = useCallback((value: string) => {
    updateIntegerDraft(value, setLocalBreathingRoundsDraft, setLocalBreathingRounds);
  }, []);

  const handleIntervalDraftChange = useCallback((value: string) => {
    updateIntegerDraft(value, setLocalIntervalDraft, setLocalInterval);
  }, []);

  const handleSessionCreditsRequiredDraftChange = useCallback((value: string) => {
    updateIntegerDraft(value, setSessionCreditsRequiredDraft, setLocalSessionCreditsRequired);
  }, []);

  const handleUnlockDurationMinutesDraftChange = useCallback((value: string) => {
    updateIntegerDraft(value, setUnlockDurationMinutesDraft, setLocalUnlockDurationMinutes);
  }, []);

  const handleSelectedModeStrictAddonChange = useCallback((enabled: boolean, strictAddonActive: boolean) => {
    if (!isStrictAddonModeId(selectedMode)) return;
    if (strictAddonActive) return;

    setLocalStrictAddons((current) => ({
      ...current,
      [selectedMode]: {
        ...current[selectedMode],
        enabled,
      },
    }));
  }, [selectedMode]);

  const selectedModeStrictWindowStart = selectedMode === 'lock'
    ? startTime
    : isStrictAddonModeId(selectedMode)
      ? localStrictAddons[selectedMode].startTime
      : startTime;
  const selectedModeStrictWindowEnd = selectedMode === 'lock'
    ? endTime
    : isStrictAddonModeId(selectedMode)
      ? localStrictAddons[selectedMode].endTime
      : endTime;

  const handleStrictWindowStartChange = useCallback((value: string, strictAddonActive: boolean) => {
    if (selectedMode === 'lock') {
      setStartTime(value);
      return;
    }
    if (!isStrictAddonModeId(selectedMode)) return;
    if (strictAddonActive) return;
    setLocalStrictAddons((current) => ({
      ...current,
      [selectedMode]: {
        ...current[selectedMode],
        startTime: value,
      },
    }));
  }, [selectedMode]);

  const handleStrictWindowEndChange = useCallback((value: string, strictAddonActive: boolean) => {
    if (selectedMode === 'lock') {
      setEndTime(value);
      return;
    }
    if (!isStrictAddonModeId(selectedMode)) return;
    if (strictAddonActive) return;
    setLocalStrictAddons((current) => ({
      ...current,
      [selectedMode]: {
        ...current[selectedMode],
        endTime: value,
      },
    }));
  }, [selectedMode]);

  const commitBreathingRoundsDraft = useCallback(() => (
    commitIntegerDraft(localBreathingRoundsDraft, setLocalBreathingRoundsDraft, setLocalBreathingRounds, BREATHING_ROUNDS_CONSTRAINTS)
  ), [localBreathingRoundsDraft]);
  const commitIntervalDraft = useCallback(() => (
    commitIntegerDraft(localIntervalDraft, setLocalIntervalDraft, setLocalInterval, BREATHING_INTERVAL_CONSTRAINTS)
  ), [localIntervalDraft]);
  const commitSessionCreditsRequiredDraft = useCallback(() => (
    commitIntegerDraft(sessionCreditsRequiredDraft, setSessionCreditsRequiredDraft, setLocalSessionCreditsRequired, SESSION_CREDITS_CONSTRAINTS)
  ), [sessionCreditsRequiredDraft]);
  const commitUnlockDurationMinutesDraft = useCallback(() => (
    commitIntegerDraft(unlockDurationMinutesDraft, setUnlockDurationMinutesDraft, setLocalUnlockDurationMinutes, UNLOCK_DURATION_CONSTRAINTS)
  ), [unlockDurationMinutesDraft]);

  return {
    ...blockingDraft,
    commitBreathingRoundsDraft,
    commitIntervalDraft,
    commitSessionCreditsRequiredDraft,
    commitUnlockDurationMinutesDraft,
    endTime,
    handleBreathingRoundsDraftChange,
    handleIntervalDraftChange,
    handleSelectedModeStrictAddonChange,
    handleSessionCreditsRequiredDraftChange,
    handleStrictWindowEndChange,
    handleStrictWindowStartChange,
    handleUnlockDurationMinutesDraftChange,
    localActiveDeckId,
    localBreathingRounds,
    localBreathingRoundsDraft,
    localInterval,
    localIntervalDraft,
    localPatternId,
    localSessionCreditsRequired,
    localStrictAddons,
    localTypedAnswerEnabled,
    localUnlockDurationMinutes,
    penaltyReadyConfirmed,
    selectedMode,
    selectedModeStrictWindowEnd,
    selectedModeStrictWindowStart,
    sessionCreditsRequiredDraft,
    setLocalActiveDeckId,
    setLocalPatternId,
    setLocalTypedAnswerEnabled,
    setPenaltyReadyConfirmed,
    setSelectedMode,
    startTime,
    unlockDurationMinutesDraft,
  };
}

interface UsePersistModesDraftOptions {
  blocking: DraftBlockingState;
  hasChanges: boolean;
  localActiveDeckId?: string;
  localBreathingRounds: number;
  localInterval: number;
  localPatternId: string;
  localSessionCreditsRequired: number;
  localStrictAddons: StrictAddonMap;
  localTypedAnswerEnabled: boolean;
  localUnlockDurationMinutes: number;
  penaltyReadyConfirmed: boolean;
  selectedMode: ModeId;
  startTime: string;
  endTime: string;
}

export function usePersistModesDraft({
  blocking,
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
}: UsePersistModesDraftOptions) {
  const saveDraftSnapshot = useModeDraftStore((state) => state.saveSnapshot);
  const clearDraftSnapshot = useModeDraftStore((state) => state.clearSnapshot);

  useEffect(() => {
    saveDraftSnapshot({
      selectedMode,
      strictAddons: localStrictAddons,
      startTime,
      endTime,
      breathingRounds: localBreathingRounds,
      interventionInterval: localInterval,
      activeDeckId: localActiveDeckId,
      sessionCreditsRequired: localSessionCreditsRequired,
      unlockDurationMinutes: localUnlockDurationMinutes,
      typedAnswerEnabled: localTypedAnswerEnabled,
      interventionPatternId: localPatternId,
      blocking,
      penaltyReadyConfirmed,
    });
  }, [
    blocking,
    endTime,
    localActiveDeckId,
    localBreathingRounds,
    localInterval,
    localPatternId,
    localSessionCreditsRequired,
    localStrictAddons,
    localTypedAnswerEnabled,
    localUnlockDurationMinutes,
    penaltyReadyConfirmed,
    saveDraftSnapshot,
    selectedMode,
    startTime,
  ]);

  useEffect(() => () => {
    if (!hasChanges) {
      clearDraftSnapshot();
    }
  }, [clearDraftSnapshot, hasChanges]);

  return clearDraftSnapshot;
}
