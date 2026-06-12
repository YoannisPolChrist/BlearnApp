package app.blearn.mobile;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

final class InterventionRouteBuilder {
    private InterventionRouteBuilder() {
    }

    static String buildBlockingRoute(PolicyTarget target, String displayLabel, String sessionId) {
        if (target == null) {
            return buildInterventionRoute(null, displayLabel, sessionId);
        }

        String mode = PolicySnapshot.hasText(target.mode) ? target.mode : "reflection";
        if (isEntryInterventionMode(mode)) {
            return buildInterventionRoute(target, displayLabel, sessionId);
        }

        return buildInterventionRoute(target, displayLabel, sessionId);
    }

    private static boolean isEntryInterventionMode(String mode) {
        return "learn".equals(mode)
            || "penalty".equals(mode)
            || "lock".equals(mode)
            || "strict".equals(mode)
            || "reflection".equals(mode);
    }

    static String buildInterventionRoute(PolicyTarget target, String displayLabel, String sessionId) {
        StringBuilder route = new StringBuilder("/intervention");
        appendCommonBlockingParams(route, target, displayLabel, sessionId);
        return route.toString();
    }

    private static void appendCommonBlockingParams(
        StringBuilder route,
        PolicyTarget target,
        String displayLabel,
        String sessionId
    ) {
        if (target == null) {
            appendParam(route, "targetLabel", displayLabel);
            appendParam(route, "overlaySessionId", sessionId);
            return;
        }

        appendParam(route, "targetId", target.id);
        appendParam(route, "targetType", target.type);
        appendParam(route, "targetLabel", displayLabel);
        String effectiveMode = PolicySnapshot.hasText(target.mode) ? target.mode : "reflection";
        appendParam(route, "mode", effectiveMode);
        appendParam(route, "overlaySessionId", sessionId);
        appendParam(route, "deckId", target.deckId);
        if (target.unlockDurationMinutes > 0) {
            appendParam(route, "unlockDurationMinutes", String.valueOf(target.unlockDurationMinutes));
        }
    }

    static String buildLearnRoute(String targetId, String targetType, String deckId) {
        return buildLearnRoute(targetId, targetType, deckId, "", 0, "");
    }

    static String buildLearnRoute(
        String targetId,
        String targetType,
        String deckId,
        String targetLabel,
        int unlockDurationMinutes,
        String sessionId
    ) {
        StringBuilder route = new StringBuilder("/learn/review");
        appendParam(route, "targetId", targetId);
        appendParam(route, "targetType", targetType);
        appendParam(route, "deckId", deckId);
        appendParam(route, "targetLabel", targetLabel);
        appendParam(route, "mode", "learn");
        appendParam(route, "overlaySessionId", sessionId);
        if (unlockDurationMinutes > 0) {
            appendParam(route, "unlockDurationMinutes", String.valueOf(unlockDurationMinutes));
        }
        return route.toString();
    }

    private static void appendParam(StringBuilder route, String key, String value) {
        if (!PolicySnapshot.hasText(value)) return;

        route.append(route.indexOf("?") >= 0 ? "&" : "?")
            .append(key)
            .append("=")
            .append(urlEncode(value));
    }

    private static String urlEncode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8).replace("+", "%20");
    }
}
