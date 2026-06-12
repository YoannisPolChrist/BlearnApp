import { normalizeTargetValue, type TargetModeId } from '@/lib/targetModes';

export type DraftBlockingState = {
  blockedApps: string[];
  blockedAppModes: Record<string, TargetModeId>;
  blockedWebsites: string[];
  blockedWebsiteModes: Record<string, TargetModeId>;
  blockedSearchTerms: string[];
  blockedSearchTermModes: Record<string, TargetModeId>;
  blockSchedules: Record<string, { from: string; to: string }>;
};

export type DraftTargetType = 'app' | 'website' | 'search';

const DEFAULT_ALL_DAY_BLOCK_SCHEDULE = { from: '00:00', to: '23:59' } as const;

function sortValues(values: string[]) {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function normalizeModeRecord(record: Record<string, TargetModeId>) {
  return Object.fromEntries(
    Object.entries(record).sort(([left], [right]) => left.localeCompare(right)),
  );
}

function normalizeScheduleRecord(record: Record<string, { from: string; to: string }>) {
  return Object.fromEntries(
    Object.entries(record).sort(([left], [right]) => left.localeCompare(right)),
  );
}

function normalizeTargets<T extends DraftTargetType>(
  targetType: T,
  values: string[],
) {
  return Array.from(
    new Set(
      values
        .map((value) => normalizeTargetValue(targetType, value))
        .filter((value): value is string => Boolean(value)),
    ),
  );
}

function normalizeTargetModes<T extends DraftTargetType>(
  targetType: T,
  modes: Record<string, TargetModeId>,
) {
  return Object.fromEntries(
    Object.entries(modes)
      .map(([targetId, mode]) => [normalizeTargetValue(targetType, targetId), mode] as const)
      .filter((entry): entry is readonly [string, TargetModeId] => Boolean(entry[0] && entry[1])),
  );
}

export function normalizeDraftBlockingState(blocking: DraftBlockingState): DraftBlockingState {
  return {
    blockedApps: normalizeTargets('app', blocking.blockedApps),
    blockedAppModes: normalizeTargetModes('app', blocking.blockedAppModes),
    blockedWebsites: normalizeTargets('website', blocking.blockedWebsites),
    blockedWebsiteModes: normalizeTargetModes('website', blocking.blockedWebsiteModes),
    blockedSearchTerms: normalizeTargets('search', blocking.blockedSearchTerms),
    blockedSearchTermModes: normalizeTargetModes('search', blocking.blockedSearchTermModes),
    blockSchedules: Object.fromEntries(
      Object.entries(blocking.blockSchedules)
        .map(([app, schedule]) => {
          const normalizedApp = normalizeTargetValue('app', app);
          const normalizedSchedule =
            schedule && typeof schedule.from === 'string' && typeof schedule.to === 'string'
              ? { from: schedule.from.trim(), to: schedule.to.trim() }
              : null;

          return [normalizedApp, normalizedSchedule] as const;
        })
        .filter(
          (entry): entry is readonly [string, { from: string; to: string }] =>
            Boolean(entry[0] && entry[1]?.from && entry[1]?.to),
        ),
    ),
  };
}

export function haveBlockingDraftChanges(source: DraftBlockingState, draft: DraftBlockingState) {
  return JSON.stringify({
    blockedApps: sortValues(source.blockedApps),
    blockedAppModes: normalizeModeRecord(source.blockedAppModes),
    blockedWebsites: sortValues(source.blockedWebsites),
    blockedWebsiteModes: normalizeModeRecord(source.blockedWebsiteModes),
    blockedSearchTerms: sortValues(source.blockedSearchTerms),
    blockedSearchTermModes: normalizeModeRecord(source.blockedSearchTermModes),
    blockSchedules: normalizeScheduleRecord(source.blockSchedules),
  }) !== JSON.stringify({
    blockedApps: sortValues(draft.blockedApps),
    blockedAppModes: normalizeModeRecord(draft.blockedAppModes),
    blockedWebsites: sortValues(draft.blockedWebsites),
    blockedWebsiteModes: normalizeModeRecord(draft.blockedWebsiteModes),
    blockedSearchTerms: sortValues(draft.blockedSearchTerms),
    blockedSearchTermModes: normalizeModeRecord(draft.blockedSearchTermModes),
    blockSchedules: normalizeScheduleRecord(draft.blockSchedules),
  });
}

export function cloneBlockingDraftState(state: DraftBlockingState): DraftBlockingState {
  return {
    blockedApps: [...state.blockedApps],
    blockedAppModes: { ...state.blockedAppModes },
    blockedWebsites: [...state.blockedWebsites],
    blockedWebsiteModes: { ...state.blockedWebsiteModes },
    blockedSearchTerms: [...state.blockedSearchTerms],
    blockedSearchTermModes: { ...state.blockedSearchTermModes },
    blockSchedules: { ...state.blockSchedules },
  };
}

function appendUniqueValue(values: string[], nextValue: string) {
  return values.includes(nextValue) ? values : [...values, nextValue];
}

function removeValue(values: string[], valueToRemove: string) {
  return values.filter((value) => value !== valueToRemove);
}

export function assignTargetModeToDraftState(
  state: DraftBlockingState,
  targetType: DraftTargetType,
  targetId: string,
  mode: TargetModeId,
): DraftBlockingState {
  const nextState = cloneBlockingDraftState(state);

  if (targetType === 'app') {
    nextState.blockedApps = appendUniqueValue(nextState.blockedApps, targetId);
    nextState.blockedAppModes[targetId] = mode;
    nextState.blockSchedules[targetId] = nextState.blockSchedules[targetId] ?? { ...DEFAULT_ALL_DAY_BLOCK_SCHEDULE };
    return nextState;
  }

  if (targetType === 'website') {
    nextState.blockedWebsites = appendUniqueValue(nextState.blockedWebsites, targetId);
    nextState.blockedWebsiteModes[targetId] = mode;
    return nextState;
  }

  nextState.blockedSearchTerms = appendUniqueValue(nextState.blockedSearchTerms, targetId);
  nextState.blockedSearchTermModes[targetId] = mode;
  return nextState;
}

export function removeTargetFromDraftState(
  state: DraftBlockingState,
  targetType: DraftTargetType,
  targetId: string,
): DraftBlockingState {
  const nextState = cloneBlockingDraftState(state);

  if (targetType === 'app') {
    nextState.blockedApps = removeValue(nextState.blockedApps, targetId);
    delete nextState.blockedAppModes[targetId];
    delete nextState.blockSchedules[targetId];
    return nextState;
  }

  if (targetType === 'website') {
    nextState.blockedWebsites = removeValue(nextState.blockedWebsites, targetId);
    delete nextState.blockedWebsiteModes[targetId];
    return nextState;
  }

  nextState.blockedSearchTerms = removeValue(nextState.blockedSearchTerms, targetId);
  delete nextState.blockedSearchTermModes[targetId];
  return nextState;
}

export function toggleTargetModeInDraftState(
  state: DraftBlockingState,
  targetType: DraftTargetType,
  targetId: string,
  mode: TargetModeId,
): DraftBlockingState {
  const currentMode =
    targetType === 'app'
      ? state.blockedAppModes[targetId]
      : targetType === 'website'
        ? state.blockedWebsiteModes[targetId]
        : state.blockedSearchTermModes[targetId];

  if (currentMode === mode) {
    return removeTargetFromDraftState(state, targetType, targetId);
  }

  return assignTargetModeToDraftState(state, targetType, targetId, mode);
}

export function updateAppDraftSchedule(
  state: DraftBlockingState,
  appId: string,
  schedule: { from: string; to: string } | null,
): DraftBlockingState {
  const nextState = cloneBlockingDraftState(state);
  if (schedule) {
    nextState.blockSchedules[appId] = schedule;
  } else {
    delete nextState.blockSchedules[appId];
  }

  return nextState;
}

export function clearAppTargetsForModeFromDraftState(
  state: DraftBlockingState,
  mode: TargetModeId,
): DraftBlockingState {
  let nextState = cloneBlockingDraftState(state);
  Object.entries(state.blockedAppModes).forEach(([appId, assignedMode]) => {
    if (assignedMode === mode) {
      nextState = removeTargetFromDraftState(nextState, 'app', appId);
    }
  });
  return nextState;
}
