package app.blearn.mobile;

final class OverlayHandoffPolicy {
    enum Stage {
        IDLE,
        OVERLAY_VISIBLE,
        LAUNCHING,
        WAITING_FOR_ROUTE_READY,
        STALLED
    }

    private OverlayHandoffPolicy() {
    }

    static boolean canBeginLaunch(Stage stage, boolean allowOverlaylessStart) {
        if (stage == Stage.OVERLAY_VISIBLE || stage == Stage.STALLED) {
            return true;
        }

        return allowOverlaylessStart && stage == Stage.IDLE;
    }

    static boolean shouldSuppressNewTriggers(Stage stage) {
        return stage != Stage.IDLE && stage != Stage.STALLED;
    }

    static boolean shouldReplaceOverlay(
        Stage stage,
        boolean sameTarget,
        long elapsedMs,
        long maxTotalTimeoutMs
    ) {
        if (elapsedMs > maxTotalTimeoutMs) {
            return true;
        }

        return stage == Stage.STALLED && !sameTarget;
    }
}
