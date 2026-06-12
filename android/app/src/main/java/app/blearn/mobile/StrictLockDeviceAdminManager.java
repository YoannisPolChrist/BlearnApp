package app.blearn.mobile;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.app.admin.DevicePolicyManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ApplicationInfo;
import android.os.Build;
import android.util.Log;

final class StrictLockDeviceAdminManager {
    static final String ACTION_RECONCILE = "app.blearn.mobile.action.RECONCILE_STRICT_LOCK_DEVICE_ADMIN";

    private static final String TAG = "BlearnStrictLockAdmin";
    private static final String PREFS = "blearn_screen_time";
    private static final String POLICY_SNAPSHOT_KEY = "policy_snapshot";
    private static final String MONITORING_ACTIVE_KEY = "monitoring_active";
    private static final String WEBSITE_BLOCKING_ACTIVE_KEY = "vpn_active";
    private static final String STRICT_DEVICE_ADMIN_PROMPT_AT_KEY = "strict_device_admin_prompt_at";
    private static final String STRICT_LOCK_UNTIL_KEY = "strict_lock_until";
    private static final int RECONCILE_REQUEST_CODE = 4107;

    private StrictLockDeviceAdminManager() {
    }

    static boolean shouldKeepDeviceAdmin(PolicySnapshot snapshot, long now) {
        return snapshot != null && snapshot.isStrictLockActive(now);
    }

    static void sync(Context context, PolicySnapshot snapshot) {
        long now = System.currentTimeMillis();
        if (!shouldKeepDeviceAdmin(snapshot, now)) {
            persistStrictLockUntil(context, 0L);
            cancelReconcileAlarm(context);
            releaseIfActive(context);
            return;
        }

        persistStrictLockUntil(context, snapshot.strictLockUntil);
        if (snapshot.strictLockUntil > now) {
            scheduleReconcileAlarm(context, snapshot.strictLockUntil);
        } else {
            cancelReconcileAlarm(context);
        }
    }

    static void reconcileFromStoredPolicy(Context context) {
        long now = System.currentTimeMillis();
        SharedPreferences prefs = prefs(context);
        PolicySnapshotReadResult readResult = PolicySnapshotReader.parse(
            prefs.getString(POLICY_SNAPSHOT_KEY, "{}"),
            prefs.getBoolean(MONITORING_ACTIVE_KEY, false),
            prefs.getBoolean(WEBSITE_BLOCKING_ACTIVE_KEY, false),
            now
        );
        PolicySnapshot snapshot = readResult.snapshot;
        if (shouldKeepDeviceAdmin(snapshot, now)) {
            persistStrictLockUntil(context, snapshot.strictLockUntil);
            if (snapshot.strictLockUntil > now) {
                scheduleReconcileAlarm(context, snapshot.strictLockUntil);
            } else {
                cancelReconcileAlarm(context);
            }
            debug(context, "kept strict device admin during reconcile");
            return;
        }

        persistStrictLockUntil(context, 0L);
        cancelReconcileAlarm(context);
        releaseIfActive(context);
    }

    static void releaseIfActive(Context context) {
        DevicePolicyManager devicePolicyManager = getDevicePolicyManager(context);
        if (devicePolicyManager == null || !devicePolicyManager.isAdminActive(getDeviceAdminComponent(context))) {
            return;
        }

        try {
            devicePolicyManager.removeActiveAdmin(getDeviceAdminComponent(context));
            prefs(context)
                .edit()
                .remove(STRICT_DEVICE_ADMIN_PROMPT_AT_KEY)
                .remove(STRICT_LOCK_UNTIL_KEY)
                .apply();
            debug(context, "released strict device admin because no active lock is running");
        } catch (Exception error) {
            debug(context, "strict device admin release failed", error);
        }
    }

    private static void scheduleReconcileAlarm(Context context, long triggerAtMillis) {
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager == null) {
            return;
        }

        PendingIntent pendingIntent = buildReconcilePendingIntent(context);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent);
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
                alarmManager.setExact(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent);
            } else {
                alarmManager.set(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent);
            }
            debug(context, "scheduled strict device admin reconcile at " + triggerAtMillis);
        } catch (Exception error) {
            debug(context, "strict device admin reconcile schedule failed", error);
        }
    }

    private static void cancelReconcileAlarm(Context context) {
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager == null) {
            return;
        }

        try {
            alarmManager.cancel(buildReconcilePendingIntent(context));
        } catch (Exception error) {
            debug(context, "strict device admin reconcile cancel failed", error);
        }
    }

    private static PendingIntent buildReconcilePendingIntent(Context context) {
        Intent intent = new Intent(context, StrictLockLifecycleReceiver.class);
        intent.setAction(ACTION_RECONCILE);
        return PendingIntent.getBroadcast(
            context,
            RECONCILE_REQUEST_CODE,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }

    private static void persistStrictLockUntil(Context context, long strictLockUntil) {
        prefs(context).edit().putLong(STRICT_LOCK_UNTIL_KEY, strictLockUntil).apply();
    }

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private static ComponentName getDeviceAdminComponent(Context context) {
        return new ComponentName(context, BlearnDeviceAdminReceiver.class);
    }

    private static DevicePolicyManager getDevicePolicyManager(Context context) {
        return (DevicePolicyManager) context.getSystemService(Context.DEVICE_POLICY_SERVICE);
    }

    private static void debug(Context context, String message) {
        if ((context.getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0) {
            Log.d(TAG, message);
        }
    }

    private static void debug(Context context, String message, Throwable error) {
        if ((context.getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0) {
            Log.d(TAG, message, error);
        }
    }
}
