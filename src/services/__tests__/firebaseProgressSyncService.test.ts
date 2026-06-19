import { beforeEach, describe, expect, it, vi } from 'vitest';

const firestoreState = vi.hoisted(() => ({
  docs: new Map<string, unknown>(),
  writes: [] as Array<{ path: string; data: unknown; options?: { merge?: boolean } }>,
}));

function clone<T>(value: T): T {
  return value === undefined || value === null
    ? value
    : JSON.parse(JSON.stringify(value));
}

vi.mock('@/lib/firebase', () => ({
  assertFirebaseWritesEnabled: vi.fn(),
  ensureFirebaseFirestore: async () => ({ kind: 'mock-firestore' }),
  getFirebaseFirestore: () => ({ kind: 'mock-firestore' }),
}));

vi.mock('@/services/screenTimeService', () => ({
  isNative: true,
  getUsageForRange: vi.fn().mockResolvedValue({
    totalScreenTimeMs: 5000000,
    entries: [
      {
        appId: 'com.google.android.youtube',
        packageName: 'com.google.android.youtube',
        label: 'YouTube',
        totalTimeMs: 1200000,
      },
      {
        appId: 'com.instagram.android',
        packageName: 'com.instagram.android',
        label: 'Instagram',
        totalTimeMs: 800000,
      },
      {
        appId: 'com.unused.app',
        packageName: 'com.unused.app',
        label: 'Unused App',
        totalTimeMs: 0,
      },
    ],
  }),
}));

vi.mock('firebase/firestore', () => ({
  doc: (...args: unknown[]) => ({ path: args.slice(1).map(String).join('/') }),
  collection: (...args: unknown[]) => ({ path: args.slice(1).map(String).join('/') }),
  getDocs: async (ref: { path: string }) => {
    const list: any[] = [];
    firestoreState.docs.forEach((val, key) => {
      if (key.includes(ref.path)) {
        list.push({
          ref: { path: key },
          data: () => clone(val),
        });
      }
    });
    return {
      forEach: (callback: (doc: any) => void) => list.forEach(callback),
    };
  },
  getDoc: async (ref: { path: string }) => ({
    exists: () => firestoreState.docs.has(ref.path),
    data: () => clone(firestoreState.docs.get(ref.path)),
  }),
  getDocFromServer: async (ref: { path: string }) => ({
    exists: () => firestoreState.docs.has(ref.path),
    data: () => clone(firestoreState.docs.get(ref.path)),
  }),
  onSnapshot: () => () => undefined,
  setDoc: async (ref: { path: string }, data: unknown, options?: { merge?: boolean }) => {
    firestoreState.writes.push({ path: ref.path, data: clone(data), options });
    firestoreState.docs.set(ref.path, clone(data));
  },
  writeBatch: (firestore: unknown) => {
    const operations: Array<{ ref: { path: string }; data?: unknown; type: 'set' | 'delete' }> = [];
    return {
      set: (ref: { path: string }, data: unknown) => {
        operations.push({ ref, data, type: 'set' });
      },
      delete: (ref: { path: string }) => {
        operations.push({ ref, type: 'delete' });
      },
      commit: async () => {
        for (const op of operations) {
          if (op.type === 'set') {
            firestoreState.writes.push({ path: op.ref.path, data: clone(op.data) });
            firestoreState.docs.set(op.ref.path, clone(op.data));
          } else if (op.type === 'delete') {
            firestoreState.docs.delete(op.ref.path);
          }
        }
      },
    };
  },
}));

