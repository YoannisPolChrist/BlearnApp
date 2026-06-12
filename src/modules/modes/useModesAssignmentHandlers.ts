import { useCallback, type Dispatch, type SetStateAction } from 'react';
import {
  normalizeTargetValue,
  type StrictAddonLockedAppsByMode,
  type StrictAddonModeId,
  type TargetModeId,
} from '@/lib/targetModes';
import { showSuccessFeedback } from '@/lib/successFeedback';
import {
  assignTargetModeToDraftState,
  clearAppTargetsForModeFromDraftState,
  removeTargetFromDraftState,
  toggleTargetModeInDraftState,
  updateAppDraftSchedule,
  type DraftBlockingState,
} from '@/modules/modes/draftBlocking';
import type { ModeId } from '@/modules/modes/modeTypes';

type UseModesAssignmentHandlersOptions = {
  isGerman: boolean;
  editableMode: TargetModeId | null;
  selectedMode: ModeId;
  draftBlockedAppModes: DraftBlockingState['blockedAppModes'];
  draftBlockedWebsiteModes: DraftBlockingState['blockedWebsiteModes'];
  draftBlockedSearchTermModes: DraftBlockingState['blockedSearchTermModes'];
  selectedModeAssignedAppCount: number;
  assignmentsLocked: boolean;
  lockedAppIdsByMode?: StrictAddonLockedAppsByMode;
  applyBlockingDraftMutation: (mutator: (current: DraftBlockingState) => DraftBlockingState) => void;
  setExpandedApp: Dispatch<SetStateAction<string | null>>;
  newWebsite: string;
  setNewWebsite: Dispatch<SetStateAction<string>>;
  newSearchTerm: string;
  setNewSearchTerm: Dispatch<SetStateAction<string>>;
};

