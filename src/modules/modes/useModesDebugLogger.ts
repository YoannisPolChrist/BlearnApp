import { useCallback, useEffect } from 'react';
import type { ModeId } from '@/components/modes/ModesSections';

export function useModesDebugLogger(options: {
  committedModeSelection: ModeId;
  hasAssignmentChanges: boolean;
  hasChanges: boolean;
  hasGlobalChanges: boolean;
  hasLearnGateChanges: boolean;
  hasModeSelectionChange: boolean;
  hasRequiredPermissions: boolean;
  isSaving: boolean;
  needsPenaltyActivation: boolean;
  penaltyReadyConfirmed: boolean;
  penaltySetupReady: boolean;
  selectedMode: ModeId;
  selectedModeAssignedAppCount: number;
  selectedModeCount: number;
  selectedModeHasRequiredApp: boolean;
  selectedModeNeedsAssignedApp: boolean;
  strictDurationTooLong: boolean;
}) {
  const logModesDebug = useCallback((reason: string) => {
    console.info('[ModesDebug]', JSON.stringify({
      reason,
      ...options,
    }));
  }, [options]);

  const shouldLogModesDebug = import.meta.env.MODE === 'development';
  useEffect(() => {
    if (!shouldLogModesDebug) return;
    logModesDebug('state');
  }, [logModesDebug, shouldLogModesDebug]);

  return logModesDebug;
}
