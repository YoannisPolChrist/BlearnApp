import type { Timestamp } from 'firebase/firestore';
import {
  assertFirebaseWritesEnabled,
  ensureFirebaseFirestore,
} from '@/lib/firebase';
import { enqueueFirestoreWrite } from '@/lib/firestoreWriteCoordinator';
import { loadFirestoreSdk } from '@/lib/firestoreTransport';
import { withTimeout } from '@/lib/promiseTimeout';
import { sanitizeFirestoreValue } from '@/services/firebaseProgressSyncService';
import { useAppStore } from '@/store/useAppStore';
import { useLearningStore } from '@/store/useLearningStore';

const USERS_COLLECTION = 'users';
// Firestore-Writes laufen mit persistentLocalCache: offline resolvt setDoc erst nach
// Server-Ack. Der Timeout verhindert, dass Sync-Schleifen unbegrenzt haengen.
const WRITE_TIMEOUT_MS = 15_000;

// Eingaben kommen als Epoch-ms, persistiert wird als Firestore-Timestamp.
type TimestampField = Timestamp | number | Date;

function toDate(value: TimestampField): Date {
  if (value instanceof Date) {
    return value;
  }
  if (typeof value === 'number') {
    return new Date(value);
  }
  return value.toDate();
}

// --- TypeScript Interfaces --------------------------------------------------

export interface EmotionMetrics {
  valence: number;
  arousal: number;
  energy: number;
}

export interface AppUsageEvent {
  id?: string;
  userId: string;
  source: 'mobile_app';
  schema_version: '1.0';

  device_id: string;
  created_at: TimestampField;
  updated_at?: TimestampField;
  interaction_id?: string;

  started_at: TimestampField;
  ended_at: TimestampField;
  duration_minutes: number;
  timezone: string;

  app: {
    name: string;
    package_name?: string;
    category?: 'social_media' | 'messaging' | 'learning' | 'browser' | 'video' | 'music' | 'productivity' | 'game' | 'other' | 'unknown';
  };

  user_intent_before?: 'pause' | 'communication' | 'learning' | 'work' | 'entertainment' | 'avoidance' | 'habit' | 'unknown';

  emotion_before?: {
    valence?: number;        // 1-10
    arousal?: number;        // 1-10
    energy?: number;         // 1-10
    tags?: string[];
    body_sensation?: string;  // short optional text
  };

  emotion_after?: {
    valence?: number;        // 1-10
    arousal?: number;        // 1-10
    energy?: number;         // 1-10
    tags?: string[];
    body_sensation?: string;  // short optional text
  };

  delta?: {
    valence?: number;
    arousal?: number;
    energy?: number;
  };

  metadata: {
    entry_mode: 'automatic' | 'manual' | 'background';
    confidence?: number;     // 0-1, if app detection uncertain
    offline_created?: boolean;
  };
}

export interface LearningLog {
  id?: string;
  userId: string;
  source: 'mobile_app';
  schema_version: '1.0';

  device_id: string;
  created_at: TimestampField;
  updated_at?: TimestampField;
  interaction_id?: string;

  started_at: TimestampField;
  ended_at: TimestampField;
  duration_minutes: number;
  timezone: string;

  session: {
    type: 'vocabulary' | 'reading' | 'listening' | 'grammar' | 'review' | 'other';
    language?: string;       // e.g. "fr"
    topic?: string;
    difficulty_level?: string;
  };

  vocabulary?: {
    words_learned?: number;
    words_reviewed?: number;
    accuracy_percent?: number;
    mistakes_count?: number;
    streak_count?: number;
  };

  state_before?: {
    energy?: number;         // 1-10
    focus?: number;          // 1-10
    resistance?: number;      // 1-10
  };

  state_after?: {
    energy?: number;         // 1-10
    focus?: number;          // 1-10
    confidence?: number;     // 1-10
    frustration?: number;     // 1-10
  };

  goal_progress?: {
    daily_goal_words?: number;
    current_total_words?: number;
    percentage?: number;
  };

  metadata: {
    entry_mode: 'automatic' | 'manual';
    offline_created?: boolean;
  };
}

export interface EmotionLog {
  id?: string;
  userId: string;
  source: 'mobile_app';
  schema_version: '1.0';

  device_id: string;
  created_at: TimestampField;
  /** Server receipt time. Hermes uses this as its monotonic incremental cursor. */
  ingested_at: TimestampField;
  timestamp: TimestampField;
  timezone: string;
  interaction_id?: string;

