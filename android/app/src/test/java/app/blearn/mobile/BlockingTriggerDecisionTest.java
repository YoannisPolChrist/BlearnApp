package app.blearn.mobile;

import org.junit.Test;

import static org.junit.Assert.assertEquals;

public class BlockingTriggerDecisionTest {
    @Test
    public void proceedsWhenThereIsNoOverlayState() {
        BlockingTriggerDecision decision = BlockingTriggerDecision.decide(
            false,
            false,
            false,
            false,
            null,
            null,
            "app:com.android.chrome"
        );

        assertEquals(BlockingTriggerDecision.Action.PROCEED, decision.action);
    }

    @Test
    public void suppressesWhileLaunchHandoffStillHasPendingNavigation() {
        BlockingTriggerDecision decision = BlockingTriggerDecision.decide(
            true,
            true,
            false,
            false,
            "app:com.android.chrome",
            "com.android.chrome",
            "app:com.android.chrome"
        );

        assertEquals(BlockingTriggerDecision.Action.SUPPRESS, decision.action);
        assertEquals("launch_handoff_in_progress", decision.reason);
    }

    @Test
    public void resetsStaleLaunchHandoffWithoutPendingNavigation() {
        BlockingTriggerDecision decision = BlockingTriggerDecision.decide(
            true,
            true,
            false,
            false,
            "app:com.android.chrome",
            null,
            "app:com.android.chrome"
        );

        assertEquals(BlockingTriggerDecision.Action.RESET_AND_PROCEED, decision.action);
        assertEquals("stale_handoff_without_pending_navigation", decision.reason);
    }

    @Test
    public void suppressesWhenSameOverlayIsStillVisible() {
        BlockingTriggerDecision decision = BlockingTriggerDecision.decide(
            false,
            true,
            true,
            true,
            "app:com.android.chrome",
            null,
            "app:com.android.chrome"
        );

        assertEquals(BlockingTriggerDecision.Action.SUPPRESS, decision.action);
        assertEquals("overlay_already_visible", decision.reason);
    }

    @Test
    public void resetsWhenOverlayStateIsActiveButNoOverlayIsAttached() {
        BlockingTriggerDecision decision = BlockingTriggerDecision.decide(
            false,
            true,
            false,
            false,
            "app:com.android.chrome",
            null,
            "app:com.android.chrome"
        );

        assertEquals(BlockingTriggerDecision.Action.RESET_AND_PROCEED, decision.action);
        assertEquals("stale_overlay_state", decision.reason);
    }

    @Test
    public void suppressesWhenSameOverlayIsStillMounting() {
        BlockingTriggerDecision decision = BlockingTriggerDecision.decide(
            false,
            true,
            false,
            true,
            "app:com.android.chrome",
            null,
            "app:com.android.chrome"
        );

        assertEquals(BlockingTriggerDecision.Action.SUPPRESS, decision.action);
        assertEquals("overlay_already_visible", decision.reason);
    }

    @Test
    public void resetsWhenForegroundTargetChangesWhileOverlayStateIsActive() {
        BlockingTriggerDecision decision = BlockingTriggerDecision.decide(
            false,
            true,
            true,
            true,
            "app:com.android.chrome",
            null,
            "app:com.whatsapp"
        );

        assertEquals(BlockingTriggerDecision.Action.RESET_AND_PROCEED, decision.action);
        assertEquals("overlay_target_changed", decision.reason);
    }
}
