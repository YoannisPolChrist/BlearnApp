package app.blearn.mobile;

import java.util.HashMap;
import java.util.Map;

/**
 * Aggregates only the time during which one app has a resumed foreground
 * activity while the display is interactive. It deliberately prefers missing
 * ambiguous time over attributing screen-off or background time to an app.
 */
final class ScreenTimeUsageTracker {
    static final class Summary {
        long totalTimeMs;
        long lastUsedTimestamp;

        Summary(long totalTimeMs, long lastUsedTimestamp) {
            this.totalTimeMs = totalTimeMs;
            this.lastUsedTimestamp = lastUsedTimestamp;
        }
    }

    private final long startMs;
    private final long endMs;
    private final Map<String, Summary> summaries = new HashMap<>();
    private boolean screenInteractive;
    private String foregroundPackage = "";
    private long activeSessionStartedAt = -1L;

    ScreenTimeUsageTracker(long startMs, long endMs) {
        this.startMs = startMs;
        this.endMs = endMs;
    }

    void onScreenInteractive(long at) {
        closeActiveSession(at);
        screenInteractive = true;
    }

    void onScreenNonInteractive(long at) {
        closeActiveSession(at);
        screenInteractive = false;
    }

    void onForeground(String packageName, long at) {
        if (packageName == null || packageName.trim().isEmpty()) return;

        closeActiveSession(at);
        foregroundPackage = packageName;
        if (screenInteractive) {
            activeSessionStartedAt = at;
        }
    }

    void onBackground(String packageName, long at) {
        if (packageName == null || !packageName.equals(foregroundPackage)) return;

        closeActiveSession(at);
        foregroundPackage = "";
    }

    void finish() {
        closeActiveSession(endMs);
    }

    Map<String, Summary> getSummaries() {
        return summaries;
    }

    private void closeActiveSession(long at) {
        if (activeSessionStartedAt < 0L || foregroundPackage.isEmpty()) return;

        long sessionStart = Math.max(startMs, activeSessionStartedAt);
        long sessionEnd = Math.min(endMs, Math.max(sessionStart, at));
        long duration = sessionEnd - sessionStart;
        if (duration > 0L) {
            Summary summary = summaries.get(foregroundPackage);
            if (summary == null) {
                summaries.put(foregroundPackage, new Summary(duration, sessionEnd));
            } else {
                summary.totalTimeMs += duration;
                summary.lastUsedTimestamp = Math.max(summary.lastUsedTimestamp, sessionEnd);
            }
        }
        activeSessionStartedAt = -1L;
    }
}
