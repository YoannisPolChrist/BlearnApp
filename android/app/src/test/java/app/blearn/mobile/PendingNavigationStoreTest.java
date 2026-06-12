package app.blearn.mobile;

import android.content.Context;
import android.content.SharedPreferences;
import android.content.ContextWrapper;

import org.junit.Before;
import org.junit.Test;

import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;

public class PendingNavigationStoreTest {
    private TestContext context;

    @Before
    public void setUp() {
        context = new TestContext();
    }

    @Test
    public void suppressesDuplicateForegroundWritesInsideDebounceWindow() {
        assertFalse(
            PendingNavigationStore.shouldPersistForegroundObservation(
                "com.instagram.android",
                1_000L,
                "com.instagram.android",
                1_600L
            )
        );
    }

    @Test
    public void allowsForegroundWritesWhenPackageChanges() {
        assertTrue(
            PendingNavigationStore.shouldPersistForegroundObservation(
                "com.instagram.android",
                1_000L,
                "com.whatsapp",
                1_200L
            )
        );
    }

    @Test
    public void allowsForegroundWritesAfterDebounceWindowExpires() {
        assertTrue(
            PendingNavigationStore.shouldPersistForegroundObservation(
                "com.instagram.android",
                1_000L,
                "com.instagram.android",
                1_800L
            )
        );
    }

    @Test
    public void rejectsOwnPackageAsUsableForegroundTarget() {
        assertFalse(
            PendingNavigationStore.isUsableForegroundPackage(
                "app.blearn.mobile",
                "app.blearn.mobile"
            )
        );
    }

    @Test
    public void keepsExternalPackageAsUsableForegroundTarget() {
        assertTrue(
            PendingNavigationStore.isUsableForegroundPackage(
                "com.instagram.android",
                "app.blearn.mobile"
            )
        );
    }

    @Test
    public void preservesCompletedHandoffUntilDismissed() {
        PendingNativeNavigation navigation = new PendingNativeNavigation(
            "/intervention?targetId=youtube.com",
            "youtube.com",
            "website",
            "learn",
            "session-1",
            "YouTube",
            "",
            12,
            null
        );

        assertEquals(PendingNavigationStore.SaveOutcome.SAVED, PendingNavigationStore.save(context, navigation));

        PendingNativeNavigation consumed = PendingNavigationStore.consume(context);
        assertNotNull(consumed);
        assertEquals("session-1", PendingNavigationStore.getActiveSessionId(context));
        assertEquals("consumed", PendingNavigationStore.getActiveStage(context));

        PendingNavigationStore.completeActiveHandoff(context);

        assertEquals("session-1", PendingNavigationStore.getActiveSessionId(context));
        assertEquals("handoff_complete", PendingNavigationStore.getActiveStage(context));
        assertNull(PendingNavigationStore.consume(context));

        PendingNavigationStore.dismissActive(context, "done");

        assertNull(PendingNavigationStore.getActiveSessionId(context));
        assertNull(PendingNavigationStore.getActiveStage(context));
    }

    @Test
    public void suppressesNewPendingNavigationWhileAnotherSessionIsActive() {
        PendingNativeNavigation activeNavigation = new PendingNativeNavigation(
            "/learn/review?targetId=com.instagram.android",
            "com.instagram.android",
            "app",
            "learn",
            "session-active",
            "Instagram",
            "deck-1",
            12,
            null
        );
        PendingNativeNavigation nextNavigation = new PendingNativeNavigation(
            "/breathing?targetId=com.google.android.gm",
            "com.google.android.gm",
            "app",
            "strict",
            "session-next",
            "Gmail",
            "",
            11,
            null
        );

        assertEquals(PendingNavigationStore.SaveOutcome.SAVED, PendingNavigationStore.save(context, activeNavigation));
        assertNotNull(PendingNavigationStore.consume(context));

        assertEquals(
            PendingNavigationStore.SaveOutcome.SUPPRESSED_ACTIVE_SESSION,
            PendingNavigationStore.save(context, nextNavigation)
        );
        assertEquals(0, PendingNavigationStore.getPendingQueueLength(context));
        assertEquals("session-active", PendingNavigationStore.getActiveSessionId(context));
    }

