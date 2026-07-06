package app.blearn.mobile;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.SystemClock;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Iterator;
import java.util.Set;

final class PolicySnapshotReader {
    private static final String POLICY_SNAPSHOT_KEY = "policy_snapshot";
    private static final String MONITORING_ACTIVE_KEY = "monitoring_active";
    private static final String WEBSITE_BLOCKING_ACTIVE_KEY = "vpn_active";

    // read() laeuft bei jedem relevanten Accessibility-Event — inkl.
    // WINDOW_CONTENT_CHANGED, das beim Scrollen mehrfach pro Sekunde feuert.
    // Der kurze TTL-Cache erspart das JSON-Parsen pro Event. Bewusst nur 1s:
    // ManualOverrideStore mutiert den Snapshot nach read(), und Unlock-/Lock-
    // Abläufe werden beim Parse gegen `now` gefiltert — mit laengerer TTL
    // wuerden abgelaufene Overrides/Unlocks zu lange weiterwirken.
    private static final long CACHE_TTL_MS = 1_000L;
    private static final Object CACHE_LOCK = new Object();
    private static String cachedRawSnapshot;
    private static boolean cachedMonitoringActive;
    private static boolean cachedWebsiteBlockingActive;
    private static long cachedAtElapsedRealtime;
    private static PolicySnapshotReadResult cachedResult;

    private PolicySnapshotReader() {
    }

    /**
     * Reads the stored snapshot using the clock-guard-corrected time, so that a
     * forward-manipulated wall clock cannot expire strict-lock targets early.
     */
    static PolicySnapshotReadResult read(Context context, SharedPreferences prefs) {
        String rawSnapshot = prefs.getString(POLICY_SNAPSHOT_KEY, "{}");
        boolean monitoringActive = prefs.getBoolean(MONITORING_ACTIVE_KEY, false);
        boolean websiteBlockingActive = prefs.getBoolean(WEBSITE_BLOCKING_ACTIVE_KEY, false);

        synchronized (CACHE_LOCK) {
            long elapsed = SystemClock.elapsedRealtime();
            boolean cacheUsable = cachedResult != null
                && elapsed - cachedAtElapsedRealtime < CACHE_TTL_MS
                && monitoringActive == cachedMonitoringActive
                && websiteBlockingActive == cachedWebsiteBlockingActive
                && rawSnapshot.equals(cachedRawSnapshot);
            if (cacheUsable) {
                return cachedResult;
            }

            long now = StrictLockClockGuard.effectiveNow(context, System.currentTimeMillis());
            PolicySnapshotReadResult result = parse(rawSnapshot, monitoringActive, websiteBlockingActive, now);
            cachedRawSnapshot = rawSnapshot;
            cachedMonitoringActive = monitoringActive;
            cachedWebsiteBlockingActive = websiteBlockingActive;
            cachedAtElapsedRealtime = elapsed;
            cachedResult = result;
            return result;
        }
    }

