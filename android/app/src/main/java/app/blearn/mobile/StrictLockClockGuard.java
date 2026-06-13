package app.blearn.mobile;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.SystemClock;
import android.provider.Settings;

/**
 * Anchors the strict-lock deadline to the monotonic elapsedRealtime clock so that
 * advancing the device's wall clock cannot end an active strict lock early
 * (Masterplan 1.4: "Uhrzeit-Manipulation").
 *
 * The anchor is only valid within one boot session because elapsedRealtime resets
 * on reboot; the boot count detects that. After a reboot the wall clock is the only
 * available reference — that residual gap is documented in the threat model.
 */
final class StrictLockClockGuard {
    private static final String PREFS = "blearn_screen_time";
    private static final String ANCHOR_WALL_KEY = "strict_lock_anchor_wall";
    private static final String ANCHOR_ELAPSED_KEY = "strict_lock_anchor_elapsed";
    private static final String ANCHOR_UNTIL_KEY = "strict_lock_anchor_until";
    private static final String ANCHOR_BOOT_COUNT_KEY = "strict_lock_anchor_boot_count";
    // NTP corrections cause small forward jumps; only larger jumps count as manipulation.
    private static final long FORWARD_JUMP_TOLERANCE_MS = 2L * 60L * 1000L;

    private StrictLockClockGuard() {
    }

    static void anchor(Context context, long strictLockUntil, long wallNow) {
        if (strictLockUntil <= wallNow) {
            return;
        }

        SharedPreferences prefs = prefs(context);
        long existingUntil = prefs.getLong(ANCHOR_UNTIL_KEY, 0L);
        // Keep the earliest same-boot anchor for an unchanged deadline: re-anchoring
        // after a clock jump would inherit the manipulated wall time as the baseline.
        if (existingUntil == strictLockUntil
            && prefs.getLong(ANCHOR_ELAPSED_KEY, -1L) >= 0L
            && isSameBoot(context, prefs)) {
            return;
        }

        prefs.edit()
            .putLong(ANCHOR_WALL_KEY, wallNow)
            .putLong(ANCHOR_ELAPSED_KEY, SystemClock.elapsedRealtime())
            .putLong(ANCHOR_UNTIL_KEY, strictLockUntil)
            .putInt(ANCHOR_BOOT_COUNT_KEY, currentBootCount(context))
            .apply();
    }

    static void clear(Context context) {
        prefs(context)
            .edit()
            .remove(ANCHOR_WALL_KEY)
            .remove(ANCHOR_ELAPSED_KEY)
            .remove(ANCHOR_UNTIL_KEY)
            .remove(ANCHOR_BOOT_COUNT_KEY)
            .apply();
    }

    /**
     * Returns wallNow corrected against the monotonic anchor: if the wall clock jumped
     * forward beyond tolerance since the anchor was set, the anchor-derived time wins.
     * Without a valid same-boot anchor, wallNow is returned unchanged.
     */
    static long effectiveNow(Context context, long wallNow) {
        SharedPreferences prefs = prefs(context);
        long anchorWall = prefs.getLong(ANCHOR_WALL_KEY, 0L);
        long anchorElapsed = prefs.getLong(ANCHOR_ELAPSED_KEY, -1L);
        if (anchorWall <= 0L || anchorElapsed < 0L || !isSameBoot(context, prefs)) {
            return wallNow;
        }

        long monotonicNow = anchorWall + Math.max(0L, SystemClock.elapsedRealtime() - anchorElapsed);
        if (wallNow > monotonicNow + FORWARD_JUMP_TOLERANCE_MS) {
            return monotonicNow;
        }
        return wallNow;
    }

    /**
     * True while the anchored deadline has not been reached on the monotonic clock,
     * even though the (possibly manipulated) wall clock claims it has.
     */
    static boolean isBindingDespiteWallClock(Context context, long wallNow) {
        long until = anchoredUntil(context);
        if (until <= 0L || wallNow < until) {
            return false;
        }
        return effectiveNow(context, wallNow) < until;
    }

    static long anchoredUntil(Context context) {
        SharedPreferences prefs = prefs(context);
        if (!isSameBoot(context, prefs) || prefs.getLong(ANCHOR_ELAPSED_KEY, -1L) < 0L) {
            return 0L;
        }
        return prefs.getLong(ANCHOR_UNTIL_KEY, 0L);
    }

    /** Remaining lock time measured on the monotonic clock; 0 when expired or unanchored. */
    static long remainingMillis(Context context, long wallNow) {
        long until = anchoredUntil(context);
        if (until <= 0L) {
            return 0L;
        }
        return Math.max(0L, until - effectiveNow(context, wallNow));
    }

    private static boolean isSameBoot(Context context, SharedPreferences prefs) {
        int anchorBootCount = prefs.getInt(ANCHOR_BOOT_COUNT_KEY, -1);
        return anchorBootCount >= 0 && anchorBootCount == currentBootCount(context);
    }

    private static int currentBootCount(Context context) {
        try {
            return Settings.Global.getInt(context.getContentResolver(), Settings.Global.BOOT_COUNT, -1);
        } catch (Exception error) {
            return -1;
        }
    }

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }
}
