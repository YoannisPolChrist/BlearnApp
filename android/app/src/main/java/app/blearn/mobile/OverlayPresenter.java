package app.blearn.mobile;

import android.accessibilityservice.AccessibilityService;
import android.content.pm.ApplicationInfo;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.view.animation.DecelerateInterpolator;
import android.view.animation.OvershootInterpolator;
import android.view.animation.AccelerateDecelerateInterpolator;
import android.view.animation.PathInterpolator;
import android.animation.ObjectAnimator;
import android.animation.PropertyValuesHolder;
import android.animation.ValueAnimator;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

final class OverlayPresenter implements OverlayHandoffCoordinator.OverlayHandle {
    interface PrimaryAction {
        void run(boolean overlayPrepared);
    }

    private static final String TAG = "BlearnOverlay";
    private static final long SCRIM_ENTER_MS = 180L;
    private static final long GLOW_ENTER_MS = 260L;
    private static final long CARD_ENTER_MS = 240L;

    private final AccessibilityService service;
    private final Handler mainHandler;
    private WindowManager windowManager;
    private FrameLayout overlayRootView;
    private View overlayView;
    private View overlayGlowView;
    private LinearLayout manualLaunchCard;
    private TextView manualLaunchTitleView;
    private TextView manualLaunchBodyView;
    private boolean launching;
    private String lastMode = "strict";
    private PrimaryAction primaryAction;
    private ObjectAnimator glowAnimator;

    OverlayPresenter(AccessibilityService service, Handler mainHandler) {
        this.service = service;
        this.mainHandler = mainHandler;
    }

