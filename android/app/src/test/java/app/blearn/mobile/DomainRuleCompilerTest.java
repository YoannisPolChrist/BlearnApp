package app.blearn.mobile;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class DomainRuleCompilerTest {
    @Test
    public void normalizesUrlsToBareDomains() {
        assertEquals("youtube.com", DomainRuleCompiler.normalizeDomain("https://YouTube.com/feed"));
        assertEquals("news.ycombinator.com", DomainRuleCompiler.normalizeDomain("news.ycombinator.com/"));
        assertEquals("", DomainRuleCompiler.normalizeDomain("127.0.0.1"));
    }

    @Test
    public void matchesSubdomainsButNotDifferentSuffixes() {
        assertTrue(DomainRuleCompiler.matches("example.com", "example.com"));
        assertTrue(DomainRuleCompiler.matches("example.com", "www.example.com"));
        assertTrue(DomainRuleCompiler.matches("example.com", "m.example.com"));
        assertFalse(DomainRuleCompiler.matches("example.com", "notexample.com"));
    }

    @Test
    public void compiledRulesMatchAlreadyNormalizedHostsWithoutExtraNormalization() {
        PolicySnapshot snapshot = new PolicySnapshot();
        snapshot.websiteBlockingActive = true;
        snapshot.websiteTargets.add(new PolicyTarget("YouTube.com", "website", "learn", null, 0, 0));

        DomainRuleCompiler.CompiledDomainRule rule = DomainRuleCompiler.compile(snapshot).get(0);

        assertTrue(rule.matchesHost("www.youtube.com"));
        assertFalse(rule.matchesHost("notyoutube.com"));
    }

    @Test
    public void compiledIndexFindsMostSpecificSuffixMatch() {
        PolicySnapshot snapshot = new PolicySnapshot();
        snapshot.websiteBlockingActive = true;
        snapshot.websiteTargets.add(new PolicyTarget("example.com", "website", "strict", null, 0, 0));
        snapshot.websiteTargets.add(new PolicyTarget("news.example.com", "website", "learn", "deck-news", 3, 12));

        DomainRuleCompiler.CompiledDomainIndex index = DomainRuleCompiler.compileIndex(snapshot);
        DomainRuleCompiler.CompiledDomainRule rule = index.findMatchingRule("m.news.example.com");

        assertNotNull(rule);
        assertEquals("news.example.com", rule.domain);
        assertEquals("learn", rule.target.mode);
    }

    @Test
    public void compiledIndexRejectsDifferentSuffixes() {
        PolicySnapshot snapshot = new PolicySnapshot();
        snapshot.websiteBlockingActive = true;
        snapshot.websiteTargets.add(new PolicyTarget("example.com", "website", "strict", null, 0, 0));

        DomainRuleCompiler.CompiledDomainIndex index = DomainRuleCompiler.compileIndex(snapshot);

        assertNull(index.findMatchingRule("notexample.com"));
        assertNull(index.findMatchingRule("example.co"));
    }
}