  trigger_type: 'manual' | 'app_prompt' | 'after_app_usage' | 'learning_session' | 'daily_checkin' | 'other';

  context?: {
    location_type?: 'home' | 'outside' | 'work' | 'transit' | 'unknown';
    activity?: 'pause' | 'learning' | 'working' | 'social' | 'eating' | 'commuting' | 'unknown';
    time_of_day?: 'morning' | 'afternoon' | 'evening' | 'night';
    social_context?: 'alone' | 'with_friend' | 'group' | 'client' | 'unknown';
  };

  emotion?: {
    valence?: number;        // 1-10
    arousal?: number;        // 1-10
    primary?: string;
    intensity?: number;      // 1-10
    tags?: string[];
  };

  body?: {
    energy_level?: number;   // 1-10
    pain_level?: number;     // 0-10 general only
    sensations?: string[];
  };

  cognition?: {
    thought_summary?: string; // short optional text
    pattern_tags?: string[];
  };

  urge?: {
    action?: string;
    intensity?: number;      // 1-10
    resisted?: boolean;
  };

  related_app_usage_id?: string;
  related_learning_session_id?: string;

  blocking_context?: {
    flow: 'breathing' | 'learning' | 'reflection';
    target_id?: string;
    target_type?: 'app' | 'website' | 'search';
    target_label?: string;
    overlay_session_id?: string;
  };

  metadata: {
    entry_mode: 'manual' | 'prompted';
    offline_created?: boolean;
  };
}

export interface SyncState {
  userId: string;
  source: 'mobile_app';
  schema_version: '1.0';

  device_id: string;
  last_sync_at: TimestampField;
  app_version: string;
  platform: 'ios' | 'android';
  timezone: string;

  pending_events_count?: number;
  last_error?: {
    code: string;
    message: string;
    timestamp: TimestampField;
  };
}

// --- Emotion Mapping Dictionary ---------------------------------------------

