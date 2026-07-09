package app.blearn.mobile;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

final class PolicySnapshot {
    private static final Set<String> NON_BLOCKABLE_APP_IDS = new HashSet<>(Arrays.asList(
        "android",
        "app.blearn.mobile",
        "com.android.vpndialogs",
        "com.google.android.captiveportallogin",
        "com.google.android.gms",
        "com.android.packageinstaller",
        "com.google.android.packageinstaller",
        "com.google.android.permissioncontroller",
        "com.android.permissioncontroller",
        "miui.systemui.plugin",
        // Xiaomi / MIUI package installers
        "com.miui.packageinstaller",
        "com.xiaomi.mipicks",
        // Samsung package installers
        "com.sec.android.app.packageinstaller",
        "com.samsung.android.packageinstaller"
    ));
    private static final Set<String> STRICT_LOCK_PROTECTED_APP_IDS = new HashSet<>(Arrays.asList(
        "com.android.settings",
        "com.android.packageinstaller",
        "com.google.android.packageinstaller",
        "com.google.android.permissioncontroller",
        "com.android.permissioncontroller",
        "com.miui.securitycenter",
        "com.miui.packageinstaller",
        "com.xiaomi.mipicks",
        "com.sec.android.app.myfiles",
        "com.sec.android.app.packageinstaller",
        "com.samsung.android.packageinstaller"
    ));
    private static final String[] NON_BLOCKABLE_APP_PREFIXES = new String[] {
        "com.android.launcher",
        "com.android.launcher3",
        "com.android.systemui",
        "com.google.android.apps.nexuslauncher",
        "com.google.android.launcher",
        "com.huawei.android.launcher",
        "com.mi.android.globallauncher",
        "com.miui.home",
        "com.sec.android.app.launcher",
        "com.transsion."
    };
    final Set<String> activeModes = new HashSet<>();
    final Map<String, PolicyTarget> appTargets = new HashMap<>();
    final List<PolicyTarget> websiteTargets = new ArrayList<>();
    final List<PolicyTarget> searchTargets = new ArrayList<>();
    final Set<String> blockedPackages = new HashSet<>();
    final Set<String> blockedDomains = new HashSet<>();
    final Set<String> blockedSearchTerms = new HashSet<>();
    final Set<String> unlockedTargets = new HashSet<>();
    boolean monitoringActive = false;
    boolean websiteBlockingActive = false;
    boolean fullLockBlocksAllApps = false;
    boolean remoteBlockingActive = false;
    long remoteBlockingExpiresAt = 0L;
    final Set<String> remoteOnlyBlockedApps = new HashSet<>();
    long strictLockUntil = 0L;
    long strictAddonProtectionUntil = 0L;

    void addTarget(PolicyTarget target) {
        if ("app".equals(target.type)) {
            appTargets.put(target.id, target);
            return;
        }
        if ("website".equals(target.type)) {
            websiteTargets.add(target);
            return;
        }
        if ("search".equals(target.type)) {
            searchTargets.add(target);
        }
    }

    void ensureLegacyTargets() {
        String legacyMode = getPreferredMode();
        if (!hasText(legacyMode)) return;

        if (appTargets.isEmpty()) {
            for (String packageName : blockedPackages) {
                appTargets.put(packageName, new PolicyTarget(packageName, "app", legacyMode, null, 0, 0));
            }
        }
        if (websiteTargets.isEmpty()) {
            for (String domain : blockedDomains) {
                websiteTargets.add(new PolicyTarget(domain, "website", legacyMode, null, 0, 0));
            }
        }
        if (searchTargets.isEmpty()) {
            for (String term : blockedSearchTerms) {
                searchTargets.add(new PolicyTarget(term, "search", legacyMode, null, 0, 0));
            }
        }
    }

    boolean isBlockingActive() {
        return (remoteBlockingActive || !activeModes.isEmpty())
            && ((monitoringActive && (fullLockBlocksAllApps || !appTargets.isEmpty() || !searchTargets.isEmpty()))
                || (websiteBlockingActive && !websiteTargets.isEmpty())
            );
    }

