package app.blearn.mobile;

import org.junit.Test;

import static org.junit.Assert.assertEquals;

public class OwnPackageOverlayDecisionTest {
    @Test
    public void allowsLiveHandoffToContinueWhileBlearnComesForeground() {
        OwnPackageOverlayDecision.Action decision = OwnPackageOverlayDecision.decide(
            true,
            true,
            true,
            "session-1",
            "consumed"
        );

        assertEquals(OwnPackageOverlayDecision.Action.ALLOW_HANDOFF_TO_CONTINUE, decision);
    }

    @Test
    public void resetsStaleOverlayWhenBlearnReturnsWithoutALiveHandoff() {
        OwnPackageOverlayDecision.Action decision = OwnPackageOverlayDecision.decide(
            false,
            true,
            true,
            null,
            null
        );

        assertEquals(OwnPackageOverlayDecision.Action.RESET_STALE_OVERLAY, decision);
    }

    @Test
    public void resetsCompletedHandoffThatStillClaimsOverlayVisibility() {
        OwnPackageOverlayDecision.Action decision = OwnPackageOverlayDecision.decide(
            false,
            true,
            false,
            "session-2",
            "handoff_complete"
        );

        assertEquals(OwnPackageOverlayDecision.Action.RESET_STALE_OVERLAY, decision);
    }

    @Test
    public void ignoresOwnPackageWhenNoOverlayStateRemains() {
        OwnPackageOverlayDecision.Action decision = OwnPackageOverlayDecision.decide(
            false,
            false,
            false,
            "session-3",
            "handoff_complete"
        );

        assertEquals(OwnPackageOverlayDecision.Action.IGNORE, decision);
    }
}
