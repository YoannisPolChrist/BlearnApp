package app.blearn.mobile;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class OverlayHandoffPolicyTest {
    @Test
    public void overlaylessFallbackLaunchesCanStartFromIdleOnly() {
        assertTrue(OverlayHandoffPolicy.canBeginLaunch(OverlayHandoffPolicy.Stage.IDLE, true));
        assertFalse(OverlayHandoffPolicy.canBeginLaunch(OverlayHandoffPolicy.Stage.IDLE, false));
        assertTrue(OverlayHandoffPolicy.canBeginLaunch(OverlayHandoffPolicy.Stage.OVERLAY_VISIBLE, false));
        assertTrue(OverlayHandoffPolicy.canBeginLaunch(OverlayHandoffPolicy.Stage.STALLED, false));
        assertFalse(OverlayHandoffPolicy.canBeginLaunch(OverlayHandoffPolicy.Stage.LAUNCHING, true));
    }

    @Test
    public void stalledFlowsDoNotSuppressFreshTriggers() {
        assertFalse(OverlayHandoffPolicy.shouldSuppressNewTriggers(OverlayHandoffPolicy.Stage.STALLED));
        assertTrue(OverlayHandoffPolicy.shouldSuppressNewTriggers(OverlayHandoffPolicy.Stage.LAUNCHING));
        assertTrue(OverlayHandoffPolicy.shouldSuppressNewTriggers(OverlayHandoffPolicy.Stage.WAITING_FOR_ROUTE_READY));
        assertTrue(OverlayHandoffPolicy.shouldSuppressNewTriggers(OverlayHandoffPolicy.Stage.OVERLAY_VISIBLE));
    }

    @Test
    public void stalledOverlayCanBeReplacedByDifferentTargetBeforeTotalTimeout() {
        assertTrue(
            OverlayHandoffPolicy.shouldReplaceOverlay(
                OverlayHandoffPolicy.Stage.STALLED,
                false,
                8_500L,
                20_000L
            )
        );
        assertFalse(
            OverlayHandoffPolicy.shouldReplaceOverlay(
                OverlayHandoffPolicy.Stage.STALLED,
                true,
                8_500L,
                20_000L
            )
        );
    }

    @Test
    public void anyFlowCanBeReplacedAfterTotalTimeout() {
        assertTrue(
            OverlayHandoffPolicy.shouldReplaceOverlay(
                OverlayHandoffPolicy.Stage.WAITING_FOR_ROUTE_READY,
                true,
                20_001L,
                20_000L
            )
        );
        assertFalse(
            OverlayHandoffPolicy.shouldReplaceOverlay(
                OverlayHandoffPolicy.Stage.OVERLAY_VISIBLE,
                false,
                1_500L,
                20_000L
            )
        );
    }
}
