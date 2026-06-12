/**
 * Strict-lock limits (single source of truth).
 *
 * Requirement: once strict mode is activated, the user commits to a time
 * window during which protective settings cannot be changed — capped at a
 * maximum of 20 hours. The UI validates this before saving; the store
 * enforces it again as defense-in-depth so no code path (or persisted
 * tampering) can produce a longer lock.
 */
export const MAX_STRICT_LOCK_DURATION_HOURS = 20;
export const MAX_STRICT_LOCK_DURATION_MS = MAX_STRICT_LOCK_DURATION_HOURS * 60 * 60 * 1000;

/** Clamp a lock end timestamp so the lock never exceeds the maximum. */
export function clampStrictLockEnd(nowMs: number, endMs: number): number {
  return Math.min(endMs, nowMs + MAX_STRICT_LOCK_DURATION_MS);
}
