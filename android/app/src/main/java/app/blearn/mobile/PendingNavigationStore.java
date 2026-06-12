package app.blearn.mobile;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

final class PendingNavigationStore {
    enum SaveOutcome {
        SAVED,
        DUPLICATE,
        SUPPRESSED_ACTIVE_SESSION,
        FAILED
    }

    static final class RuntimeEvent {
        final String stage;
        final String message;
        final String sessionId;
        final String targetId;
        final String targetType;
        final long at;

        RuntimeEvent(
            String stage,
            String message,
            String sessionId,
            String targetId,
            String targetType,
            long at
        ) {
            this.stage = safe(stage);
            this.message = safe(message);
            this.sessionId = safe(sessionId);
            this.targetId = safe(targetId);
            this.targetType = safe(targetType);
            this.at = at;
        }

        JSONObject toJson() {
            JSONObject json = new JSONObject();
            try {
                json.put("stage", stage);
                json.put("message", message);
                json.put("sessionId", sessionId);
                json.put("targetId", targetId);
                json.put("targetType", targetType);
                json.put("at", at);
            } catch (JSONException ignored) {
                // Static payload assembly.
            }
            return json;
        }

        static RuntimeEvent fromJson(JSONObject json) {
            if (json == null) {
                return null;
            }
            return new RuntimeEvent(
                json.optString("stage", ""),
                json.optString("message", ""),
                json.optString("sessionId", ""),
                json.optString("targetId", ""),
                json.optString("targetType", ""),
                json.optLong("at", 0L)
            );
        }
    }

    static final class ForegroundObservation {
        final String packageName;
        final String source;
        final long observedAt;

        ForegroundObservation(String packageName, String source, long observedAt) {
            this.packageName = safe(packageName);
            this.source = safe(source);
            this.observedAt = observedAt;
        }
    }

    private static final class RuntimeState {
        final List<PendingNativeNavigation> queue = new ArrayList<>();
        final List<RuntimeEvent> events = new ArrayList<>();
        PendingNativeNavigation active;
        String activeStage = "";
        String accessibilityForegroundPackage = "";
        long accessibilityForegroundAt = 0L;
        String usageForegroundPackage = "";
        long usageForegroundAt = 0L;

        JSONObject toJson() {
            JSONObject json = new JSONObject();
            JSONArray queueJson = new JSONArray();
            for (PendingNativeNavigation navigation : queue) {
                queueJson.put(navigation.toJson());
            }

            JSONArray eventJson = new JSONArray();
            for (RuntimeEvent event : events) {
                eventJson.put(event.toJson());
            }

            try {
                json.put("queue", queueJson);
                json.put("activeStage", safe(activeStage));
                if (active != null && active.isValid()) {
                    json.put("active", active.toJson());
                }
                json.put("events", eventJson);
                json.put("accessibilityForegroundPackage", safe(accessibilityForegroundPackage));
                json.put("accessibilityForegroundAt", accessibilityForegroundAt);
                json.put("usageForegroundPackage", safe(usageForegroundPackage));
                json.put("usageForegroundAt", usageForegroundAt);
            } catch (JSONException ignored) {
                // Static payload assembly.
            }

            return json;
        }

        static RuntimeState fromJson(String raw) {
            RuntimeState state = new RuntimeState();
            if (!hasText(raw)) {
                return state;
            }

            try {
                JSONObject json = new JSONObject(raw);

                JSONArray queueJson = json.optJSONArray("queue");
                if (queueJson != null) {
                    for (int index = 0; index < queueJson.length(); index += 1) {
                        JSONObject item = queueJson.optJSONObject(index);
                        PendingNativeNavigation navigation =
                            item == null ? null : PendingNativeNavigation.fromJson(item.toString());
                        if (navigation != null && navigation.isValid()) {
                            state.queue.add(navigation);
                        }
                    }
                }

                JSONObject activeJson = json.optJSONObject("active");
                if (activeJson != null) {
                    PendingNativeNavigation activeNavigation = PendingNativeNavigation.fromJson(activeJson.toString());
                    if (activeNavigation != null && activeNavigation.isValid()) {
                        state.active = activeNavigation;
                    }
                }

                state.activeStage = safe(json.optString("activeStage", ""));

                JSONArray eventJson = json.optJSONArray("events");
                if (eventJson != null) {
                    for (int index = 0; index < eventJson.length(); index += 1) {
                        RuntimeEvent event = RuntimeEvent.fromJson(eventJson.optJSONObject(index));
                        if (event != null && hasText(event.stage)) {
                            state.events.add(event);
                        }
                    }
                }

                state.accessibilityForegroundPackage = safe(json.optString("accessibilityForegroundPackage", ""));
                state.accessibilityForegroundAt = json.optLong("accessibilityForegroundAt", 0L);
                state.usageForegroundPackage = safe(json.optString("usageForegroundPackage", ""));
                state.usageForegroundAt = json.optLong("usageForegroundAt", 0L);
            } catch (Exception ignored) {
                // Fall back to empty state when parsing fails.
            }

            return state;
        }
    }

