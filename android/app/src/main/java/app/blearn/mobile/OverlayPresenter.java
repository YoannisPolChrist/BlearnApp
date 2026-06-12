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
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

final class OverlayPresenter implements OverlayHandoffCoordinator.OverlayHandle {
    interface PrimaryAction {
        void run(boolean overlayPrepared);
    }

    private static final String TAG = "BlearnOverlay";

    private final AccessibilityService service;
    private final Handler mainHandler;
    private WindowManager windowManager;
    private FrameLayout overlayRootView;
    private View overlayView;
    private LinearLayout manualLaunchCard;
    private TextView manualLaunchTitleView;
    private TextView manualLaunchBodyView;
    private boolean launching;
    private String lastMode = "strict";
    private PrimaryAction primaryAction;

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
            if (overlayRootView != null) {
                overlayRootView.setBackgroundColor(Color.parseColor(resolveScrimColor(lastMode)));
                overlayRootView.setAlpha(1f);
            }
            if (manualLaunchCard != null) {
                manualLaunchCard.setVisibility(View.GONE);
                manualLaunchCard.setAlpha(0f);
            }
        });
    }

    @Override
    public void showManualLaunchState() {
        mainHandler.post(() -> {
            launching = false;
            if (overlayRootView != null) {
                overlayRootView.setBackgroundColor(Color.parseColor(resolveScrimColor(lastMode)));
                overlayRootView.setAlpha(0.96f);
            }
            if (manualLaunchTitleView != null) {
                manualLaunchTitleView.setText("Blearn oeffnen");
            }
            if (manualLaunchBodyView != null) {
                manualLaunchBodyView.setText("Die Uebergabe haengt gerade. Tippe, um den Blocking-Flow erneut zu starten.");
            }
            if (manualLaunchCard != null) {
                manualLaunchCard.setVisibility(View.VISIBLE);
                manualLaunchCard.setAlpha(1f);
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

        try {
            if (currentWindowManager != null && currentOverlayView != null) {
                currentWindowManager.removeViewImmediate(currentOverlayView);
            }
        } catch (Exception ignored) {
            // Ignore stale overlay handles.
        } finally {
            manualLaunchCard = null;
            manualLaunchTitleView = null;
            manualLaunchBodyView = null;
            overlayRootView = null;
            overlayView = null;
            windowManager = null;
            launching = false;
            primaryAction = null;
            debug("overlay hidden");
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
