package app.blearn.mobile;

import android.os.Handler;
import android.os.Looper;
import android.os.Build;
import android.text.TextUtils;
import android.util.Log;

import java.util.concurrent.locks.ReentrantLock;

final class OverlayHandoffCoordinator {
    interface OverlayHandle {
        void showLaunchingState();
        void showManualLaunchState();
        void hideNow();
    }

    private static final String TAG = "BlearnOverlayFlow";
    private static final long HANDOFF_TIMEOUT_MS = 2_500L;
    private static final long MAX_TOTAL_TIMEOUT_MS = 9_000L;
    private static final OverlayHandoffCoordinator INSTANCE = new OverlayHandoffCoordinator();

    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final Runnable timeoutRunnable = this::handleTimeout;
    private final ReentrantLock lock = new ReentrantLock();

    private OverlayHandoffPolicy.Stage stage = OverlayHandoffPolicy.Stage.IDLE;
    private String activeTargetKey = "";
    private OverlayHandle overlayHandle;
    private long flowStartedAt = 0L;

    private OverlayHandoffCoordinator() {
    }

    static OverlayHandoffCoordinator getInstance() {
        return INSTANCE;
    }

    void registerOverlay(String targetKey, OverlayHandle handle) {
        lock.lock();
        try {
            String normalizedTargetKey = normalizeTargetKey(targetKey);
            if (stage != OverlayHandoffPolicy.Stage.IDLE) {
                long elapsed = flowStartedAt > 0 ? System.currentTimeMillis() - flowStartedAt : 0;
                boolean sameTarget = TextUtils.equals(activeTargetKey, normalizedTargetKey);
                if (OverlayHandoffPolicy.shouldReplaceOverlay(stage, sameTarget, elapsed, MAX_TOTAL_TIMEOUT_MS)) {
                    if (elapsed > MAX_TOTAL_TIMEOUT_MS) {
                        debug("force_reset: total flow timeout exceeded " + elapsed + "ms for " + activeTargetKey);
                    } else {
                        debug("replace_stalled_overlay active=" + activeTargetKey + " incoming=" + normalizedTargetKey);
                    }
                    OverlayHandle previousHandle = overlayHandle;
                    clearLocked();
                    if (previousHandle != null) {
                        previousHandle.hideNow();
                    }
                    // Fall through to register the new overlay below.
                } else {
                    if (!sameTarget) {
                        debug("register_overlay_ignored target_key_mismatch active=" + activeTargetKey + " incoming=" + normalizedTargetKey);
                    } else {
                        debug("register_overlay_ignored stage=" + stage + " key=" + normalizedTargetKey);
                    }
                    return;
                }
            }

            cancelTimeoutLocked();
            flowStartedAt = System.currentTimeMillis();
            activeTargetKey = normalizedTargetKey;
            overlayHandle = handle;
            stage = OverlayHandoffPolicy.Stage.OVERLAY_VISIBLE;
            debug("overlay shown for " + activeTargetKey);
        } finally {
            lock.unlock();
        }
    }

    boolean isHandoffInProgress() {
        lock.lock();
        try {
            return stage == OverlayHandoffPolicy.Stage.LAUNCHING || stage == OverlayHandoffPolicy.Stage.WAITING_FOR_ROUTE_READY;
        } finally {
            lock.unlock();
        }
    }

    boolean isOverlayVisible() {
        lock.lock();
        try {
            return stage != OverlayHandoffPolicy.Stage.IDLE;
        } finally {
            lock.unlock();
        }
    }

    String getActiveTargetKey() {
        lock.lock();
        try {
            return TextUtils.isEmpty(activeTargetKey) ? null : activeTargetKey;
        } finally {
            lock.unlock();
        }
    }

    boolean shouldSuppressNewTriggers() {
        lock.lock();
        try {
            return OverlayHandoffPolicy.shouldSuppressNewTriggers(stage);
        } finally {
            lock.unlock();
        }
    }

    boolean beginLaunch(String targetKey) {
        return beginLaunchInternal(targetKey, false);
    }

