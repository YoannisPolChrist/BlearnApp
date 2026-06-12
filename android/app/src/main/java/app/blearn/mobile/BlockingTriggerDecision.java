package app.blearn.mobile;

final class BlockingTriggerDecision {
    enum Action {
        PROCEED,
        SUPPRESS,
        RESET_AND_PROCEED
    }

    final Action action;
    final String reason;

    private BlockingTriggerDecision(Action action, String reason) {
        this.action = action;
        this.reason = reason;
    }

    static BlockingTriggerDecision decide(
        boolean handoffInProgress,
        boolean overlayStateActive,
        boolean overlayAttached,
        boolean overlayHandlePresent,
        String activeTargetKey,
        String pendingTargetId,
        String matchedTargetKey
    ) {
        if (!overlayStateActive) {
            return proceed();
        }

        if (handoffInProgress) {
            if (!hasText(pendingTargetId) && !overlayAttached) {
                return resetAndProceed("stale_handoff_without_pending_navigation");
            }
            return suppress("launch_handoff_in_progress");
        }

        if (!overlayAttached && !overlayHandlePresent) {
            return resetAndProceed("stale_overlay_state");
        }

        if (!hasText(matchedTargetKey)) {
            return suppress("overlay_visible_without_target");
        }

        if (sameTargetKey(activeTargetKey, matchedTargetKey)) {
            return suppress("overlay_already_visible");
        }

        return resetAndProceed("overlay_target_changed");
    }

    private static BlockingTriggerDecision proceed() {
        return new BlockingTriggerDecision(Action.PROCEED, null);
    }

    private static BlockingTriggerDecision suppress(String reason) {
        return new BlockingTriggerDecision(Action.SUPPRESS, reason);
    }

    private static BlockingTriggerDecision resetAndProceed(String reason) {
        return new BlockingTriggerDecision(Action.RESET_AND_PROCEED, reason);
    }

    private static boolean sameTargetKey(String left, String right) {
        return normalize(left).equals(normalize(right));
    }

    private static String normalize(String value) {
        return hasText(value) ? value.trim() : "";
    }

    private static boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }
}
