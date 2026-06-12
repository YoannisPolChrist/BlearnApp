package app.blearn.mobile;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class TargetMatcherTest {
    @Test
    public void matchesAppsAcrossAllPackages() {
        PolicySnapshot snapshot = new PolicySnapshot();
        snapshot.monitoringActive = true;
        snapshot.addTarget(new PolicyTarget("com.instagram.android", "app", "strict", null, 0, 0));

        PolicyMatch match = TargetMatcher.findAppMatch(snapshot, "com.instagram.android", "Instagram");

        assertNotNull(match);
        assertEquals("Instagram", match.displayLabel);
        assertEquals("app", match.source);
    }

    @Test
    public void doesNotMatchSearchTermsWhenMonitoringIsInactive() {
        PolicySnapshot snapshot = new PolicySnapshot();
        snapshot.monitoringActive = false;
        snapshot.addTarget(new PolicyTarget("doomscroll", "search", "learn", null, 0, 0));

        PolicyMatch match = TargetMatcher.findTextMatch(
            snapshot,
            "com.android.chrome",
            "doomscroll doomscroll doomscroll"
        );

        assertNull(match);
    }

    @Test
    public void matchesWebsitesOnlyInAllowedBrowserPackages() {
        PolicySnapshot snapshot = new PolicySnapshot();
        snapshot.websiteBlockingActive = true;
        snapshot.websiteTargets.add(new PolicyTarget("youtube.com", "website", "learn", null, 0, 0));

        PolicyMatch allowed = TargetMatcher.findTextMatch(snapshot, "com.android.chrome", "watching youtube.com all day");
        PolicyMatch blocked = TargetMatcher.findTextMatch(snapshot, "com.whatsapp", "youtube.com");

        assertNotNull(allowed);
        assertEquals("website", allowed.source);
        assertNull(blocked);
    }

    @Test
    public void matchesWebsiteTextCaseInsensitively() {
        PolicySnapshot snapshot = new PolicySnapshot();
        snapshot.websiteBlockingActive = true;
        snapshot.websiteTargets.add(new PolicyTarget("youtube.com", "website", "learn", null, 0, 0));

        PolicyMatch match = TargetMatcher.findTextMatch(
            snapshot,
            "com.android.chrome",
            "Watching YouTube.com on the homepage"
        );

        assertNotNull(match);
        assertEquals("website", match.source);
    }

    @Test
    public void matchesSearchTermsOnlyInSearchOrBrowserPackages() {
        PolicySnapshot snapshot = new PolicySnapshot();
        snapshot.monitoringActive = true;
        snapshot.searchTargets.add(new PolicyTarget("doomscrolling", "search", "penalty", null, 0, 0));

        PolicyMatch browserMatch = TargetMatcher.findTextMatch(snapshot, "org.mozilla.firefox", "doomscrolling tips");
        PolicyMatch searchAppMatch = TargetMatcher.findTextMatch(snapshot, "com.google.android.googlequicksearchbox", "doomscrolling");
        PolicyMatch nonAllowedMatch = TargetMatcher.findTextMatch(snapshot, "com.whatsapp", "doomscrolling");

        assertNotNull(browserMatch);
        assertNotNull(searchAppMatch);
        assertNull(nonAllowedMatch);
        assertTrue(TargetMatcher.supportsWebsitePackage("com.android.chrome"));
        assertTrue(TargetMatcher.supportsSearchPackage("com.google.android.googlequicksearchbox"));
    }

    @Test
    public void synthesizesLockHitsForAllAllowlistedAppsDuringFullLock() {
        PolicySnapshot snapshot = new PolicySnapshot();
        snapshot.monitoringActive = true;
        snapshot.activeModes.add("lock");
        snapshot.fullLockBlocksAllApps = true;

        PolicyMatch blockedApp = TargetMatcher.findAppMatch(snapshot, "com.instagram.android", "Instagram");
        PolicyMatch launcherApp = TargetMatcher.findAppMatch(snapshot, "com.google.android.apps.nexuslauncher", "Launcher");

        assertNotNull(blockedApp);
        assertEquals("lock", blockedApp.target.mode);
        assertEquals("com.instagram.android", blockedApp.target.id);
        assertNull(launcherApp);
    }
}
