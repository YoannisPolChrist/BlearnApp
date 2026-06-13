package app.blearn.mobile;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Iterator;
import java.util.Set;

final class PolicySnapshotReader {
    private static final String POLICY_SNAPSHOT_KEY = "policy_snapshot";
    private static final String MONITORING_ACTIVE_KEY = "monitoring_active";
    private static final String WEBSITE_BLOCKING_ACTIVE_KEY = "vpn_active";

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
        long now = StrictLockClockGuard.effectiveNow(context, System.currentTimeMillis());
        return parse(rawSnapshot, monitoringActive, websiteBlockingActive, now);
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