const EMOTION_METRIC_MAP: Record<string, EmotionMetrics> = {
  // Positiv
  relieved: { valence: 7, arousal: 2, energy: 4 },
  content: { valence: 8, arousal: 3, energy: 5 },
  connected: { valence: 8, arousal: 4, energy: 6 },
  optimistic: { valence: 8, arousal: 5, energy: 7 },
  centered: { valence: 9, arousal: 2, energy: 4 },
  happy: { valence: 9, arousal: 5, energy: 7 },
  relaxed: { valence: 8, arousal: 2, energy: 4 },
  grateful: { valence: 9, arousal: 3, energy: 5 },
  motivated: { valence: 8, arousal: 7, energy: 9 },
  excited: { valence: 9, arousal: 8, energy: 9 },
  proud: { valence: 8, arousal: 6, energy: 8 },
  peaceful: { valence: 9, arousal: 2, energy: 4 },
  inspired: { valence: 8, arousal: 6, energy: 7 },
  hopeful: { valence: 8, arousal: 4, energy: 6 },
  loving: { valence: 9, arousal: 4, energy: 6 },
  confident: { valence: 8, arousal: 5, energy: 7 },
  joyful: { valence: 9, arousal: 7, energy: 8 },
  safe: { valence: 9, arousal: 2, energy: 4 },
  light: { valence: 8, arousal: 3, energy: 5 },
  curious_hopeful: { valence: 8, arousal: 5, energy: 6 },
  seen: { valence: 8, arousal: 4, energy: 5 },
  open: { valence: 8, arousal: 4, energy: 5 },
  serene: { valence: 9, arousal: 2, energy: 4 },
  fulfilled: { valence: 9, arousal: 3, energy: 5 },
  playful: { valence: 8, arousal: 6, energy: 7 },

  // Neutral
  focused: { valence: 6, arousal: 5, energy: 7 },
  alert: { valence: 5, arousal: 6, energy: 8 },
  present: { valence: 6, arousal: 4, energy: 5 },
  uncertain: { valence: 4, arousal: 5, energy: 4 },
  observing: { valence: 5, arousal: 3, energy: 4 },
  calm: { valence: 6, arousal: 2, energy: 4 },
  bored: { valence: 4, arousal: 2, energy: 2 },
  tired: { valence: 4, arousal: 1, energy: 1 },
  thoughtful: { valence: 5, arousal: 3, energy: 4 },
  curious: { valence: 6, arousal: 5, energy: 6 },
  indifferent: { valence: 4, arousal: 2, energy: 3 },
  distracted: { valence: 4, arousal: 5, energy: 5 },
  restless: { valence: 4, arousal: 6, energy: 6 },
  hesitant: { valence: 4, arousal: 4, energy: 4 },
  busy: { valence: 5, arousal: 6, energy: 7 },
  guarded: { valence: 5, arousal: 4, energy: 4 },
  grounded: { valence: 6, arousal: 2, energy: 4 },
  numb: { valence: 3, arousal: 1, energy: 2 },
  reflective: { valence: 6, arousal: 3, energy: 4 },
  waiting: { valence: 5, arousal: 3, energy: 3 },

  // Negativ
  worried: { valence: 3, arousal: 6, energy: 4 },
  drained: { valence: 2, arousal: 1, energy: 1 },
  irritated: { valence: 3, arousal: 6, energy: 5 },
  ashamed: { valence: 2, arousal: 5, energy: 3 },
  disappointed: { valence: 2, arousal: 3, energy: 2 },
  stressed: { valence: 2, arousal: 8, energy: 6 },
  anxious: { valence: 2, arousal: 7, energy: 4 },
  sad: { valence: 2, arousal: 3, energy: 2 },
  frustrated: { valence: 3, arousal: 7, energy: 5 },
  lonely: { valence: 3, arousal: 4, energy: 3 },
  overwhelmed: { valence: 2, arousal: 8, energy: 5 },
  angry: { valence: 2, arousal: 8, energy: 7 },
  guilty: { valence: 2, arousal: 5, energy: 3 },
  hurt: { valence: 2, arousal: 5, energy: 4 },
  tense: { valence: 3, arousal: 7, energy: 5 },
  discouraged: { valence: 2, arousal: 4, energy: 2 },
  jealous: { valence: 3, arousal: 6, energy: 4 },
  pressured: { valence: 2, arousal: 7, energy: 5 },
  insecure: { valence: 3, arousal: 6, energy: 4 },
  restless_neg: { valence: 3, arousal: 6, energy: 5 },

  // Körper
  energized: { valence: 8, arousal: 7, energy: 9 },
  heavy: { valence: 4, arousal: 2, energy: 2 },
  shaky: { valence: 3, arousal: 6, energy: 4 },
  awake: { valence: 7, arousal: 6, energy: 8 },
  foggy: { valence: 4, arousal: 2, energy: 2 },
  warm: { valence: 7, arousal: 3, energy: 5 },
  tight: { valence: 3, arousal: 6, energy: 3 },
  rested: { valence: 8, arousal: 2, energy: 6 },
  sensitive: { valence: 5, arousal: 5, energy: 4 },
  regulated: { valence: 7, arousal: 2, energy: 5 },
};

export function mapEmotionsToValenceArousalEnergy(emotions: string[]): EmotionMetrics {
  if (!emotions || emotions.length === 0) {
    return { valence: 5, arousal: 4, energy: 4 };
  }

  let totalValence = 0;
  let totalArousal = 0;
  let totalEnergy = 0;
  let count = 0;

  for (const id of emotions) {
    const metrics = EMOTION_METRIC_MAP[id];
    if (metrics) {
      totalValence += metrics.valence;
      totalArousal += metrics.arousal;
      totalEnergy += metrics.energy;
      count++;
    }
  }

  if (count === 0) {
    return { valence: 5, arousal: 4, energy: 4 };
  }

  return {
    valence: Math.round(totalValence / count),
    arousal: Math.round(totalArousal / count),
    energy: Math.round(totalEnergy / count),
  };
}

// --- Firestore Sync Helper Functions ----------------------------------------

export function getTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Paris';
  } catch {
    return 'Europe/Paris';
  }
}

export function getDeviceId(): string {
  try {
    let devId = window.localStorage.getItem('blearn-device-id');
    if (!devId) {
      devId = `device_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`;
      window.localStorage.setItem('blearn-device-id', devId);
    }
    return devId;
  } catch {
    return 'unknown-device';
  }
}

// --- Collection Writers -----------------------------------------------------

