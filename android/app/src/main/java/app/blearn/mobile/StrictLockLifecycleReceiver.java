package app.blearn.mobile;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class StrictLockLifecycleReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (context == null) {
            return;
        }

        String action = intent == null ? null : intent.getAction();
        if (Intent.ACTION_BOOT_COMPLETED.equals(action)
            || Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)
            || StrictLockDeviceAdminManager.ACTION_RECONCILE.equals(action)) {
            StrictLockDeviceAdminManager.reconcileFromStoredPolicy(context);
        }
    }
}
