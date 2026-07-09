package app.blearn.mobile;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

import org.junit.Test;

public class PolicySnapshotRemoteOverlayTest {

    private Set<String> packages(String... values) {
        return new HashSet<>(Arrays.asList(values));
    }

    @Test
    public void overlayAddsRemoteAppTargetsAndActivatesBlocking() {
        PolicySnapshot snapshot = new PolicySnapshot();

        snapshot.applyRemoteOverlay(packages("com.android.chrome", "org.mozilla.firefox"), 5000L, "strict", 1000L);

        assertTrue(snapshot.remoteBlockingActive);
        assertEquals(5000L, snapshot.remoteBlockingExpiresAt);
        assertTrue(snapshot.monitoringActive);
        assertTrue(snapshot.appTargets.containsKey("com.android.chrome"));
        assertTrue(snapshot.appTargets.containsKey("org.mozilla.firefox"));
        assertTrue(snapshot.isBlockingActive());
    }

    @Test
    public void expiredOverlayIsIgnored() {
        PolicySnapshot snapshot = new PolicySnapshot();

        snapshot.applyRemoteOverlay(packages("com.android.chrome"), 1000L, "strict", 1000L);

        assertFalse(snapshot.remoteBlockingActive);
        assertTrue(snapshot.appTargets.isEmpty());
    }

    @Test
    public void nativeExpiryRemovesOnlyRemoteAddedTargets() {
        PolicySnapshot snapshot = new PolicySnapshot();
        // A manually blocked app that also happens to be in the overlay.
        snapshot.activeModes.add("strict");
        snapshot.monitoringActive = true;
        snapshot.addTarget(new PolicyTarget("com.android.chrome", "app", "strict", null, 0, 0));
        snapshot.blockedPackages.add("com.android.chrome");

        snapshot.applyRemoteOverlay(packages("com.android.chrome", "org.mozilla.firefox"), 5000L, "strict", 1000L);

        // Firefox is remote-only; Chrome stays a manual target.
        assertTrue(snapshot.remoteOnlyBlockedApps.contains("org.mozilla.firefox"));
        assertFalse(snapshot.remoteOnlyBlockedApps.contains("com.android.chrome"));

        snapshot.expireRemoteBlockingIfNeeded(6000L);

        assertFalse(snapshot.remoteBlockingActive);
        assertFalse(snapshot.appTargets.containsKey("org.mozilla.firefox"));
        // The user's own block survives the remote expiry.
        assertTrue(snapshot.appTargets.containsKey("com.android.chrome"));
        assertTrue(snapshot.blockedPackages.contains("com.android.chrome"));
    }

    @Test
    public void overlayIgnoresNonBlockablePackages() {
        PolicySnapshot snapshot = new PolicySnapshot();

        snapshot.applyRemoteOverlay(packages("app.blearn.mobile", "android"), 5000L, "strict", 1000L);

        assertTrue(snapshot.appTargets.isEmpty());
    }
}
