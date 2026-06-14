import type { AppState } from '@/store/appStore.types';
import {
  type AppStoreSlice,
  applyModeState,
} from '@/store/appStore.shared';
import {
  createDefaultStrictAddonMap,
  isStrictAddonActive,
  type StrictAddonModeId,
} from '@/lib/targetModes';
import { clampStrictLockEnd } from '@/lib/strictLockLimits';
import { resolveScheduleWindow } from '@/lib/scheduleWindow';

export const createModeSlice: AppStoreSlice<Partial<AppState>> = (set, get) => ({
  activeMode: 'normal',
  activeModes: [],
  savedModeSelection: null,
  strictAddons: createDefaultStrictAddonMap(),
  blockingMode: 'reflective',
  strictStartTime: '08:00',
  strictEndTime: '17:00',
  breathingRounds: 3,
  interventionInterval: 20,
  defaultUnlockDurationMinutes: 15,
  modeProtection: 'standard',
  lastModeActivation: null,
  setSavedModeSelection: (mode) => set((state) => applyModeState(state, { savedModeSelection: mode })),
  setStrictAddonState: (mode, next) =>
    set((state) => {
      const current = state.strictAddons[mode];
      const active = isStrictAddonActive(current);
      const nextAddons = {
        ...state.strictAddons,
        [mode]: {
          ...(active
            ? {
                ...current,
                enabled: current.enabled,
                startTime: current.startTime,
                endTime: current.endTime,
                lockUntil: current.lockUntil,
                lockedAppIds: [...current.lockedAppIds],
              }
            : {
                ...next,
                lockedAppIds: [...next.lockedAppIds],
              }),
        },
      };

      return applyModeState(state, { strictAddons: nextAddons });
    }),
  setStrictAddonConfig: (mode, partial) =>
    set((state) => {
      const current = state.strictAddons[mode];
      const now = Date.now();
      const active = isStrictAddonActive(current, now);
      const next = {
        ...current,
        ...partial,
        lockedAppIds: Array.isArray(partial.lockedAppIds) ? [...partial.lockedAppIds] : current.lockedAppIds,
      };

      if (active) {
        if (partial.enabled === false) {
          next.enabled = current.enabled;
        }
        if (typeof partial.startTime === 'string' || typeof partial.endTime === 'string') {
          next.startTime = current.startTime;
          next.endTime = current.endTime;
        }
        if (Array.isArray(partial.lockedAppIds)) {
          next.lockedAppIds = current.lockedAppIds;
        }
        if ('lockUntil' in partial) {
          next.lockUntil = current.lockUntil;
        }
      }

      return applyModeState(state, {
        strictAddons: {
          ...state.strictAddons,
          [mode]: next,
        },
      });
    }),
  setBlockingMode: (mode) => set({ blockingMode: mode }),
  setStrictSchedule: (start, end) =>
    set((state) => {
      // Requirement: settings are immutable while the strict window runs.
      // The UI disables these controls, but the store is the last line of
      // defense — a locked schedule silently changing would void the
      // commitment the user made.
      const lockActive = state.strictLockUntil !== null && Date.now() < state.strictLockUntil;
      if (lockActive) {
        return state;
      }
      return { ...state, strictStartTime: start, strictEndTime: end };
    }),
  setBreathingRounds: (rounds) => set({ breathingRounds: rounds }),
  setInterventionInterval: (minutes) => set({ interventionInterval: minutes }),
  setDefaultUnlockDurationMinutes: (minutes) => set({ defaultUnlockDurationMinutes: minutes }),
  setModeProtection: (modeProtection) => set({ modeProtection }),

  strictLockUntil: null,
  strictLockScope: null,
  activateStrictLock: (options) => {
    const { strictStartTime, strictEndTime } = get();
    const now = Date.now();
    const preserveActiveMode = options?.preserveActiveMode ?? false;
    const scope = options?.scope ?? (preserveActiveMode ? 'settings' : 'full');

    // Beruecksichtigt Nacht-Fenster korrekt – inklusive Aktivierung nach
    // Mitternacht im Morgen-Teil eines gestern gestarteten Fensters.
    const { start, end } = resolveScheduleWindow(strictStartTime, strictEndTime, now);

    // Guard: only activate the strict lock inside the configured window.
    if (end <= now || now < start) {
      return;
    }

    // Hard cap (requirement): a strict lock never exceeds 20 hours from
    // activation, regardless of how the window was configured or persisted.
    // Auf das übernacht-korrekte Fensterende (`end`) angewandt.
    const lockUntil = clampStrictLockEnd(now, end);

    set((state) => applyModeState(state, {
      strictLockUntil: lockUntil,
      strictLockScope: scope,
    }, now));
  },
  activateStrictAddon: (mode: StrictAddonModeId, lockedAppIds: string[]) => {
    const { strictAddons } = get();
    const current = strictAddons[mode];
    const now = Date.now();

    const { start, end } = resolveScheduleWindow(current.startTime, current.endTime, now);

    // Guard: only activate the addon lock inside the configured window.
    if (end <= now || now < start) {
      return;
    }

    // Same hard cap as the main strict lock: never more than 20 hours.
    const addonLockUntil = clampStrictLockEnd(now, end);

    const uniqueLockedApps = Array.from(new Set(lockedAppIds));

    set((state) => applyModeState(state, {
      strictAddons: {
        ...state.strictAddons,
        [mode]: {
          ...state.strictAddons[mode],
          enabled: true,
          lockUntil: addonLockUntil,
          lockedAppIds: uniqueLockedApps,
        },
      },
    }, now));
  },
  clearExpiredStrictLock: () => {
    const { strictLockUntil } = get();
    if (!strictLockUntil || Date.now() < strictLockUntil) return;

    set((state) => applyModeState(state, { strictLockUntil: null, strictLockScope: null }));
  },
  forceReleaseLock: () => {
    set((state) => applyModeState(state, { strictLockUntil: null, strictLockScope: null }));
  },
  forceReleaseAddonLocks: () => {
    const { strictAddons } = get();
    const nextAddons = Object.fromEntries(
      Object.entries(strictAddons).map(([mode, addon]) => [
        mode,
        { ...addon, enabled: false, lockUntil: null, lockedAppIds: [] },
      ]),
    ) as typeof strictAddons;
    set((state) => applyModeState(state, { strictAddons: nextAddons }));
  },
  clearExpiredStrictAddons: () => {
    const now = Date.now();
    const { strictAddons } = get();
    let changed = false;

    const nextAddons = Object.fromEntries(
      Object.entries(strictAddons).map(([mode, addon]) => {
        if (!addon.lockUntil || addon.lockUntil > now) {
          return [mode, addon];
        }

        changed = true;
        return [mode, {
          ...addon,
          enabled: false,
          lockUntil: null,
          lockedAppIds: [],
        }];
      }),
    ) as typeof strictAddons;

    if (!changed) return;

    set((state) => applyModeState(state, { strictAddons: nextAddons }));
  },
  isStrictLocked: () => {
    const { strictLockUntil } = get();
    return strictLockUntil !== null && Date.now() < strictLockUntil;
  },
  isStrictAddonLocked: (mode: StrictAddonModeId) => {
    const { strictAddons } = get();
    return isStrictAddonActive(strictAddons[mode]);
  },
  getStrictLockRemaining: () => {
    const { strictLockUntil } = get();
    if (!strictLockUntil) return 0;
    const remaining = strictLockUntil - Date.now();
    return remaining > 0 ? remaining : 0;
  },
});