describe('firebaseProgressSyncService', () => {
  beforeEach(() => {
    firestoreState.docs.clear();
    firestoreState.writes.length = 0;
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  it('strips undefined fields before writing nested progress records to Firestore', async () => {
    const { saveProgressCloudState } = await import('@/services/firebaseProgressSyncService');

    await saveProgressCloudState('user-progress', {
      checkins: [
        {
          id: 'checkin-1',
          timestamp: 1_700_000_000_000,
          emotions: ['calm'],
          reflection: 'Bleibe ruhig',
          targetApp: undefined,
          chatHistory: [],
          breathingCompleted: true,
        },
      ],
      interactions: [
        {
          id: 'interaction-1',
          timestamp: 1_700_000_000_100,
          type: 'breathing',
          emotions: ['calm'],
          completed: true,
          intention: undefined,
          targetApp: undefined,
          challenge: undefined,
          durationMinutes: undefined,
        },
      ],
    }, 'device-test');

    const write = firestoreState.writes[0];
    expect(write?.path).toBe('users/user-progress/progress/profile');
    expect(write?.data).toEqual({
      schemaVersion: 1,
      updatedAt: expect.any(Number),
      updatedByDeviceId: 'device-test',
      progressSignature: expect.any(String),
      checkins: [
        {
          id: 'checkin-1',
          timestamp: 1_700_000_000_000,
          emotions: ['calm'],
          reflection: 'Bleibe ruhig',
          chatHistory: [],
          breathingCompleted: true,
        },
      ],
      interactions: [
        {
          id: 'interaction-1',
          timestamp: 1_700_000_000_100,
          type: 'breathing',
          emotions: ['calm'],
          completed: true,
        },
      ],
    });

    const checkinWrite = firestoreState.writes.find((w) => w.path === 'users/user-progress/checkins/checkin-1');
    expect(checkinWrite).toBeDefined();
    expect(checkinWrite?.data).toEqual({
      id: 'checkin-1',
      timestamp: 1_700_000_000_000,
      emotions: ['calm'],
      reflection: 'Bleibe ruhig',
      chatHistory: [],
      breathingCompleted: true,
    });

    const interactionWrite = firestoreState.writes.find((w) => w.path === 'users/user-progress/interactions/interaction-1');
    expect(interactionWrite).toBeDefined();
    expect(interactionWrite?.data).toEqual({
      id: 'interaction-1',
      timestamp: 1_700_000_000_100,
      type: 'breathing',
      emotions: ['calm'],
      completed: true,
    });
  });

  it('saves app usage daily statistics to Firestore and handles TTL cleanup of expired entries', async () => {
    const { syncAppUsageToFirestore } = await import('@/services/firebaseProgressSyncService');

    // Seed an expired document and a fresh document to verify cleanup
    firestoreState.docs.set('users/user-test/appUsage/2026-03-01', {
      date: '2026-03-01',
      expiresAt: Date.now() - 1000, // Expired
      apps: [],
    });
    firestoreState.docs.set('users/user-test/appUsage/2026-06-18', {
      date: '2026-06-18',
      expiresAt: Date.now() + 10_000_000, // Not expired
      apps: [],
    });

    await syncAppUsageToFirestore('user-test');

    // Expired document must be deleted
    expect(firestoreState.docs.has('users/user-test/appUsage/2026-03-01')).toBe(false);
    // Non-expired document must be kept
    expect(firestoreState.docs.has('users/user-test/appUsage/2026-06-18')).toBe(true);

    // Verify daily documents written for the last 7 days (including bounds check)
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const dateKey = `${year}-${month}-${day}`;

    const todayWrite = firestoreState.writes.find((w) => w.path === `users/user-test/appUsage/${dateKey}`);
    expect(todayWrite).toBeDefined();
    expect(todayWrite?.data).toEqual({
      date: dateKey,
      timestamp: expect.any(Number),
      totalScreenTimeMs: 5000000,
      expiresAt: expect.any(Number),
      apps: [
        {
          packageName: 'com.google.android.youtube',
          label: 'YouTube',
          totalTimeMs: 1200000,
        },
        {
          packageName: 'com.instagram.android',
          label: 'Instagram',
          totalTimeMs: 800000,
        },
      ],
    });
  });
});
