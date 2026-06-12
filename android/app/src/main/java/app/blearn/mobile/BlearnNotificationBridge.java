package app.blearn.mobile;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.provider.Settings;
import android.text.TextUtils;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import com.getcapacitor.JSObject;

final class BlearnNotificationBridge {
    static final String PREFS = "blearn_notifications";
    static final String PREF_ENABLED = "notifications_enabled";
    static final String PREF_REMINDERS = "notifications_reminders";
    static final String PREF_STATUS_HINTS = "notifications_status_hints";
    static final String PREF_LEARN_PROGRESS = "notifications_learn_progress";
    static final String PREF_PENALTY_ALERTS = "notifications_penalty_alerts";

    static final String CATEGORY_REMINDERS = "reminders";
    static final String CATEGORY_STATUS_HINTS = "statusHints";
    static final String CATEGORY_LEARN_PROGRESS = "learnProgress";
    static final String CATEGORY_PENALTY_ALERTS = "penaltyAlerts";

    static final String CHANNEL_REMINDERS = "blearn.notifications.reminders";
    static final String CHANNEL_STATUS_HINTS = "blearn.notifications.statusHints";
    static final String CHANNEL_LEARN_PROGRESS = "blearn.notifications.learnProgress";
    static final String CHANNEL_PENALTY_ALERTS = "blearn.notifications.penaltyAlerts";

    private static final int BASE_NOTIFICATION_ID = 4600;

    private final Context context;

    BlearnNotificationBridge(Context context) {
        this.context = context.getApplicationContext();
        ensureChannels();
    }

    boolean areNotificationsEnabled() {
        return NotificationManagerCompat.from(context).areNotificationsEnabled();
    }

    JSObject buildPreferenceSnapshot() {
        JSObject snapshot = new JSObject();
        snapshot.put("enabled", prefs().getBoolean(PREF_ENABLED, true));
        snapshot.put("reminders", prefs().getBoolean(PREF_REMINDERS, true));
        snapshot.put("statusHints", prefs().getBoolean(PREF_STATUS_HINTS, true));
        snapshot.put("learnProgress", prefs().getBoolean(PREF_LEARN_PROGRESS, true));
        snapshot.put("penaltyAlerts", prefs().getBoolean(PREF_PENALTY_ALERTS, true));
        return snapshot;
    }

    JSObject syncNotificationPreferences(boolean enabled, JSObject preferences, JSObject preview) {
        prefs()
            .edit()
            .putBoolean(PREF_ENABLED, enabled)
            .putBoolean(PREF_REMINDERS, preferences == null || preferences.optBoolean("reminders", true))
            .putBoolean(PREF_STATUS_HINTS, preferences == null || preferences.optBoolean("statusHints", true))
            .putBoolean(PREF_LEARN_PROGRESS, preferences == null || preferences.optBoolean("learnProgress", true))
            .putBoolean(PREF_PENALTY_ALERTS, preferences == null || preferences.optBoolean("penaltyAlerts", true))
            .apply();

        ensureChannels();

        JSObject result = new JSObject();
        result.put("enabled", enabled);
        result.put("previewSent", false);
        result.put("state", areNotificationsEnabled() ? "granted" : "denied");

        if (enabled && preview != null && preview.has("category") && preview.has("title") && preview.has("body")) {
            boolean sent = dispatchInternal(
                preview.optString("category", CATEGORY_STATUS_HINTS),
                preview.optString("title", ""),
                preview.optString("body", ""),
                preview.optString("id", null)
            );
            result.put("previewSent", sent);
        }

        return result;
    }

    JSObject dispatchNotification(String category, String title, String body, String notificationId) {
        JSObject result = new JSObject();
        boolean sent = dispatchInternal(category, title, body, notificationId);
        result.put("sent", sent);
        if (!sent) {
            result.put("reason", "blocked");
        }
        return result;
    }

    void openNotificationSettings() {
        Intent intent = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        intent.putExtra(Settings.EXTRA_APP_PACKAGE, context.getPackageName());
        context.startActivity(intent);
    }

    private boolean dispatchInternal(String category, String title, String body, String notificationId) {
        String normalizedCategory = normalizeCategory(category);
        if (!prefs().getBoolean(PREF_ENABLED, true) || !isCategoryEnabled(normalizedCategory)) {
            return false;
        }

        if (!areNotificationsEnabled()) {
            return false;
        }

        NotificationManagerCompat notificationManager = NotificationManagerCompat.from(context);
        Notification notification = buildNotification(normalizedCategory, title, body, notificationId);
        notificationManager.notify(resolveNotificationId(notificationId, normalizedCategory), notification);
        return true;
    }

