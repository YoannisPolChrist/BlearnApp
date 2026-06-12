package app.blearn.mobile;

import android.content.Context;
import android.text.TextUtils;

final class BlockingFlowState {
    private BlockingFlowState() {
    }

    static void completeRouteReady(Context context) {
        completeRouteReady(context, null);
    }

    static void completeRouteReady(Context context, String sessionId) {
        PendingNavigationStore.completeActiveHandoff(context, sessionId);
        OverlayHandoffCoordinator.getInstance().completeRouteReady();
        BlockingOverlayActivity.notifyRouteReady();
    }

    static void reset(Context context, String reason) {
        reset(context, null, reason);
    }

    static void reset(Context context, String sessionId, String reason) {
        PendingNavigationStore.abandonActive(context, sessionId, reason);
        OverlayHandoffCoordinator.getInstance().reset(reason);
    }

    static void dismiss(Context context, String reason) {
        dismiss(context, null, reason);
    }

    static void dismiss(Context context, String sessionId, String reason) {
        PendingNavigationStore.dismissActive(context, sessionId, reason);
        OverlayHandoffCoordinator.getInstance().reset(reason);
        BlockingOverlayActivity.notifyBlockingFlowDismissed();
    }

    static String getPendingTargetId(Context context) {
        PendingNativeNavigation navigation = PendingNavigationStore.peek(context);
        if (navigation == null || !navigation.isValid() || TextUtils.isEmpty(navigation.targetId)) {
            return null;
        }
        return navigation.targetId;
    }
}