    private static final String PREFS = "blearn_runtime";
    private static final String KEY_RUNTIME_STATE = "pending_navigation_runtime_state";
    private static final String KEY_ACCESSIBILITY_FOREGROUND_PACKAGE = "accessibility_foreground_package";
    private static final String KEY_ACCESSIBILITY_FOREGROUND_AT = "accessibility_foreground_at";
    private static final String KEY_USAGE_FOREGROUND_PACKAGE = "usage_foreground_package";
    private static final String KEY_USAGE_FOREGROUND_AT = "usage_foreground_at";
    private static final String TAG = "BlearnPendingStore";
    private static final int MAX_EVENT_COUNT = 64;
    private static final int MAX_PENDING_QUEUE_SIZE = 1;
    private static final long ACCESSIBILITY_OBSERVATION_FRESH_MS = 4_000L;
    private static final long FOREGROUND_OBSERVATION_WRITE_DEBOUNCE_MS = 750L;

    private PendingNavigationStore() {
    }

    static SaveOutcome save(Context context, PendingNativeNavigation navigation) {
        if (navigation == null || !navigation.isValid()) {
            return clear(context) ? SaveOutcome.SAVED : SaveOutcome.FAILED;
        }

        RuntimeState state = readState(context);
        if (shouldReleaseCompletedActive(state)) {
            PendingNativeNavigation completedNavigation = state.active;
            appendEvent(
                state,
                "stale-cleared",
                "completed blocking flow released for a new trigger",
                completedNavigation
            );
            state.active = null;
            state.activeStage = "";
        }
        if (matchesActiveSession(state, navigation.sessionId)) {
            appendEvent(state, "queued", "duplicate navigation ignored", navigation);
            return writeState(context, state) ? SaveOutcome.DUPLICATE : SaveOutcome.FAILED;
        }
        if (isEquivalentNavigation(state.active, navigation)) {
            appendEvent(state, "queued", "equivalent navigation ignored", navigation);
            return writeState(context, state) ? SaveOutcome.DUPLICATE : SaveOutcome.FAILED;
        }
        if (state.active != null && state.active.isValid()) {
            appendEvent(state, "suppressed", "ignored while another blocking flow stays active", navigation);
            return writeState(context, state) ? SaveOutcome.SUPPRESSED_ACTIVE_SESSION : SaveOutcome.FAILED;
        }
        if (containsSessionInQueue(state, navigation.sessionId)) {
            appendEvent(state, "queued", "duplicate navigation ignored", navigation);
            return writeState(context, state) ? SaveOutcome.DUPLICATE : SaveOutcome.FAILED;
        }
        if (containsEquivalentNavigationInQueue(state, navigation)) {
            appendEvent(state, "queued", "equivalent navigation ignored", navigation);
            return writeState(context, state) ? SaveOutcome.DUPLICATE : SaveOutcome.FAILED;
        }

        if (!state.queue.isEmpty()) {
            state.queue.clear();
            appendEvent(state, "queued-replaced", "older pending blocking flows discarded", navigation);
        }

        state.queue.add(navigation);
        trimQueueToLatest(state, navigation);
        appendEvent(state, "detected", "blocking target detected", navigation);
        appendEvent(state, "queued", "navigation queued for blocking flow", navigation);
        boolean saved = writeState(context, state);
        debug(
            "queue "
                + navigation.targetType
                + ":"
                + navigation.targetId
                + " session="
                + navigation.sessionId
                + " queueSize="
                + state.queue.size()
                + " success="
                + saved
        );
        return saved ? SaveOutcome.SAVED : SaveOutcome.FAILED;
    }

    static PendingNativeNavigation peek(Context context) {
        RuntimeState state = readState(context);
        if (state.active != null && state.active.isValid()) {
            return state.active;
        }
        return state.queue.isEmpty() ? null : state.queue.get(0);
    }