    boolean beginDirectLaunch(String targetKey) {
        return beginLaunchInternal(targetKey, true);
    }

    private boolean beginLaunchInternal(String targetKey, boolean allowOverlaylessStart) {
        lock.lock();
        try {
            if (!OverlayHandoffPolicy.canBeginLaunch(stage, allowOverlaylessStart)) {
                debug(
                    "begin_launch_ignored stage="
                        + stage
                        + " overlayless="
                        + allowOverlaylessStart
                );
                return false;
            }

            String normalizedTargetKey = normalizeTargetKey(targetKey);
            if (stage == OverlayHandoffPolicy.Stage.IDLE) {
                cancelTimeoutLocked();
                flowStartedAt = System.currentTimeMillis();
                activeTargetKey = normalizedTargetKey;
            } else if (!TextUtils.equals(activeTargetKey, normalizedTargetKey)) {
                debug("begin_launch_ignored target_key_mismatch active=" + activeTargetKey + " incoming=" + normalizedTargetKey);
                return false;
            }

            stage = OverlayHandoffPolicy.Stage.LAUNCHING;
            if (overlayHandle != null) {
                overlayHandle.showLaunchingState();
            }
            scheduleTimeoutLocked();
            debug((allowOverlaylessStart ? "direct navigation buffered for " : "navigation buffered for ") + activeTargetKey);
            return true;
        } finally {
            lock.unlock();
        }
    }

    void markAppForegrounded() {
        lock.lock();
        try {
            if (stage != OverlayHandoffPolicy.Stage.LAUNCHING) {
                return;
            }

            OverlayHandle handle = overlayHandle;
            overlayHandle = null;
            stage = OverlayHandoffPolicy.Stage.WAITING_FOR_ROUTE_READY;
            scheduleTimeoutLocked();
            if (handle != null) {
                handle.hideNow();
                debug("overlay hidden after app foreground for " + activeTargetKey);
            }
            debug("app foreground for " + activeTargetKey);
        } finally {
            lock.unlock();
        }
    }

    void completeRouteReady() {
        lock.lock();
        try {
            OverlayHandle handle = overlayHandle;
            clearLocked();
            if (handle != null) {
                handle.hideNow();
            }
            debug("route ready");
        } finally {
            lock.unlock();
        }
    }

    private void handleTimeout() {
        if (!lock.tryLock()) {
            mainHandler.postDelayed(timeoutRunnable, 50);
            return;
        }
        try {
            if (stage == OverlayHandoffPolicy.Stage.LAUNCHING && overlayHandle != null) {
                stage = OverlayHandoffPolicy.Stage.STALLED;
                overlayHandle.showManualLaunchState();
                scheduleTimeoutLocked();
                debug("route_ready_timeout");
                return;
            }
            resetLocked("route_ready_timeout");
        } finally {
            lock.unlock();
        }
    }

    void reset(String reason) {
        lock.lock();
        try {
            resetLocked(reason);
        } finally {
            lock.unlock();
        }
    }

    private void resetLocked(String reason) {
        OverlayHandle handle = overlayHandle;
        clearLocked();
        if (handle != null) {
            handle.hideNow();
        }
        debug(reason);
    }

    private void clearLocked() {
        cancelTimeoutLocked();
        stage = OverlayHandoffPolicy.Stage.IDLE;
        activeTargetKey = "";
        overlayHandle = null;
        flowStartedAt = 0L;
    }

    private void scheduleTimeoutLocked() {
        mainHandler.removeCallbacks(timeoutRunnable);
        mainHandler.postDelayed(timeoutRunnable, HANDOFF_TIMEOUT_MS);
    }

    private void cancelTimeoutLocked() {
        mainHandler.removeCallbacks(timeoutRunnable);
    }

    private String normalizeTargetKey(String targetKey) {
        return TextUtils.isEmpty(targetKey) ? "unknown" : targetKey;
    }

    private void debug(String message) {
        if ("user".equals(Build.TYPE)) {
            return;
        }

        try {
            Log.d(TAG, message);
        } catch (RuntimeException ignored) {
        }
    }
}
