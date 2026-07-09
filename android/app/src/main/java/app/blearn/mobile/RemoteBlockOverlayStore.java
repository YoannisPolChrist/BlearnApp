package app.blearn.mobile;

import android.content.Context;
import android.content.SharedPreferences;

/**
 * Persists the FCM-delivered {@link RemoteBlockOverlay} in a dedicated prefs key,
 * separate from the JS-authored {@code policy_snapshot}. Kept intentionally thin
 * so the parse/merge logic stays in the unit-testable {@link RemoteBlockOverlay}
 * and {@link PolicySnapshot}.
 */
final class RemoteBlockOverlayStore {
    private static final String PREFS = "blearn_screen_time";
    static final String KEY_REMOTE_OVERLAY = "remote_block_overlay";

    private RemoteBlockOverlayStore() {
    }

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static void apply(Context context, RemoteBlockOverlay overlay) {
        if (context == null || overlay == null) {
            return;
        }
        prefs(context).edit().putString(KEY_REMOTE_OVERLAY, overlay.toJson()).apply();
    }

    static void clear(Context context) {
        if (context == null) {
            return;
        }
        prefs(context).edit().remove(KEY_REMOTE_OVERLAY).apply();
    }

    static String readRaw(Context context) {
        if (context == null) {
            return null;
        }
        return prefs(context).getString(KEY_REMOTE_OVERLAY, null);
    }
}
