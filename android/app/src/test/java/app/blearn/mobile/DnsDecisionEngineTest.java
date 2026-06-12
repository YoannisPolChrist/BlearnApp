package app.blearn.mobile;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class DnsDecisionEngineTest {
    @Test
    public void blocksConfiguredWebsiteAndSubdomains() {
        PolicySnapshot snapshot = new PolicySnapshot();
        snapshot.websiteBlockingActive = true;
        snapshot.activeModes.add("strict");
        snapshot.addTarget(new PolicyTarget("example.com", "website", "strict", null, 0, 0));

        DnsDecisionEngine engine = DnsDecisionEngine.fromSnapshot(snapshot);

        DnsDecisionEngine.Decision rootDecision = engine.decide("example.com");
        DnsDecisionEngine.Decision subdomainDecision = engine.decide("www.example.com");
        DnsDecisionEngine.Decision unrelatedDecision = engine.decide("notexample.com");

        assertTrue(rootDecision.blocked);
        assertEquals("example.com", rootDecision.target.id);
        assertTrue(subdomainDecision.blocked);
        assertFalse(unrelatedDecision.blocked);
        assertNull(unrelatedDecision.target);
    }

    @Test
    public void respectsTypedUnlockedWebsiteTargets() {
        PolicySnapshot snapshot = new PolicySnapshot();
        snapshot.websiteBlockingActive = true;
        snapshot.activeModes.add("learn");
        snapshot.addTarget(new PolicyTarget("youtube.com", "website", "learn", null, 0, 0));
        snapshot.unlockedTargets.add("website:youtube.com");

        DnsDecisionEngine engine = DnsDecisionEngine.fromSnapshot(snapshot);
        DnsDecisionEngine.Decision decision = engine.decide("www.youtube.com");

        assertFalse(decision.blocked);
        assertEquals("target unlocked", decision.reason);
    }

    @Test
    public void prefersMostSpecificMatchingDomain() {
        PolicySnapshot snapshot = new PolicySnapshot();
        snapshot.websiteBlockingActive = true;
        snapshot.activeModes.add("strict");
        snapshot.addTarget(new PolicyTarget("example.com", "website", "strict", null, 0, 0));
        snapshot.addTarget(new PolicyTarget("news.example.com", "website", "learn", "deck-news", 3, 12));

        DnsDecisionEngine engine = DnsDecisionEngine.fromSnapshot(snapshot);
        DnsDecisionEngine.Decision decision = engine.decide("m.news.example.com");

        assertTrue(decision.blocked);
        assertEquals("news.example.com", decision.target.id);
        assertEquals("learn", decision.target.mode);
    }
}