    @Test
    public void allowsEquivalentNavigationAfterCompletedHandoff() {
        PendingNativeNavigation firstNavigation = new PendingNativeNavigation(
            "/breathing?targetId=com.google.android.keep",
            "com.google.android.keep",
            "app",
            "strict",
            "session-first",
            "Keep",
            "",
            15,
            null
        );
        PendingNativeNavigation secondNavigation = new PendingNativeNavigation(
            "/breathing?targetId=com.google.android.keep",
            "com.google.android.keep",
            "app",
            "strict",
            "session-second",
            "Keep",
            "",
            15,
            null
        );

        assertEquals(PendingNavigationStore.SaveOutcome.SAVED, PendingNavigationStore.save(context, firstNavigation));
        assertNotNull(PendingNavigationStore.consume(context));
        PendingNavigationStore.completeActiveHandoff(context);

        assertEquals(PendingNavigationStore.SaveOutcome.SAVED, PendingNavigationStore.save(context, secondNavigation));
        assertEquals(1, PendingNavigationStore.getPendingQueueLength(context));
        assertEquals("session-second", PendingNavigationStore.peek(context).sessionId);
        assertNull(PendingNavigationStore.getActiveSessionId(context));
    }

    @Test
    public void exposesCompletedHandoffSessionWhenForegroundLeavesBlockingHost() {
        PendingNativeNavigation navigation = new PendingNativeNavigation(
            "/learn/review?targetId=com.google.android.gm",
            "com.google.android.gm",
            "app",
            "learn",
            "session-learn",
            "Gmail",
            "deck-1",
            12,
            null
        );

        assertEquals(PendingNavigationStore.SaveOutcome.SAVED, PendingNavigationStore.save(context, navigation));
        assertNotNull(PendingNavigationStore.consume(context));
        PendingNavigationStore.completeActiveHandoff(context);

        assertEquals(
            "session-learn",
            PendingNavigationStore.getCompletedActiveSessionIdForForegroundChange(
                context,
                "com.google.android.keep",
                "app.blearn.mobile"
            )
        );
        assertNull(
            PendingNavigationStore.getCompletedActiveSessionIdForForegroundChange(
                context,
                "app.blearn.mobile",
                "app.blearn.mobile"
            )
        );
    }

    @Test
    public void ignoresDismissForDifferentSessionId() {
        PendingNativeNavigation navigation = new PendingNativeNavigation(
            "/intervention?targetId=youtube.com",
            "youtube.com",
            "website",
            "strict",
            "session-owned",
            "YouTube",
            "",
            12,
            null
        );

        assertEquals(PendingNavigationStore.SaveOutcome.SAVED, PendingNavigationStore.save(context, navigation));
        assertNotNull(PendingNavigationStore.consume(context));

        PendingNavigationStore.dismissActive(context, "session-other", "ignore");

        assertEquals("session-owned", PendingNavigationStore.getActiveSessionId(context));
        assertEquals("consumed", PendingNavigationStore.getActiveStage(context));
    }

    @Test
    public void doesNotReopenDismissedBlockingSessions() {
        PendingNativeNavigation navigation = new PendingNativeNavigation(
            "/learn/review?targetId=com.instagram.android",
            "com.instagram.android",
            "app",
            "learn",
            "session-dismissed",
            "Instagram",
            "deck-1",
            12,
            null
        );

        assertEquals(PendingNavigationStore.SaveOutcome.SAVED, PendingNavigationStore.save(context, navigation));
        assertNotNull(PendingNavigationStore.consume(context));

        PendingNavigationStore.dismissActive(context, "session-dismissed", "blocking_overlay_dismissed");

        assertNull(PendingNavigationStore.getActiveSessionId(context));
        assertNull(PendingNavigationStore.getActiveStage(context));
        assertNull(PendingNavigationStore.consume(context));
    }

