package app.blearn.mobile;

import org.json.JSONException;
import org.json.JSONObject;

final class PendingNativeNavigation {
    final String route;
    final String targetId;
    final String targetType;
    final String mode;
    final String sessionId;
    final String targetLabel;
    final String deckId;
    final int unlockDurationMinutes;
    final Integer penaltyAmountSats;

    PendingNativeNavigation(String route, String targetId, String targetType, String mode) {
        this(route, targetId, targetType, mode, "", "", "", 0, null);
    }

    PendingNativeNavigation(
        String route,
        String targetId,
        String targetType,
        String mode,
        String sessionId,
        String targetLabel,
        String deckId,
        int unlockDurationMinutes,
        Integer penaltyAmountSats
    ) {
        this.route = route == null ? "" : route.trim();
        this.targetId = targetId == null ? "" : targetId.trim();
        this.targetType = targetType == null ? "" : targetType.trim();
        this.mode = mode == null ? "" : mode.trim();
        this.sessionId = sessionId == null ? "" : sessionId.trim();
        this.targetLabel = targetLabel == null ? "" : targetLabel.trim();
        this.deckId = deckId == null ? "" : deckId.trim();
        this.unlockDurationMinutes = Math.max(0, unlockDurationMinutes);
        this.penaltyAmountSats = penaltyAmountSats;
    }

    boolean isValid() {
        return hasText(route);
    }

    JSONObject toJson() {
        JSONObject payload = new JSONObject();
        try {
            payload.put("route", route);
            payload.put("targetId", targetId);
            payload.put("targetType", targetType);
            payload.put("mode", mode);
            payload.put("sessionId", sessionId);
            payload.put("targetLabel", targetLabel);
            payload.put("deckId", deckId);
            if (unlockDurationMinutes > 0) {
                payload.put("unlockDurationMinutes", unlockDurationMinutes);
            }
            if (penaltyAmountSats != null) {
                payload.put("penaltyAmountSats", penaltyAmountSats);
            }
        } catch (JSONException ignored) {
            // Keys are static; JSON assembly should not fail in practice.
        }
        return payload;
    }

    static PendingNativeNavigation fromJson(String raw) {
        if (!hasText(raw)) {
            return null;
        }

        try {
            JSONObject payload = new JSONObject(raw);
            PendingNativeNavigation navigation = new PendingNativeNavigation(
                payload.optString("route", ""),
                payload.optString("targetId", ""),
                payload.optString("targetType", ""),
                payload.optString("mode", ""),
                payload.optString("sessionId", ""),
                payload.optString("targetLabel", ""),
                payload.optString("deckId", ""),
                payload.optInt("unlockDurationMinutes", 0),
                payload.has("penaltyAmountSats") ? Integer.valueOf(payload.optInt("penaltyAmountSats", 0)) : null
            );
            return navigation.isValid() ? navigation : null;
        } catch (JSONException ignored) {
            return null;
        }
    }

    private static boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }
}
