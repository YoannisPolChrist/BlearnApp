package app.blearn.mobile;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;

/**
 * Receives Hermes coach-lock pushes. A high-priority FCM data message is
 * delivered even when the Blearn process is dead, which is the whole point:
 * the accessibility service alone cannot fetch new instructions from Firestore,
 * so this is how a freshly written block reaches a device that never opens the
 * app. The payload is applied to {@link RemoteBlockOverlayStore}; the always-on
 * accessibility service enforces it on the next foreground event.
 */
public class BlearnMessagingService extends FirebaseMessagingService {
    private static final String TAG = "BlearnMessaging";
    private static final String PREFS = "blearn_screen_time";
    static final String KEY_FCM_TOKEN = "fcm_token";
    static final String KEY_FCM_TOKEN_DIRTY = "fcm_token_dirty";

    @Override
    public void onMessageReceived(RemoteMessage message) {
        Map<String, String> data = message.getData();
        if (data == null || data.isEmpty()) {
            return;
        }

        if (RemoteBlockOverlay.isClearMessage(data)) {
            RemoteBlockOverlayStore.clear(getApplicationContext());
            Log.d(TAG, "remote block overlay cleared by push");
            return;
        }

        RemoteBlockOverlay overlay = RemoteBlockOverlay.fromMessageData(data);
        if (overlay == null) {
            return;
        }
        RemoteBlockOverlayStore.apply(getApplicationContext(), overlay);
        Log.d(TAG, "remote block overlay applied: " + overlay.packages.size()
            + " package(s), expires " + overlay.expiresAt);
    }

    @Override
    public void onNewToken(String token) {
        persistToken(getApplicationContext(), token);
    }

    /**
     * Stores the token plus a dirty flag; the JS layer reads it via the plugin
     * and writes it to Firestore so Hermes knows where to push.
     */
    static void persistToken(Context context, String token) {
        if (context == null || token == null || token.trim().isEmpty()) {
            return;
        }
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        prefs.edit()
            .putString(KEY_FCM_TOKEN, token)
            .putBoolean(KEY_FCM_TOKEN_DIRTY, true)
            .apply();
    }
}
