package app.blearn.mobile;

import android.content.Context;
import android.content.SharedPreferences;

final class VpnPolicyBridge {
    private static final String PREFS = "blearn_screen_time";
    private static final String VPN_ACTIVE_KEY = "vpn_active";
    private static final String LAST_TRIGGER_TARGET_KEY = "last_trigger_target";
    private static final String LAST_TRIGGER_TYPE_KEY = "last_trigger_type";
    private static final String LAST_TRIGGER_AT_KEY = "last_trigger_at";

    private final SharedPreferences prefs;
    private final Context context;

    VpnPolicyBridge(Context context) {
        this.context = context.getApplicationContext();
        prefs = this.context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    PolicySnapshotReadResult readSnapshot() {
        return PolicySnapshotReader.read(context, prefs);
    }

    DnsDecisionEngine buildDecisionEngine() {
        PolicySnapshot snapshot = readSnapshot().snapshot;
        ManualOverrideStore.applyActiveOverrides(context, snapshot, System.currentTimeMillis());
        return DnsDecisionEngine.fromSnapshot(snapshot);
    }

    void setVpnActive(boolean active) {
        prefs.edit().putBoolean(VPN_ACTIVE_KEY, active).apply();
    }

    boolean isVpnActive() {
        return prefs.getBoolean(VPN_ACTIVE_KEY, false);
    }

    void recordTrigger(String targetId, String targetType) {
        prefs.edit()
            .putString(LAST_TRIGGER_TARGET_KEY, targetId)
            .putString(LAST_TRIGGER_TYPE_KEY, targetType)
            .putLong(LAST_TRIGGER_AT_KEY, System.currentTimeMillis())
            .apply();
    }
}