export async function createAppUsageEvent(event: Omit<AppUsageEvent, 'source' | 'schema_version' | 'timezone' | 'created_at' | 'device_id'>): Promise<void> {
  assertFirebaseWritesEnabled('App Usage Event');
  const sdk = await loadFirestoreSdk();
  const db = await ensureFirebaseFirestore();
  if (!db) throw new Error('Firestore not initialized');

  const id = event.id || `app_usage_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const docRef = sdk.doc(db, USERS_COLLECTION, event.userId, 'app_usage', id);

  const finalEvent: AppUsageEvent = {
    ...event,
    source: 'mobile_app',
    schema_version: '1.0',
    device_id: getDeviceId(),
    timezone: getTimezone(),
    created_at: sdk.Timestamp.fromDate(new Date()),
    started_at: sdk.Timestamp.fromDate(toDate(event.started_at)),
    ended_at: sdk.Timestamp.fromDate(toDate(event.ended_at)),
    updated_at: event.updated_at ? sdk.Timestamp.fromDate(toDate(event.updated_at)) : undefined,
  };

  await enqueueFirestoreWrite(() => withTimeout(
    sdk.setDoc(docRef, sanitizeFirestoreValue(finalEvent)),
    WRITE_TIMEOUT_MS,
    'hermes app usage write',
  ));
}

export async function createLearningLog(log: Omit<LearningLog, 'source' | 'schema_version' | 'timezone' | 'created_at' | 'device_id'>): Promise<void> {
  assertFirebaseWritesEnabled('Learning Log');
  const sdk = await loadFirestoreSdk();
  const db = await ensureFirebaseFirestore();
  if (!db) throw new Error('Firestore not initialized');

  const id = log.id || `learning_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const docRef = sdk.doc(db, USERS_COLLECTION, log.userId, 'learning_logs', id);

  const finalLog: LearningLog = {
    ...log,
    source: 'mobile_app',
    schema_version: '1.0',
    device_id: getDeviceId(),
    timezone: getTimezone(),
    created_at: sdk.Timestamp.fromDate(new Date()),
    started_at: sdk.Timestamp.fromDate(toDate(log.started_at)),
    ended_at: sdk.Timestamp.fromDate(toDate(log.ended_at)),
    updated_at: log.updated_at ? sdk.Timestamp.fromDate(toDate(log.updated_at)) : undefined,
  };

  await enqueueFirestoreWrite(() => withTimeout(
    sdk.setDoc(docRef, sanitizeFirestoreValue(finalLog)),
    WRITE_TIMEOUT_MS,
    'hermes learning log write',
  ));
}

