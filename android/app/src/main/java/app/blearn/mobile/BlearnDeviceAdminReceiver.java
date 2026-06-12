package app.blearn.mobile;

import android.app.admin.DeviceAdminReceiver;
import android.content.Context;
import android.content.Intent;

public class BlearnDeviceAdminReceiver extends DeviceAdminReceiver {
    @Override
    public CharSequence onDisableRequested(Context context, Intent intent) {
        return context.getString(R.string.device_admin_disable_warning);
    }
}