    void show(PolicyMatch match, PrimaryAction onPrimaryAction) {
        mainHandler.post(() -> {
            hideInternal();
            launching = false;
            lastMode = match.target.mode;
            primaryAction = onPrimaryAction;

            windowManager = (WindowManager) service.getSystemService(AccessibilityService.WINDOW_SERVICE);
            if (windowManager == null) {
                debug("overlay fallback: missing window manager");
                runPrimaryAction(false);
                return;
            }

            FrameLayout root = new FrameLayout(service);
            root.setClickable(true);
            root.setFocusable(true);
            root.setBackgroundColor(Color.TRANSPARENT);
            root.setAlpha(0f);
            root.setOnClickListener((view) -> {
                if (launching || manualLaunchCard == null || manualLaunchCard.getVisibility() != View.VISIBLE) {
                    return;
                }

                debug("manual overlay retry tapped");
                showLaunchingState();
                runPrimaryAction(true);
            });

            View glow = new View(service);
            FrameLayout.LayoutParams glowParams = new FrameLayout.LayoutParams(dp(240), dp(240), Gravity.CENTER);
            glow.setBackground(makeCircleDrawable(resolveGlowColor(match.target.mode)));
            glow.setAlpha(0f);
            glow.setScaleX(0.78f);
            glow.setScaleY(0.78f);
            root.addView(glow, glowParams);

            LinearLayout launchCard = new LinearLayout(service);
            launchCard.setOrientation(LinearLayout.VERTICAL);
            launchCard.setGravity(Gravity.CENTER_HORIZONTAL);
            launchCard.setPadding(dp(24), dp(22), dp(24), dp(22));
            launchCard.setBackground(makeRoundedDrawable("#F51F2937"));
            launchCard.setVisibility(View.GONE);
            launchCard.setAlpha(0f);

            TextView titleView = new TextView(service);
            titleView.setTextColor(Color.WHITE);
            titleView.setTextSize(20f);
            titleView.setGravity(Gravity.CENTER_HORIZONTAL);
            titleView.setTypeface(titleView.getTypeface(), android.graphics.Typeface.BOLD);
            launchCard.addView(titleView);

            TextView bodyView = new TextView(service);
            bodyView.setTextColor(Color.parseColor("#FFE5E7EB"));
            bodyView.setTextSize(14f);
            bodyView.setGravity(Gravity.CENTER_HORIZONTAL);
            bodyView.setLineSpacing(0f, 1.12f);
            LinearLayout.LayoutParams bodyParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            );
            bodyParams.topMargin = dp(10);
            launchCard.addView(bodyView, bodyParams);

            FrameLayout.LayoutParams launchCardParams = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.WRAP_CONTENT,
                Gravity.CENTER
            );
            int horizontalInset = dp(28);
            launchCardParams.leftMargin = horizontalInset;
            launchCardParams.rightMargin = horizontalInset;
            root.addView(launchCard, launchCardParams);

            WindowManager.LayoutParams layoutParams = new WindowManager.LayoutParams(
                WindowManager.LayoutParams.MATCH_PARENT,
                WindowManager.LayoutParams.MATCH_PARENT,
                WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN
                    | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS
                    | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON,
                PixelFormat.TRANSLUCENT
            );
            layoutParams.gravity = Gravity.TOP | Gravity.START;

            try {
                windowManager.addView(root, layoutParams);
                overlayRootView = root;
                overlayView = root;
                overlayGlowView = glow;
                manualLaunchCard = launchCard;
                manualLaunchTitleView = titleView;
                manualLaunchBodyView = bodyView;
                OverlayHandoffCoordinator.getInstance()
                    .registerOverlay(match.target.type + ":" + match.target.id, this);
                showLaunchingState();
                debug("overlay shield shown for " + match.target.type + ":" + match.target.id + " mode=" + match.target.mode);
                root.post(() -> {
                    if (overlayView == null) {
                        return;
                    }

                    runPrimaryAction(true);
                });
            } catch (Exception error) {
                debug("overlay fallback: addView failed", error);
                runPrimaryAction(false);
            }
        });
    }

    boolean isShowing() {
        return overlayView != null;
    }

    boolean isActuallyShowing() {
        View currentOverlayView = overlayView;
        return currentOverlayView != null
            && currentOverlayView.isAttachedToWindow()
            && currentOverlayView.getVisibility() == View.VISIBLE
            && currentOverlayView.getWindowVisibility() == View.VISIBLE;
    }

    void hide() {
        mainHandler.post(this::hideInternal);
    }

    @Override
    public void showLaunchingState() {
        mainHandler.post(() -> {
            launching = true;
            cancelBreathingAnimation();
            if (overlayRootView != null) {
                overlayRootView.animate().cancel();
                overlayRootView.setBackgroundColor(Color.parseColor(resolveScrimColor(lastMode)));
                overlayRootView.animate()
                    .alpha(1f)
                    .setDuration(SCRIM_ENTER_MS)
                    .setInterpolator(new PathInterpolator(0.22f, 1f, 0.36f, 1f))
                    .start();
            }
            if (overlayGlowView != null) {
                overlayGlowView.animate().cancel();
                overlayGlowView.setAlpha(0f);
                overlayGlowView.setScaleX(0.78f);
                overlayGlowView.setScaleY(0.78f);
                overlayGlowView.animate()
                    .alpha(1f)
                    .scaleX(1.18f)
                    .scaleY(1.18f)
                    .setDuration(GLOW_ENTER_MS)
                    .setInterpolator(new PathInterpolator(0.34f, 1.35f, 0.64f, 1f))
                    .withEndAction(this::startBreathingAnimation)
                    .start();
            }
            if (manualLaunchCard != null) {
                manualLaunchCard.animate().cancel();
                manualLaunchCard.setVisibility(View.GONE);
                manualLaunchCard.setAlpha(0f);
                manualLaunchCard.setTranslationY(0f);
                manualLaunchCard.setScaleX(1f);
                manualLaunchCard.setScaleY(1f);
            }
        });
    }

    @Override
    public void showManualLaunchState() {
        mainHandler.post(() -> {
            launching = false;
            cancelBreathingAnimation();
            if (overlayRootView != null) {
                overlayRootView.animate().cancel();
                overlayRootView.setBackgroundColor(Color.parseColor(resolveScrimColor(lastMode)));
                overlayRootView.animate()
                    .alpha(0.96f)
                    .setDuration(SCRIM_ENTER_MS)
                    .setInterpolator(new PathInterpolator(0.22f, 1f, 0.36f, 1f))
                    .start();
            }
            if (manualLaunchTitleView != null) {
                manualLaunchTitleView.setText("Blearn oeffnen");
            }
            if (manualLaunchBodyView != null) {
                manualLaunchBodyView.setText("Die Uebergabe haengt gerade. Tippe, um den Blocking-Flow erneut zu starten.");
            }
            if (manualLaunchCard != null) {
                manualLaunchCard.animate().cancel();
                manualLaunchCard.setVisibility(View.VISIBLE);
                manualLaunchCard.setAlpha(0f);
                manualLaunchCard.setTranslationY(dp(14));
                manualLaunchCard.setScaleX(0.97f);
                manualLaunchCard.setScaleY(0.97f);
                manualLaunchCard.animate()
                    .alpha(1f)
                    .translationY(0f)
                    .scaleX(1f)
                    .scaleY(1f)
                    .setDuration(CARD_ENTER_MS)
                    .setInterpolator(new OvershootInterpolator(0.78f))
                    .start();
            }
        });
    }

    @Override
    public void hideNow() {
        if (Looper.myLooper() == Looper.getMainLooper()) {
            hideInternal();
        } else {
            mainHandler.post(this::hideInternal);
        }
    }

    private void hideInternal() {
        WindowManager currentWindowManager = windowManager;
        View currentOverlayView = overlayView;

        cancelBreathingAnimation();

        try {
            if (currentWindowManager != null && currentOverlayView != null) {
                currentOverlayView.animate().cancel();
                currentWindowManager.removeViewImmediate(currentOverlayView);
            }
        } catch (Exception ignored) {
            // Ignore stale overlay handles.
        } finally {
            manualLaunchCard = null;
            manualLaunchTitleView = null;
            manualLaunchBodyView = null;
            overlayGlowView = null;
            overlayRootView = null;
            overlayView = null;
            windowManager = null;
            launching = false;
            primaryAction = null;
            debug("overlay hidden");
        }
    }

    private void startBreathingAnimation() {
        if (overlayGlowView == null) {
            return;
        }
        cancelBreathingAnimation();

        PropertyValuesHolder scaleX = PropertyValuesHolder.ofFloat("scaleX", 1.12f, 1.22f);
        PropertyValuesHolder scaleY = PropertyValuesHolder.ofFloat("scaleY", 1.12f, 1.22f);

        glowAnimator = ObjectAnimator.ofPropertyValuesHolder(overlayGlowView, scaleX, scaleY);
        glowAnimator.setDuration(1400L);
        glowAnimator.setRepeatCount(ValueAnimator.INFINITE);
        glowAnimator.setRepeatMode(ValueAnimator.REVERSE);
        glowAnimator.setInterpolator(new AccelerateDecelerateInterpolator());
        glowAnimator.start();
    }

    private void cancelBreathingAnimation() {
        if (glowAnimator != null) {
            glowAnimator.cancel();
            glowAnimator = null;
        }
    }

    private String resolveScrimColor(String mode) {
        if ("learn".equals(mode)) {
            return "#D811140D";
        }
        if ("penalty".equals(mode) || "strict".equals(mode) || "lock".equals(mode)) {
            return "#E1130E10";
        }
        return "#D40F172A";
    }

    private String resolveGlowColor(String mode) {
        if ("learn".equals(mode)) {
            return "#24E7B45F";
        }
        if ("penalty".equals(mode) || "strict".equals(mode) || "lock".equals(mode)) {
            return "#24FF7864";
        }
        return "#245DC7D8";
    }

    private android.graphics.drawable.GradientDrawable makeCircleDrawable(String fillColor) {
        android.graphics.drawable.GradientDrawable drawable = new android.graphics.drawable.GradientDrawable();
        drawable.setShape(android.graphics.drawable.GradientDrawable.OVAL);
        drawable.setColor(Color.parseColor(fillColor));
        return drawable;
    }

    private android.graphics.drawable.GradientDrawable makeRoundedDrawable(String fillColor) {
        android.graphics.drawable.GradientDrawable drawable = new android.graphics.drawable.GradientDrawable();
        drawable.setCornerRadius(dp(22));
        drawable.setColor(Color.parseColor(fillColor));
        return drawable;
    }

    private int dp(int value) {
        return Math.round(value * service.getResources().getDisplayMetrics().density);
    }

    private void runPrimaryAction(boolean overlayPrepared) {
        PrimaryAction currentPrimaryAction = primaryAction;
        if (currentPrimaryAction == null) {
            return;
        }

        try {
            currentPrimaryAction.run(overlayPrepared);
        } catch (Exception error) {
            debug("overlay launch failed", error);
            if (overlayPrepared && overlayView != null) {
                showManualLaunchState();
            }
        }
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
        return (service.getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
    }
}
