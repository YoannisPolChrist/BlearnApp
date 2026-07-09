package app.blearn.mobile;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import java.util.HashMap;
import java.util.Map;

import org.junit.Test;

public class RemoteBlockOverlayTest {

    private Map<String, String> data(String... pairs) {
        Map<String, String> map = new HashMap<>();
        for (int i = 0; i + 1 < pairs.length; i += 2) {
            map.put(pairs[i], pairs[i + 1]);
        }
        return map;
    }

    @Test
    public void parsesValidApplyMessageWithCommaPackages() {
        RemoteBlockOverlay overlay = RemoteBlockOverlay.fromMessageData(data(
            "type", "remote_block",
            "action", "apply",
            "packages", "com.android.chrome, org.mozilla.firefox",
            "expiresAt", "1751940000000",
            "mode", "strict"
        ));

        assertNotNull(overlay);
        assertEquals(2, overlay.packages.size());
        assertTrue(overlay.packages.contains("com.android.chrome"));
        assertTrue(overlay.packages.contains("org.mozilla.firefox"));
        assertEquals(1751940000000L, overlay.expiresAt);
        assertEquals("strict", overlay.mode);
    }

    @Test
    public void parsesJsonArrayPackages() {
        RemoteBlockOverlay overlay = RemoteBlockOverlay.fromMessageData(data(
            "packages", "[\"com.android.chrome\",\"com.brave.browser\"]",
            "expiresAt", "1751940000000"
        ));

        assertNotNull(overlay);
        assertEquals(2, overlay.packages.size());
        assertTrue(overlay.packages.contains("com.brave.browser"));
        assertEquals("strict", overlay.mode);
    }

    @Test
    public void rejectsClearAction() {
        assertNull(RemoteBlockOverlay.fromMessageData(data(
            "action", "clear",
            "packages", "com.android.chrome",
            "expiresAt", "1751940000000"
        )));
        assertTrue(RemoteBlockOverlay.isClearMessage(data("action", "clear")));
        assertFalse(RemoteBlockOverlay.isClearMessage(data("action", "apply")));
    }

    @Test
    public void rejectsMissingOrInvalidExpiry() {
        assertNull(RemoteBlockOverlay.fromMessageData(data("packages", "com.android.chrome")));
        assertNull(RemoteBlockOverlay.fromMessageData(data(
            "packages", "com.android.chrome",
            "expiresAt", "not-a-number"
        )));
        assertNull(RemoteBlockOverlay.fromMessageData(data(
            "packages", "com.android.chrome",
            "expiresAt", "0"
        )));
    }

    @Test
    public void rejectsEmptyPackagesAndWrongType() {
        assertNull(RemoteBlockOverlay.fromMessageData(data("expiresAt", "1751940000000")));
        assertNull(RemoteBlockOverlay.fromMessageData(data(
            "type", "something_else",
            "packages", "com.android.chrome",
            "expiresAt", "1751940000000"
        )));
    }

    @Test
    public void storedJsonRoundTrips() {
        RemoteBlockOverlay original = RemoteBlockOverlay.fromMessageData(data(
            "packages", "com.android.chrome,org.mozilla.firefox",
            "expiresAt", "1751940000000",
            "mode", "strict"
        ));
        assertNotNull(original);

        RemoteBlockOverlay restored = RemoteBlockOverlay.fromStoredJson(original.toJson());
        assertNotNull(restored);
        assertEquals(original.expiresAt, restored.expiresAt);
        assertEquals(original.mode, restored.mode);
        assertEquals(original.packages, restored.packages);
    }

    @Test
    public void isActiveHonoursExpiry() {
        RemoteBlockOverlay overlay = RemoteBlockOverlay.fromMessageData(data(
            "packages", "com.android.chrome",
            "expiresAt", "2000"
        ));
        assertNotNull(overlay);
        assertTrue(overlay.isActive(1000L));
        assertFalse(overlay.isActive(2000L));
        assertFalse(overlay.isActive(3000L));
    }
}
