import type { AppState } from '@/store/appStore.types';
import {
  type AppStoreSlice,
  applyModeState,
  getAssignedTargetModeFromState,
  normalizeBlockSchedules,
  normalizeTargetIds,
  normalizeTargetModeRecord,
  normalizeTargetValue,
  setTargetModeRecord,
} from '@/store/appStore.shared';
import {
  getActiveStrictAddonLockedAppsByMode,
  type StrictAddonModeId,
  type TargetModeId,
} from '@/lib/targetModes';
import { buildUnlockedTargetKey } from '@/lib/unlockedTargets';

const DEFAULT_ALL_DAY_BLOCK_SCHEDULE = { from: '00:00', to: '23:59' } as const;

export const createBlockingSlice: AppStoreSlice<Partial<AppState>> = (set, get) => ({
  blockedApps: [],
  blockedAppModes: {},
  toggleBlockedApp: (app, mode) => {
    const normalizedApp = normalizeTargetValue('app', app);
    if (!normalizedApp) return;

    set((state) => {
      const lockedByMode = getActiveStrictAddonLockedAppsByMode(state.strictAddons);
      const currentMode = state.blockedAppModes[normalizedApp];
      const lockedModeEntry = Object.entries(lockedByMode).find(([, set]) => set.has(normalizedApp));
      if (lockedModeEntry && lockedModeEntry[0] !== currentMode) {
        return state;
      }
      const lockedSetForCurrentMode = currentMode ? lockedByMode[currentMode as StrictAddonModeId] : null;
      if (lockedSetForCurrentMode?.has(normalizedApp)) {
        return state;
      }
      const lockedSetForTargetMode = lockedByMode[mode as StrictAddonModeId];
      if (lockedSetForTargetMode && !lockedSetForTargetMode.has(normalizedApp)) {
        return state;
      }
      const shouldRemove = currentMode === mode;
      const nextBlockSchedules = { ...state.blockSchedules };

      if (shouldRemove) {
        delete nextBlockSchedules[normalizedApp];
      }

      return applyModeState(state, {
        blockedApps: shouldRemove
          ? state.blockedApps.filter((entry) => entry !== normalizedApp)
          : state.blockedApps.includes(normalizedApp)
            ? state.blockedApps
            : [...state.blockedApps, normalizedApp],
        blockedAppModes: setTargetModeRecord(
          state.blockedAppModes,
          'app',
          normalizedApp,
          shouldRemove ? null : mode,
        ),
        blockSchedules: shouldRemove
          ? nextBlockSchedules
          : {
              ...nextBlockSchedules,
              [normalizedApp]: nextBlockSchedules[normalizedApp] ?? { ...DEFAULT_ALL_DAY_BLOCK_SCHEDULE },
            },
      });
    });
  },
  setBlockedAppsMode: (apps, mode) => {
    const normalizedApps = normalizeTargetIds('app', apps);
    if (normalizedApps.length === 0) return;

    set((state) => {
      const lockedByMode = getActiveStrictAddonLockedAppsByMode(state.strictAddons);
      const lockedSetForTargetMode = lockedByMode[mode as StrictAddonModeId];
      const filteredApps = normalizedApps.filter((appId) => {
        const lockedModeEntry = Object.entries(lockedByMode).find(([, set]) => set.has(appId));
        if (lockedModeEntry && lockedModeEntry[0] !== mode) {
          return false;
        }
        if (lockedSetForTargetMode && !lockedSetForTargetMode.has(appId)) {
          return false;
        }
        return true;
      });

      if (filteredApps.length === 0) {
        return state;
      }

      return applyModeState(state, {
        blockedApps: Array.from(new Set([...state.blockedApps, ...filteredApps])),
        blockedAppModes: filteredApps.reduce(
          (record, appId) => setTargetModeRecord(record, 'app', appId, mode),
          state.blockedAppModes,
        ),
        blockSchedules: filteredApps.reduce(
          (record, appId) => ({
            ...record,
            [appId]: record[appId] ?? { ...DEFAULT_ALL_DAY_BLOCK_SCHEDULE },
          }),
          { ...state.blockSchedules },
        ),
      });
    });
  },

  replaceBlockingState: (payload) =>
    set((state) => {
      const normalizedBlockedApps = normalizeTargetIds('app', payload.blockedApps);
      const normalizedBlockedWebsites = normalizeTargetIds('website', payload.blockedWebsites);
      const normalizedBlockedSearchTerms = normalizeTargetIds('search', payload.blockedSearchTerms);
      const normalizedBlockedAppModes = normalizeTargetModeRecord('app', payload.blockedAppModes);
      const normalizedBlockedWebsiteModes = normalizeTargetModeRecord('website', payload.blockedWebsiteModes);
      const normalizedBlockedSearchTermModes = normalizeTargetModeRecord('search', payload.blockedSearchTermModes);
      const normalizedBlockSchedules = normalizeBlockSchedules(payload.blockSchedules, normalizedBlockedApps);

      const lockedByMode = getActiveStrictAddonLockedAppsByMode(state.strictAddons);
      const lockedAppIds = Object.values(lockedByMode).flatMap((set) => Array.from(set));
      const nextBlockedApps = new Set([...normalizedBlockedApps, ...lockedAppIds]);
      const nextBlockedAppModes = { ...normalizedBlockedAppModes };
      const nextBlockSchedules = { ...normalizedBlockSchedules };

      Object.entries(lockedByMode).forEach(([mode, lockedSet]) => {
        lockedSet.forEach((appId) => {
          nextBlockedAppModes[appId] = mode as TargetModeId;
          nextBlockSchedules[appId] = nextBlockSchedules[appId] ?? { ...DEFAULT_ALL_DAY_BLOCK_SCHEDULE };
        });
      });

      return applyModeState(state, {
        blockedApps: Array.from(nextBlockedApps),
        blockedAppModes: nextBlockedAppModes,
        blockedWebsites: normalizedBlockedWebsites,
        blockedWebsiteModes: normalizedBlockedWebsiteModes,
        blockedSearchTerms: normalizedBlockedSearchTerms,
        blockedSearchTermModes: normalizedBlockedSearchTermModes,
        blockSchedules: nextBlockSchedules,
      });
    }),
  blockedWebsites: [],
  blockedWebsiteModes: {},
  blockedSearchTerms: [],
  blockedSearchTermModes: {},
  toggleBlockedWebsite: (url, mode) => {
    const normalizedUrl = normalizeTargetValue('website', url);
    if (!normalizedUrl) return;

    set((state) => {
      const currentMode = state.blockedWebsiteModes[normalizedUrl];
      const shouldRemove = currentMode === mode;

      return applyModeState(state, {
        blockedWebsites: shouldRemove
          ? state.blockedWebsites.filter((entry) => entry !== normalizedUrl)
          : state.blockedWebsites.includes(normalizedUrl)
            ? state.blockedWebsites
            : [...state.blockedWebsites, normalizedUrl],
        blockedWebsiteModes: setTargetModeRecord(
          state.blockedWebsiteModes,
          'website',
          normalizedUrl,
          shouldRemove ? null : mode,
        ),
      });
    });
  },
  addBlockedWebsite: (url, mode) => {
    const normalizedUrl = normalizeTargetValue('website', url);
    if (!normalizedUrl) return;

    set((state) => applyModeState(state, {
      blockedWebsites: state.blockedWebsites.includes(normalizedUrl)
        ? state.blockedWebsites
        : [...state.blockedWebsites, normalizedUrl],
      blockedWebsiteModes: setTargetModeRecord(state.blockedWebsiteModes, 'website', normalizedUrl, mode),
    }));
  },
  removeBlockedWebsite: (url) => {
    const normalizedUrl = normalizeTargetValue('website', url);
    if (!normalizedUrl) return;

    set((state) => applyModeState(state, {
      blockedWebsites: state.blockedWebsites.filter((entry) => entry !== normalizedUrl),
      blockedWebsiteModes: setTargetModeRecord(state.blockedWebsiteModes, 'website', normalizedUrl, null),
    }));
  },
  toggleBlockedSearchTerm: (term, mode) => {
    const normalizedTerm = normalizeTargetValue('search', term);
    if (!normalizedTerm) return;

    set((state) => {
      const currentMode = state.blockedSearchTermModes[normalizedTerm];
      const shouldRemove = currentMode === mode;

      return applyModeState(state, {
        blockedSearchTerms: shouldRemove
          ? state.blockedSearchTerms.filter((entry) => entry !== normalizedTerm)
          : state.blockedSearchTerms.includes(normalizedTerm)
            ? state.blockedSearchTerms
            : [...state.blockedSearchTerms, normalizedTerm],
        blockedSearchTermModes: setTargetModeRecord(
          state.blockedSearchTermModes,
          'search',
          normalizedTerm,
          shouldRemove ? null : mode,
        ),
      });
    });
  },
  addBlockedSearchTerm: (term, mode) => {
    const normalizedTerm = normalizeTargetValue('search', term);
    if (!normalizedTerm) return;

    set((state) => applyModeState(state, {
      blockedSearchTerms: state.blockedSearchTerms.includes(normalizedTerm)
        ? state.blockedSearchTerms
        : [...state.blockedSearchTerms, normalizedTerm],
      blockedSearchTermModes: setTargetModeRecord(state.blockedSearchTermModes, 'search', normalizedTerm, mode),
    }));
  },
  removeBlockedSearchTerm: (term) => {
    const normalizedTerm = normalizeTargetValue('search', term);
    if (!normalizedTerm) return;

    set((state) => applyModeState(state, {
      blockedSearchTerms: state.blockedSearchTerms.filter((entry) => entry !== normalizedTerm),
      blockedSearchTermModes: setTargetModeRecord(state.blockedSearchTermModes, 'search', normalizedTerm, null),
    }));
  },
  getTargetMode: (targetId, targetType) => getAssignedTargetModeFromState(get(), targetType, targetId),

  interventionPatternId: 'box',
  setInterventionPatternId: (id) => set({ interventionPatternId: id }),

  unlockedTargets: {},
  blockSchedules: {},
  setBlockSchedule: (app, from, to) => {
    const normalizedApp = normalizeTargetValue('app', app);
    const normalizedFrom = from.trim();
    const normalizedTo = to.trim();
    if (!normalizedApp || !normalizedFrom || !normalizedTo) return;

    set((state) => ({
      blockSchedules: {
        ...state.blockSchedules,
        [normalizedApp]: { from: normalizedFrom, to: normalizedTo },
      },
    }));
  },
  removeBlockSchedule: (app) => {
    const normalizedApp = normalizeTargetValue('app', app);
    if (!normalizedApp) return;

    set((state) => {
      const updated = { ...state.blockSchedules };
      delete updated[normalizedApp];
      return { blockSchedules: updated };
    });
  },
  unlockTarget: (targetId, targetType, durationMinutes) => {
    const { defaultUnlockDurationMinutes } = get();
    const expiresAt = Date.now() + (durationMinutes ?? defaultUnlockDurationMinutes) * 60 * 1000;
    const targetKey = buildUnlockedTargetKey(targetId, targetType);
    if (!targetKey) return;

    set((state) => ({
      unlockedTargets: { ...state.unlockedTargets, [targetKey]: expiresAt },
    }));
  },
  isTargetUnlocked: (targetId, targetType) => {
    const { unlockedTargets } = get();
    const key = buildUnlockedTargetKey(targetId, targetType);
    if (!key) return false;

    const expiry = unlockedTargets[key];
    if (!expiry) return false;
    if (Date.now() < expiry) return true;
    const updated = { ...unlockedTargets };
    delete updated[key];
    set({ unlockedTargets: updated });
    return false;
  },

  nativeRuntimeIssues: {
    blockingService: null,
    websiteBlocking: null,
    searchTermSync: null,
    policySync: null,
  },
  setNativeRuntimeIssue: (key, message) =>
    set((state) => {
      if (state.nativeRuntimeIssues[key] === message) {
        return state;
      }

      return {
        nativeRuntimeIssues: {
          ...state.nativeRuntimeIssues,
          [key]: message,
        },
      };
    }),
  clearNativeRuntimeIssue: (key) =>
    set((state) => {
      if (state.nativeRuntimeIssues[key] === null) {
        return state;
      }

      return {
        nativeRuntimeIssues: {
          ...state.nativeRuntimeIssues,
          [key]: null,
        },
      };
    }),
});
