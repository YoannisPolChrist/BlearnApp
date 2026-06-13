package app.blearn.mobile;

import android.Manifest;
import android.app.AppOpsManager;
import android.app.Activity;
import android.app.ActivityManager;
import android.app.admin.DevicePolicyManager;
import android.app.usage.UsageStats;
import android.app.usage.UsageStatsManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.drawable.BitmapDrawable;
import android.graphics.drawable.Drawable;
import android.net.Uri;
import android.net.VpnService;
import android.os.Build;
import android.os.PowerManager;
import android.os.Process;
import android.provider.Settings;
import android.text.TextUtils;
import android.util.Base64;
import android.util.Log;

import androidx.activity.result.ActivityResult;
import androidx.annotation.Nullable;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.PermissionState;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.io.ByteArrayOutputStream;

@CapacitorPlugin(
    name = "ScreenTime",
    permissions = {
        @Permission(alias = "notifications", strings = {Manifest.permission.POST_NOTIFICATIONS})
    }
)
public class ScreenTimePlugin extends Plugin {
    private static final String PREFS = "blearn_screen_time";
    private static final String TAG = "BlearnScreenTime";
    private static final long DAY_MS = 24L * 60L * 60L * 1000L;
    private static final long OVERLAY_COOLDOWN_MS = 1500L;
    private static final int MAX_USAGE_ENTRIES = 48;
    private static final int MAX_INSTALLED_APPS = 160;
    private static final int MAX_RECENT_PACKAGES = 80;
    private static final int APP_ICON_SIZE_PX = 72;
    private static final long STRICT_DEVICE_ADMIN_PROMPT_COOLDOWN_MS = 5L * 60L * 1000L;
    private final OverlayHandoffCoordinator handoffCoordinator = OverlayHandoffCoordinator.getInstance();
    private BlearnNotificationBridge notificationBridge;

    private BlearnNotificationBridge notificationBridge() {
        if (notificationBridge == null) {
            notificationBridge = new BlearnNotificationBridge(getContext());
        }
        return notificationBridge;
    }

    private SharedPreferences prefs() {
        return getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    @PluginMethod
    public void getNotificationPermissionState(PluginCall call) {
        call.resolve(buildNotificationPermissionStatus());
    }

    @PluginMethod
    public void requestNotificationPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            if (!notificationBridge().areNotificationsEnabled()) {
                notificationBridge().openNotificationSettings();
            }
            call.resolve(buildNotificationPermissionStatus());
            return;
        }

        if (notificationBridge().areNotificationsEnabled() && getPermissionState("notifications") == PermissionState.GRANTED) {
            call.resolve(buildNotificationPermissionStatus());
            return;
        }

        if (getPermissionState("notifications") == PermissionState.DENIED) {
            notificationBridge().openNotificationSettings();
            call.resolve(buildNotificationPermissionStatus());
            return;
        }

