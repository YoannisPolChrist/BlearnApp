package app.blearn.mobile;

final class OwnPackageOverlayDecision {
    enum Action {
        IGNORE,
        ALLOW_HANDOFF_TO_CONTINUE,
        RESET_STALE_OVERLAY
    }

    private OwnPackageOverlayDecision() {
    }

    static Action decide(
        boolean handoffInProgress,
        boolean overlayVisible,
        boolean overlayShowing,
        String activeSessionId,
        String activeStage
    ) {
        boolean hasActiveSession = PolicySnapshot.hasText(activeSessionId);
        boolean handoffCompleted = "handoff_complete".equals(PolicySnapshot.normalize(activeStage));

        if (handoffInProgress && hasActiveSession && !handoffCompleted) {
            return Action.ALLOW_HANDOFF_TO_CONTINUE;
        }

        if (overlayVisible || overlayShowing || handoffInProgress) {
            return Action.RESET_STALE_OVERLAY;
        }

        return Action.IGNORE;
    }
}