    private static final class TestContext extends ContextWrapper {
        private final Map<String, SharedPreferences> preferences = new HashMap<>();

        private TestContext() {
            super(null);
        }

        @Override
        public SharedPreferences getSharedPreferences(String name, int mode) {
            SharedPreferences sharedPreferences = preferences.get(name);
            if (sharedPreferences == null) {
                sharedPreferences = new InMemorySharedPreferences();
                preferences.put(name, sharedPreferences);
            }
            return sharedPreferences;
        }
    }

    private static final class InMemorySharedPreferences implements SharedPreferences {
        private final Map<String, Object> values = new HashMap<>();

        @Override
        public Map<String, ?> getAll() {
            return Collections.unmodifiableMap(values);
        }

        @Override
        public String getString(String key, String defValue) {
            Object value = values.get(key);
            return value instanceof String ? (String) value : defValue;
        }

        @Override
        public Set<String> getStringSet(String key, Set<String> defValues) {
            Object value = values.get(key);
            if (value instanceof Set) {
                @SuppressWarnings("unchecked")
                Set<String> stringSet = (Set<String>) value;
                return new HashSet<>(stringSet);
            }
            return defValues;
        }

        @Override
        public int getInt(String key, int defValue) {
            Object value = values.get(key);
            return value instanceof Number ? ((Number) value).intValue() : defValue;
        }

        @Override
        public long getLong(String key, long defValue) {
            Object value = values.get(key);
            return value instanceof Number ? ((Number) value).longValue() : defValue;
        }

        @Override
        public float getFloat(String key, float defValue) {
            Object value = values.get(key);
            return value instanceof Number ? ((Number) value).floatValue() : defValue;
        }

        @Override
        public boolean getBoolean(String key, boolean defValue) {
            Object value = values.get(key);
            return value instanceof Boolean ? (Boolean) value : defValue;
        }

        @Override
        public boolean contains(String key) {
            return values.containsKey(key);
        }

        @Override
        public Editor edit() {
            return new InMemoryEditor();
        }

        @Override
        public void registerOnSharedPreferenceChangeListener(OnSharedPreferenceChangeListener listener) {
        }

        @Override
        public void unregisterOnSharedPreferenceChangeListener(OnSharedPreferenceChangeListener listener) {
        }

        private final class InMemoryEditor implements Editor {
            private final Map<String, Object> staged = new HashMap<>();
            private final Set<String> removals = new HashSet<>();
            private boolean clearRequested;

            @Override
            public Editor putString(String key, String value) {
                staged.put(key, value);
                return this;
            }

            @Override
            public Editor putStringSet(String key, Set<String> values) {
                staged.put(key, values == null ? null : new HashSet<>(values));
                return this;
            }

            @Override
            public Editor putInt(String key, int value) {
                staged.put(key, value);
                return this;
            }

            @Override
            public Editor putLong(String key, long value) {
                staged.put(key, value);
                return this;
            }

            @Override
            public Editor putFloat(String key, float value) {
                staged.put(key, value);
                return this;
            }

            @Override
            public Editor putBoolean(String key, boolean value) {
                staged.put(key, value);
                return this;
            }

            @Override
            public Editor remove(String key) {
                removals.add(key);
                return this;
            }

            @Override
            public Editor clear() {
                clearRequested = true;
                return this;
            }

            @Override
            public boolean commit() {
                applyChanges();
                return true;
            }

            @Override
            public void apply() {
                applyChanges();
            }

            private void applyChanges() {
                if (clearRequested) {
                    values.clear();
                }
                for (String key : removals) {
                    values.remove(key);
                }
                for (Map.Entry<String, Object> entry : staged.entrySet()) {
                    if (entry.getValue() == null) {
                        values.remove(entry.getKey());
                    } else {
                        values.put(entry.getKey(), entry.getValue());
                    }
                }
                removals.clear();
                staged.clear();
                clearRequested = false;
            }
        }
    }
}
