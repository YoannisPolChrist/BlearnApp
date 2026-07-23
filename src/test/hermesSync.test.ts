import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  mapEmotionsToValenceArousalEnergy,
  createAppUsageEvent,
  createLearningLog,
  createEmotionLog,
  updateSyncState,
  syncBackgroundAppUsage,
  backfillHistoricalData
} from '@/services/hermesSyncService';
import { useAppStore } from '@/store/useAppStore';
import { useLearningStore } from '@/store/useLearningStore';

// Mock Firebase SDK
const docMock = vi.hoisted(() => vi.fn((...args: unknown[]) => ({ kind: 'doc', path: args.slice(1).join('/') })));
const collectionMock = vi.hoisted(() => vi.fn((...args: unknown[]) => ({ kind: 'collection', path: args.slice(1).join('/') })));
const queryMock = vi.hoisted(() => vi.fn((firstArg: unknown) => firstArg));
const whereMock = vi.hoisted(() => vi.fn());
const getDocsMock = vi.hoisted(() => vi.fn());
const setDocMock = vi.hoisted(() => vi.fn());
const serverTimestampMock = vi.hoisted(() => vi.fn(() => ({ __serverTimestamp: true })));

vi.mock('firebase/firestore', () => ({
  doc: docMock,
  collection: collectionMock,
  query: queryMock,
  where: whereMock,
  getDocs: getDocsMock,
  setDoc: setDocMock,
  serverTimestamp: serverTimestampMock,
  Timestamp: {
    fromDate: (date: Date) => ({ seconds: Math.floor(date.getTime() / 1000), nanoseconds: 0 }),
  },
}));

vi.mock('@/lib/firebase', () => ({
  assertFirebaseWritesEnabled: vi.fn(),
  ensureFirebaseFirestore: vi.fn(async () => ({ kind: 'firestore' })),
}));

const getUsageForRangeMock = vi.hoisted(() => vi.fn(async () => ({
  totalScreenTimeMs: 1200000,
  unlockCount: 5,
  entries: [
    {
      appId: 'com.instagram.android',
      label: 'Instagram',
      totalTimeMs: 600000,
      lastUsedTimestamp: Date.now() - 60000,
    }
  ]
})));

vi.mock('@/services/screenTimeService', () => ({
  isNative: true,
  getUsageForRange: getUsageForRangeMock,
}));

describe('Hermes Sync Service - Emotion Mapping', () => {
  it('should map single happy emotion to valence, arousal, energy', () => {
    const result = mapEmotionsToValenceArousalEnergy(['happy']);
    expect(result).toEqual({ valence: 9, arousal: 5, energy: 7 });
  });

  it('should average multiple emotions correctly', () => {
    const result = mapEmotionsToValenceArousalEnergy(['happy', 'bored']);
    expect(result).toEqual({ valence: 7, arousal: 4, energy: 5 });
  });

  it('should return defaults for unknown or empty emotions', () => {
    const resultEmpty = mapEmotionsToValenceArousalEnergy([]);
    expect(resultEmpty).toEqual({ valence: 5, arousal: 4, energy: 4 });

    const resultUnknown = mapEmotionsToValenceArousalEnergy(['nonsense']);
    expect(resultUnknown).toEqual({ valence: 5, arousal: 4, energy: 4 });
  });
});

