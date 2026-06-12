package app.blearn.mobile;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class ScreenTimePluginDeviceAdminPolicyTest {
    @Test
    public void keepsDeviceAdminOnlyWhileFullLockModeIsActive() {
        long now = System.currentTimeMillis();
        PolicySnapshot lockSnapshot = new PolicySnapshot();
        lockSnapshot.activeModes.add("lock");
        lockSnapshot.strictLockUntil = now + 60_000L;

        PolicySnapshot expiredLockSnapshot = new PolicySnapshot();
        expiredLockSnapshot.activeModes.add("lock");
        expiredLockSnapshot.strictLockUntil = now - 1_000L;

        PolicySnapshot strictSnapshot = new PolicySnapshot();
        strictSnapshot.activeModes.add("strict");

        PolicySnapshot learnSnapshot = new PolicySnapshot();
        learnSnapshot.activeModes.add("learn");

        assertTrue(ScreenTimePlugin.shouldKeepStrictDeviceAdmin(lockSnapshot));
        assertFalse(ScreenTimePlugin.shouldKeepStrictDeviceAdmin(expiredLockSnapshot));
        assertFalse(ScreenTimePlugin.shouldKeepStrictDeviceAdmin(strictSnapshot));
        assertFalse(ScreenTimePlugin.shouldKeepStrictDeviceAdmin(learnSnapshot));
        assertFalse(ScreenTimePlugin.shouldKeepStrictDeviceAdmin(null));
    }
}
