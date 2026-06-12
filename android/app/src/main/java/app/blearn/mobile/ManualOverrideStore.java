package app.blearn.mobile;

import android.content.Context;
import android.content.SharedPreferences;

import java.util.HashSet;
import java.util.Map;
import java.util.Set;

final class ManualOverrideStore {
    static class Status {
        final boolean active;
        final long unlockedUntil;
        final int attemptsUsed;
        final int attemptsRemaining;
        final int maxAttempts;
        final long windowStartedAt;

        Status(boolean active, long unlockedUntil, int attemptsUsed, int attemptsRemaining, int maxAttempts, long windowStartedAt) {
            this.active = active;
            this.unlockedUntil = unlockedUntil;
            this.attemptsUsed = attemptsUsed;
            this.attemptsRemaining = attemptsRemaining;
            this.maxAttempts = maxAttempts;
            this.windowStartedAt = windowStartedAt;
        }
    }

    static final class GrantResult extends Status {
        final boolean granted;
        final String reason;

        GrantResult(
            boolean granted,
            String reason,
            boolean active,
            long unlockedUntil,
            int attemptsUsed,
            int attemptsRemaining,
            int maxAttempts,
            long windowStartedAt
        ) {
            super(active, unlockedUntil, attemptsUsed, attemptsRemaining, maxAttempts, windowStartedAt);
            this.granted = granted;
            this.reason = reason;
        }
    }

    private static final String PREFS = "blearn_runtime";
    private static final String OVERRIDE_PREFIX = "manual_override_expires_";
    private static final String ATTEMPT_COUNT_PREFIX = "manual_override_attempt_count_";
    private static final String ATTEMPT_WINDOW_PREFIX = "manual_override_attempt_window_start_";
    private static final int MAX_ATTEMPTS_PER_HOUR = 2;
    private static final long ATTEMPT_WINDOW_MS = 60L * 60L * 1000L;

    private ManualOverrideStore() {
    }

    static Status getStatus(Context context, String targetId, String targetType, long now) {
        SharedPreferences prefs = prefs(context);
        String targetKey = normalizeTargetKey(targetId, targetType);
        if (!PolicySnapshot.hasText(targetKey)) {
            return new Status(false, 0L, 0, MAX_ATTEMPTS_PER_HOUR, MAX_ATTEMPTS_PER_HOUR, 0L);
        }

        long unlockedUntil = prefs.getLong(overridePrefKey(targetKey), 0L);
        if (unlockedUntil > 0L && unlockedUntil <= now) {
            clearExpiredState(prefs, targetKey);
            unlockedUntil = 0L;
        }

        long windowStartedAt = prefs.getLong(windowPrefKey(targetKey), 0L);
        int attemptsUsed = prefs.getInt(attemptPrefKey(targetKey), 0);
        if (windowStartedAt <= 0L || now - windowStartedAt >= ATTEMPT_WINDOW_MS) {
            windowStartedAt = attemptsUsed > 0 ? now : 0L;
            attemptsUsed = 0;
            prefs.edit()
                .putLong(windowPrefKey(targetKey), windowStartedAt)
                .putInt(attemptPrefKey(targetKey), attemptsUsed)
                .apply();
        }

        boolean active = unlockedUntil > now;
        int attemptsRemaining = Math.max(0, MAX_ATTEMPTS_PER_HOUR - attemptsUsed);
        return new Status(active, unlockedUntil, attemptsUsed, attemptsRemaining, MAX_ATTEMPTS_PER_HOUR, windowStartedAt);
    }