        requestPermissionForAlias("notifications", call, "handleNotificationPermissionResult");
    }

    @PermissionCallback
    public void handleNotificationPermissionResult(PluginCall call) {
        if (call == null) {
            return;
        }

        call.resolve(buildNotificationPermissionStatus());
    }

    @PluginMethod
    public void syncNotificationPreferences(PluginCall call) {
        boolean enabled = call.getBoolean("enabled", true);
        JSObject preferences = call.getObject("preferences");
        JSObject preview = call.getObject("preview");
        call.resolve(notificationBridge().syncNotificationPreferences(enabled, preferences, preview));
    }

    @PluginMethod
    public void dispatchNotification(PluginCall call) {
        String category = call.getString("category", BlearnNotificationBridge.CATEGORY_STATUS_HINTS);
        String title = call.getString("title", "Blearn");
        String body = call.getString("body", "Benachrichtigung");
        String notificationId = call.getString("id");
        call.resolve(notificationBridge().dispatchNotification(category, title, body, notificationId));
    }

    private JSObject buildNotificationPermissionStatus() {
        JSObject result = new JSObject();
        boolean notificationsEnabled = notificationBridge().areNotificationsEnabled();
        result.put("enabled", notificationsEnabled);
        result.put("state", resolveNotificationPermissionState(notificationsEnabled));
        return result;
    }

    private String resolveNotificationPermissionState(boolean notificationsEnabled) {
        if (!notificationsEnabled) {
            PermissionState permissionState = getPermissionState("notifications");
            if (permissionState == PermissionState.PROMPT) {
                return "default";
            }
            return "denied";
        }

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            return "granted";
        }

        PermissionState permissionState = getPermissionState("notifications");
        if (permissionState == PermissionState.GRANTED) {
            return "granted";
        }
        if (permissionState == PermissionState.PROMPT) {
            return "default";
        }
        if (permissionState == PermissionState.PROMPT_WITH_RATIONALE || permissionState == PermissionState.DENIED) {
            return "denied";
        }

        return notificationsEnabled ? "granted" : "denied";
    }

    @PluginMethod
    public void hasUsagePermission(PluginCall call) {
        JSObject result = new JSObject();
        result.put("granted", hasUsageStatsAccess());
        call.resolve(result);
    }

    @PluginMethod
    public void requestUsagePermission(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }

    @PluginMethod
    public void isBatteryOptimizationExempt(PluginCall call) {
        JSObject result = new JSObject();
        result.put("granted", isIgnoringBatteryOptimizations());
        call.resolve(result);
    }

    @PluginMethod
    public void requestBatteryOptimizationExemption(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
            intent.setData(Uri.parse("package:" + getContext().getPackageName()));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception error) {
            try {
                Intent fallback = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
                fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(fallback);
                call.resolve();
            } catch (Exception fallbackError) {
                call.reject("Battery optimization settings could not be opened", fallbackError);
            }
        }
    }

    @PluginMethod
    public void clearVpnBootInterruption(PluginCall call) {
        ProtectionWatchdog.clearVpnBootInterruption(getContext());
        call.resolve();
    }

    private boolean isIgnoringBatteryOptimizations() {
        PowerManager powerManager = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
        return powerManager != null && powerManager.isIgnoringBatteryOptimizations(getContext().getPackageName());
    }

    @PluginMethod
    public void getTodayUsage(PluginCall call) {
        long end = System.currentTimeMillis();
        long start = end - DAY_MS;
        resolveUsageForRange(call, start, end);
    }

    @PluginMethod
    public void getUsageForRange(PluginCall call) {
        Long requestedStartMs = call.getLong("startMs");
        Long requestedEndMs = call.getLong("endMs");
        long end = requestedEndMs != null && requestedEndMs > 0L ? requestedEndMs : System.currentTimeMillis();
        long fallbackStart = Math.max(0L, end - DAY_MS);
        long start =
            requestedStartMs != null && requestedStartMs >= 0L && requestedStartMs < end
                ? requestedStartMs
                : fallbackStart;
        resolveUsageForRange(call, start, end);
    }

    private void resolveUsageForRange(PluginCall call, long start, long end) {
        UsageStatsManager usageStatsManager = (UsageStatsManager) getContext().getSystemService(Context.USAGE_STATS_SERVICE);
        List<UsageStats> stats = usageStatsManager == null
            ? new ArrayList<>()
            : usageStatsManager.queryUsageStats(resolveUsageInterval(start, end), start, end);
        JSArray entries = new JSArray();
        long totalScreenTime = 0L;
        PackageManager packageManager = getContext().getPackageManager();
        Map<String, UsageSummary> summarizedEntries = new HashMap<>();

        if (stats != null) {
            for (UsageStats entry : stats) {
                long totalTimeInForeground = entry.getTotalTimeInForeground();
                String packageName = entry.getPackageName();
                if (totalTimeInForeground <= 0 || TextUtils.isEmpty(packageName)) continue;

                totalScreenTime += totalTimeInForeground;
                UsageSummary current = summarizedEntries.get(packageName);
                if (current == null) {
                    summarizedEntries.put(
                        packageName,
                        new UsageSummary(packageName, totalTimeInForeground, entry.getLastTimeUsed())
                    );
                } else {
                    current.totalTimeMs += totalTimeInForeground;
                    current.lastUsedTimestamp = Math.max(current.lastUsedTimestamp, entry.getLastTimeUsed());
                }
            }
        }

        List<UsageSummary> sortedEntries = new ArrayList<>(summarizedEntries.values());
        Collections.sort(sortedEntries, (left, right) -> Long.compare(right.totalTimeMs, left.totalTimeMs));

        for (int index = 0; index < sortedEntries.size() && index < MAX_USAGE_ENTRIES; index++) {
            UsageSummary entry = sortedEntries.get(index);
            JSObject item = new JSObject();
            item.put("packageName", entry.packageName);
            item.put("appName", getApplicationLabel(packageManager, entry.packageName));
            item.put("totalTimeMs", entry.totalTimeMs);
            item.put("lastUsedTimestamp", entry.lastUsedTimestamp);
            entries.put(item);
        }

        JSObject result = new JSObject();
        result.put("totalScreenTimeMs", totalScreenTime);
        result.put("unlockCount", prefs().getInt("unlock_count", 0));
        result.put("entries", entries);
        call.resolve(result);
    }

    private int resolveUsageInterval(long start, long end) {
        long durationMs = Math.max(0L, end - start);
        if (durationMs <= 7L * DAY_MS) {
            return UsageStatsManager.INTERVAL_DAILY;
        }
        if (durationMs <= 90L * DAY_MS) {
            return UsageStatsManager.INTERVAL_WEEKLY;
        }
        return UsageStatsManager.INTERVAL_MONTHLY;
    }

    @PluginMethod
    public void getCurrentApp(PluginCall call) {
        PendingNavigationStore.ForegroundObservation foregroundObservation = resolveForegroundObservation();
        JSObject result = new JSObject();
        result.put("packageName", foregroundObservation.packageName);
        result.put("appId", foregroundObservation.packageName);
        if (PolicySnapshot.hasText(foregroundObservation.source)) {
            result.put("source", foregroundObservation.source);
        }
        if (foregroundObservation.observedAt > 0L) {
            result.put("observedAt", foregroundObservation.observedAt);
        }
        call.resolve(result);
    }

    @PluginMethod
    public void getInstalledApps(PluginCall call) {
        PackageManager packageManager = getContext().getPackageManager();
        Intent launchIntent = new Intent(Intent.ACTION_MAIN, null);
        launchIntent.addCategory(Intent.CATEGORY_LAUNCHER);
        List<ResolveInfo> apps = packageManager.queryIntentActivities(launchIntent, 0);

        JSArray resultApps = new JSArray();
        Set<String> seen = new HashSet<>();
        Collections.sort(apps, (left, right) ->
            left.loadLabel(packageManager).toString().compareToIgnoreCase(right.loadLabel(packageManager).toString())
        );

        for (ResolveInfo app : apps) {
            String packageName = app.activityInfo.packageName;
            if (seen.contains(packageName) || packageName.equals(getContext().getPackageName()) || !shouldIncludePackage(packageManager, packageName, true)) continue;
            seen.add(packageName);
            resultApps.put(buildInstalledAppItem(packageManager, packageName, app.loadLabel(packageManager).toString()));
            if (resultApps.length() >= MAX_INSTALLED_APPS) {
                break;
            }
        }

        for (String packageName : getRecentlyUsedPackageNames()) {
            if (resultApps.length() >= MAX_INSTALLED_APPS) {
                break;
            }
            if (seen.contains(packageName) || packageName.equals(getContext().getPackageName()) || !shouldIncludePackage(packageManager, packageName, false)) continue;
            seen.add(packageName);
            resultApps.put(buildInstalledAppItem(packageManager, packageName, getApplicationLabel(packageManager, packageName)));
        }

        JSObject result = new JSObject();
        result.put("apps", resultApps);
        call.resolve(result);
    }

    @PluginMethod
    public void hasOverlayPermission(PluginCall call) {
        JSObject result = new JSObject();
        result.put("granted", canPresentOverlay());
        call.resolve(result);
    }

    @PluginMethod
    public void requestOverlayPermission(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:" + getContext().getPackageName()));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }

    @PluginMethod
    public void startMonitoringService(PluginCall call) {
        if (!saveJsonArray("blocked_packages", call.getArray("blockedPackages"))) {
            call.reject("Blocked packages could not be persisted");
            return;
        }
        if (!prefs().edit().putBoolean("monitoring_active", true).commit()) {
            call.reject("Monitoring state could not be persisted");
            return;
        }
        call.resolve();
    }

    @PluginMethod
    public void stopMonitoringService(PluginCall call) {
        if (!prefs().edit().putBoolean("monitoring_active", false).commit()) {
            call.reject("Monitoring state could not be persisted");
            return;
        }
        call.resolve();
    }

    @PluginMethod
    public void updateBlockedPackages(PluginCall call) {
        if (!saveJsonArray("blocked_packages", call.getArray("blockedPackages"))) {
            call.reject("Blocked packages could not be persisted");
            return;
        }
        call.resolve();
    }

    @PluginMethod
    public void hasAccessibilityPermission(PluginCall call) {
        JSObject result = new JSObject();
        result.put("granted", isAccessibilityServiceEnabled(getContext()));
        call.resolve(result);
    }

    @PluginMethod
    public void requestAccessibilityPermission(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }

    @PluginMethod
    public void startVpnFilter(PluginCall call) {
        if (!saveJsonArray("blocked_domains", call.getArray("blockedDomains"))) {
            call.reject("Blocked domains could not be persisted");
            return;
        }
        Intent vpnPermissionIntent = VpnService.prepare(getContext());
        if (vpnPermissionIntent != null) {
            startActivityForResult(call, vpnPermissionIntent, "handleVpnPermissionResult");
            return;
        }

        BlearnVpnService.start(getContext());
        call.resolve();
    }

    @PluginMethod
    public void stopVpnFilter(PluginCall call) {
        if (!prefs().edit().putBoolean("vpn_active", false).commit()) {
            call.reject("VPN state could not be persisted");
            return;
        }
        BlearnVpnService.stop(getContext());
        call.resolve();
    }

    @PluginMethod
    public void updateBlockedDomains(PluginCall call) {
        if (!saveJsonArray("blocked_domains", call.getArray("blockedDomains"))) {
            call.reject("Blocked domains could not be persisted");
            return;
        }
        if (prefs().getBoolean("vpn_active", false)) {
            BlearnVpnService.update(getContext());
        }
        call.resolve();
    }

    @PluginMethod
    public void hasVpnPermission(PluginCall call) {
        JSObject result = new JSObject();
        result.put("granted", VpnService.prepare(getContext()) == null);
        call.resolve(result);
    }

    @PluginMethod
    public void getWebsiteBlockingStatus(PluginCall call) {
        JSObject result = new JSObject();
        result.put("available", true);
        result.put("active", prefs().getBoolean("vpn_active", false));
        result.put("permissionGranted", VpnService.prepare(getContext()) == null);
        call.resolve(result);
    }

    @PluginMethod
    public void updateBlockedSearchTerms(PluginCall call) {
        if (!saveJsonArray("blocked_search_terms", call.getArray("terms"))) {
            call.reject("Blocked search terms could not be persisted");
            return;
        }
        call.resolve();
    }

    @PluginMethod
    public void syncPolicies(PluginCall call) {
        JSObject snapshot = call.getObject("snapshot");
        String rawSnapshot = snapshot == null ? "{}" : snapshot.toString();
        PolicySnapshot parsedSnapshot = PolicySnapshotReader.parse(rawSnapshot, true, true, System.currentTimeMillis()).snapshot;
        boolean hasMonitoringRules = !parsedSnapshot.activeModes.isEmpty()
            && (parsedSnapshot.fullLockBlocksAllApps
                || !parsedSnapshot.appTargets.isEmpty()
                || !parsedSnapshot.searchTargets.isEmpty());
        boolean hasWebsiteRules = !parsedSnapshot.activeModes.isEmpty() && !parsedSnapshot.websiteTargets.isEmpty();

        if (!saveJsonArray("blocked_packages", snapshot == null ? null : snapshot.optJSONArray("blockedPackages"))) {
            call.reject("Blocked packages could not be persisted");
            return;
        }
        if (!saveJsonArray("blocked_domains", snapshot == null ? null : snapshot.optJSONArray("blockedDomains"))) {
            call.reject("Blocked domains could not be persisted");
            return;
        }
        if (!saveJsonArray("blocked_search_terms", snapshot == null ? null : snapshot.optJSONArray("blockedSearchTerms"))) {
            call.reject("Blocked search terms could not be persisted");
            return;
        }
        if (!prefs()
            .edit()
            .putString("policy_snapshot", rawSnapshot)
            .putBoolean("monitoring_active", hasMonitoringRules)
            .commit()) {
            call.reject("Policy snapshot could not be persisted");
            return;
        }
        debug(
            "policy synced monitoring="
                + hasMonitoringRules
                + " website="
                + hasWebsiteRules
                + " appTargets="
                + parsedSnapshot.appTargets.size()
                + " searchTargets="
                + parsedSnapshot.searchTargets.size()
                + " websiteTargets="
                + parsedSnapshot.websiteTargets.size()
        );

        if (hasWebsiteRules && VpnService.prepare(getContext()) == null) {
            if (prefs().getBoolean("vpn_active", false)) {
                BlearnVpnService.update(getContext());
            } else {
                BlearnVpnService.start(getContext());
            }
        } else if (prefs().getBoolean("vpn_active", false)) {
            BlearnVpnService.stop(getContext());
        }
        syncStrictDeviceAdmin(parsedSnapshot);
        call.resolve();
    }

    @PluginMethod
    public void recheckCurrentForegroundTarget(PluginCall call) {
        JSObject result = new JSObject();
        result.put("matched", false);

        if (isAccessibilityServiceEnabled(getContext())) {
            debug("skip: accessibility service already active for blocking pipeline");
            call.resolve(result);
            return;
        }

        try {
            PendingNativeNavigation pendingNavigation = PendingNavigationStore.peek(getContext());
            if (
                (pendingNavigation != null && pendingNavigation.isValid())
                    || handoffCoordinator.isOverlayVisible()
                    || handoffCoordinator.isHandoffInProgress()
            ) {
                debug("skip: foreground recheck while blocking handoff already exists");
                call.resolve(result);
                return;
            }

            PolicyMatch match = evaluateForegroundPolicyMatch();
            if (match == null) {
                call.resolve(result);
                return;
            }

            if ("normal".equals(match.target.mode)) {
                debug("skip: foreground match outside blocking flow " + match.target.mode);
                call.resolve(result);
                return;
            }

            recordTriggerEvent(match.target.id, match.target.type);
            openPendingNavigationForMatch(match);
            result.put("matched", true);
            call.resolve(result);
        } catch (Exception error) {
            debug("foreground recheck failed", error);
            call.reject("Foreground recheck failed", error);
        }
    }

    @PluginMethod
    public void getMonitoringStatus(PluginCall call) {
        JSObject result = new JSObject();
        PendingNavigationStore.ForegroundObservation foregroundObservation = resolveForegroundObservation();
        boolean accessibilityPermission = isAccessibilityServiceEnabled(getContext());
        result.put("monitoringActive", prefs().getBoolean("monitoring_active", false));
        result.put("vpnActive", prefs().getBoolean("vpn_active", false));
        result.put("overlayPermission", canPresentOverlay());
        result.put("accessibilityPermission", accessibilityPermission);
        result.put("usageStatsPermission", hasUsageStatsAccess());
        result.put("deviceAdminActive", isDeviceAdminActive());
        result.put("batteryOptimizationExempt", isIgnoringBatteryOptimizations());
        result.put("notificationsEnabled", new BlearnNotificationBridge(getContext()).areNotificationsEnabled());
        String privateDnsMode = Settings.Global.getString(getContext().getContentResolver(), "private_dns_mode");
        if (!TextUtils.isEmpty(privateDnsMode)) {
            result.put("privateDnsMode", privateDnsMode);
        }
        result.put("vpnInterruptedByBoot", ProtectionWatchdog.wasVpnInterruptedByBoot(getContext()));
        result.put("accessibilityServiceReady", ScreenTimeAccessibilityService.isServiceReady(getContext()));
        long accessibilityServiceConnectedAt = ScreenTimeAccessibilityService.getServiceConnectedAt(getContext());
        if (accessibilityServiceConnectedAt > 0L) {
            result.put("accessibilityServiceConnectedAt", accessibilityServiceConnectedAt);
        }
        long accessibilityServiceDisconnectedAt = ScreenTimeAccessibilityService.getServiceDisconnectedAt(getContext());
        if (accessibilityServiceDisconnectedAt > 0L) {
            result.put("accessibilityServiceDisconnectedAt", accessibilityServiceDisconnectedAt);
        }
        result.put("websiteBlockingAvailable", true);
        result.put("websiteBlockingEnabled", prefs().getBoolean("vpn_active", false));
        result.put("websiteBlockingPermission", VpnService.prepare(getContext()) == null);
        result.put("lastTriggerTarget", prefs().getString("last_trigger_target", null));
        result.put("lastTriggerType", prefs().getString("last_trigger_type", null));
        long lastTriggerAt = prefs().getLong("last_trigger_at", 0L);
        if (lastTriggerAt > 0L) {
            result.put("lastTriggerAt", lastTriggerAt);
        }
        result.put("handoffInProgress", handoffCoordinator.isHandoffInProgress());
        result.put("overlayVisible", handoffCoordinator.isOverlayVisible());
        result.put("pendingQueueLength", PendingNavigationStore.getPendingQueueLength(getContext()));
        String activeBlockingSessionId = PendingNavigationStore.getActiveSessionId(getContext());
        if (!TextUtils.isEmpty(activeBlockingSessionId)) {
            result.put("activeBlockingSessionId", activeBlockingSessionId);
        }
        String activeBlockingTargetId = PendingNavigationStore.getActiveTargetId(getContext());
        if (!TextUtils.isEmpty(activeBlockingTargetId)) {
            result.put("activeBlockingTargetId", activeBlockingTargetId);
        }
        String activeBlockingStage = PendingNavigationStore.getActiveStage(getContext());
        if (!TextUtils.isEmpty(activeBlockingStage)) {
            result.put("activeBlockingStage", activeBlockingStage);
        }
        result.put("recentBlockingEvents", PendingNavigationStore.getRecentEventsJson(getContext()));
        String pendingTargetId = BlockingFlowState.getPendingTargetId(getContext());
        if (!TextUtils.isEmpty(pendingTargetId)) {
            result.put("pendingTargetId", pendingTargetId);
        }
        if (PolicySnapshot.hasText(foregroundObservation.packageName)) {
            result.put("currentAppId", foregroundObservation.packageName);
        }
        if (PolicySnapshot.hasText(foregroundObservation.source)) {
            result.put("foregroundSource", foregroundObservation.source);
        }
        if (foregroundObservation.observedAt > 0L) {
            result.put("foregroundObservedAt", foregroundObservation.observedAt);
        }
        result.put("taskDiagnostics", buildTaskDiagnostics());
        call.resolve(result);
    }

    @ActivityCallback
    private void handleVpnPermissionResult(PluginCall call, ActivityResult result) {
        if (call == null) {
            return;
        }

        if (result.getResultCode() != Activity.RESULT_OK) {
            prefs().edit().putBoolean("vpn_active", false).apply();
            call.reject("VPN permission denied");
            return;
        }

        BlearnVpnService.start(getContext());
        call.resolve();
    }

    @PluginMethod
    public void openGate(PluginCall call) {
        String targetId = call.getString("targetId");
        String targetType = call.getString("targetType", "app");
        String deckId = call.getString("deckId");
        if (TextUtils.isEmpty(targetId)) {
            call.reject("targetId is required");
            return;
        }

        PolicyTarget policyTarget = resolvePolicyTarget(targetId, targetType);
        PolicyTarget effectiveTarget = policyTarget;
        if (effectiveTarget == null || !TextUtils.isEmpty(deckId)) {
            effectiveTarget = new PolicyTarget(
                targetId,
                targetType,
                policyTarget != null && PolicySnapshot.hasText(policyTarget.mode) ? policyTarget.mode : "learn",
                !TextUtils.isEmpty(deckId)
                    ? deckId
                    : (policyTarget == null ? null : policyTarget.deckId),
                policyTarget == null ? 0 : policyTarget.requiredCorrectReviews,
                policyTarget == null ? 0 : policyTarget.unlockDurationMinutes
            );
        }

        PendingNativeNavigation navigation = buildPendingNavigation(
            effectiveTarget,
            resolveTargetLabel(targetId, targetType),
            null
        );
        openPendingNavigation(navigation);
        call.resolve();
    }

    @PluginMethod
    public void openTarget(PluginCall call) {
        String targetId = call.getString("targetId");
        String targetType = call.getString("targetType", "app");

        if (TextUtils.isEmpty(targetId)) {
            call.reject("targetId is required");
            return;
        }

        Intent intent = buildTargetIntent(targetId, targetType);
        if (intent == null) {
            call.reject("No launch target available");
            return;
        }

        ensureMainTaskAvailableForReturn();
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_NO_ANIMATION);
        getContext().startActivity(intent);
        call.resolve();
    }

    @PluginMethod
    public void peekPendingNavigation(PluginCall call) {
        PendingNativeNavigation navigation = PendingNavigationStore.peek(getContext());
        if (navigation == null || !navigation.isValid()) {
            call.resolve();
            return;
        }

        call.resolve(buildPendingNavigationResult(navigation));
    }

    @PluginMethod
    public void reportTriggerEvent(PluginCall call) {
        prefs()
            .edit()
            .putString("last_trigger_target", call.getString("targetId"))
            .putString("last_trigger_type", call.getString("targetType"))
            .putLong("last_trigger_at", call.getLong("triggeredAt") != null ? call.getLong("triggeredAt") : System.currentTimeMillis())
            .apply();
        call.resolve();
    }

    @PluginMethod
    public void consumePendingNavigation(PluginCall call) {
        PendingNativeNavigation navigation = PendingNavigationStore.consume(getContext());
        if (navigation == null || !navigation.isValid()) {
            debug("consume_pending_navigation_empty");
            call.resolve();
            return;
        }

        debug("consume_pending_navigation " + navigation.targetType + ":" + navigation.targetId);
        call.resolve(buildPendingNavigationResult(navigation));
    }

    @PluginMethod
    public void completePendingNavigation(PluginCall call) {
        String sessionId = call.getString("sessionId");
        BlockingFlowState.completeRouteReady(getContext(), sessionId);
        debug("pending_navigation_completed");
        call.resolve();
    }

    @PluginMethod
    public void abandonPendingNavigation(PluginCall call) {
        String sessionId = call.getString("sessionId");
        BlockingFlowState.reset(getContext(), sessionId, "pending_navigation_abandoned");
        debug("pending_navigation_abandoned");
        call.resolve();
    }

    @PluginMethod
    public void dismissBlockingOverlay(PluginCall call) {
        String sessionId = call.getString("sessionId");
        BlockingFlowState.dismiss(getContext(), sessionId, "blocking_overlay_dismissed");
        debug("blocking_overlay_dismissed");

        Activity activity = getActivity();
        if (activity != null) {
            if (activity instanceof BlockingOverlayActivity) {
                activity.finishAndRemoveTask();
                activity.overridePendingTransition(0, 0);
            }
        }
        call.resolve();
    }

    @PluginMethod
    public void getManualOverrideStatus(PluginCall call) {
        String targetId = call.getString("targetId");
        String targetType = call.getString("targetType", "app");

        if (TextUtils.isEmpty(targetId)) {
            call.reject("targetId is required");
            return;
        }

        ManualOverrideStore.Status status = ManualOverrideStore.getStatus(
            getContext(),
            targetId,
            targetType,
            System.currentTimeMillis()
        );
        call.resolve(buildManualOverrideResult(status, null, null));
    }

    @PluginMethod
    public void grantManualOverride(PluginCall call) {
        String targetId = call.getString("targetId");
        String targetType = call.getString("targetType", "app");
        Integer unlockDurationMinutes = call.getInt("unlockDurationMinutes");

        if (TextUtils.isEmpty(targetId)) {
            call.reject("targetId is required");
            return;
        }

        ManualOverrideStore.GrantResult result = ManualOverrideStore.grant(
            getContext(),
            targetId,
            targetType,
            unlockDurationMinutes != null ? unlockDurationMinutes : 15,
            System.currentTimeMillis()
        );
        call.resolve(buildManualOverrideResult(result, result.granted, result.reason));
    }

    @Nullable
    private Intent buildTargetIntent(String targetId, String targetType) {
        if ("website".equals(targetType)) {
            String normalizedUrl = targetId.startsWith("http://") || targetId.startsWith("https://")
                ? targetId
                : "https://" + targetId;
            return new Intent(Intent.ACTION_VIEW, Uri.parse(normalizedUrl));
        }

        if ("search".equals(targetType)) {
            return new Intent(
                Intent.ACTION_VIEW,
                Uri.parse("https://www.google.com/search?q=" + Uri.encode(targetId))
            );
        }

        PackageManager packageManager = getContext().getPackageManager();
        Intent launchIntent = packageManager.getLaunchIntentForPackage(targetId);
        if (launchIntent == null) {
            return null;
        }

        return launchIntent;
    }

    private void ensureMainTaskAvailableForReturn() {
        Activity activity = getActivity();
        if (activity != null && !(activity instanceof BlockingOverlayActivity)) {
            return;
        }

        ActivityManager activityManager = (ActivityManager) getContext().getSystemService(Context.ACTIVITY_SERVICE);
        if (activityManager != null) {
            for (ActivityManager.AppTask appTask : activityManager.getAppTasks()) {
                ActivityManager.RecentTaskInfo taskInfo = appTask.getTaskInfo();
                if (taskInfo == null) {
                    continue;
                }

                if (
                    isMainActivityComponent(taskInfo.baseActivity)
                        || isMainActivityComponent(taskInfo.topActivity)
                        || isMainActivityIntent(taskInfo.baseIntent)
                ) {
                    return;
                }
            }
        }

        Intent reopenIntent = new Intent(getContext(), MainActivity.class);
        reopenIntent.addFlags(
            Intent.FLAG_ACTIVITY_NEW_TASK
                | Intent.FLAG_ACTIVITY_SINGLE_TOP
                | Intent.FLAG_ACTIVITY_CLEAR_TOP
                | Intent.FLAG_ACTIVITY_NO_ANIMATION
        );
        getContext().startActivity(reopenIntent);
    }

    private JSObject buildTaskDiagnostics() {
        JSObject result = new JSObject();
        JSArray appTasks = new JSArray();
        Activity activity = getActivity();
        boolean mainTaskAvailable = activity instanceof MainActivity;
        boolean blockingTaskActive = activity instanceof BlockingOverlayActivity;

        if (activity != null) {
            result.put("currentActivityClass", activity.getClass().getName());
            result.put("currentTaskId", activity.getTaskId());
        }

        ActivityManager activityManager = (ActivityManager) getContext().getSystemService(Context.ACTIVITY_SERVICE);
        if (activityManager != null) {
            for (ActivityManager.AppTask appTask : activityManager.getAppTasks()) {
                ActivityManager.RecentTaskInfo taskInfo = appTask.getTaskInfo();
                if (taskInfo == null) {
                    continue;
                }

                String baseActivity = flattenComponentName(taskInfo.baseActivity);
                String topActivity = flattenComponentName(taskInfo.topActivity);
                String baseIntentComponent = flattenComponentName(
                    taskInfo.baseIntent != null ? taskInfo.baseIntent.getComponent() : null
                );
                boolean hasTaskData = false;
                JSObject task = new JSObject();

                if (!TextUtils.isEmpty(baseActivity)) {
                    task.put("baseActivity", baseActivity);
                    hasTaskData = true;
                }
                if (!TextUtils.isEmpty(topActivity)) {
                    task.put("topActivity", topActivity);
                    hasTaskData = true;
                }
                if (!TextUtils.isEmpty(baseIntentComponent)) {
                    task.put("baseIntentComponent", baseIntentComponent);
                    hasTaskData = true;
                }
                if (hasTaskData) {
                    appTasks.put(task);
                }

                if (
                    isMainActivityComponent(taskInfo.baseActivity)
                        || isMainActivityComponent(taskInfo.topActivity)
                        || isMainActivityIntent(taskInfo.baseIntent)
                ) {
                    mainTaskAvailable = true;
                }
                if (
                    isBlockingOverlayComponent(taskInfo.baseActivity)
                        || isBlockingOverlayComponent(taskInfo.topActivity)
                        || isBlockingOverlayIntent(taskInfo.baseIntent)
                ) {
                    blockingTaskActive = true;
                }
            }
        }

        result.put("mainTaskAvailable", mainTaskAvailable);
        result.put("blockingTaskActive", blockingTaskActive);
        result.put("appTasks", appTasks);
        return result;
    }

    private boolean isMainActivityIntent(@Nullable Intent intent) {
        return intent != null && isMainActivityComponent(intent.getComponent());
    }

    private boolean isMainActivityComponent(@Nullable ComponentName componentName) {
        return componentName != null
            && TextUtils.equals(componentName.getPackageName(), getContext().getPackageName())
            && TextUtils.equals(componentName.getClassName(), MainActivity.class.getName());
    }

    private boolean isBlockingOverlayIntent(@Nullable Intent intent) {
        return intent != null && isBlockingOverlayComponent(intent.getComponent());
    }

    private boolean isBlockingOverlayComponent(@Nullable ComponentName componentName) {
        return componentName != null
            && TextUtils.equals(componentName.getPackageName(), getContext().getPackageName())
            && TextUtils.equals(componentName.getClassName(), BlockingOverlayActivity.class.getName());
    }

    @Nullable
    private String flattenComponentName(@Nullable ComponentName componentName) {
        return componentName == null ? null : componentName.flattenToShortString();
    }

    private boolean hasUsageStatsAccess() {
        AppOpsManager appOps = (AppOpsManager) getContext().getSystemService(Context.APP_OPS_SERVICE);
        if (appOps == null) return false;
        int mode = appOps.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), getContext().getPackageName());
        if (mode == AppOpsManager.MODE_DEFAULT) {
            return getContext().checkCallingOrSelfPermission(android.Manifest.permission.PACKAGE_USAGE_STATS) == PackageManager.PERMISSION_GRANTED;
        }
        return mode == AppOpsManager.MODE_ALLOWED;
    }

    private void openPendingNavigation(PendingNativeNavigation navigation) {
        PendingNavigationLauncher.open(getContext(), navigation);
    }

    private JSObject buildPendingNavigationResult(PendingNativeNavigation navigation) {
        JSObject result = new JSObject();
        result.put("route", navigation.route);
        result.put("targetId", navigation.targetId);
        result.put("targetType", navigation.targetType);
        result.put("mode", navigation.mode);
        result.put("sessionId", navigation.sessionId);
        result.put("targetLabel", navigation.targetLabel);
        result.put("deckId", navigation.deckId);
        if (navigation.unlockDurationMinutes > 0) {
            result.put("unlockDurationMinutes", navigation.unlockDurationMinutes);
        }
        if (navigation.penaltyAmountSats != null) {
            result.put("penaltyAmountSats", navigation.penaltyAmountSats);
        }
        return result;
    }

    private JSObject buildManualOverrideResult(ManualOverrideStore.Status status, Boolean granted, String reason) {
        JSObject result = new JSObject();
        result.put("supported", true);
        result.put("active", status.active);
        result.put("attemptsUsed", status.attemptsUsed);
        result.put("attemptsRemaining", status.attemptsRemaining);
        result.put("maxAttempts", status.maxAttempts);
        if (status.unlockedUntil > 0L) {
            result.put("unlockedUntil", status.unlockedUntil);
        }
        if (status.windowStartedAt > 0L) {
            result.put("windowStartedAt", status.windowStartedAt);
        }
        if (granted != null) {
            result.put("granted", granted);
        }
        if (!TextUtils.isEmpty(reason)) {
            result.put("reason", reason);
        }
        return result;
    }

    private boolean canPresentOverlay() {
        return Settings.canDrawOverlays(getContext()) || isAccessibilityServiceEnabled(getContext());
    }

    @Nullable
    private PolicyMatch evaluateForegroundPolicyMatch() {
        if (handoffCoordinator.isHandoffInProgress()) {
            String pendingTargetId = BlockingFlowState.getPendingTargetId(getContext());
            if (!TextUtils.isEmpty(pendingTargetId)) {
                debug("skip: launch_handoff_in_progress");
                return null;
            }
            debug("reset: stale_foreground_recheck_handoff");
            BlockingFlowState.reset(getContext(), "stale_foreground_recheck_handoff");
        }

        PolicySnapshotReadResult snapshotReadResult = PolicySnapshotReader.read(getContext(), prefs());
        PolicySnapshot snapshot = snapshotReadResult.snapshot;
        if (snapshotReadResult.parseError != null) {
            debug("policy snapshot parse fallback: " + snapshotReadResult.parseError);
        }
        if (!snapshot.isBlockingActive()) {
            debug("skip: no active modes");
            return null;
        }

        String packageName = resolveForegroundPackageName();
        if (!PolicySnapshot.hasText(packageName)) {
            debug("skip: no foreground package");
            return null;
        }
        if (TextUtils.equals(packageName, getContext().getPackageName())) {
            debug("skip: self_app");
            return null;
        }

        PolicyMatch match = TargetMatcher.findAppMatch(
            snapshot,
            packageName,
            getApplicationLabel(getContext().getPackageManager(), packageName)
        );
        if (match == null) {
            debug("skip: no app match for " + packageName);
            return null;
        }
        if (!"lock".equals(match.target.mode) && snapshot.isUnlocked(match.target.id, match.target.type)) {
            debug("skip: target unlocked " + match.target.type + ":" + match.target.id);
            return null;
        }

        String targetKey = match.target.type + ":" + match.target.id;
        String lastTargetKey = prefs().getString("last_trigger_type", "") + ":" + prefs().getString("last_trigger_target", "");
        long lastTriggeredAt = prefs().getLong("last_trigger_at", 0L);
        if (TextUtils.equals(targetKey, lastTargetKey) && System.currentTimeMillis() - lastTriggeredAt < OVERLAY_COOLDOWN_MS) {
            debug("skip: cooldown active for " + targetKey);
            return null;
        }

        debug("foreground match: " + targetKey + " mode=" + match.target.mode);
        return match;
    }

    private String resolveForegroundPackageName() {
        return resolveForegroundObservation().packageName;
    }

    private PendingNavigationStore.ForegroundObservation resolveForegroundObservation() {
        PendingNavigationStore.ForegroundObservation persistedObservation =
            PendingNavigationStore.resolveForegroundObservation(getContext());
        if (
            PendingNavigationStore.isUsableForegroundPackage(
                persistedObservation.packageName,
                getContext().getPackageName()
            )
        ) {
            return persistedObservation;
        }

        UsageStatsManager usageStatsManager = (UsageStatsManager) getContext().getSystemService(Context.USAGE_STATS_SERVICE);
        long end = System.currentTimeMillis();
        long start = end - 5L * 60L * 1000L;
        List<UsageStats> stats = usageStatsManager == null
            ? new ArrayList<>()
            : usageStatsManager.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, start, end);

        if (stats == null || stats.isEmpty()) {
            return new PendingNavigationStore.ForegroundObservation("", "", 0L);
        }

        UsageStats mostRecent = Collections.max(stats, Comparator.comparingLong(UsageStats::getLastTimeUsed));
        String packageName = PolicySnapshot.normalize(mostRecent.getPackageName());
        if (PolicySnapshot.hasText(packageName)) {
            PendingNavigationStore.recordUsageObservation(getContext(), packageName, mostRecent.getLastTimeUsed());
            return new PendingNavigationStore.ForegroundObservation(
                packageName,
                "usage",
                mostRecent.getLastTimeUsed()
            );
        }

        return new PendingNavigationStore.ForegroundObservation("", "", 0L);
    }

    private void openPendingNavigationForMatch(PolicyMatch match) {
        openPendingNavigation(buildPendingNavigation(match.target, match.displayLabel, null));
    }

    private PendingNativeNavigation buildPendingNavigation(
        PolicyTarget target,
        String targetLabel,
        @Nullable Integer penaltyAmountSats
    ) {
        String sessionId = UUID.randomUUID().toString();
        return new PendingNativeNavigation(
            InterventionRouteBuilder.buildBlockingRoute(target, targetLabel, sessionId),
            target == null ? "" : target.id,
            target == null ? "" : target.type,
            target == null ? "" : target.mode,
            sessionId,
            targetLabel,
            target == null ? "" : target.deckId,
            target == null ? 0 : target.unlockDurationMinutes,
            penaltyAmountSats
        );
    }

    @Nullable
    private PolicyTarget resolvePolicyTarget(String targetId, String targetType) {
        if (TextUtils.isEmpty(targetId) || TextUtils.isEmpty(targetType)) {
            return null;
        }

        PolicySnapshotReadResult snapshotReadResult = PolicySnapshotReader.read(getContext(), prefs());
        PolicySnapshot snapshot = snapshotReadResult.snapshot;
        if ("app".equals(targetType)) {
            return snapshot.appTargets.get(PolicySnapshot.normalize(targetId));
        }

        List<PolicyTarget> candidates = "website".equals(targetType)
            ? snapshot.websiteTargets
            : snapshot.searchTargets;
        String normalizedTargetId = PolicySnapshot.normalize(targetId);
        for (PolicyTarget candidate : candidates) {
            if (normalizedTargetId.equals(PolicySnapshot.normalize(candidate.id))) {
                return candidate;
            }
        }

        return null;
    }

    private String resolveTargetLabel(String targetId, String targetType) {
        if (TextUtils.isEmpty(targetId)) {
            return "";
        }

        if (!"app".equals(targetType)) {
            return targetId;
        }

        return getApplicationLabel(getContext().getPackageManager(), targetId);
    }

    private void recordTriggerEvent(String targetId, String targetType) {
        prefs()
            .edit()
            .putString("last_trigger_target", targetId)
            .putString("last_trigger_type", targetType)
            .putLong("last_trigger_at", System.currentTimeMillis())
            .apply();
    }

    static boolean isAccessibilityServiceEnabled(Context context) {
        String enabledServices = Settings.Secure.getString(
            context.getContentResolver(),
            Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
        );
        if (TextUtils.isEmpty(enabledServices)) {
            return false;
        }

        ComponentName expectedComponent = new ComponentName(context, ScreenTimeAccessibilityService.class);
        String expectedId = expectedComponent.flattenToString();
        String expectedShortId = expectedComponent.flattenToShortString();

        String[] enabledEntries = enabledServices.split(":");
        for (String entry : enabledEntries) {
            if (TextUtils.equals(entry, expectedId) || TextUtils.equals(entry, expectedShortId)) {
                return true;
            }
        }

        return false;
    }

    private boolean saveJsonArray(String key, @Nullable Object array) {
        String serialized = "[]";
        if (array instanceof JSArray || array instanceof org.json.JSONArray) {
            serialized = array.toString();
        }
        return prefs().edit().putString(key, serialized).commit();
    }

    private String getApplicationLabel(PackageManager packageManager, String packageName) {
        try {
            ApplicationInfo applicationInfo = packageManager.getApplicationInfo(packageName, 0);
            return packageManager.getApplicationLabel(applicationInfo).toString();
        } catch (PackageManager.NameNotFoundException ignored) {
            return packageName;
        }
    }

    private JSObject buildInstalledAppItem(PackageManager packageManager, String packageName, String fallbackLabel) {
        JSObject item = new JSObject();
        String label = fallbackLabel;

        try {
            ApplicationInfo applicationInfo = packageManager.getApplicationInfo(packageName, 0);
            label = packageManager.getApplicationLabel(applicationInfo).toString();
        } catch (PackageManager.NameNotFoundException ignored) {
            // Keep fallback label.
        }

        item.put("packageName", packageName);
        item.put("appId", packageName);
        item.put("label", label);
        item.put("appName", label);
        String icon = getApplicationIconBase64(packageManager, packageName);
        if (!TextUtils.isEmpty(icon)) {
            item.put("icon", icon);
        }
        return item;
    }

    @Nullable
    private String getApplicationIconBase64(PackageManager packageManager, String packageName) {
        try {
            Drawable drawable = packageManager.getApplicationIcon(packageName);
            if (drawable == null) {
                return null;
            }

            Bitmap bitmap = drawableToBitmap(drawable);
            if (bitmap == null) {
                return null;
            }

            Bitmap scaledBitmap = scaleBitmap(bitmap, APP_ICON_SIZE_PX);
            ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
            try {
                boolean compressed = scaledBitmap.compress(Bitmap.CompressFormat.PNG, 100, outputStream);
                if (!compressed) {
                    return null;
                }

                byte[] iconBytes = outputStream.toByteArray();
                if (iconBytes.length == 0) {
                    return null;
                }

                return Base64.encodeToString(iconBytes, Base64.NO_WRAP);
            } finally {
                if (scaledBitmap != bitmap) {
                    scaledBitmap.recycle();
                }
            }
        } catch (Exception ignored) {
            return null;
        }
    }

    @Nullable
    private Bitmap drawableToBitmap(Drawable drawable) {
        if (drawable instanceof BitmapDrawable) {
            Bitmap bitmap = ((BitmapDrawable) drawable).getBitmap();
            if (bitmap != null && bitmap.getWidth() > 0 && bitmap.getHeight() > 0) {
                return bitmap;
            }
        }

        int width = Math.max(drawable.getIntrinsicWidth(), APP_ICON_SIZE_PX);
        int height = Math.max(drawable.getIntrinsicHeight(), APP_ICON_SIZE_PX);
        if (width <= 0 || height <= 0) {
            return null;
        }

        Bitmap bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);
        drawable.setBounds(0, 0, canvas.getWidth(), canvas.getHeight());
        drawable.draw(canvas);
        return bitmap;
    }

    private Bitmap scaleBitmap(Bitmap bitmap, int sizePx) {
        if (bitmap.getWidth() == sizePx && bitmap.getHeight() == sizePx) {
            return bitmap;
        }

        return Bitmap.createScaledBitmap(bitmap, sizePx, sizePx, true);
    }

    private Set<String> getRecentlyUsedPackageNames() {
        Set<String> packages = new HashSet<>();
        UsageStatsManager usageStatsManager = (UsageStatsManager) getContext().getSystemService(Context.USAGE_STATS_SERVICE);
        if (usageStatsManager == null) {
            return packages;
        }

        long end = System.currentTimeMillis();
        long start = end - 30L * 24L * 60L * 60L * 1000L;
        List<UsageStats> stats = usageStatsManager.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, start, end);
        if (stats == null) {
            return packages;
        }

        for (UsageStats entry : stats) {
            String packageName = entry.getPackageName();
            if (entry.getTotalTimeInForeground() <= 0 || TextUtils.isEmpty(packageName)) continue;
            packages.add(packageName);
            if (packages.size() >= MAX_RECENT_PACKAGES) {
                break;
            }
        }

        return packages;
    }

    private void debug(String message) {
        if ((getContext().getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0) {
            Log.d(TAG, message);
        }
    }

    private void debug(String message, Throwable error) {
        if ((getContext().getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0) {
            Log.d(TAG, message, error);
        }
    }

    private ComponentName getDeviceAdminComponent() {
        return new ComponentName(getContext(), BlearnDeviceAdminReceiver.class);
    }

    @Nullable
    private DevicePolicyManager getDevicePolicyManager() {
        return (DevicePolicyManager) getContext().getSystemService(Context.DEVICE_POLICY_SERVICE);
    }

    private boolean isDeviceAdminActive() {
        DevicePolicyManager devicePolicyManager = getDevicePolicyManager();
        return devicePolicyManager != null && devicePolicyManager.isAdminActive(getDeviceAdminComponent());
    }

    static boolean shouldKeepStrictDeviceAdmin(PolicySnapshot snapshot) {
        return StrictLockDeviceAdminManager.shouldKeepDeviceAdmin(snapshot, System.currentTimeMillis());
    }

    private void syncStrictDeviceAdmin(PolicySnapshot snapshot) {
        StrictLockDeviceAdminManager.sync(getContext(), snapshot);
        if (!shouldKeepStrictDeviceAdmin(snapshot)) {
            return;
        }

        maybeRequestStrictDeviceAdmin();
    }

    private void maybeRequestStrictDeviceAdmin() {
        if (isDeviceAdminActive()) {
            return;
        }

        long now = System.currentTimeMillis();
        long lastPromptAt = prefs().getLong("strict_device_admin_prompt_at", 0L);
        if (now - lastPromptAt < STRICT_DEVICE_ADMIN_PROMPT_COOLDOWN_MS) {
            debug("skip: strict device admin prompt cooldown active");
            return;
        }

        Activity activity = getActivity();
        if (activity == null || activity.isFinishing()) {
            debug("skip: strict device admin prompt without foreground activity");
            return;
        }

        prefs().edit().putLong("strict_device_admin_prompt_at", now).apply();
        Intent intent = new Intent(DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN);
        intent.putExtra(DevicePolicyManager.EXTRA_DEVICE_ADMIN, getDeviceAdminComponent());
        intent.putExtra(
            DevicePolicyManager.EXTRA_ADD_EXPLANATION,
            getContext().getString(R.string.device_admin_explanation)
        );

        activity.runOnUiThread(() -> {
            try {
                activity.startActivity(intent);
                debug("prompted strict device admin activation");
            } catch (Exception error) {
                debug("strict device admin prompt failed", error);
            }
        });
    }

    private void releaseStrictDeviceAdminIfIdle() {
        StrictLockDeviceAdminManager.releaseIfActive(getContext());
    }

    private boolean shouldIncludePackage(PackageManager packageManager, String packageName, boolean launcherSource) {
        if (TextUtils.isEmpty(packageName)) return false;
        if (packageName.equals(getContext().getPackageName())) return false;
        if (packageName.startsWith("android.")
            || packageName.startsWith("com.android.packageinstaller")
            || packageName.startsWith("com.android.")
            || packageName.startsWith("com.google.android.packageinstaller")
            || packageName.startsWith("com.google.android.permissioncontroller")
            || packageName.startsWith("com.android.permissioncontroller")
            || packageName.startsWith("com.android.systemui")
            || packageName.startsWith("com.android.settings")
            || packageName.startsWith("com.android.launcher")
            || packageName.startsWith("com.google.android.apps.nexuslauncher")
            || packageName.startsWith("com.google.android.launcher")
            || packageName.startsWith("com.sec.android.app.launcher")
            || packageName.startsWith("com.miui.home")
            || packageName.startsWith("com.huawei.android.launcher")
            || packageName.startsWith("com.transsion."))
        {
            return false;
        }

        try {
            ApplicationInfo applicationInfo = packageManager.getApplicationInfo(packageName, 0);
            boolean isSystemApp = (applicationInfo.flags & ApplicationInfo.FLAG_SYSTEM) != 0;
            boolean isUpdatedSystemApp = (applicationInfo.flags & ApplicationInfo.FLAG_UPDATED_SYSTEM_APP) != 0;
            if ((isSystemApp || isUpdatedSystemApp) && !hasLauncherIntent(packageManager, packageName)) {
                return false;
            }
        } catch (PackageManager.NameNotFoundException ignored) {
            return false;
        }

        if (!hasLauncherIntent(packageManager, packageName)) {
            return false;
        }

        return launcherSource || !packageName.startsWith("com.google.android.");
    }

    private boolean hasLauncherIntent(PackageManager packageManager, String packageName) {
        Intent launchIntent = packageManager.getLaunchIntentForPackage(packageName);
        return launchIntent != null;
    }

    private static final class UsageSummary {
        final String packageName;
        long totalTimeMs;
        long lastUsedTimestamp;

        UsageSummary(String packageName, long totalTimeMs, long lastUsedTimestamp) {
            this.packageName = packageName;
            this.totalTimeMs = totalTimeMs;
            this.lastUsedTimestamp = lastUsedTimestamp;
        }
    }
}