describe('Hermes Sync Service - Datacollection Writers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should write createAppUsageEvent correctly', async () => {
    await createAppUsageEvent({
      userId: 'test-user-123',
      started_at: Date.now() - 10 * 60 * 1000,
      ended_at: Date.now(),
      duration_minutes: 10,
      app: {
        name: 'Instagram',
        category: 'social_media',
      },
      user_intent_before: 'avoidance',
      metadata: {
        entry_mode: 'automatic',
      },
    });

    expect(setDocMock).toHaveBeenCalled();
    const [docRef, data] = setDocMock.mock.calls[0];
    expect(docRef.path).toContain('app_usage');
    expect(data.userId).toBe('test-user-123');
    expect(data.schema_version).toBe('1.0');
    expect(data.app.name).toBe('Instagram');
  });

  it('should write createLearningLog correctly', async () => {
    await createLearningLog({
      userId: 'test-user-123',
      started_at: Date.now() - 5 * 60 * 1000,
      ended_at: Date.now(),
      duration_minutes: 5,
      session: {
        type: 'vocabulary',
        language: 'es',
        topic: 'Verbos',
      },
      metadata: {
        entry_mode: 'manual',
      },
    });

    expect(setDocMock).toHaveBeenCalled();
    const [docRef, data] = setDocMock.mock.calls[0];
    expect(docRef.path).toContain('learning_logs');
    expect(data.schema_version).toBe('1.0');
    expect(data.session.type).toBe('vocabulary');
  });

  it('should write createEmotionLog correctly', async () => {
    await createEmotionLog({
      userId: 'test-user-123',
      timestamp: Date.now(),
      trigger_type: 'manual',
      emotion: {
        valence: 7,
        arousal: 3,
        primary: 'content',
        intensity: 6,
      },
      metadata: {
        entry_mode: 'manual',
      },
    });

    expect(setDocMock).toHaveBeenCalled();
    const [docRef, data] = setDocMock.mock.calls[0];
    expect(docRef.path).toContain('emotion_logs');
    expect(data.schema_version).toBe('1.0');
    expect(data.emotion.primary).toBe('content');
    expect(data.ingested_at).toEqual({ __serverTimestamp: true });
  });

  it('should write updateSyncState correctly', async () => {
    await updateSyncState({
      userId: 'test-user-123',
      last_sync_at: Date.now(),
      app_version: '1.0.0',
      platform: 'android',
    });

    expect(setDocMock).toHaveBeenCalled();
    const [docRef, data] = setDocMock.mock.calls[0];
    expect(docRef.path).toContain('sync_state');
    expect(data.schema_version).toBe('1.0');
    expect(data.platform).toBe('android');
  });

  it('should run syncBackgroundAppUsage and push app usage events on delta', async () => {
    // 1. Initial run: should initialize the storage key but not write
    const todayKey = new Date().toISOString().split('T')[0];
    window.localStorage.removeItem(`blearn-last-usage-test-user-com.instagram.android-${todayKey}`);
    await syncBackgroundAppUsage('test-user');
    expect(setDocMock).not.toHaveBeenCalled();

    // 2. Second run with increased totalTimeMs: should calculate delta and write
    getUsageForRangeMock.mockResolvedValueOnce({
      totalScreenTimeMs: 1800000,
      unlockCount: 6,
      entries: [
        {
          appId: 'com.instagram.android',
          label: 'Instagram',
          totalTimeMs: 900000, // + 5 minutes delta (300,000 ms)
          lastUsedTimestamp: Date.now(),
        }
      ]
    });

    await syncBackgroundAppUsage('test-user');
    expect(setDocMock).toHaveBeenCalled();
    const [docRef, data] = setDocMock.mock.calls[0];
    expect(docRef.path).toContain('app_usage');
    expect(data.app.package_name).toBe('com.instagram.android');
    expect(data.duration_minutes).toBe(5);
  });
});

describe('Hermes Sync Service - Backfill Historical Data', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({
      checkins: [
        {
          id: 'checkin-123',
          timestamp: Date.now() - 24 * 60 * 60 * 1000,
          emotions: ['happy'],
          reflection: 'Good day',
          chatHistory: [],
          breathingCompleted: true,
          targetApp: 'Instagram',
        },
      ],
    });
    useLearningStore.setState({
      decks: {
        'deck-1': { id: 'deck-1', name: 'Deutsch', language: 'de', cardIds: [], createdAt: 0 },
      },
      reviewLogs: {
        'log-1': {
          id: 'log-1',
          deckId: 'deck-1',
          cardId: 'card-1',
          reviewedAt: Date.now() - 24 * 60 * 60 * 1000,
          rating: 'good',
          previousState: 'new',
          newState: 'review',
          scheduledDays: 3,
          elapsedDays: 0,
          wasCorrect: true,
          memoryStateBefore: null,
          memoryStateAfter: null,
        },
      },
    });
  });

  it('runs backfill successfully pushing checkins and review logs as aggregated learning logs', async () => {
    await backfillHistoricalData('user-test');
    expect(setDocMock).toHaveBeenCalled();
  });
});
