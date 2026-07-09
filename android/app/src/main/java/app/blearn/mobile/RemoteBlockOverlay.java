package app.blearn.mobile;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * A remote coach block delivered by the Hermes server via an FCM data message.
 *
 * <p>The push carries the already-resolved package list plus the expiry, so the
 * device can start enforcing the block immediately — even when the app process
 * is dead — without a Firestore read or a WebView. {@link PolicySnapshotReader}
 * layers this overlay on top of the JS-authored policy snapshot; the JS layer is
 * never mutated, so a bad push can never corrupt the user's own blocking config.
 */
final class RemoteBlockOverlay {
    static final String ACTION_APPLY = "apply";
    static final String ACTION_CLEAR = "clear";
    static final String MESSAGE_TYPE = "remote_block";

    final Set<String> packages;
    final long expiresAt;
    final String mode;

    private RemoteBlockOverlay(Set<String> packages, long expiresAt, String mode) {
        this.packages = packages;
        this.expiresAt = expiresAt;
        this.mode = mode;
    }

    boolean isActive(long now) {
        return !packages.isEmpty() && expiresAt > now;
    }

    /**
     * Parses an FCM data payload. Returns {@code null} for anything that is not a
     * well-formed apply instruction (missing/zero expiry, no packages, clear
     * action, wrong type) — the caller treats {@code null} as "no overlay".
     */
    static RemoteBlockOverlay fromMessageData(Map<String, String> data) {
        if (data == null) {
            return null;
        }
        String type = normalize(data.get("type"));
        if (!type.isEmpty() && !MESSAGE_TYPE.equals(type)) {
            return null;
        }
        String action = normalize(data.get("action"));
        if (ACTION_CLEAR.equals(action)) {
            return null;
        }

        long expiresAt = parseLong(data.get("expiresAt"));
        Set<String> packages = parsePackages(data.get("packages"));
        String mode = resolveMode(data.get("mode"));
        if (expiresAt <= 0L || packages.isEmpty()) {
            return null;
        }
        return new RemoteBlockOverlay(packages, expiresAt, mode);
    }

    static boolean isClearMessage(Map<String, String> data) {
        return data != null && ACTION_CLEAR.equals(normalize(data.get("action")));
    }

    /** Parses the overlay previously persisted via {@link #toJson()}. */
    static RemoteBlockOverlay fromStoredJson(String raw) {
        if (raw == null || raw.trim().isEmpty()) {
            return null;
        }
        try {
            JSONObject json = new JSONObject(raw);
            long expiresAt = Math.max(0L, json.optLong("expiresAt", 0L));
            String mode = resolveMode(json.optString("mode", ""));
            Set<String> packages = new LinkedHashSet<>();
            JSONArray array = json.optJSONArray("packages");
            if (array != null) {
                for (int index = 0; index < array.length(); index += 1) {
                    String value = normalize(array.optString(index, ""));
                    if (!value.isEmpty()) {
                        packages.add(value);
                    }
                }
            }
            if (expiresAt <= 0L || packages.isEmpty()) {
                return null;
            }
            return new RemoteBlockOverlay(packages, expiresAt, mode);
        } catch (Exception error) {
            return null;
        }
    }

    String toJson() {
        JSONObject json = new JSONObject();
        try {
            json.put("expiresAt", expiresAt);
            json.put("mode", mode);
            json.put("packages", new JSONArray(new ArrayList<>(packages)));
        } catch (Exception error) {
            return "{}";
        }
        return json.toString();
    }

    private static Set<String> parsePackages(String raw) {
        Set<String> packages = new LinkedHashSet<>();
        if (raw == null) {
            return packages;
        }
        String trimmed = raw.trim();
        if (trimmed.isEmpty()) {
            return packages;
        }
        List<String> tokens = new ArrayList<>();
        if (trimmed.startsWith("[")) {
            try {
                JSONArray array = new JSONArray(trimmed);
                for (int index = 0; index < array.length(); index += 1) {
                    tokens.add(array.optString(index, ""));
                }
            } catch (Exception error) {
                return packages;
            }
        } else {
            for (String token : trimmed.split(",")) {
                tokens.add(token);
            }
        }
        for (String token : tokens) {
            String value = normalize(token);
            if (!value.isEmpty()) {
                packages.add(value);
            }
        }
        return packages;
    }

    private static String resolveMode(String raw) {
        String mode = normalize(raw);
        return mode.isEmpty() ? "strict" : mode;
    }

    private static long parseLong(String raw) {
        if (raw == null) {
            return 0L;
        }
        try {
            return Long.parseLong(raw.trim());
        } catch (NumberFormatException error) {
            return 0L;
        }
    }

    private static String normalize(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    }
}
