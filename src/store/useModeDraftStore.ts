import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { ModeId } from '@/components/modes/ModesSections';
import type { StrictAddonMap } from '@/lib/targetModes';
import {
  normalizeDraftBlockingState,
  type DraftBlockingState,
} from '@/modules/modes/draftBlocking';
import { normalizeStrictAddons } from '@/store/appStore.shared';

export type ModeDraftSnapshot = {
  selectedMode: ModeId;
  strictAddons: StrictAddonMap;
  startTime: string;
  endTime: string;
  breathingRounds: number;
  interventionInterval: number;
  activeDeckId?: string;
  sessionCreditsRequired: number;
  unlockDurationMinutes: number;
  interventionPatternId: string;
  blocking: DraftBlockingState;
  penaltyReadyConfirmed: boolean;
};

interface ModeDraftStore {
  snapshot: ModeDraftSnapshot | null;
  saveSnapshot: (snapshot: ModeDraftSnapshot) => void;
  clearSnapshot: () => void;
}

function areModeDraftSnapshotsEqual(
  left: ModeDraftSnapshot | null,
  right: ModeDraftSnapshot | null,
) {
  if (left === right) {
    return true;
  }

  if (!left || !right) {
    return false;
  }

  return JSON.stringify(left) === JSON.stringify(right);
}

export function normalizeModeDraftSnapshot(snapshot: ModeDraftSnapshot): ModeDraftSnapshot {
  return {
    ...snapshot,
    startTime: snapshot.startTime.trim(),
    endTime: snapshot.endTime.trim(),
    strictAddons: normalizeStrictAddons(snapshot.strictAddons),
    breathingRounds: Math.max(0, Math.round(snapshot.breathingRounds)),
    interventionInterval: Math.max(0, Math.round(snapshot.interventionInterval)),
    activeDeckId: snapshot.activeDeckId?.trim() || undefined,
    sessionCreditsRequired: Math.max(0, Math.round(snapshot.sessionCreditsRequired)),
    unlockDurationMinutes: Math.max(0, Math.round(snapshot.unlockDurationMinutes)),
    interventionPatternId: snapshot.interventionPatternId.trim(),
    blocking: normalizeDraftBlockingState(snapshot.blocking),
  };
}

export const useModeDraftStore = create<ModeDraftStore>()(
  subscribeWithSelector((set) => ({
    snapshot: null,
    saveSnapshot: (snapshot) =>
      set((state) => {
        const normalizedSnapshot = normalizeModeDraftSnapshot(snapshot);
        if (areModeDraftSnapshotsEqual(state.snapshot, normalizedSnapshot)) {
          return state;
        }

        return { snapshot: normalizedSnapshot };
      }),
    clearSnapshot: () =>
      set((state) => {
        if (state.snapshot === null) {
          return state;
        }

        return { snapshot: null };
      }),
  })),
);

export type { DraftBlockingState } from '@/modules/modes/draftBlocking';