    static PolicySnapshotReadResult parse(
        String rawSnapshot,
        boolean monitoringActive,
        boolean websiteBlockingActive,
        long now
    ) {
        PolicySnapshot snapshot = new PolicySnapshot();
        snapshot.monitoringActive = monitoringActive;
        snapshot.websiteBlockingActive = websiteBlockingActive;

        try {
            JSONObject json = new JSONObject(rawSnapshot == null ? "{}" : rawSnapshot);

            JSONArray activeModes = json.optJSONArray("activeModes");
            if (activeModes != null) {
                for (int index = 0; index < activeModes.length(); index += 1) {
                    String value = PolicySnapshot.normalize(activeModes.optString(index, ""));
                    if (PolicySnapshot.hasText(value)) {
                        snapshot.activeModes.add(value);
                    }
                }
            } else {
                String legacyMode = PolicySnapshot.normalize(json.optString("activeMode", "normal"));
                if (PolicySnapshot.hasText(legacyMode) && !"normal".equals(legacyMode)) {
                    snapshot.activeModes.add(legacyMode);
                }
            }

            JSONArray targets = json.optJSONArray("targets");
            if (targets != null) {
                for (int index = 0; index < targets.length(); index += 1) {
                    JSONObject item = targets.optJSONObject(index);
                    if (item == null || !item.optBoolean("enabled", true)) continue;

                    String id = PolicySnapshot.normalize(item.optString("id", ""));
                    String type = PolicySnapshot.normalize(item.optString("type", ""));
                    String mode = PolicySnapshot.normalize(item.optString("mode", ""));
                    String deckId = PolicySnapshot.normalize(item.optString("deckId", ""));
                    int requiredCorrectReviews = Math.max(0, item.optInt("requiredCorrectReviews", 0));
                    int unlockDurationMinutes = Math.max(0, item.optInt("unlockDurationMinutes", 0));
                    if (!PolicySnapshot.hasText(id) || !PolicySnapshot.hasText(type) || !PolicySnapshot.hasText(mode)) continue;

                    snapshot.addTarget(
                        new PolicyTarget(
                            id,
                            type,
                            mode,
                            PolicySnapshot.hasText(deckId) ? deckId : null,
                            requiredCorrectReviews,
                            unlockDurationMinutes
                        )
                    );
                }
            }

            readNormalizedStringArray(json.optJSONArray("blockedPackages"), snapshot.blockedPackages);
            readNormalizedStringArray(json.optJSONArray("blockedDomains"), snapshot.blockedDomains);
            readNormalizedStringArray(json.optJSONArray("blockedSearchTerms"), snapshot.blockedSearchTerms);
            snapshot.fullLockBlocksAllApps = json.optBoolean("fullLockBlocksAllApps", false);
            snapshot.remoteBlockingActive = json.optBoolean("remoteBlockingActive", false);
            snapshot.remoteBlockingExpiresAt = Math.max(0L, json.optLong("remoteBlockingExpiresAt", 0L));
            readNormalizedStringArray(json.optJSONArray("remoteOnlyBlockedApps"), snapshot.remoteOnlyBlockedApps);
            snapshot.strictLockUntil = Math.max(0L, json.optLong("strictLockUntil", 0L));
            snapshot.strictAddonProtectionUntil = Math.max(0L, json.optLong("strictAddonProtectionUntil", 0L));
            readUnlockedTargets(json.optJSONObject("unlockedTargets"), snapshot.unlockedTargets, now, null);

            if (snapshot.unlockedTargets.isEmpty()) {
                readUnlockedTargets(json.optJSONObject("unlockedApps"), snapshot.unlockedTargets, now, "app");
            }
        } catch (Exception error) {
            snapshot.sanitizeAppTargets();
            snapshot.ensureLegacyTargets();
            return new PolicySnapshotReadResult(snapshot, error.getMessage());
        }

        snapshot.expireStrictLockIfNeeded(now);
        snapshot.expireStrictAddonProtectionIfNeeded(now);
        snapshot.expireRemoteBlockingIfNeeded(now);
        snapshot.sanitizeAppTargets();
        snapshot.ensureLegacyTargets();
        return new PolicySnapshotReadResult(snapshot, null);
    }

    private static void readNormalizedStringArray(JSONArray values, Set<String> destination) {
        if (values == null) return;

        for (int index = 0; index < values.length(); index += 1) {
            String value = PolicySnapshot.normalize(values.optString(index, ""));
            if (PolicySnapshot.hasText(value)) {
                destination.add(value);
            }
        }
    }

    private static void readUnlockedTargets(
        JSONObject unlockedTargets,
        Set<String> destination,
        long now,
        String fallbackTargetType
    ) {
        if (unlockedTargets == null) return;

        Iterator<String> keys = unlockedTargets.keys();
        while (keys.hasNext()) {
            String rawKey = keys.next();
            String normalizedKey = PolicySnapshot.normalizeUnlockTargetKey(rawKey, fallbackTargetType);
            long expiresAt = unlockedTargets.optLong(rawKey, 0L);
            if (expiresAt > now && PolicySnapshot.hasText(normalizedKey)) {
                destination.add(normalizedKey);
            }
        }
    }
}
