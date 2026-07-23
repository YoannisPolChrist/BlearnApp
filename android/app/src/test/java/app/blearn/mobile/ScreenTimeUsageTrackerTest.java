package app.blearn.mobile;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;

import org.junit.Test;

public class ScreenTimeUsageTrackerTest {
    @Test
    public void countsOnlyTheInteractiveForegroundSession() {
        ScreenTimeUsageTracker tracker = new ScreenTimeUsageTracker(1_000L, 2_000L);

        tracker.onForeground("com.example.background", 900L);
        tracker.onScreenInteractive(1_050L);
        tracker.onForeground("com.example.reader", 1_100L);
        tracker.onScreenNonInteractive(1_400L);
        tracker.onForeground("com.example.video", 1_450L);
        tracker.onScreenInteractive(1_500L);
        tracker.onForeground("com.example.video", 1_550L);
        tracker.onBackground("com.example.video", 1_800L);
        tracker.finish();

        assertFalse(tracker.getSummaries().containsKey("com.example.background"));
        assertEquals(300L, tracker.getSummaries().get("com.example.reader").totalTimeMs);
        assertEquals(250L, tracker.getSummaries().get("com.example.video").totalTimeMs);
    }

    @Test
    public void neverExtendsAnOpenForegroundSessionPastTheRequestedRange() {
        ScreenTimeUsageTracker tracker = new ScreenTimeUsageTracker(1_000L, 2_000L);

        tracker.onScreenInteractive(900L);
        tracker.onForeground("com.example.reader", 950L);
        tracker.finish();

        assertEquals(1_000L, tracker.getSummaries().get("com.example.reader").totalTimeMs);
    }
}