    static PendingNativeNavigation consume(Context context) {
        RuntimeState state = readState(context);
        if (state.active != null && state.active.isValid()) {
            if ("handoff_complete".equals(state.activeStage)) {
                long handoffCompletedAt = findLatestEventTimestamp(state, "handoff-complete");
                long staleThresholdMs = 30_000L;
                long age = handoffCompletedAt > 0L
                    ? System.currentTimeMillis() - handoffCompletedAt
                    : staleThresholdMs + 1;
                if (age < staleThresholdMs) {
                    debug("consume waiting_for_dismiss session=" + state.active.sessionId);
                    return null;
                }
                PendingNativeNavigation staleNavigation = state.active;
                appendEvent(
                    state,
                    "stale-cleared",
                    "stale handoff_complete discarded after " + age + "ms",
                    staleNavigation
                );
                state.queue.clear();
                state.active = null;
                state.activeStage = "";
                writeState(context, state);
                debug("consume discarded stale handoff_complete after " + age + "ms");
                return null;
            } else {
                appendEvent(state, "reopened", "resuming active blocking flow after interruption", state.active);
                writeState(context, state);
                debug("consume reopened session=" + state.active.sessionId);
                return state.active;
            }
        }

        if (state.queue.isEmpty()) {
            debug("consume empty");
            return null;
        }

        PendingNativeNavigation navigation = state.queue.remove(0);
        state.active = navigation;
        state.activeStage = "consumed";
        appendEvent(state, "overlay-mounted", "blocking flow moved into active handoff", navigation);
        writeState(context, state);
        debug("consume " + navigation.targetType + ":" + navigation.targetId + " session=" + navigation.sessionId);
        return navigation;
    }

    static PendingNativeNavigation promoteToActive(Context context, PendingNativeNavigation navigation, String reason) {
        RuntimeState state = readState(context);
        PendingNativeNavigation nextNavigation = navigation;

        if (nextNavigation == null || !nextNavigation.isValid()) {
            if (state.active != null && state.active.isValid()) {
                return state.active;
            }
            return state.queue.isEmpty() ? null : state.queue.get(0);
        }

        if (state.active != null && state.active.isValid()) {
            if (
                safe(state.active.sessionId).equals(safe(nextNavigation.sessionId))
                    || isEquivalentNavigation(state.active, nextNavigation)
            ) {
                state.active = mergeNavigationPayload(state.active, nextNavigation);
                state.activeStage = "consumed";
                state.queue.clear();
                appendEvent(state, "overlay-mounted", safe(reason), state.active);
                writeState(context, state);
                return state.active;
            }

            appendEvent(state, "abandoned", "older active blocking flow replaced", state.active);
        }

        for (int index = 0; index < state.queue.size(); index += 1) {
            PendingNativeNavigation queuedNavigation = state.queue.get(index);
            if (
                safe(queuedNavigation.sessionId).equals(safe(nextNavigation.sessionId))
                    || isEquivalentNavigation(queuedNavigation, nextNavigation)
            ) {
                nextNavigation = mergeNavigationPayload(queuedNavigation, nextNavigation);
                state.queue.remove(index);
                break;
            }
        }

        state.active = nextNavigation;
        state.activeStage = "consumed";
        state.queue.clear();
        appendEvent(state, "overlay-mounted", safe(reason), nextNavigation);
        writeState(context, state);
        debug(
            "promote_to_active "
                + nextNavigation.targetType
                + ":"
                + nextNavigation.targetId
                + " session="
                + nextNavigation.sessionId
        );
        return nextNavigation;
    }

    static void completeActiveHandoff(Context context) {
        completeActiveHandoff(context, null);
    }

    static void completeActiveHandoff(Context context, String sessionId) {
        RuntimeState state = readState(context);
        if (!matchesActiveSession(state, sessionId)) {
            return;
        }

        state.activeStage = "handoff_complete";
        state.queue.clear();
        appendEvent(state, "handoff-complete", "blocking flow handoff completed in app shell", state.active);
        writeState(context, state);
    }

    static void dismissActive(Context context, String reason) {
        dismissActive(context, null, reason);
    }

    static void dismissActive(Context context, String sessionId, String reason) {
        RuntimeState state = readState(context);
        PendingNativeNavigation activeNavigation = matchesActiveSession(state, sessionId) ? state.active : null;
        if (activeNavigation != null && activeNavigation.isValid()) {
            appendEvent(state, "dismissed", safe(reason), activeNavigation);
            state.queue.clear();
            state.active = null;
            state.activeStage = "";
            writeState(context, state);
            return;
        }

        if (removeQueuedSession(state, sessionId)) {
            writeState(context, state);
        }
    }

