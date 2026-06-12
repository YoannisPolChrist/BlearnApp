import { useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { getActiveStrictAddonModes } from '@/lib/targetModes';
import type { StrictAddonMap } from '@/lib/targetModes';

/** Returns true if `now` is outside the [startTime, endTime] daily window. */
function isOutsideScheduleWindow(startTime: string, endTime: string, now = Date.now()): boolean {
  const nowDate = new Date(now);
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);

  const startDate = new Date(nowDate);
  startDate.setHours(startH, startM, 0, 0);

  const endDate = new Date(nowDate);
  endDate.setHours(endH, endM, 0, 0);

  // Handle overnight windows (e.g. 22:00 – 06:00)
  if (endDate.getTime() <= startDate.getTime()) {
    endDate.setDate(endDate.getDate() + 1);
  }

  return now < startDate.getTime() || now >= endDate.getTime();
}

/** Returns the ms until the configured end of the current or next window. */
function msUntilWindowEnd(startTime: string, endTime: string, now = Date.now()): number {
  const nowDate = new Date(now);
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);

  const startDate = new Date(nowDate);
  startDate.setHours(startH, startM, 0, 0);

  const endDate = new Date(nowDate);
  endDate.setHours(endH, endM, 0, 0);

  if (endDate.getTime() <= startDate.getTime()) {
    endDate.setDate(endDate.getDate() + 1);
  }

  return Math.max(0, endDate.getTime() - now);
}

/** Returns true if any active addon lock should be dismissed because we are
 *  outside its configured schedule window. */
function hasAddonLocksOutsideWindow(strictAddons: StrictAddonMap, now = Date.now()): boolean {
  const activeModes = getActiveStrictAddonModes(strictAddons, now);
  return activeModes.some((mode) => {
    const addon = strictAddons[mode];
    return isOutsideScheduleWindow(addon.startTime, addon.endTime, now);
  });
}

export function useStrictLockExpirySync() {
  const strictLockUntil = useAppStore((state) => state.strictLockUntil);
  const strictStartTime = useAppStore((state) => state.strictStartTime);
  const strictEndTime = useAppStore((state) => state.strictEndTime);
  const clearExpiredStrictLock = useAppStore((state) => state.clearExpiredStrictLock);
  const forceReleaseLock = useAppStore((state) => state.forceReleaseLock);
  const forceReleaseAddonLocks = useAppStore((state) => state.forceReleaseAddonLocks);
  const strictAddons = useAppStore((state) => state.strictAddons);
  const clearExpiredStrictAddons = useAppStore((state) => state.clearExpiredStrictAddons);

  // ── Main strict lock ────────────────────────────────────────────────────
  useEffect(() => {
    if (!strictLockUntil) return;

    const now = Date.now();

    // Expired by timestamp
    if (now >= strictLockUntil) {
      clearExpiredStrictLock();
      return;
    }

    // Still "valid" by timestamp but we are outside the configured window →
    // the lock was set before the window ended and survived into the next day.
    if (isOutsideScheduleWindow(strictStartTime, strictEndTime, now)) {
      forceReleaseLock();
      return;
    }

    // Schedule a clear when the window ends (whichever comes first).
    const msUntilExpiry = strictLockUntil - now;
    const msUntilEnd = msUntilWindowEnd(strictStartTime, strictEndTime, now);
    const delay = Math.min(msUntilExpiry, msUntilEnd);

    const timeout = window.setTimeout(() => {
      forceReleaseLock();
    }, delay);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [clearExpiredStrictLock, forceReleaseLock, strictLockUntil, strictStartTime, strictEndTime]);

  // ── Strict addon locks (Reflexionsmodus etc.) ────────────────────────────
  useEffect(() => {
    const now = Date.now();
    const activeModes = getActiveStrictAddonModes(strictAddons, now);

    if (activeModes.length === 0) return;

    // If any active addon lock is outside its own schedule window, clear all
    // immediately. This fixes the "stuck outside schedule" bug where lockUntil
    // is still in the future but the daily window has already ended.
    if (hasAddonLocksOutsideWindow(strictAddons, now)) {
      forceReleaseAddonLocks();
      return;
    }

    // Find the earliest moment at which we should re-evaluate:
    // either lockUntil expires OR the addon's schedule window ends.
    const deadlines = activeModes.flatMap((mode) => {
      const addon = strictAddons[mode];
      const timestamps: number[] = [];
      if (typeof addon.lockUntil === 'number') timestamps.push(addon.lockUntil);
      const windowEnd = now + msUntilWindowEnd(addon.startTime, addon.endTime, now);
      timestamps.push(windowEnd);
      return timestamps;
    });

    const nextDeadline = Math.min(...deadlines);
    if (!Number.isFinite(nextDeadline) || nextDeadline <= now) {
      clearExpiredStrictAddons();
      return;
    }

    const timeout = window.setTimeout(() => {
      clearExpiredStrictAddons();
    }, nextDeadline - now);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [clearExpiredStrictAddons, forceReleaseAddonLocks, strictAddons]);
}
