package app.blearn.mobile;

import android.content.Intent;
import android.graphics.Color;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.TextUtils;
import android.util.Log;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

import com.getcapacitor.CapConfig;

import java.lang.reflect.Field;
import java.lang.ref.WeakReference;

public class BlockingOverlayActivity extends MainActivity {
    private static final String TAG = "BlearnBlockingActivity";
    private static final Object INSTANCE_LOCK = new Object();
    private static final long LOADING_SHELL_DELAY_MS = 300L;
    private static final long LOADING_SHELL_RETRY_MS = 50L;
    private static WeakReference<BlockingOverlayActivity> currentInstance = new WeakReference<>(null);
    private PendingNativeNavigation bootstrapNavigation;
    private View blockingSplashView;
    private boolean userLeavingTask;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final Runnable showBlockingSplashRunnable = this::showBlockingSplashNow;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        try {
            bootstrapNavigation = PendingNavigationStore.promoteToActive(
                this,
                resolveBootstrapNavigation(getIntent()),
                "blocking host bootstrapped from launch payload"
            );
            // Never restore a stale WebView route here. Blocking entry must boot directly into
            // the requested handoff path, not briefly replay the last in-app screen.
            super.onCreate(null);
            registerCurrentInstance();
            scheduleBlockingSplash();
            overridePendingTransition(0, 0);
        } catch (RuntimeException error) {
            handleBootstrapFailure("blocking_overlay_on_create_failed", error);
        }
    }

    @Override
    protected void load() {
        try {
            config = CapConfig.loadDefault(this);
            String blockingRoute = resolveBootstrapRoute();
            if (!TextUtils.isEmpty(blockingRoute)) {
                applyStartPath(config, blockingRoute);
            }

            super.load();
        } catch (RuntimeException error) {
            handleBootstrapFailure("blocking_overlay_load_failed", error);
        }
    }

    @Override
    public void finish() {
        super.finish();
        overridePendingTransition(0, 0);
    }

    @Override
    public void onBackPressed() {
        dismissAndClose("blocking_overlay_back_pressed");
    }

    @Override
    public void onUserLeaveHint() {
        userLeavingTask = true;
        String sessionId = resolveBootstrapSessionId();
        if (!TextUtils.isEmpty(sessionId)) {
            BlockingFlowState.dismiss(this, sessionId, "blocking_overlay_user_left");
        }
        super.onUserLeaveHint();
    }

    @Override
    public void onDestroy() {
        Log.d(TAG, "onDestroy");
        OverlayHandoffCoordinator coordinator = OverlayHandoffCoordinator.getInstance();
        String bootstrapSessionId = resolveBootstrapSessionId();
        String activeSessionId = PendingNavigationStore.getActiveSessionId(this);
        String activeStage = PendingNavigationStore.getActiveStage(this);
        boolean ownsActiveSession = !TextUtils.isEmpty(bootstrapSessionId)
            && TextUtils.equals(bootstrapSessionId, activeSessionId);
        boolean routeReadyCompleted = "handoff_complete".equals(activeStage);

        if (ownsActiveSession && !routeReadyCompleted) {
            String reason = userLeavingTask
                ? "blocking_overlay_destroyed_after_user_leave"
                : "blocking_overlay_destroyed_before_route_ready";
            BlockingFlowState.reset(this, bootstrapSessionId, reason);
        } else if (ownsActiveSession) {
            BlockingFlowState.dismiss(this, bootstrapSessionId, "blocking_overlay_destroyed_after_route_ready");
        } else if (coordinator.isHandoffInProgress()) {
            coordinator.reset("blocking_overlay_destroyed_without_owned_active_session");
        } else if (coordinator.isOverlayVisible()) {
            coordinator.reset("blocking_overlay_destroyed_without_active_session");
        }
        hideBlockingSplash();
        clearCurrentInstance();
        super.onDestroy();
    }

    @Override
    protected boolean shouldPromoteBootstrapNavigation() {
        return false;
    }

    @Override
    protected boolean shouldBootstrapFromPendingStore() {
        return true;
    }

    private void dismissAndClose(String reason) {
        String sessionId = resolveBootstrapSessionId();
        BlockingFlowState.dismiss(this, sessionId, reason);
        finishAndRemoveTask();
        overridePendingTransition(0, 0);
    }

    @Override
    protected PendingNativeNavigation resolveBootstrapNavigation(Intent intent) {
        if (intent == null) {
            PendingNativeNavigation navigation = PendingNavigationStore.peek(this);
            return navigation != null && navigation.isValid() ? navigation : null;
        }

        PendingNativeNavigation intentNavigation = new PendingNativeNavigation(
            intent.getStringExtra(PendingNavigationLauncher.EXTRA_PENDING_ROUTE),
            intent.getStringExtra(PendingNavigationLauncher.EXTRA_PENDING_TARGET_ID),
            intent.getStringExtra(PendingNavigationLauncher.EXTRA_PENDING_TARGET_TYPE),
            intent.getStringExtra(PendingNavigationLauncher.EXTRA_PENDING_MODE),
            intent.getStringExtra(PendingNavigationLauncher.EXTRA_PENDING_SESSION_ID),
            intent.getStringExtra(PendingNavigationLauncher.EXTRA_PENDING_TARGET_LABEL),
            intent.getStringExtra(PendingNavigationLauncher.EXTRA_PENDING_DECK_ID),
            intent.getIntExtra(PendingNavigationLauncher.EXTRA_PENDING_UNLOCK_DURATION_MINUTES, 0),
            intent.hasExtra(PendingNavigationLauncher.EXTRA_PENDING_PENALTY_AMOUNT_SATS)
                ? Integer.valueOf(
                    intent.getIntExtra(PendingNavigationLauncher.EXTRA_PENDING_PENALTY_AMOUNT_SATS, 0)
                )
                : null
        );
        if (intentNavigation.isValid()) {
            return intentNavigation;
        }

        PendingNativeNavigation navigation = PendingNavigationStore.peek(this);
        return navigation != null && navigation.isValid() ? navigation : null;
    }

    private String resolveBootstrapRoute() {
        if (bootstrapNavigation != null && bootstrapNavigation.isValid() && !TextUtils.isEmpty(bootstrapNavigation.route)) {
            return bootstrapNavigation.route;
        }

        PendingNativeNavigation navigation = PendingNavigationStore.peek(this);
        if (navigation != null && navigation.isValid()) {
            return navigation.route;
        }

        return null;
    }

    private String resolveBootstrapSessionId() {
        return bootstrapNavigation == null ? null : bootstrapNavigation.sessionId;
    }

    private void applyStartPath(CapConfig capConfig, String route) {
        if (capConfig == null || TextUtils.isEmpty(route)) {
            return;
        }

        try {
            Field startPathField = CapConfig.class.getDeclaredField("startPath");
            startPathField.setAccessible(true);
            String normalizedRoute = route.trim();
            String startPath = normalizedRoute.startsWith("#") ? normalizedRoute : "#" + normalizedRoute;
            startPathField.set(capConfig, startPath);
            Log.d(TAG, "blocking bootstrap start path applied: " + startPath);
        } catch (ReflectiveOperationException error) {
            Log.w(TAG, "Unable to apply blocking bootstrap start path", error);
        }
    }

    static void notifyRouteReady() {
        BlockingOverlayActivity activity = getCurrentInstance();
        if (activity == null) {
            return;
        }

        activity.runOnUiThread(activity::hideBlockingSplash);
    }

    static void notifyBlockingFlowDismissed() {
        BlockingOverlayActivity activity = getCurrentInstance();
        if (activity == null) {
            return;
        }

        activity.runOnUiThread(activity::hideBlockingSplash);
    }

    private static BlockingOverlayActivity getCurrentInstance() {
        synchronized (INSTANCE_LOCK) {
            return currentInstance.get();
        }
    }

    private void registerCurrentInstance() {
        synchronized (INSTANCE_LOCK) {
            currentInstance = new WeakReference<>(this);
        }
    }

    private void clearCurrentInstance() {
        synchronized (INSTANCE_LOCK) {
            BlockingOverlayActivity activity = currentInstance.get();
            if (activity == this) {
                currentInstance = new WeakReference<>(null);
            }
        }
    }

    private void scheduleBlockingSplash() {
        mainHandler.removeCallbacks(showBlockingSplashRunnable);
        mainHandler.postDelayed(showBlockingSplashRunnable, LOADING_SHELL_DELAY_MS);
    }

    private void showBlockingSplashNow() {
        if (blockingSplashView != null) {
            return;
        }

        ViewGroup root = findViewById(android.R.id.content);
        if (root == null) {
            mainHandler.postDelayed(showBlockingSplashRunnable, LOADING_SHELL_RETRY_MS);
            return;
        }

        FrameLayout splash = new FrameLayout(this);
        splash.setClickable(true);
        splash.setFocusable(true);
        splash.setBackgroundColor(Color.parseColor(resolveSplashColor()));

        LinearLayout content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setGravity(Gravity.CENTER_HORIZONTAL);
        content.setPadding(dp(28), dp(28), dp(28), dp(28));

        TextView eyebrowView = new TextView(this);
        eyebrowView.setText(resolveSplashEyebrow());
        eyebrowView.setTextColor(Color.parseColor(resolveSplashEyebrowColor()));
        eyebrowView.setTextSize(TypedValue.COMPLEX_UNIT_SP, 11);
        eyebrowView.setAllCaps(true);
        eyebrowView.setLetterSpacing(0.18f);
        eyebrowView.setTypeface(eyebrowView.getTypeface(), android.graphics.Typeface.BOLD);
        content.addView(eyebrowView);

        ImageView logoView = new ImageView(this);
        logoView.setImageResource(getApplicationInfo().icon);
        LinearLayout.LayoutParams logoParams = new LinearLayout.LayoutParams(dp(88), dp(88));
        logoParams.topMargin = dp(18);
        content.addView(logoView, logoParams);

        TextView titleView = new TextView(this);
        titleView.setText("Blearn");
        titleView.setTextColor(Color.WHITE);
        titleView.setTextSize(TypedValue.COMPLEX_UNIT_SP, 28);
        titleView.setTypeface(titleView.getTypeface(), android.graphics.Typeface.BOLD);
        titleView.setGravity(Gravity.CENTER_HORIZONTAL);
        LinearLayout.LayoutParams titleParams = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        );
        titleParams.topMargin = dp(18);
        content.addView(titleView, titleParams);

        TextView subtitleView = new TextView(this);
        subtitleView.setText(resolveSplashMessage());
        subtitleView.setTextColor(Color.parseColor("#FFE5E7EB"));
        subtitleView.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
        subtitleView.setGravity(Gravity.CENTER_HORIZONTAL);
        subtitleView.setLineSpacing(0f, 1.16f);
        LinearLayout.LayoutParams subtitleParams = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        );
        subtitleParams.topMargin = dp(12);
        content.addView(subtitleView, subtitleParams);

        splash.addView(
            content,
            new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.WRAP_CONTENT,
                Gravity.CENTER
            )
        );
        root.addView(
            splash,
            new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
        );
        blockingSplashView = splash;
    }

    private void hideBlockingSplash() {
        mainHandler.removeCallbacks(showBlockingSplashRunnable);
        if (blockingSplashView == null) {
            return;
        }

        ViewGroup parent = (ViewGroup) blockingSplashView.getParent();
        if (parent != null) {
            parent.removeView(blockingSplashView);
        }
        blockingSplashView = null;
    }

    private String resolveSplashMessage() {
        String mode = bootstrapNavigation == null ? "" : bootstrapNavigation.mode;
        if ("learn".equals(mode)) {
            return "Learn-Freischaltung wird vorbereitet";
        }
        if ("penalty".equals(mode)) {
            return "Dein Schutzschirm wird vorbereitet";
        }
        if ("strict".equals(mode)) {
            return "Dein Fokus-Flow wird vorbereitet";
        }
        if ("lock".equals(mode)) {
            return "Dein Fokus bleibt bis zum Ende des Schutzfensters gesperrt.";
        }
        return "Dein Reflexions-Flow wird vorbereitet";
    }

    private String resolveSplashEyebrow() {
        String mode = bootstrapNavigation == null ? "" : bootstrapNavigation.mode;
        if ("learn".equals(mode)) {
            return "Learn";
        }
        if ("penalty".equals(mode)) {
            return "Penalty";
        }
        if ("strict".equals(mode)) {
            return "Fokus-Schutz";
        }
        if ("lock".equals(mode)) {
            return "Strict Lock";
        }
        return "Reflexion";
    }

    private String resolveSplashEyebrowColor() {
        String mode = bootstrapNavigation == null ? "" : bootstrapNavigation.mode;
        if ("learn".equals(mode)) {
            return "#FFF1D487";
        }
        if ("penalty".equals(mode) || "strict".equals(mode) || "lock".equals(mode)) {
            return "#FFF6B4A7";
        }
        return "#FF9DD9E6";
    }

    private String resolveSplashColor() {
        String mode = bootstrapNavigation == null ? "" : bootstrapNavigation.mode;
        if ("learn".equals(mode)) {
            return "#FF12120E";
        }
        if ("penalty".equals(mode) || "strict".equals(mode) || "lock".equals(mode)) {
            return "#FF161112";
        }
        return "#FF0F172A";
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private void handleBootstrapFailure(String reason, RuntimeException error) {
        Log.e(TAG, reason, error);
        String sessionId = resolveBootstrapSessionId();
        BlockingFlowState.reset(this, sessionId, reason);
        hideBlockingSplash();
        clearCurrentInstance();
        finish();
        overridePendingTransition(0, 0);
    }
}