    static void abandonActive(Context context, String reason) {
        abandonActive(context, null, reason);
    }

    static void abandonActive(Context context, String sessionId, String reason) {
        RuntimeState state = readState(context);
        PendingNativeNavigation activeNavigation = matchesActiveSession(state, sessionId) ? state.active : null;
        if (activeNavigation != null && activeNavigation.isValid()) {
            appendEvent(state, "abandoned", safe(reason), activeNavigation);
            state.queue.clear();
            state.active = null;
            state.activeStage = "abandoned";
            writeState(context, state);
            return;
        }

        if (removeQueuedSession(state, sessionId)) {
            state.activeStage = "abandoned";
            writeState(context, state);
        }
    }

    static boolean clear(Context context) {
        RuntimeState state = readState(context);
        PendingNativeNavigation activeNavigation = state.active;
        if (activeNavigation != null && activeNavigation.isValid()) {
            appendEvent(state, "cleared", "runtime store cleared", activeNavigation);
        }
        state.queue.clear();
        state.active = null;
        state.activeStage = "";
        return writeState(context, state);
    }

    static int getPendingQueueLength(Context context) {
        return readState(context).queue.size();
    }

    static String getActiveSessionId(Context context) {
        RuntimeState state = readState(context);
        return state.active == null ? null : emptyToNull(state.active.sessionId);
    }

    static String getActiveTargetId(Context context) {
        RuntimeState state = readState(context);
        return state.active == null ? null : emptyToNull(state.active.targetId);
    }

    static String getActiveStage(Context context) {
        return emptyToNull(readState(context).activeStage);
    }

    static JSONArray getRecentEventsJson(Context context) {
        RuntimeState state = readState(context);
        JSONArray array = new JSONArray();
        for (RuntimeEvent event : state.events) {
            array.put(event.toJson());
        }
        return array;
    }

    static void recordAccessibilityObservation(Context context, String packageName) {
        recordForegroundObservation(context, packageName, "accessibility", System.currentTimeMillis());
    }

    static void recordUsageObservation(Context context, String packageName, long observedAt) {
        recordForegroundObservation(context, packageName, "usage", observedAt);
    }

    static String getCompletedActiveSessionIdForForegroundChange(
        Context context,
        String packageName,
        String ownPackageName
    ) {
        RuntimeState state = readState(context);
        if (!shouldReleaseCompletedActive(state)) {
            return null;
        }

        String normalizedForegroundPackage = PolicySnapshot.normalize(packageName);
        String normalizedOwnPackage = PolicySnapshot.normalize(ownPackageName);
        if (
            !hasText(normalizedForegroundPackage)
                || normalizedForegroundPackage.equals(normalizedOwnPackage)
        ) {
            return null;
        }

        return emptyToNull(state.active.sessionId);
    }

    static ForegroundObservation resolveForegroundObservation(Context context) {
        ForegroundObservation persistedAccessibilityObservation =
            readPersistedForegroundObservation(context, "accessibility");
        long now = System.currentTimeMillis();
        if (
            hasText(persistedAccessibilityObservation.packageName)
                && persistedAccessibilityObservation.observedAt > 0L
                && now - persistedAccessibilityObservation.observedAt <= ACCESSIBILITY_OBSERVATION_FRESH_MS
        ) {
            return persistedAccessibilityObservation;
        }

        ForegroundObservation persistedUsageObservation = readPersistedForegroundObservation(context, "usage");
        if (hasText(persistedUsageObservation.packageName) && persistedUsageObservation.observedAt > 0L) {
            return persistedUsageObservation;
        }

        RuntimeState state = readState(context);
        if (
            hasText(state.accessibilityForegroundPackage)
                && state.accessibilityForegroundAt > 0L
                && now - state.accessibilityForegroundAt <= ACCESSIBILITY_OBSERVATION_FRESH_MS
        ) {
            return new ForegroundObservation(
                state.accessibilityForegroundPackage,
                "accessibility",
                state.accessibilityForegroundAt
            );
        }

        if (hasText(state.usageForegroundPackage) && state.usageForegroundAt > 0L) {
            return new ForegroundObservation(state.usageForegroundPackage, "usage", state.usageForegroundAt);
        }

        return new ForegroundObservation("", "", 0L);
    }

