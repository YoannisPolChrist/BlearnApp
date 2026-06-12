package app.blearn.mobile;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class PolicySnapshotReaderTest {
    @Test
    public void parsesActiveModesTargetsAndUnlocks() {
        long now = 1_700_000_000_000L;
        String snapshotJson = "{"
            + "\"activeModes\":[\"strict\",\"learn\"],"
            + "\"targets\":["
            + "{\"id\":\"com.instagram.android\",\"type\":\"app\",\"mode\":\"strict\",\"enabled\":true},"
            + "{\"id\":\"youtube.com\",\"type\":\"website\",\"mode\":\"learn\",\"enabled\":true},"
            + "{\"id\":\"doomscrolling\",\"type\":\"search\",\"mode\":\"penalty\",\"enabled\":true}"
            + "],"
            + "\"unlockedTargets\":{\"app:com.instagram.android\":" + (now + 60_000L) + "},"
            + "\"blockedPackages\":[\"com.instagram.android\"],"
            + "\"blockedDomains\":[\"youtube.com\"],"
            + "\"blockedSearchTerms\":[\"doomscrolling\"]"
            + "}";

        PolicySnapshotReadResult result = PolicySnapshotReader.parse(snapshotJson, true, true, now);

        assertNull(result.parseError);
        assertEquals(2, result.snapshot.activeModes.size());
        assertEquals(1, result.snapshot.appTargets.size());
        assertEquals(1, result.snapshot.websiteTargets.size());
        assertEquals(1, result.snapshot.searchTargets.size());
        assertTrue(result.snapshot.unlockedTargets.contains("app:com.instagram.android"));
        assertTrue(result.snapshot.isUnlocked("com.instagram.android", "app"));
        assertTrue(result.snapshot.isBlockingActive());
    }

    @Test
    public void parsesFullLockAllAppsSemantics() {
        long now = 1_700_000_000_000L;
        String snapshotJson = "{"
            + "\"activeModes\":[\"lock\"],"
            + "\"strictLockUntil\":" + (now + 60_000L) + ","
            + "\"fullLockBlocksAllApps\":true,"
            + "\"targets\":[]"
            + "}";

        PolicySnapshotReadResult result = PolicySnapshotReader.parse(snapshotJson, true, false, now);

        assertNull(result.parseError);
        assertTrue(result.snapshot.fullLockBlocksAllApps);
        assertTrue(result.snapshot.shouldLockAllApps());
        assertTrue(result.snapshot.isBlockingActive());
    }

    @Test
    public void expiresStrictLockTargetsAfterWindowEnds() {
        long now = 1_700_000_000_000L;
        String snapshotJson = "{"
            + "\"activeModes\":[\"lock\",\"learn\"],"
            + "\"strictLockUntil\":" + (now - 1_000L) + ","
            + "\"targets\":["
            + "{\"id\":\"com.android.settings\",\"type\":\"app\",\"mode\":\"lock\",\"enabled\":true},"
            + "{\"id\":\"youtube.com\",\"type\":\"website\",\"mode\":\"learn\",\"enabled\":true}"
            + "],"
            + "\"blockedPackages\":[\"com.android.settings\"],"
            + "\"blockedDomains\":[\"youtube.com\"]"
            + "}";

        PolicySnapshotReadResult result = PolicySnapshotReader.parse(snapshotJson, true, true, now);

        assertNull(result.parseError);
        assertFalse(result.snapshot.activeModes.contains("lock"));
        assertFalse(result.snapshot.fullLockBlocksAllApps);
        assertTrue(result.snapshot.websiteTargets.size() == 1);
        assertFalse(result.snapshot.appTargets.containsKey("com.android.settings"));
        assertFalse(result.snapshot.blockedPackages.contains("com.android.settings"));
        assertTrue(result.snapshot.isBlockingActive());
    }

    @Test
    public void keepsStrictAddonProtectionTargetsWhileWindowIsActive() {
        long now = 1_700_000_000_000L;
        String snapshotJson = "{"
            + "\"activeModes\":[\"strict\",\"learn\"],"
            + "\"strictAddonProtectionUntil\":" + (now + 60_000L) + ","
            + "\"targets\":["
            + "{\"id\":\"com.android.settings\",\"type\":\"app\",\"mode\":\"strict\",\"enabled\":true},"
            + "{\"id\":\"youtube.com\",\"type\":\"website\",\"mode\":\"learn\",\"enabled\":true}"
            + "],"
            + "\"blockedPackages\":[\"com.android.settings\"],"
            + "\"blockedDomains\":[\"youtube.com\"]"
            + "}";

        PolicySnapshotReadResult result = PolicySnapshotReader.parse(snapshotJson, true, true, now);

        assertNull(result.parseError);
        assertTrue(result.snapshot.appTargets.containsKey("com.android.settings"));
        assertTrue(result.snapshot.blockedPackages.contains("com.android.settings"));
        assertTrue(result.snapshot.isBlockingActive());
    }

    @Test
    public void expiresStrictAddonProtectionTargetsAfterWindowEnds() {
        long now = 1_700_000_000_000L;
        String snapshotJson = "{"
            + "\"activeModes\":[\"strict\",\"learn\"],"
            + "\"strictAddonProtectionUntil\":" + (now - 1_000L) + ","
            + "\"targets\":["
            + "{\"id\":\"com.android.settings\",\"type\":\"app\",\"mode\":\"strict\",\"enabled\":true},"
            + "{\"id\":\"youtube.com\",\"type\":\"website\",\"mode\":\"learn\",\"enabled\":true}"
            + "],"
            + "\"blockedPackages\":[\"com.android.settings\"],"
            + "\"blockedDomains\":[\"youtube.com\"]"
            + "}";

        PolicySnapshotReadResult result = PolicySnapshotReader.parse(snapshotJson, true, true, now);

        assertNull(result.parseError);
        assertFalse(result.snapshot.appTargets.containsKey("com.android.settings"));
        assertFalse(result.snapshot.blockedPackages.contains("com.android.settings"));
        assertEquals(1, result.snapshot.websiteTargets.size());
        assertTrue(result.snapshot.isBlockingActive());
    }

    @Test
    public void fallsBackToLegacyFields() {
        long now = 1_700_000_000_000L;
        String snapshotJson = "{"
            + "\"activeMode\":\"penalty\","
            + "\"blockedPackages\":[\"com.instagram.android\"],"
            + "\"blockedDomains\":[\"youtube.com\"],"
            + "\"blockedSearchTerms\":[\"doomscrolling\"],"
            + "\"unlockedApps\":{\"com.instagram.android\":" + (now + 60_000L) + "}"
            + "}";

        PolicySnapshotReadResult result = PolicySnapshotReader.parse(snapshotJson, true, true, now);

        assertNull(result.parseError);
        assertTrue(result.snapshot.activeModes.contains("penalty"));
        assertNotNull(result.snapshot.appTargets.get("com.instagram.android"));
        assertEquals(1, result.snapshot.websiteTargets.size());
        assertEquals(1, result.snapshot.searchTargets.size());
        assertTrue(result.snapshot.unlockedTargets.contains("app:com.instagram.android"));
        assertTrue(result.snapshot.isUnlocked("com.instagram.android", "app"));
    }

    @Test
    public void keepsLegacyUntypedAppUnlockTargetsReadableForCompatibility() {
        long now = 1_700_000_000_000L;
        String snapshotJson = "{"
            + "\"activeModes\":[\"learn\"],"
            + "\"targets\":[{\"id\":\"com.instagram.android\",\"type\":\"app\",\"mode\":\"learn\",\"enabled\":true}],"
            + "\"unlockedTargets\":{\"com.instagram.android\":" + (now + 60_000L) + "}"
            + "}";

        PolicySnapshotReadResult result = PolicySnapshotReader.parse(snapshotJson, true, true, now);

        assertNull(result.parseError);
        assertTrue(result.snapshot.unlockedTargets.contains("com.instagram.android"));
        assertTrue(result.snapshot.isUnlocked("com.instagram.android", "app"));
    }

    @Test
    public void reportsParseErrorsWithoutThrowing() {
        PolicySnapshotReadResult result = PolicySnapshotReader.parse("{broken", true, false, 1_700_000_000_000L);

        assertNotNull(result.snapshot);
        assertFalse(result.snapshot.isBlockingActive());
        assertNotNull(result.parseError);
    }
}