export async function createEmotionLog(log: Omit<EmotionLog, 'source' | 'schema_version' | 'timezone' | 'created_at' | 'ingested_at' | 'device_id'>): Promise<void> {
  assertFirebaseWritesEnabled('Emotion Log');
  const sdk = await loadFirestoreSdk();
  const db = await ensureFirebaseFirestore();
  if (!db) throw new Error('Firestore not initialized');

  const id = log.id || `emotion_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const docRef = sdk.doc(db, USERS_COLLECTION, log.userId, 'emotion_logs', id);

  const finalLog = {
    ...log,
    source: 'mobile_app',
    schema_version: '1.0',
    device_id: getDeviceId(),
    timezone: getTimezone(),
    created_at: sdk.Timestamp.fromDate(new Date()),
    ingested_at: sdk.serverTimestamp(),
    timestamp: sdk.Timestamp.fromDate(toDate(log.timestamp)),
  };

  await enqueueFirestoreWrite(() => withTimeout(
    sdk.setDoc(docRef, sanitizeFirestoreValue(finalLog)),
    WRITE_TIMEOUT_MS,
    'hermes emotion log write',
  ));
}

export async function updateSyncState(state: Omit<SyncState, 'source' | 'schema_version' | 'timezone' | 'device_id'>): Promise<void> {
  assertFirebaseWritesEnabled('Sync State');
  const sdk = await loadFirestoreSdk();
  const db = await ensureFirebaseFirestore();
  if (!db) throw new Error('Firestore not initialized');

  const deviceId = getDeviceId();
  const docRef = sdk.doc(db, USERS_COLLECTION, state.userId, 'sync_state', deviceId);

  const finalState: SyncState = {
    ...state,
    source: 'mobile_app',
    schema_version: '1.0',
    device_id: deviceId,
    timezone: getTimezone(),
    last_sync_at: sdk.Timestamp.fromDate(toDate(state.last_sync_at)),
    last_error: state.last_error ? {
      ...state.last_error,
      timestamp: sdk.Timestamp.fromDate(toDate(state.last_error.timestamp)),
    } : undefined,
  };

  await enqueueFirestoreWrite(() => withTimeout(
    sdk.setDoc(docRef, sanitizeFirestoreValue(finalState)),
    WRITE_TIMEOUT_MS,
    'hermes sync state write',
  ));
}

export async function syncBackgroundAppUsage(userId: string): Promise<void> {
  const { isNative, getUsageForRange } = await import('@/services/screenTimeService');
  if (!isNative) return;

  assertFirebaseWritesEnabled('Background App Usage Sync');

  const now = new Date();
  const todayDateKey = now.toISOString().split('T')[0];

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const startMs = startOfDay.getTime();
  const endMs = now.getTime();

  const usage = await getUsageForRange(startMs, endMs);

  if (!usage || !usage.entries) return;

  // Baselines vergangener Tage entsorgen: die Keys sind pro App und Datum und
  // wuerden localStorage sonst unbegrenzt anwachsen lassen.
  const baselinePrefix = `blearn-last-usage-${userId}-`;
  const staleKeys: string[] = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (key && key.startsWith(baselinePrefix) && !key.endsWith(`-${todayDateKey}`)) {
      staleKeys.push(key);
    }
  }
  staleKeys.forEach((key) => window.localStorage.removeItem(key));

  for (const entry of usage.entries) {
    if (entry.totalTimeMs <= 0) continue;

    const storageKey = `blearn-last-usage-${userId}-${entry.appId}-${todayDateKey}`;
    const lastSyncedVal = window.localStorage.getItem(storageKey);

    if (lastSyncedVal === null) {
      // First time seeing this app today. Initialize the storage value to the current totalTimeMs
      window.localStorage.setItem(storageKey, entry.totalTimeMs.toString());
      continue;
    }

    const lastSyncedTime = parseInt(lastSyncedVal, 10);
    const deltaMs = entry.totalTimeMs - lastSyncedTime;

    if (deltaMs >= 30000) { // at least 30 seconds of new usage
      const durationMinutes = Math.max(1, Math.round(deltaMs / 60000));
      const endedAt = entry.lastUsedTimestamp || Date.now();
      const startedAt = endedAt - deltaMs;

      const docId = `bg_usage_${userId}_${entry.appId}_${todayDateKey}_${entry.totalTimeMs}`;

      try {
        await createAppUsageEvent({
          id: docId,
          userId,
          started_at: startedAt,
          ended_at: endedAt,
          duration_minutes: durationMinutes,
          app: {
            name: entry.label || entry.appName || entry.appId,
            package_name: entry.appId,
            category: 'unknown',
          },
          metadata: {
            entry_mode: 'background',
          },
        });

        window.localStorage.setItem(storageKey, entry.totalTimeMs.toString());
      } catch (err) {
        console.warn(`[BackgroundAppUsageSync] Failed to sync ${entry.appId}:`, err);
      }
    }
  }
}

// --- Historical Data Backfiller ---------------------------------------------

export async function backfillHistoricalData(userId: string): Promise<void> {
  const { checkins } = useAppStore.getState();
  const { reviewLogs, decks } = useLearningStore.getState();
  // Fehler werden pro Dokument gefangen, damit ein einzelner Ausfall nicht den Rest
  // blockiert — am Ende muss der Aufrufer aber wissen, dass der Backfill unvollstaendig
  // war, sonst wird das Completed-Flag gesetzt und die Daten fehlen dauerhaft.
  let failureCount = 0;

  // 1. Backfill Check-ins to emotion_logs / app_usage
  for (const checkin of checkins) {
    try {
      const completedAt = checkin.timestamp;
      const metrics = mapEmotionsToValenceArousalEnergy(checkin.emotions);
      const docId = checkin.id; // Preserve original ID to avoid duplicates

      // Push emotion log
      await createEmotionLog({
        id: docId,
        userId,
        timestamp: completedAt,
        trigger_type: checkin.targetApp ? 'after_app_usage' : 'manual',
        context: {
          location_type: 'unknown',
          activity: checkin.targetApp ? 'pause' : 'unknown',
          time_of_day: new Date(completedAt).getHours() < 12 ? 'morning' : new Date(completedAt).getHours() < 18 ? 'afternoon' : 'evening',
          social_context: 'alone',
        },
        emotion: {
          valence: metrics.valence,
          arousal: metrics.arousal,
          primary: checkin.emotions[0] || 'Neutral',
          intensity: 5,
          tags: checkin.emotions,
        },
        body: {
          energy_level: metrics.energy,
          pain_level: 0,
          sensations: [],
        },
        cognition: {
          thought_summary: checkin.reflection || undefined,
          pattern_tags: [],
        },
        urge: {
          action: checkin.targetApp || undefined,
          intensity: checkin.targetApp ? 7 : 0,
          resisted: true,
        },
        metadata: {
          entry_mode: 'manual',
          offline_created: true,
        },
      });

      // If checkin has a targetApp, push app usage log too
      if (checkin.targetApp) {
        await createAppUsageEvent({
          id: `app_usage_${docId}`,
          userId,
          started_at: completedAt - 15 * 60 * 1000,
          ended_at: completedAt,
          duration_minutes: 15,
          app: {
            name: checkin.targetApp,
            category: 'unknown',
          },
          user_intent_before: 'avoidance',
          emotion_before: {
            valence: metrics.valence,
            arousal: metrics.arousal,
            energy: metrics.energy,
            tags: checkin.emotions,
          },
          emotion_after: {
            valence: metrics.valence,
            arousal: Math.max(1, metrics.arousal - 1),
            energy: metrics.energy,
            tags: [],
          },
          delta: {
            valence: 0,
            arousal: -1,
            energy: 0,
          },
          metadata: {
            entry_mode: 'manual',
            offline_created: true,
          },
        });
      }
    } catch (err) {
      failureCount += 1;
      console.warn(`[Backfill] Failed to push check-in ${checkin.id}:`, err);
    }
  }

  // 2. Backfill Review Logs to learning_logs
  // Group review logs by date (YYYY-MM-DD)
  type StoredReviewLog = (typeof reviewLogs)[string];
  const logsByDate: Record<string, StoredReviewLog[]> = {};
  for (const log of Object.values(reviewLogs)) {
    const dateKey = new Date(log.reviewedAt).toISOString().split('T')[0];
    if (!logsByDate[dateKey]) {
      logsByDate[dateKey] = [];
    }
    logsByDate[dateKey].push(log);
  }

  for (const [dateKey, logs] of Object.entries(logsByDate)) {
    try {
      const words_learned = logs.filter(log => log.previousState === 'new').length;
      const words_reviewed = logs.length;
      const correctCount = logs.filter(log => log.wasCorrect).length;
      const accuracy_percent = words_reviewed > 0 ? (correctCount / words_reviewed) * 100 : 100;
      
      const latestLog = logs.reduce((latest, current) => current.reviewedAt > latest.reviewedAt ? current : latest, logs[0]);
      const earliestLog = logs.reduce((earliest, current) => current.reviewedAt < earliest.reviewedAt ? current : earliest, logs[0]);
      
      // Use the deck name from the first log's deck, or fallback
      const sampleDeck = decks[latestLog.deckId];
      const topic = sampleDeck?.name || 'Vokabeln';
      const language = sampleDeck?.language || 'de';

      const durationMinutes = Math.max(1, Math.ceil(words_reviewed * 0.5)); // 30s per card

      await createLearningLog({
        id: `learning_backfill_${dateKey}`, // deterministic ID
        userId,
        started_at: earliestLog.reviewedAt,
        ended_at: latestLog.reviewedAt,
        duration_minutes: durationMinutes,
        session: {
          type: 'vocabulary',
          language,
          topic,
          difficulty_level: 'B1',
        },
        vocabulary: {
          words_learned,
          words_reviewed,
          accuracy_percent: Math.round(accuracy_percent),
        },
        state_before: { energy: 5, focus: 6, resistance: 4 },
        state_after: { energy: 5, focus: 7, confidence: 7, frustration: 2 },
        goal_progress: {
          daily_goal_words: 20,
          current_total_words: words_reviewed,
          percentage: Math.min(100, Math.round((words_reviewed / 20) * 100)),
        },
        metadata: {
          entry_mode: 'manual',
          offline_created: true,
        },
      });
    } catch (err) {
      failureCount += 1;
      console.warn(`[Backfill] Failed to push learning log for date ${dateKey}:`, err);
    }
  }

  if (failureCount > 0) {
    throw new Error(`Backfill incomplete: ${failureCount} document(s) failed to sync.`);
  }
}