    boolean isUnlocked(String targetId, String targetType) {
        String normalizedTargetKey = normalizeTargetKey(targetType, targetId);
        if (hasText(normalizedTargetKey) && unlockedTargets.contains(normalizedTargetKey)) {
            return true;
        }

        String normalizedTargetId = normalize(targetId);
        return hasText(normalizedTargetId) && unlockedTargets.contains(normalizedTargetId);
    }

    void sanitizeAppTargets() {
        appTargets.entrySet().removeIf((entry) -> !isAllowedAppTargetId(entry.getKey()));
        blockedPackages.removeIf((packageName) -> !isAllowedAppTargetId(packageName));
    }

    String getPreferredMode() {
        if (activeModes.contains("penalty")) return "penalty";
        if (activeModes.contains("learn")) return "learn";
        if (activeModes.contains("lock")) return "lock";
        if (activeModes.contains("strict")) return "strict";
        return "";
    }

    static String normalize(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    }

    static boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }

    static String normalizeTargetKey(String targetType, String targetId) {
        String normalizedTargetId = normalize(targetId);
        String normalizedTargetType = normalize(targetType);
        if (!hasText(normalizedTargetId)) {
            return "";
        }
        if (!isSupportedTargetType(normalizedTargetType)) {
            normalizedTargetType = "app";
        }
        return normalizedTargetType + ":" + normalizedTargetId;
    }

    static String normalizeUnlockTargetKey(String rawKey, String fallbackTargetType) {
        String normalizedKey = normalize(rawKey);
        if (!hasText(normalizedKey)) {
            return "";
        }

        int separatorIndex = normalizedKey.indexOf(':');
        if (separatorIndex > 0 && separatorIndex + 1 < normalizedKey.length()) {
            String targetType = normalizedKey.substring(0, separatorIndex);
            String targetId = normalizedKey.substring(separatorIndex + 1);
            if (isSupportedTargetType(targetType)) {
                return normalizeTargetKey(targetType, targetId);
            }
        }

        if (hasText(fallbackTargetType)) {
            return normalizeTargetKey(fallbackTargetType, normalizedKey);
        }

        return normalizedKey;
    }

    static boolean isBlockableAppTargetId(String value) {
        String normalizedValue = normalize(value);
        if (!hasText(normalizedValue)) {
            return false;
        }
        if (NON_BLOCKABLE_APP_IDS.contains(normalizedValue)) {
            return false;
        }
        for (String prefix : NON_BLOCKABLE_APP_PREFIXES) {
            if (matchesPrefix(normalizedValue, prefix)) {
                return false;
            }
        }
        return true;
    }

    boolean isAllowedAppTargetId(String value) {
        String normalizedValue = normalize(value);
        if (activeModes.contains("lock") && STRICT_LOCK_PROTECTED_APP_IDS.contains(normalizedValue)) {
            return true;
        }
        if (hasStrictAddonProtection()
            && STRICT_LOCK_PROTECTED_APP_IDS.contains(normalizedValue)) {
            return true;
        }

        return isBlockableAppTargetId(normalizedValue);
    }

    boolean shouldLockAllApps() {
        return fullLockBlocksAllApps && activeModes.contains("lock");
    }

    boolean isStrictLockActive(long now) {
        return activeModes.contains("lock") && (strictLockUntil <= 0L || strictLockUntil > now);
    }

    boolean isStrictAddonProtectionActive(long now) {
        return activeModes.contains("strict")
            && strictAddonProtectionUntil > 0L
            && strictAddonProtectionUntil > now;
    }

    boolean hasStrictAddonProtection() {
        return activeModes.contains("strict") && strictAddonProtectionUntil > 0L;
    }

    /**
     * The JS runtime normally clears an expired remote block and pushes a fresh
     * snapshot. If the app was killed or the device rebooted, that push never
     * happens — without this native expiry the remote-blocked apps would stay
     * blocked forever. Uses the clock-guard-corrected {@code now} from the
     * reader, so forward clock manipulation cannot end the block early.
     */
    void expireRemoteBlockingIfNeeded(long now) {
        if (!remoteBlockingActive || remoteBlockingExpiresAt <= 0L || remoteBlockingExpiresAt > now) {
            return;
        }

        remoteBlockingActive = false;
        appTargets.entrySet().removeIf((entry) -> remoteOnlyBlockedApps.contains(normalize(entry.getKey())));
        blockedPackages.removeIf((packageName) -> remoteOnlyBlockedApps.contains(normalize(packageName)));
        remoteOnlyBlockedApps.clear();
    }

    /**
     * Layers an FCM-delivered remote block on top of the parsed snapshot. Only
     * adds packages that are not already blocked (so a manual block is never
     * turned into a remote-only one that would vanish on expiry) and marks the
     * newly added ones as remote-only so {@link #expireRemoteBlockingIfNeeded}
     * cleans them up. Forces monitoring on, since the accessibility matcher only
     * inspects app targets while monitoring is active.
     */
    void applyRemoteOverlay(Set<String> overlayPackages, long overlayExpiresAt, String overlayMode, long now) {
        if (overlayPackages == null || overlayPackages.isEmpty() || overlayExpiresAt <= now) {
            return;
        }
        String mode = hasText(overlayMode) ? normalize(overlayMode) : "strict";
        boolean addedAny = false;
        for (String pkg : overlayPackages) {
            String normalizedPackage = normalize(pkg);
            if (!isBlockableAppTargetId(normalizedPackage) || appTargets.containsKey(normalizedPackage)) {
                continue;
            }
            appTargets.put(normalizedPackage, new PolicyTarget(normalizedPackage, "app", mode, null, 0, 0));
            blockedPackages.add(normalizedPackage);
            remoteOnlyBlockedApps.add(normalizedPackage);
            addedAny = true;
        }
        if (!addedAny && appTargets.isEmpty()) {
            return;
        }
        remoteBlockingActive = true;
        remoteBlockingExpiresAt = Math.max(remoteBlockingExpiresAt, overlayExpiresAt);
        monitoringActive = true;
    }

    void expireStrictLockIfNeeded(long now) {
        if (!activeModes.contains("lock") || strictLockUntil <= 0L || strictLockUntil > now) {
            return;
        }

        activeModes.remove("lock");
        fullLockBlocksAllApps = false;

        Set<String> expiredLockAppIds = new HashSet<>();
        appTargets.entrySet().removeIf((entry) -> {
            boolean isExpiredLockTarget = "lock".equals(entry.getValue().mode);
            if (isExpiredLockTarget) {
                expiredLockAppIds.add(entry.getKey());
            }
            return isExpiredLockTarget;
        });
        blockedPackages.removeAll(expiredLockAppIds);
        websiteTargets.removeIf((target) -> "lock".equals(target.mode));
        searchTargets.removeIf((target) -> "lock".equals(target.mode));
    }

    void expireStrictAddonProtectionIfNeeded(long now) {
        if (strictAddonProtectionUntil <= 0L || strictAddonProtectionUntil > now) {
            return;
        }

        Set<String> expiredProtectedAppIds = new HashSet<>();
        appTargets.entrySet().removeIf((entry) -> {
            boolean isExpiredProtectedTarget = "strict".equals(entry.getValue().mode)
                && STRICT_LOCK_PROTECTED_APP_IDS.contains(normalize(entry.getKey()));
            if (isExpiredProtectedTarget) {
                expiredProtectedAppIds.add(entry.getKey());
            }
            return isExpiredProtectedTarget;
        });
        blockedPackages.removeAll(expiredProtectedAppIds);
        strictAddonProtectionUntil = 0L;
    }

    private static boolean matchesPrefix(String value, String prefix) {
        if (prefix.endsWith(".")) {
            return value.startsWith(prefix);
        }
        return value.equals(prefix) || value.startsWith(prefix + ".");
    }

    private static boolean isSupportedTargetType(String value) {
        return "app".equals(value) || "website".equals(value) || "search".equals(value);
    }
}