    static GrantResult grant(Context context, String targetId, String targetType, int unlockDurationMinutes, long now) {
        SharedPreferences prefs = prefs(context);
        String targetKey = normalizeTargetKey(targetId, targetType);
        if (!PolicySnapshot.hasText(targetKey)) {
            return new GrantResult(false, "invalid_target", false, 0L, 0, MAX_ATTEMPTS_PER_HOUR, MAX_ATTEMPTS_PER_HOUR, 0L);
        }

        Status currentStatus = getStatus(context, targetId, targetType, now);
        if (currentStatus.active) {
            return new GrantResult(
                true,
                "already_active",
                true,
                currentStatus.unlockedUntil,
                currentStatus.attemptsUsed,
                currentStatus.attemptsRemaining,
                currentStatus.maxAttempts,
                currentStatus.windowStartedAt
            );
        }

        long windowStartedAt = currentStatus.windowStartedAt > 0L ? currentStatus.windowStartedAt : now;
        int attemptsUsed = currentStatus.attemptsUsed;
        if (attemptsUsed >= MAX_ATTEMPTS_PER_HOUR) {
            return new GrantResult(
                false,
                "rate_limited",
                false,
                0L,
                attemptsUsed,
                0,
                MAX_ATTEMPTS_PER_HOUR,
                windowStartedAt
            );
        }

        attemptsUsed += 1;
        long unlockedUntil = now + Math.max(1, unlockDurationMinutes) * 60L * 1000L;
        prefs.edit()
            .putLong(windowPrefKey(targetKey), windowStartedAt)
            .putInt(attemptPrefKey(targetKey), attemptsUsed)
            .putLong(overridePrefKey(targetKey), unlockedUntil)
            .apply();

        return new GrantResult(
            true,
            "granted",
            true,
            unlockedUntil,
            attemptsUsed,
            Math.max(0, MAX_ATTEMPTS_PER_HOUR - attemptsUsed),
            MAX_ATTEMPTS_PER_HOUR,
            windowStartedAt
        );
    }

    static void applyActiveOverrides(Context context, PolicySnapshot snapshot, long now) {
        if (snapshot == null) {
            return;
        }

        snapshot.unlockedTargets.addAll(collectActiveOverrideKeys(context, now));
    }

    private static Set<String> collectActiveOverrideKeys(Context context, long now) {
        SharedPreferences prefs = prefs(context);
        Map<String, ?> entries = prefs.getAll();
        Set<String> unlockedKeys = new HashSet<>();
        Set<String> expiredTargetKeys = new HashSet<>();

        for (Map.Entry<String, ?> entry : entries.entrySet()) {
            String prefKey = entry.getKey();
            if (!prefKey.startsWith(OVERRIDE_PREFIX)) {
                continue;
            }

            String targetKey = prefKey.substring(OVERRIDE_PREFIX.length());
            Object rawExpiry = entry.getValue();
            long expiresAt = rawExpiry instanceof Number ? ((Number) rawExpiry).longValue() : 0L;
            if (expiresAt <= now) {
                expiredTargetKeys.add(targetKey);
                continue;
            }

            unlockedKeys.add(targetKey);
        }

        if (!expiredTargetKeys.isEmpty()) {
            SharedPreferences.Editor editor = prefs.edit();
            for (String targetKey : expiredTargetKeys) {
                clearExpiredState(editor, targetKey);
            }
            editor.apply();
        }

        return unlockedKeys;
    }

    private static void clearExpiredState(SharedPreferences prefs, String targetKey) {
        prefs.edit()
            .remove(overridePrefKey(targetKey))
            .apply();
    }

    private static void clearExpiredState(SharedPreferences.Editor editor, String targetKey) {
        editor.remove(overridePrefKey(targetKey));
    }

    private static SharedPreferences prefs(Context context) {
        return context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private static String normalizeTargetKey(String targetId, String targetType) {
        return PolicySnapshot.normalizeTargetKey(targetType, targetId);
    }

    private static String overridePrefKey(String targetKey) {
        return OVERRIDE_PREFIX + targetKey;
    }

    private static String attemptPrefKey(String targetKey) {
        return ATTEMPT_COUNT_PREFIX + targetKey;
    }

    private static String windowPrefKey(String targetKey) {
        return ATTEMPT_WINDOW_PREFIX + targetKey;
    }
}
