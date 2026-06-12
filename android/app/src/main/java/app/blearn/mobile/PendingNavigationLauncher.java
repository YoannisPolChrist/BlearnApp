package app.blearn.mobile;

import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

final class PendingNavigationLauncher {
    private static final String TAG = "BlearnPendingNav";
    static final String EXTRA_PENDING_ROUTE = "app.blearn.mobile.EXTRA_PENDING_ROUTE";
    static final String EXTRA_PENDING_TARGET_ID = "app.blearn.mobile.EXTRA_PENDING_TARGET_ID";
    static final String EXTRA_PENDING_TARGET_TYPE = "app.blearn.mobile.EXTRA_PENDING_TARGET_TYPE";
    static final String EXTRA_PENDING_MODE = "app.blearn.mobile.EXTRA_PENDING_MODE";
    static final String EXTRA_PENDING_SESSION_ID = "app.blearn.mobile.EXTRA_PENDING_SESSION_ID";
    static final String EXTRA_PENDING_TARGET_LABEL = "app.blearn.mobile.EXTRA_PENDING_TARGET_LABEL";
    static final String EXTRA_PENDING_DECK_ID = "app.blearn.mobile.EXTRA_PENDING_DECK_ID";
    static final String EXTRA_PENDING_UNLOCK_DURATION_MINUTES =
        "app.blearn.mobile.EXTRA_PENDING_UNLOCK_DURATION_MINUTES";
    static final String EXTRA_PENDING_PENALTY_AMOUNT_SATS =
        "app.blearn.mobile.EXTRA_PENDING_PENALTY_AMOUNT_SATS";
    private static final Handler MAIN_HANDLER = new Handler(Looper.getMainLooper());
    private static final OverlayHandoffCoordinator HANDOFF_COORDINATOR = OverlayHandoffCoordinator.getInstance();

    private PendingNavigationLauncher() {
    }

    static boolean open(Context context, PendingNativeNavigation navigation) {
        return open(context, navigation, true);
    }

    static boolean open(Context context, PendingNativeNavigation navigation, boolean overlayPrepared) {
        if (context == null || navigation == null || !navigation.isValid()) {
            HANDOFF_COORDINATOR.reset("invalid_navigation");
            return false;
        }

        try {
            PendingNavigationStore.SaveOutcome saveOutcome = PendingNavigationStore.save(context, navigation);
            if (saveOutcome == PendingNavigationStore.SaveOutcome.DUPLICATE) {
                // Proceed to launch the blocking activity to ensure it is brought to the foreground
            } else if (saveOutcome == PendingNavigationStore.SaveOutcome.SUPPRESSED_ACTIVE_SESSION) {
                return false;
            } else if (saveOutcome != PendingNavigationStore.SaveOutcome.SAVED) {
                HANDOFF_COORDINATOR.reset("pending_navigation_save_failed");
                return false;
            }
        } catch (Exception error) {
            HANDOFF_COORDINATOR.reset("pending_navigation_save_failed");
            debug(context, "pending navigation save failed", error);
            return false;
        }

        String targetKey = navigation.targetType + ":" + navigation.targetId;

        Runnable launchRunnable = () -> {
            boolean launchPrepared = overlayPrepared
                ? HANDOFF_COORDINATOR.beginLaunch(targetKey)
                : HANDOFF_COORDINATOR.beginDirectLaunch(targetKey);
            if (!launchPrepared) {
                HANDOFF_COORDINATOR.reset("blocking_overlay_launch_rejected");
                return;
            }

            if (!startBlockingActivity(context, navigation)) {
                HANDOFF_COORDINATOR.reset("blocking_overlay_launch_failed");
            }
        };

        if (Looper.myLooper() == Looper.getMainLooper()) {
            launchRunnable.run();
        } else {
            MAIN_HANDLER.post(launchRunnable);
        }

        return true;
    }

    static boolean startBlockingActivity(Context context) {
        return startBlockingActivity(context, PendingNavigationStore.peek(context));
    }

    static boolean startBlockingActivity(Context context, PendingNativeNavigation navigation) {
        try {
            Intent intent = buildBlockingActivityIntent(context, navigation);
            context.startActivity(intent);
            return true;
        } catch (Exception error) {
            debug(context, "blocking overlay launch failed", error);
            return false;
        }
    }

    private static void debug(Context context, String message, Throwable error) {
        if ((context.getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0) {
            Log.d(TAG, message, error);
        }
    }

    static Intent buildBlockingActivityIntent(Context context, PendingNativeNavigation navigation) {
        Intent intent = new Intent(context, BlockingOverlayActivity.class);
        intent.addFlags(
            Intent.FLAG_ACTIVITY_NEW_TASK
                | Intent.FLAG_ACTIVITY_NO_ANIMATION
                | Intent.FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS
                | Intent.FLAG_ACTIVITY_SINGLE_TOP
        );

        if (navigation != null && navigation.isValid()) {
            intent.putExtra(EXTRA_PENDING_ROUTE, navigation.route);
            intent.putExtra(EXTRA_PENDING_TARGET_ID, navigation.targetId);
            intent.putExtra(EXTRA_PENDING_TARGET_TYPE, navigation.targetType);
            intent.putExtra(EXTRA_PENDING_MODE, navigation.mode);
            intent.putExtra(EXTRA_PENDING_SESSION_ID, navigation.sessionId);
            intent.putExtra(EXTRA_PENDING_TARGET_LABEL, navigation.targetLabel);
            intent.putExtra(EXTRA_PENDING_DECK_ID, navigation.deckId);
            intent.putExtra(EXTRA_PENDING_UNLOCK_DURATION_MINUTES, navigation.unlockDurationMinutes);
            if (navigation.penaltyAmountSats != null) {
                intent.putExtra(EXTRA_PENDING_PENALTY_AMOUNT_SATS, navigation.penaltyAmountSats);
            }
        }

        return intent;
    }
}
