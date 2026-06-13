package app.blearn.mobile;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ApplicationInfo;
import android.os.SystemClock;
import android.text.TextUtils;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Iterator;

/**
 * Watches over the two failure modes the masterplan calls out (1.2/1.7):
 *
 * 1. Trigger storms: the same target fires repeatedly without the blocking flow
 *    ever reaching route-ready (broken WebView, handoff bug). Instead of leaving
 *    the user in an overlay loop, the target is suppressed and a diagnostic
 *    notification is posted.
 * 2. Silent protection loss: the accessibility service was killed (OEM battery
 *    management, user toggle) or the device rebooted (Android never restarts a
 *    VPN on its own). The user gets an honest high-priority notification instead
 *    of a green status that is no longer true.
 */
final class ProtectionWatchdog {
    static final String ACTION_ACCESSIBILITY_CHECK = "app.blearn.mobile.action.PROTECTION_WATCHDOG_CHECK";

    static final int STORM_TRIGGER_THRESHOLD = 4;
    static final long STORM_WINDOW_MS = 60_000L;
    static final long STORM_SUPPRESSION_MS = 120_000L;
    static final long ACCESSIBILITY_CHECK_DELAY_MS = 5L * 60L * 1000L;

    private static final String TAG = "BlearnWatchdog";
    private static final String PREFS = "blearn_screen_time";
    private static final String KEY_TRIGGER_WINDOWS = "watchdog_trigger_windows";
    private static final String MONITORING_ACTIVE_KEY = "monitoring_active";
    private static final String VPN_ACTIVE_KEY = "vpn_active";
    private static final String VPN_INTERRUPTED_BY_BOOT_KEY = "vpn_interrupted_by_boot";
    private static final int ACCESSIBILITY_CHECK_REQUEST_CODE = 4108;
    private static final int MAX_TRACKED_TARGETS = 16;

    private ProtectionWatchdog() {
    }

    /**
     * Records an overlay trigger for the target. Returns true when this trigger
     * completes a storm (threshold reached inside the window without any
     * route-ready in between); the caller must then skip showing the overlay.
     */
    static boolean recordTriggerAndDetectStorm(Context context, String targetType, String targetId, long now) {
        String key = PolicySnapshot.normalize(targetType) + ":" + PolicySnapshot.normalize(targetId);
        JSONObject windows = readTriggerWindows(context);
        JSONArray timestamps = windows.optJSONArray(key);
        JSONArray pruned = new JSONArray();
        if (timestamps != null) {
            for (int index = 0; index < timestamps.length(); index += 1) {
                long at = timestamps.optLong(index, 0L);
                if (at > now - STORM_WINDOW_MS) {
                    pruned.put(at);
                }
            }
        }
        pruned.put(now);

        try {
            windows.put(key, pruned);
        } catch (Exception ignored) {
            return false;
        }
        capTrackedTargets(windows);
        writeTriggerWindows(context, windows);

        if (pruned.length() < STORM_TRIGGER_THRESHOLD) {
            return false;
        }

        // Storm confirmed: suppress the target and tell the user what happened.
        windows.remove(key);
        writeTriggerWindows(context, windows);
        AbortSuppressionStore.recordAbort(context, targetType, targetId, STORM_SUPPRESSION_MS);
        new BlearnNotificationBridge(context).dispatchProtectionAlert(
            "Blocking-Flow hat ein Problem",
            "Der Block für dieses Ziel wurde kurz pausiert. Öffne Blearn für Details.",
            "trigger_storm:" + key
        );
        warn(context, "trigger storm detected for " + key + ", suppressed for " + STORM_SUPPRESSION_MS + "ms");
        return true;
    }

    /** Route-ready proves the flow works; forget the accumulated trigger history. */
    static void recordRouteReady(Context context) {
        SharedPreferences prefs = prefs(context);
        if (prefs.contains(KEY_TRIGGER_WINDOWS)) {
            prefs.edit().remove(KEY_TRIGGER_WINDOWS).apply();
        }
    }

