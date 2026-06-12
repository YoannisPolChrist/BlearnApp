package app.blearn.mobile;

final class LegacyWebViewCleanupPolicy {
    enum Decision {
        NONE,
        MARK_DONE_ONLY,
        RUN_CLEANUP
    }

    private LegacyWebViewCleanupPolicy() {
    }

    static Decision decide(boolean cleanupAlreadyHandled, boolean hasLegacyArtifacts, boolean freshInstall) {
        if (cleanupAlreadyHandled) {
            return Decision.NONE;
        }
        if (!hasLegacyArtifacts || freshInstall) {
            return Decision.MARK_DONE_ONLY;
        }
        return Decision.RUN_CLEANUP;
    }
}
