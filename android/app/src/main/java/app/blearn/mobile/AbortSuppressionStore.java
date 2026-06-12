package app.blearn.mobile;

import android.content.Context;
import android.content.SharedPreferences;
import android.text.TextUtils;

import org.json.JSONObject;

import java.util.Iterator;

/**
 * Short-lived per-target suppression after a user aborts a blocking flow.
 *
 * Without this, an aborted flow returns the user to the still-foregrounded
 * blocked app, which immediately re-triggers the overlay (the 1.5s overlay
 * cooldown is far too short for a deliberate exit) and traps the user in a
 * loop. Suppression is intentionally NOT an unlock: it only mutes re-triggers
 * for the aborted target long enough for the user to navigate away.
 */
final class AbortSuppressionStore {
    static final long DEFAULT_SUPPRESSION_MS = 30_000L;

    private static final String PREFS = "blearn_screen_time";
    private static final String KEY_SUPPRESSIONS = "abort_suppressions";
    private static final int MAX_ENTRIES = 16;

    private AbortSuppressionStore() {
    }

    static void recordAbort(Context context, String targetType, String targetId) {
        recordAbort(context, targetType, targetId, DEFAULT_SUPPRESSION_MS);
    }

    static void recordAbort(Context context, String targetType, String targetId, long durationMs) {
        String key = buildKey(targetType, targetId);
        if (TextUtils.isEmpty(key) || durationMs <= 0L) {
            return;
        }

        long now = System.currentTimeMillis();
        JSONObject suppressions = pruneExpired(readSuppressions(context), now);
        try {
            suppressions.put(key, now + durationMs);
        } catch (Exception ignored) {
            return;
        }

        // Hard cap so a misbehaving caller can never grow the prefs blob.
        while (suppressions.length() > MAX_ENTRIES) {
            Iterator<String> keys = suppressions.keys();
            if (!keys.hasNext()) {
                break;
            }
            keys.next();
            keys.remove();
        }

        writeSuppressions(context, suppressions);
    }

    static boolean isSuppressed(Context context, String targetType, String targetId, long now) {
        String key = buildKey(targetType, targetId);
        if (TextUtils.isEmpty(key)) {
            return false;
        }

        JSONObject suppressions = readSuppressions(context);
        long suppressUntil = suppressions.optLong(key, 0L);
        if (suppressUntil <= now) {
            if (suppressions.has(key)) {
                suppressions.remove(key);
                writeSuppressions(context, pruneExpired(suppressions, now));
            }
            return false;
        }

        return true;
    }

    static void clear(Context context, String targetType, String targetId) {
        String key = buildKey(targetType, targetId);
        if (TextUtils.isEmpty(key)) {
            return;
        }

        JSONObject suppressions = readSuppressions(context);
        if (suppressions.has(key)) {
            suppressions.remove(key);
            writeSuppressions(context, suppressions);
        }
    }

    private static String buildKey(String targetType, String targetId) {
        String normalizedType = PolicySnapshot.normalize(targetType);
        String normalizedId = PolicySnapshot.normalize(targetId);
        if (!PolicySnapshot.hasText(normalizedType) || !PolicySnapshot.hasText(normalizedId)) {
            return "";
        }
        return normalizedType + ":" + normalizedId;
    }

    private static JSONObject pruneExpired(JSONObject suppressions, long now) {
        Iterator<String> keys = suppressions.keys();
        while (keys.hasNext()) {
            String key = keys.next();
            if (suppressions.optLong(key, 0L) <= now) {
                keys.remove();
            }
        }
        return suppressions;
    }

    private static JSONObject readSuppressions(Context context) {
        String raw = prefs(context).getString(KEY_SUPPRESSIONS, null);
        if (TextUtils.isEmpty(raw)) {
            return new JSONObject();
        }
        try {
            return new JSONObject(raw);
        } catch (Exception error) {
            return new JSONObject();
        }
    }

    private static void writeSuppressions(Context context, JSONObject suppressions) {
        prefs(context).edit().putString(KEY_SUPPRESSIONS, suppressions.toString()).apply();
    }

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }
}