    private static void recordForegroundObservation(
        Context context,
        String packageName,
        String source,
        long observedAt
    ) {
        String normalizedPackage = PolicySnapshot.normalize(packageName);
        if (!hasText(normalizedPackage) || observedAt <= 0L) {
            return;
        }

        SharedPreferences sharedPreferences = prefs(context);
        String existingPackage;
        long existingObservedAt;
        String packageKey;
        String atKey;

        if ("accessibility".equals(source)) {
            packageKey = KEY_ACCESSIBILITY_FOREGROUND_PACKAGE;
            atKey = KEY_ACCESSIBILITY_FOREGROUND_AT;
        } else {
            packageKey = KEY_USAGE_FOREGROUND_PACKAGE;
            atKey = KEY_USAGE_FOREGROUND_AT;
        }

        existingPackage = sharedPreferences.getString(packageKey, "");
        existingObservedAt = sharedPreferences.getLong(atKey, 0L);
        if (!shouldPersistForegroundObservation(existingPackage, existingObservedAt, normalizedPackage, observedAt)) {
            return;
        }

        sharedPreferences
            .edit()
            .putString(packageKey, normalizedPackage)
            .putLong(atKey, observedAt)
            .apply();
    }

    static boolean shouldPersistForegroundObservation(
        String existingPackageName,
        long existingObservedAt,
        String nextPackageName,
        long nextObservedAt
    ) {
        String normalizedNextPackage = PolicySnapshot.normalize(nextPackageName);
        if (!hasText(normalizedNextPackage) || nextObservedAt <= 0L) {
            return false;
        }

        String normalizedExistingPackage = PolicySnapshot.normalize(existingPackageName);
        return !normalizedExistingPackage.equals(normalizedNextPackage)
            || existingObservedAt <= 0L
            || nextObservedAt - existingObservedAt >= FOREGROUND_OBSERVATION_WRITE_DEBOUNCE_MS;
    }

    static boolean isUsableForegroundPackage(String packageName, String ownPackageName) {
        String normalizedPackage = PolicySnapshot.normalize(packageName);
        String normalizedOwnPackage = PolicySnapshot.normalize(ownPackageName);
        return hasText(normalizedPackage) && !normalizedPackage.equals(normalizedOwnPackage);
    }

    private static boolean matchesActiveSession(RuntimeState state, String sessionId) {
        if (state.active == null || !state.active.isValid()) {
            return false;
        }
        String normalizedSessionId = safe(sessionId);
        return !hasText(normalizedSessionId) || normalizedSessionId.equals(state.active.sessionId);
    }

    private static boolean containsSessionInQueue(RuntimeState state, String sessionId) {
        String normalizedSessionId = safe(sessionId);
        if (!hasText(normalizedSessionId)) {
            return false;
        }
        for (PendingNativeNavigation queuedNavigation : state.queue) {
            if (normalizedSessionId.equals(queuedNavigation.sessionId)) {
                return true;
            }
        }
        return false;
    }

    private static boolean containsEquivalentNavigationInQueue(RuntimeState state, PendingNativeNavigation navigation) {
        if (navigation == null || !navigation.isValid()) {
            return false;
        }

        for (PendingNativeNavigation queuedNavigation : state.queue) {
            if (isEquivalentNavigation(queuedNavigation, navigation)) {
                return true;
            }
        }

        return false;
    }

    private static void trimQueueToLatest(RuntimeState state, PendingNativeNavigation navigation) {
        while (state.queue.size() > MAX_PENDING_QUEUE_SIZE) {
            state.queue.remove(0);
            appendEvent(state, "queued-replaced", "older pending blocking flows discarded", navigation);
        }
    }

    private static boolean removeQueuedSession(RuntimeState state, String sessionId) {
        String normalizedSessionId = safe(sessionId);
        if (!hasText(normalizedSessionId)) {
            return false;
        }

        boolean removed = false;
        for (int index = state.queue.size() - 1; index >= 0; index -= 1) {
            PendingNativeNavigation queuedNavigation = state.queue.get(index);
            if (!normalizedSessionId.equals(safe(queuedNavigation.sessionId))) {
                continue;
            }

            appendEvent(state, "discarded", "stale queued blocking flow removed", queuedNavigation);
            state.queue.remove(index);
            removed = true;
        }

        return removed;
    }