export function useModesAssignmentHandlers({
  isGerman,
  editableMode,
  selectedMode,
  draftBlockedAppModes,
  draftBlockedWebsiteModes,
  draftBlockedSearchTermModes,
  selectedModeAssignedAppCount,
  assignmentsLocked,
  lockedAppIdsByMode = {},
  applyBlockingDraftMutation,
  setExpandedApp,
  newWebsite,
  setNewWebsite,
  newSearchTerm,
  setNewSearchTerm,
}: UseModesAssignmentHandlersOptions) {
  const triggerAssignmentFeedback = useCallback((german: string, english: string) => {
    showSuccessFeedback({
      eyebrow: isGerman ? 'Modi' : 'Modes',
      title: isGerman ? german : english,
    });
  }, [isGerman]);

  const getLockedModeForApp = useCallback((appId: string) => {
    const normalizedAppId = normalizeTargetValue('app', appId);
    const lockedModeEntry = (Object.entries(lockedAppIdsByMode || {}) as [StrictAddonModeId, Set<string>][])
      .find(([, lockedAppIds]) => lockedAppIds.has(normalizedAppId));

    return lockedModeEntry?.[0] ?? null;
  }, [lockedAppIdsByMode]);

  const handleToggleAppTarget = useCallback((appId: string) => {
    if (!editableMode) return;
    if (assignmentsLocked) return;

    const normalizedAppId = normalizeTargetValue('app', appId);
    const previousMode = draftBlockedAppModes[normalizedAppId];
    const lockedMode = getLockedModeForApp(normalizedAppId);
    const lockedSetForCurrentMode = previousMode
      ? lockedAppIdsByMode[previousMode as StrictAddonModeId]
      : null;
    const lockedSetForTargetMode = lockedAppIdsByMode[editableMode as StrictAddonModeId];

    if (lockedMode && lockedMode !== previousMode) return;
    if (lockedSetForCurrentMode?.has(normalizedAppId)) return;
    if (lockedSetForTargetMode && !lockedSetForTargetMode.has(normalizedAppId)) return;

    applyBlockingDraftMutation((current) => toggleTargetModeInDraftState(current, 'app', normalizedAppId, editableMode));
    triggerAssignmentFeedback(
      previousMode === editableMode ? 'App aus diesem Modus entfernt' : 'App diesem Modus zugewiesen',
      previousMode === editableMode ? 'App removed from this mode' : 'App assigned to this mode',
    );
  }, [
    applyBlockingDraftMutation,
    assignmentsLocked,
    draftBlockedAppModes,
    editableMode,
    getLockedModeForApp,
    lockedAppIdsByMode,
    triggerAssignmentFeedback,
  ]);

  const handleAssignAppsToSelectedMode = useCallback((apps: string[]) => {
    if (!editableMode || apps.length === 0) return;
    if (assignmentsLocked) return;

    const normalizedApps = Array.from(new Set(apps.map((appId) => normalizeTargetValue('app', appId)).filter(Boolean)));
    const lockedSetForTargetMode = lockedAppIdsByMode[editableMode as StrictAddonModeId];
    const assignableApps = normalizedApps.filter((normalizedAppId) => {
      const lockedMode = getLockedModeForApp(normalizedAppId);
      if (lockedMode && lockedMode !== editableMode) {
        return false;
      }
      if (lockedSetForTargetMode && !lockedSetForTargetMode.has(normalizedAppId)) {
        return false;
      }
      return true;
    });

    if (assignableApps.length === 0) {
      return;
    }

    applyBlockingDraftMutation((current) => assignableApps.reduce(
      (nextState, normalizedAppId) => assignTargetModeToDraftState(nextState, 'app', normalizedAppId, editableMode),
      current,
    ));

    triggerAssignmentFeedback(
      assignableApps.length === 1 ? '1 App diesem Modus zugewiesen' : `${assignableApps.length} Apps diesem Modus zugewiesen`,
      assignableApps.length === 1 ? '1 app assigned to this mode' : `${assignableApps.length} apps assigned to this mode`,
    );
  }, [
    applyBlockingDraftMutation,
    assignmentsLocked,
    editableMode,
    getLockedModeForApp,
    lockedAppIdsByMode,
    triggerAssignmentFeedback,
  ]);

  const handleClearAppsFromSelectedMode = useCallback(() => {
    if (!editableMode || selectedModeAssignedAppCount === 0) return;
    if (assignmentsLocked) return;

    applyBlockingDraftMutation((current) => clearAppTargetsForModeFromDraftState(current, editableMode));
    setExpandedApp(null);
    triggerAssignmentFeedback(
      selectedModeAssignedAppCount === 1 ? '1 App aus diesem Modus entfernt' : `Alle ${selectedModeAssignedAppCount} Apps aus diesem Modus entfernt`,
      selectedModeAssignedAppCount === 1 ? '1 app removed from this mode' : `All ${selectedModeAssignedAppCount} apps removed from this mode`,
    );
  }, [applyBlockingDraftMutation, assignmentsLocked, editableMode, selectedModeAssignedAppCount, setExpandedApp, triggerAssignmentFeedback]);

  const handleToggleWebsiteTarget = useCallback((website: string) => {
    if (!editableMode) return;
    if (assignmentsLocked) return;

    const normalizedWebsite = normalizeTargetValue('website', website);
    const previousMode = draftBlockedWebsiteModes[normalizedWebsite];

    applyBlockingDraftMutation((current) => toggleTargetModeInDraftState(current, 'website', normalizedWebsite, editableMode));
    triggerAssignmentFeedback(
      previousMode === editableMode ? 'Website aus diesem Modus entfernt' : 'Website diesem Modus zugewiesen',
      previousMode === editableMode ? 'Website removed from this mode' : 'Website assigned to this mode',
    );
  }, [applyBlockingDraftMutation, assignmentsLocked, draftBlockedWebsiteModes, editableMode, triggerAssignmentFeedback]);

  const handleToggleSearchTarget = useCallback((term: string) => {
    if (!editableMode) return;
    if (assignmentsLocked) return;

    const normalizedTerm = normalizeTargetValue('search', term);
    const previousMode = draftBlockedSearchTermModes[normalizedTerm];

    applyBlockingDraftMutation((current) => toggleTargetModeInDraftState(current, 'search', normalizedTerm, editableMode));
    triggerAssignmentFeedback(
      previousMode === editableMode ? 'Suchbegriff aus diesem Modus entfernt' : 'Suchbegriff diesem Modus zugewiesen',
      previousMode === editableMode ? 'Search term removed from this mode' : 'Search term assigned to this mode',
    );
  }, [applyBlockingDraftMutation, assignmentsLocked, draftBlockedSearchTermModes, editableMode, triggerAssignmentFeedback]);

  const handleAddWebsite = useCallback(() => {
    if (selectedMode !== 'strict' && selectedMode !== 'learn' && selectedMode !== 'penalty') return;
    if (assignmentsLocked) return;

    const url = normalizeTargetValue('website', newWebsite.trim().replace(/^https?:\/\//, '').replace(/\/$/, ''));
    if (!url) return;

    applyBlockingDraftMutation((current) => assignTargetModeToDraftState(current, 'website', url, selectedMode));
    setNewWebsite('');
    triggerAssignmentFeedback('Website hinzugefuegt', 'Website added');
  }, [applyBlockingDraftMutation, assignmentsLocked, newWebsite, selectedMode, setNewWebsite, triggerAssignmentFeedback]);

  const handleAddSearchTerm = useCallback(() => {
    if (selectedMode !== 'strict' && selectedMode !== 'learn' && selectedMode !== 'penalty') return;
    if (assignmentsLocked) return;

    const term = normalizeTargetValue('search', newSearchTerm);
    if (!term) return;

    applyBlockingDraftMutation((current) => assignTargetModeToDraftState(current, 'search', term, selectedMode));
    setNewSearchTerm('');
    triggerAssignmentFeedback('Suchbegriff hinzugefuegt', 'Search term added');
  }, [applyBlockingDraftMutation, assignmentsLocked, newSearchTerm, selectedMode, setNewSearchTerm, triggerAssignmentFeedback]);

  const handleRemoveWebsite = useCallback((website: string) => {
    if (assignmentsLocked) return;
    const normalizedWebsite = normalizeTargetValue('website', website);

    applyBlockingDraftMutation((current) => removeTargetFromDraftState(current, 'website', normalizedWebsite));
    triggerAssignmentFeedback('Website entfernt', 'Website removed');
  }, [applyBlockingDraftMutation, assignmentsLocked, triggerAssignmentFeedback]);

  const handleRemoveSearchTerm = useCallback((term: string) => {
    if (assignmentsLocked) return;
    const normalizedTerm = normalizeTargetValue('search', term);

    applyBlockingDraftMutation((current) => removeTargetFromDraftState(current, 'search', normalizedTerm));
    triggerAssignmentFeedback('Suchbegriff entfernt', 'Search term removed');
  }, [applyBlockingDraftMutation, assignmentsLocked, triggerAssignmentFeedback]);

  const handleSetDraftBlockSchedule = useCallback((appId: string, from: string, to: string) => {
    if (assignmentsLocked) return;
    const normalizedAppId = normalizeTargetValue('app', appId);

    applyBlockingDraftMutation((current) => updateAppDraftSchedule(current, normalizedAppId, { from, to }));
  }, [applyBlockingDraftMutation, assignmentsLocked]);

  const handleRemoveDraftBlockSchedule = useCallback((appId: string) => {
    if (assignmentsLocked) return;
    const normalizedAppId = normalizeTargetValue('app', appId);

    applyBlockingDraftMutation((current) => updateAppDraftSchedule(current, normalizedAppId, null));
  }, [applyBlockingDraftMutation, assignmentsLocked]);

  return {
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
  };
}
