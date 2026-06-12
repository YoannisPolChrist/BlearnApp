package app.blearn.mobile;

import static org.junit.Assert.assertEquals;

import org.junit.Test;

public class LegacyWebViewCleanupPolicyTest {
    @Test
    public void returnsNoneWhenCleanupAlreadyHandled() {
        assertEquals(
            LegacyWebViewCleanupPolicy.Decision.NONE,
            LegacyWebViewCleanupPolicy.decide(true, true, false)
        );
    }

    @Test
    public void marksDoneWithoutCleanupOnFreshInstall() {
        assertEquals(
            LegacyWebViewCleanupPolicy.Decision.MARK_DONE_ONLY,
            LegacyWebViewCleanupPolicy.decide(false, true, true)
        );
    }

    @Test
    public void marksDoneWithoutCleanupWhenNoArtifactsExist() {
        assertEquals(
            LegacyWebViewCleanupPolicy.Decision.MARK_DONE_ONLY,
            LegacyWebViewCleanupPolicy.decide(false, false, false)
        );
    }

    @Test
    public void runsCleanupOnlyForUpgradeWithLegacyArtifacts() {
        assertEquals(
            LegacyWebViewCleanupPolicy.Decision.RUN_CLEANUP,
            LegacyWebViewCleanupPolicy.decide(false, true, false)
        );
    }
}