    private Notification buildNotification(String category, String title, String body, String notificationId) {
        String channelId = resolveChannelId(category);
        PendingIntent contentIntent = PendingIntent.getActivity(
            context,
            0,
            new Intent(context, MainActivity.class)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        return new NotificationCompat.Builder(context, channelId)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(TextUtils.isEmpty(title) ? "Blearn" : title)
            .setContentText(TextUtils.isEmpty(body) ? "Benachrichtigung" : body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(TextUtils.isEmpty(body) ? "Benachrichtigung" : body))
            .setContentIntent(contentIntent)
            .setAutoCancel(true)
            .setOnlyAlertOnce(true)
            .setPriority(resolvePriority(category))
            .setCategory(resolveAndroidCategory(category))
            .build();
    }

    private int resolvePriority(String category) {
        if (CATEGORY_PENALTY_ALERTS.equals(category)) {
            return NotificationCompat.PRIORITY_HIGH;
        }
        if (CATEGORY_REMINDERS.equals(category)) {
            return NotificationCompat.PRIORITY_DEFAULT;
        }
        return NotificationCompat.PRIORITY_LOW;
    }

    private String resolveAndroidCategory(String category) {
        if (CATEGORY_PENALTY_ALERTS.equals(category)) {
            return Notification.CATEGORY_ALARM;
        }
        if (CATEGORY_REMINDERS.equals(category)) {
            return Notification.CATEGORY_REMINDER;
        }
        if (CATEGORY_LEARN_PROGRESS.equals(category)) {
            return Notification.CATEGORY_PROGRESS;
        }
        return Notification.CATEGORY_STATUS;
    }

    private boolean isCategoryEnabled(String category) {
        if (CATEGORY_REMINDERS.equals(category)) {
            return prefs().getBoolean(PREF_REMINDERS, true);
        }
        if (CATEGORY_STATUS_HINTS.equals(category)) {
            return prefs().getBoolean(PREF_STATUS_HINTS, true);
        }
        if (CATEGORY_LEARN_PROGRESS.equals(category)) {
            return prefs().getBoolean(PREF_LEARN_PROGRESS, true);
        }
        if (CATEGORY_PENALTY_ALERTS.equals(category)) {
            return prefs().getBoolean(PREF_PENALTY_ALERTS, true);
        }
        return true;
    }

    private String resolveChannelId(String category) {
        if (CATEGORY_REMINDERS.equals(category)) {
            return CHANNEL_REMINDERS;
        }
        if (CATEGORY_STATUS_HINTS.equals(category)) {
            return CHANNEL_STATUS_HINTS;
        }
        if (CATEGORY_LEARN_PROGRESS.equals(category)) {
            return CHANNEL_LEARN_PROGRESS;
        }
        if (CATEGORY_PENALTY_ALERTS.equals(category)) {
            return CHANNEL_PENALTY_ALERTS;
        }
        return CHANNEL_STATUS_HINTS;
    }

    private String normalizeCategory(String category) {
        if (CATEGORY_REMINDERS.equals(category)) {
            return CATEGORY_REMINDERS;
        }
        if (CATEGORY_STATUS_HINTS.equals(category)) {
            return CATEGORY_STATUS_HINTS;
        }
        if (CATEGORY_LEARN_PROGRESS.equals(category)) {
            return CATEGORY_LEARN_PROGRESS;
        }
        if (CATEGORY_PENALTY_ALERTS.equals(category)) {
            return CATEGORY_PENALTY_ALERTS;
        }
        return CATEGORY_STATUS_HINTS;
    }

    private int resolveNotificationId(String notificationId, String category) {
        String seed = TextUtils.isEmpty(notificationId) ? category : notificationId;
        return BASE_NOTIFICATION_ID + (seed.hashCode() & 0x7fffffff);
    }

    private void ensureChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }

        NotificationManager notificationManager = context.getSystemService(NotificationManager.class);
        if (notificationManager == null) {
            return;
        }

        notificationManager.createNotificationChannel(buildChannel(
            CHANNEL_REMINDERS,
            "Blearn Erinnerungen",
            "Fokus-, Lern- und Rueckkehr-Erinnerungen",
            NotificationManager.IMPORTANCE_DEFAULT
        ));
        notificationManager.createNotificationChannel(buildChannel(
            CHANNEL_STATUS_HINTS,
            "Blearn Statushinweise",
            "Kurze Hinweise zu Schutz, Status und Freigaben",
            NotificationManager.IMPORTANCE_LOW
        ));
        notificationManager.createNotificationChannel(buildChannel(
            CHANNEL_LEARN_PROGRESS,
            "Blearn Lernfortschritt",
            "Hinweise zu Sessions, Karten und Learn-Status",
            NotificationManager.IMPORTANCE_LOW
        ));
        notificationManager.createNotificationChannel(buildChannel(
            CHANNEL_PENALTY_ALERTS,
            "Blearn Wallet und Strafe",
            "Wichtige Hinweise zu Strafe, Wallet und Accountability",
            NotificationManager.IMPORTANCE_HIGH
        ));
    }

    private NotificationChannel buildChannel(String id, String name, String description, int importance) {
        NotificationChannel channel = new NotificationChannel(id, name, importance);
        channel.setDescription(description);
        return channel;
    }

    private SharedPreferences prefs() {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }
}
