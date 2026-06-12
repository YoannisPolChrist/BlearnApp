package app.blearn.mobile;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import androidx.core.app.NotificationCompat;

final class VpnNotificationController {
    static final String CHANNEL_ID = "blearn.website.blocking";
    static final int NOTIFICATION_ID = 4107;

    private final Context context;

    VpnNotificationController(Context context) {
        this.context = context.getApplicationContext();
        ensureChannel();
    }

    Notification buildActiveNotification(int blockedDomainCount) {
        Intent openAppIntent = new Intent(context, MainActivity.class);
        openAppIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);

        PendingIntent contentIntent = PendingIntent.getActivity(
            context,
            0,
            openAppIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        String contentText = blockedDomainCount > 0
            ? "Webschutz aktiv fuer " + blockedDomainCount + " Website-Regeln."
            : "Webschutz aktiv.";

        return new NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.stat_sys_warning)
            .setContentTitle("Blearn Webschutz")
            .setContentText(contentText)
            .setContentIntent(contentIntent)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build();
    }

    private void ensureChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }

        NotificationManager notificationManager = context.getSystemService(NotificationManager.class);
        if (notificationManager == null) {
            return;
        }

        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            "Blearn Webschutz",
            NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription("Status fuer aktives Website-Blocking");
        notificationManager.createNotificationChannel(channel);
    }
}