    private static boolean isEquivalentNavigation(
        PendingNativeNavigation current,
        PendingNativeNavigation next
    ) {
        if (current == null || next == null || !current.isValid() || !next.isValid()) {
            return false;
        }

        return safe(current.targetId).equals(safe(next.targetId))
            && safe(current.targetType).equals(safe(next.targetType))
            && safe(current.mode).equals(safe(next.mode))
            && safe(current.deckId).equals(safe(next.deckId))
            && current.unlockDurationMinutes == next.unlockDurationMinutes
            && safe(resolveRoutePath(current.route)).equals(safe(resolveRoutePath(next.route)));
    }

    private static PendingNativeNavigation mergeNavigationPayload(
        PendingNativeNavigation primary,
        PendingNativeNavigation overlay
    ) {
        if (primary == null || !primary.isValid()) {
            return overlay;
        }
        if (overlay == null || !overlay.isValid()) {
            return primary;
        }

        return new PendingNativeNavigation(
            preferredText(overlay.route, primary.route),
            preferredText(overlay.targetId, primary.targetId),
            preferredText(overlay.targetType, primary.targetType),
            preferredText(overlay.mode, primary.mode),
            preferredText(overlay.sessionId, primary.sessionId),
            preferredText(overlay.targetLabel, primary.targetLabel),
            preferredText(overlay.deckId, primary.deckId),
            overlay.unlockDurationMinutes > 0 ? overlay.unlockDurationMinutes : primary.unlockDurationMinutes,
            overlay.penaltyAmountSats != null ? overlay.penaltyAmountSats : primary.penaltyAmountSats
        );
    }

    private static boolean shouldReleaseCompletedActive(RuntimeState state) {
        return state != null
            && state.active != null
            && state.active.isValid()
            && "handoff_complete".equals(state.activeStage);
    }

    private static String resolveRoutePath(String route) {
        String normalizedRoute = safe(route);
        if (!hasText(normalizedRoute)) {
            return "";
        }

        int queryIndex = normalizedRoute.indexOf('?');
        if (queryIndex < 0) {
            return normalizedRoute;
        }

        return normalizedRoute.substring(0, queryIndex);
    }

    private static void appendEvent(
        RuntimeState state,
        String stage,
        String message,
        PendingNativeNavigation navigation
    ) {
        state.events.add(
            new RuntimeEvent(
                stage,
                message,
                navigation == null ? "" : navigation.sessionId,
                navigation == null ? "" : navigation.targetId,
                navigation == null ? "" : navigation.targetType,
                System.currentTimeMillis()
            )
        );

        while (state.events.size() > MAX_EVENT_COUNT) {
            state.events.remove(0);
        }
    }

    private static long findLatestEventTimestamp(RuntimeState state, String stage) {
        long latest = 0L;
        for (RuntimeEvent event : state.events) {
            if (stage.equals(event.stage) && event.at > latest) {
                latest = event.at;
            }
        }
        return latest;
    }

    private static RuntimeState readState(Context context) {
        return RuntimeState.fromJson(prefs(context).getString(KEY_RUNTIME_STATE, null));
    }

    private static ForegroundObservation readPersistedForegroundObservation(Context context, String source) {
        SharedPreferences sharedPreferences = prefs(context);
        if ("accessibility".equals(source)) {
            return new ForegroundObservation(
                sharedPreferences.getString(KEY_ACCESSIBILITY_FOREGROUND_PACKAGE, ""),
                "accessibility",
                sharedPreferences.getLong(KEY_ACCESSIBILITY_FOREGROUND_AT, 0L)
            );
        }

        return new ForegroundObservation(
            sharedPreferences.getString(KEY_USAGE_FOREGROUND_PACKAGE, ""),
            "usage",
            sharedPreferences.getLong(KEY_USAGE_FOREGROUND_AT, 0L)
        );
    }

    private static boolean writeState(Context context, RuntimeState state) {
        return prefs(context)
            .edit()
            .putString(KEY_RUNTIME_STATE, state.toJson().toString())
            .commit();
    }

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private static void debug(String message) {
        if ("user".equals(Build.TYPE)) {
            return;
        }

        try {
            Log.d(TAG, message);
        } catch (RuntimeException ignored) {
        }
    }

    private static boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }

    private static String safe(String value) {
        return value == null ? "" : value.trim();
    }

    private static String preferredText(String preferred, String fallback) {
        return hasText(preferred) ? preferred.trim() : safe(fallback);
    }

    private static String emptyToNull(String value) {
        return hasText(value) ? value : null;
    }
}
