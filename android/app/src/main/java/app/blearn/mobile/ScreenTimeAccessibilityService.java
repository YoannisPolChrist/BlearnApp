package app.blearn.mobile;

import android.accessibilityservice.AccessibilityService;
import android.app.usage.UsageStats;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ApplicationInfo;
import android.os.Handler;
import android.os.Looper;
import android.text.TextUtils;
import android.util.Log;
import android.view.accessibility.AccessibilityEvent;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

public class ScreenTimeAccessibilityService extends AccessibilityService {
    private static final String PREFS = "blearn_screen_time";
    private static final String PREF_ACCESSIBILITY_SERVICE_READY = "accessibility_service_ready";
    private static final String PREF_ACCESSIBILITY_SERVICE_CONNECTED_AT = "accessibility_service_connected_at";
    private static final String PREF_ACCESSIBILITY_SERVICE_DISCONNECTED_AT = "accessibility_service_disconnected_at";
    private static final String TAG = "BlearnAccessibility";
    private static final long OVERLAY_COOLDOWN_MS = 1500L;
    private static volatile boolean serviceReady;
    private static volatile long serviceConnectedAt;

    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final OverlayHandoffCoordinator handoffCoordinator = OverlayHandoffCoordinator.getInstance();
    private SharedPreferences prefs;
    private String lastOpenedTarget = "";
    private long lastOpenedAt = 0L;
    private OverlayPresenter overlayPresenter;

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        try {
            handleAccessibilityEvent(event);
        } catch (Exception error) {
            debug("accessibility event handling failed", error);
            handoffCoordinator.reset("accessibility handler failed");
        }
    }

    @Override
    protected void onServiceConnected() {
        super.onServiceConnected();
        prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        serviceReady = true;
        serviceConnectedAt = System.currentTimeMillis();
        persistRuntimeStatus(true);
        debug("service connected");
    }

    private void handleAccessibilityEvent(AccessibilityEvent event) {
        if (event == null || !isRelevantEventType(event.getEventType())) {
            return;
        }

        String packageName = readPackageName(event);
        if (!PolicySnapshot.hasText(packageName)) {
            debug("skip: missing package");
            return;
        }

        debug("event: " + packageName + " type=" + event.getEventType());

        if (TextUtils.equals(packageName, getPackageName())) {
            String activeSessionId = PendingNavigationStore.getActiveSessionId(this);
            String activeStage = PendingNavigationStore.getActiveStage(this);
            OwnPackageOverlayDecision.Action ownPackageDecision = OwnPackageOverlayDecision.decide(
                handoffCoordinator.isHandoffInProgress(),
                handoffCoordinator.isOverlayVisible(),
                overlayPresenter != null && overlayPresenter.isShowing(),
                activeSessionId,
                activeStage
            );

            if (ownPackageDecision == OwnPackageOverlayDecision.Action.RESET_STALE_OVERLAY) {
                debug("reset stale overlay while own package is foregrounded");
                BlockingFlowState.dismiss(this, activeSessionId, "own_package_foregrounded");
                return;
            }
            if (ownPackageDecision == OwnPackageOverlayDecision.Action.ALLOW_HANDOFF_TO_CONTINUE) {
                debug("skip: own package during handoff");
                return;
            }

            hideOverlayIfIdle();
            debug("skip: own package");
            return;
        }

        PendingNavigationStore.recordAccessibilityObservation(this, packageName);
        String completedSessionId = PendingNavigationStore.getCompletedActiveSessionIdForForegroundChange(
            this,
            packageName,
            getPackageName()
        );
        if (PolicySnapshot.hasText(completedSessionId)) {
            debug("dismiss: completed handoff cleared after leaving blocking host session=" + completedSessionId);
            BlockingFlowState.dismiss(this, completedSessionId, "completed_handoff_left_host");
        }

        PolicySnapshotReadResult readResult = PolicySnapshotReader.read(prefs());
        if (readResult.parseError != null) {
            debug("policy snapshot parse failed: " + readResult.parseError);
        }

        PolicySnapshot snapshot = readResult.snapshot;
        ManualOverrideStore.applyActiveOverrides(this, snapshot, System.currentTimeMillis());
        if (!snapshot.isBlockingActive()) {
            debug("skip: no active blocking");
            hideOverlayIfIdle();
            return;
        }

        PolicyMatch match = resolveMatch(snapshot, packageName, event);
        if (match == null) {
            String foregroundPackageName = resolveForegroundPackageName();
            if (
                PolicySnapshot.hasText(foregroundPackageName)
                    && !TextUtils.equals(foregroundPackageName, packageName)
                    && !TextUtils.equals(foregroundPackageName, getPackageName())
                    && snapshot.isAllowedAppTargetId(foregroundPackageName)
            ) {
                debug("fallback foreground package " + foregroundPackageName + " after event " + packageName);
                match = resolveMatch(snapshot, foregroundPackageName, event);
            }
        }
        if (match == null) {
            hideOverlayIfIdle();
            return;
        }

        if (!"lock".equals(match.target.mode) && snapshot.isUnlocked(match.target.id, match.target.type)) {
            debug("skip: target unlocked " + match.target.type + ":" + match.target.id);
            hideOverlayIfIdle();
            return;
        }

        if (AbortSuppressionStore.isSuppressed(this, match.target.type, match.target.id, System.currentTimeMillis())) {
            debug("skip: abort suppression active for " + match.target.type + ":" + match.target.id);
            hideOverlayIfIdle();
            return;
        }

        String targetKey = match.target.type + ":" + match.target.id;
        BlockingTriggerDecision triggerDecision = BlockingTriggerDecision.decide(
            handoffCoordinator.isHandoffInProgress(),
            handoffCoordinator.isOverlayVisible(),
            overlayPresenter != null && overlayPresenter.isActuallyShowing(),
            overlayPresenter != null && overlayPresenter.isShowing(),
            handoffCoordinator.getActiveTargetKey(),
            BlockingFlowState.getPendingTargetId(this),
            targetKey
        );
        if (triggerDecision.action == BlockingTriggerDecision.Action.SUPPRESS) {
            debug("skip: " + triggerDecision.reason + " for " + targetKey);
            return;
        }
        if (triggerDecision.action == BlockingTriggerDecision.Action.RESET_AND_PROCEED) {
            debug("reset: " + triggerDecision.reason + " for " + targetKey);
            BlockingFlowState.reset(this, triggerDecision.reason);
        }

        if (TextUtils.equals(lastOpenedTarget, targetKey) && System.currentTimeMillis() - lastOpenedAt < OVERLAY_COOLDOWN_MS) {
            debug("skip: cooldown active for " + targetKey);
            return;
        }

        lastOpenedTarget = targetKey;
        lastOpenedAt = System.currentTimeMillis();
        recordTriggerEvent(match.target.id, match.target.type);
        debug(
            "resolved target "
                + targetKey
                + " mode="
                + match.target.mode
                + " deck="
                + match.target.deckId
        );
        showBlockingOverlay(match);
    }

    @Override
    public void onInterrupt() {
        handoffCoordinator.reset("accessibility interrupted");
    }

    @Override
    public boolean onUnbind(Intent intent) {
        serviceReady = false;
        persistRuntimeStatus(false);
        return super.onUnbind(intent);
    }

    @Override
    public void onDestroy() {
        serviceReady = false;
        persistRuntimeStatus(false);
        handoffCoordinator.reset("accessibility destroyed");
        super.onDestroy();
    }

    static boolean isServiceReady(Context context) {
        if (!ScreenTimePlugin.isAccessibilityServiceEnabled(context)) {
            return false;
        }

        if (serviceReady) {
            return true;
        }

        SharedPreferences preferences = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        return preferences.getBoolean(PREF_ACCESSIBILITY_SERVICE_READY, false);
    }

    static long getServiceConnectedAt(Context context) {
        if (serviceConnectedAt > 0L) {
            return serviceConnectedAt;
        }

        SharedPreferences preferences = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        return preferences.getLong(PREF_ACCESSIBILITY_SERVICE_CONNECTED_AT, 0L);
    }

    static long getServiceDisconnectedAt(Context context) {
        SharedPreferences preferences = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        return preferences.getLong(PREF_ACCESSIBILITY_SERVICE_DISCONNECTED_AT, 0L);
    }

    private SharedPreferences runtimePrefs() {
        if (prefs == null) {
            prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        }
        return prefs;
    }

    private void persistRuntimeStatus(boolean ready) {
        SharedPreferences.Editor editor = runtimePrefs().edit().putBoolean(PREF_ACCESSIBILITY_SERVICE_READY, ready);
        if (ready && serviceConnectedAt > 0L) {
            editor.putLong(PREF_ACCESSIBILITY_SERVICE_CONNECTED_AT, serviceConnectedAt);
            editor.putLong(PREF_ACCESSIBILITY_SERVICE_DISCONNECTED_AT, 0L);
        } else if (!ready) {
            editor.putLong(PREF_ACCESSIBILITY_SERVICE_DISCONNECTED_AT, System.currentTimeMillis());
        }
        editor.apply();
    }

    private PolicyMatch resolveMatch(PolicySnapshot snapshot, String packageName, AccessibilityEvent event) {
        PolicyMatch appMatch = TargetMatcher.findAppMatch(snapshot, packageName, getAppLabel(packageName));
        if (appMatch != null) {
            debug("match: app " + appMatch.target.id);
            return appMatch;
        }

        if (!TargetMatcher.shouldInspectText(snapshot, packageName)) {
            debug("skip: package outside conservative text allowlist " + packageName);
            return null;
        }

        String observedText = ObservedTextCollector.collect(this, event);
        if (!PolicySnapshot.hasText(observedText)) {
            debug("skip: empty observed text for " + packageName);
            return null;
        }

        PolicyMatch textMatch = TargetMatcher.findTextMatch(snapshot, packageName, observedText);
        if (textMatch != null) {
            debug("match: " + textMatch.source + " " + textMatch.target.id);
            return textMatch;
        }

        debug("skip: no text target matched in allowed package " + packageName);
        return null;
    }

    private SharedPreferences prefs() {
        if (prefs == null) {
            prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        }
        return prefs;
    }

    private OverlayPresenter getOverlayPresenter() {
        if (overlayPresenter == null) {
            overlayPresenter = new OverlayPresenter(this, mainHandler);
        }
        return overlayPresenter;
    }

    private void hideOverlayIfIdle() {
        if (overlayPresenter != null && !handoffCoordinator.isHandoffInProgress()) {
            overlayPresenter.hide();
        }
    }

    private boolean isRelevantEventType(int eventType) {
        return eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED
            || eventType == AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED
            || eventType == AccessibilityEvent.TYPE_VIEW_TEXT_CHANGED;
    }

    private String readPackageName(AccessibilityEvent event) {
        CharSequence packageNameSeq = event.getPackageName();
        return packageNameSeq == null ? "" : packageNameSeq.toString();
    }

    private void recordTriggerEvent(String targetId, String targetType) {
        prefs()
            .edit()
            .putString("last_trigger_target", targetId)
            .putString("last_trigger_type", targetType)
            .putLong("last_trigger_at", System.currentTimeMillis())
            .apply();
    }

    private void openIntervention(PolicyMatch match, boolean overlayPrepared) {
        String sessionId = UUID.randomUUID().toString();
        PendingNativeNavigation navigation = new PendingNativeNavigation(
            InterventionRouteBuilder.buildBlockingRoute(match.target, match.displayLabel, sessionId),
            match.target.id,
            match.target.type,
            match.target.mode,
            sessionId,
            match.displayLabel,
            match.target.deckId,
            match.target.unlockDurationMinutes,
            null
        );
        openPendingNavigation(navigation, overlayPrepared);
    }

    private void openPendingNavigation(PendingNativeNavigation navigation, boolean overlayPrepared) {
        if (navigation == null || !navigation.isValid()) {
            debug("skip: invalid pending navigation");
            handoffCoordinator.reset("invalid_navigation");
            return;
        }

        PendingNavigationLauncher.open(this, navigation, overlayPrepared);
    }

    private void showBlockingOverlay(PolicyMatch match) {
        if (match == null) {
            return;
        }

        debug("show overlay for " + match.target.type + ":" + match.target.id);
        getOverlayPresenter().show(match, (overlayPrepared) -> handlePrimaryAction(match, overlayPrepared));
    }

    private void handlePrimaryAction(PolicyMatch match, boolean overlayPrepared) {
        debug("open intervention from overlay for " + match.target.type + ":" + match.target.id);
        openIntervention(match, overlayPrepared);
    }

    private String getAppLabel(String packageName) {
        try {
            return getPackageManager().getApplicationLabel(
                getPackageManager().getApplicationInfo(packageName, 0)
            ).toString();
        } catch (Exception error) {
            debug("app label lookup failed for " + packageName, error);
            return packageName;
        }
    }

    private String resolveForegroundPackageName() {
        PendingNavigationStore.ForegroundObservation foregroundObservation =
            PendingNavigationStore.resolveForegroundObservation(this);
        if (PendingNavigationStore.isUsableForegroundPackage(foregroundObservation.packageName, getPackageName())) {
            return foregroundObservation.packageName;
        }

        UsageStatsManager usageStatsManager = (UsageStatsManager) getSystemService(Context.USAGE_STATS_SERVICE);
        long end = System.currentTimeMillis();
        long start = end - 5L * 60L * 1000L;
        List<UsageStats> stats = usageStatsManager == null
            ? new ArrayList<>()
            : usageStatsManager.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, start, end);

        if (stats == null || stats.isEmpty()) {
            return "";
        }

        UsageStats mostRecent = Collections.max(stats, Comparator.comparingLong(UsageStats::getLastTimeUsed));
        String packageName = PolicySnapshot.normalize(mostRecent.getPackageName());
        if (PolicySnapshot.hasText(packageName)) {
            PendingNavigationStore.recordUsageObservation(this, packageName, mostRecent.getLastTimeUsed());
        }
        return packageName;
    }

    private void debug(String message) {
        if (isDebuggable()) {
            Log.d(TAG, message);
        }
    }

    private void debug(String message, Throwable error) {
        if (isDebuggable()) {
            Log.d(TAG, message, error);
        }
    }

    private boolean isDebuggable() {
        return (getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
    }
}
