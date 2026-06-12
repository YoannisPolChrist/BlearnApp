package app.blearn.mobile;

import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.Locale;

final class TargetMatcher {
    static final Set<String> WEBSITE_PACKAGES = new HashSet<>(Arrays.asList(
        "com.android.chrome",
        "org.mozilla.firefox",
        "org.mozilla.fenix",
        "com.microsoft.emmx",
        "com.brave.browser",
        "com.sec.android.app.sbrowser",
        "com.opera.browser",
        "com.opera.mini.native",
        "com.duckduckgo.mobile.android"
    ));

    static final Set<String> SEARCH_PACKAGES = new HashSet<>(Arrays.asList(
        "com.google.android.googlequicksearchbox",
        "com.google.android.apps.searchlite"
    ));

    private TargetMatcher() {
    }

    static boolean shouldInspectText(PolicySnapshot snapshot, String packageName) {
        String normalizedPackage = PolicySnapshot.normalize(packageName);
        return canMatchWebsite(snapshot, normalizedPackage) || canMatchSearch(snapshot, normalizedPackage);
    }

    static PolicyMatch findAppMatch(PolicySnapshot snapshot, String packageName, String appLabel) {
        if (!snapshot.monitoringActive) return null;
        if (!snapshot.isAllowedAppTargetId(packageName)) return null;

        String normalizedPackage = PolicySnapshot.normalize(packageName);
        String displayLabel = PolicySnapshot.hasText(appLabel) ? appLabel : normalizedPackage;

        if (snapshot.shouldLockAllApps()) {
            return new PolicyMatch(
                new PolicyTarget(normalizedPackage, "app", "lock", null, 0, 0),
                displayLabel,
                "app"
            );
        }

        PolicyTarget target = snapshot.appTargets.get(normalizedPackage);
        if (target == null) return null;

        return new PolicyMatch(target, displayLabel, "app");
    }

    static PolicyMatch findTextMatch(PolicySnapshot snapshot, String packageName, String observedText) {
        if (!PolicySnapshot.hasText(observedText)) return null;

        String normalizedPackage = PolicySnapshot.normalize(packageName);
        if (canMatchWebsite(snapshot, normalizedPackage)) {
            PolicyMatch websiteMatch = findContainsMatch(snapshot.websiteTargets, observedText, "website");
            if (websiteMatch != null) {
                return websiteMatch;
            }
        }

        if (canMatchSearch(snapshot, normalizedPackage)) {
            return findContainsMatch(snapshot.searchTargets, observedText, "search");
        }

        return null;
    }

    static boolean supportsWebsitePackage(String packageName) {
        return WEBSITE_PACKAGES.contains(PolicySnapshot.normalize(packageName));
    }

    static boolean supportsSearchPackage(String packageName) {
        String normalizedPackage = PolicySnapshot.normalize(packageName);
        return WEBSITE_PACKAGES.contains(normalizedPackage) || SEARCH_PACKAGES.contains(normalizedPackage);
    }

    private static boolean canMatchWebsite(PolicySnapshot snapshot, String packageName) {
        return snapshot.websiteBlockingActive
            && !snapshot.websiteTargets.isEmpty()
            && supportsWebsitePackage(packageName);
    }

    private static boolean canMatchSearch(PolicySnapshot snapshot, String packageName) {
        return snapshot.monitoringActive
            && !snapshot.searchTargets.isEmpty()
            && supportsSearchPackage(packageName);
    }

    private static PolicyMatch findContainsMatch(List<PolicyTarget> targets, String observedText, String source) {
        String normalizedObservedText = observedText.toLowerCase(Locale.ROOT);
        for (PolicyTarget target : targets) {
            if (normalizedObservedText.contains(target.id)) {
                return new PolicyMatch(target, target.id, source);
            }
        }
        return null;
    }
}
