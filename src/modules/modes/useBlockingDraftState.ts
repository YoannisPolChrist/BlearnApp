import { useCallback, useMemo, useRef, useState, type MutableRefObject } from 'react';
import type { DraftBlockingState } from '@/modules/modes/draftBlocking';

type UseBlockingDraftStateResult = {
  draftBlockingState: DraftBlockingState;
  draftBlockedApps: string[];
  draftBlockedAppModes: DraftBlockingState['blockedAppModes'];
  draftBlockedWebsites: string[];
  draftBlockedWebsiteModes: DraftBlockingState['blockedWebsiteModes'];
  draftBlockedSearchTerms: string[];
  draftBlockedSearchTermModes: DraftBlockingState['blockedSearchTermModes'];
  draftBlockSchedules: DraftBlockingState['blockSchedules'];
  replaceDraftBlockingState: (nextState: DraftBlockingState) => void;
  applyBlockingDraftMutation: (mutator: (current: DraftBlockingState) => DraftBlockingState) => void;
  blockingDraftRef: MutableRefObject<DraftBlockingState>;
};

export function useBlockingDraftState(initialState: DraftBlockingState): UseBlockingDraftStateResult {
  const [draftBlockingState, setDraftBlockingState] = useState(initialState);
  const blockingDraftRef = useRef<DraftBlockingState>(initialState);

  const replaceDraftBlockingState = useCallback((nextState: DraftBlockingState) => {
    blockingDraftRef.current = nextState;
    setDraftBlockingState(nextState);
  }, []);

  const applyBlockingDraftMutation = useCallback((mutator: (current: DraftBlockingState) => DraftBlockingState) => {
    replaceDraftBlockingState(mutator(blockingDraftRef.current));
  }, [replaceDraftBlockingState]);

  return useMemo(() => ({
    draftBlockingState,
    draftBlockedApps: draftBlockingState.blockedApps,
    draftBlockedAppModes: draftBlockingState.blockedAppModes,
    draftBlockedWebsites: draftBlockingState.blockedWebsites,
    draftBlockedWebsiteModes: draftBlockingState.blockedWebsiteModes,
    draftBlockedSearchTerms: draftBlockingState.blockedSearchTerms,
    draftBlockedSearchTermModes: draftBlockingState.blockedSearchTermModes,
    draftBlockSchedules: draftBlockingState.blockSchedules,
    replaceDraftBlockingState,
    applyBlockingDraftMutation,
    blockingDraftRef,
  }), [applyBlockingDraftMutation, draftBlockingState, replaceDraftBlockingState]);
}