    /** Called when the accessibility service disconnects: re-check in 5 minutes. */
    static void scheduleAccessibilityCheck(Context context) {
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager == null) {
            return;
        }
        try {
            alarmManager.setAndAllowWhileIdle(
                AlarmManager.ELAPSED_REALTIME_WAKEUP,
                SystemClock.elapsedRealtime() + ACCESSIBILITY_CHECK_DELAY_MS,
                buildCheckPendingIntent(context)
            );
        } catch (Exception error) {
            warn(context, "accessibility check schedule failed: " + error.getMessage());
        }
    }

    static void cancelAccessibilityCheck(Context context) {
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager == null) {
            return;
        }
        try {
            alarmManager.cancel(buildCheckPendingIntent(context));
        } catch (Exception ignored) {
        }
    }

    /** Alarm callback: warn when protection is configured but the service is gone. */
    static void runAccessibilityCheck(Context context) {
        SharedPreferences prefs = prefs(context);
        boolean monitoringConfigured = prefs.getBoolean(MONITORING_ACTIVE_KEY, false);
        if (!monitoringConfigured || ScreenTimeAccessibilityService.isServiceReady(context)) {
            return;
        }

        new BlearnNotificationBridge(context).dispatchProtectionAlert(
            "Blearn-Schutz ist deaktiviert",
            "Die Bedienungshilfe wurde beendet. Tippe, um den Schutz wieder zu aktivieren.",
            "accessibility_down"
        );
        warn(context, "accessibility service down while monitoring is configured");
    }

    /**
     * Boot handling: Android does not restart VPNs, and the accessibility service
     * may need user interaction on aggressive ROMs. Record the truth and notify.
     */
    static void handleBootCompleted(Context context) {
        SharedPreferences prefs = prefs(context);
        boolean monitoringConfigured = prefs.getBoolean(MONITORING_ACTIVE_KEY, false);
        boolean vpnWasActive = prefs.getBoolean(VPN_ACTIVE_KEY, false);

        if (vpnWasActive) {
            // Truthful state: the VPN is not running anymore after a reboot.
            prefs.edit()
                .putBoolean(VPN_ACTIVE_KEY, false)
                .putBoolean(VPN_INTERRUPTED_BY_BOOT_KEY, true)
                .apply();
        }

        if (monitoringConfigured || vpnWasActive) {
            new BlearnNotificationBridge(context).dispatchProtectionAlert(
                "Schutz nach Neustart unterbrochen",
                "Öffne Blearn, um das Blocking wieder zu aktivieren.",
                "boot_interrupted"
            );
        }
    }

    static boolean wasVpnInterruptedByBoot(Context context) {
        return prefs(context).getBoolean(VPN_INTERRUPTED_BY_BOOT_KEY, false);
    }

    static void clearVpnBootInterruption(Context context) {
        prefs(context).edit().remove(VPN_INTERRUPTED_BY_BOOT_KEY).apply();
    }

    private static void capTrackedTargets(JSONObject windows) {
        while (windows.length() > MAX_TRACKED_TARGETS) {
            Iterator<String> keys = windows.keys();
            if (!keys.hasNext()) {
                return;
            }
            keys.next();
            keys.remove();
        }
    }

    private static PendingIntent buildCheckPendingIntent(Context context) {
        Intent intent = new Intent(context, StrictLockLifecycleReceiver.class);
        intent.setAction(ACTION_ACCESSIBILITY_CHECK);
        return PendingIntent.getBroadcast(
            context,
            ACCESSIBILITY_CHECK_REQUEST_CODE,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }

    private static JSONObject readTriggerWindows(Context context) {
        String raw = prefs(context).getString(KEY_TRIGGER_WINDOWS, null);
        if (TextUtils.isEmpty(raw)) {
            return new JSONObject();
        }
        try {
            return new JSONObject(raw);
        } catch (Exception error) {
            return new JSONObject();
        }
    }

    private static void writeTriggerWindows(Context context, JSONObject windows) {
        prefs(context).edit().putString(KEY_TRIGGER_WINDOWS, windows.toString()).apply();
    }

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private static void warn(Context context, String message) {
        if ((context.getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0) {
            Log.w(TAG, message);
        }
    }
}
