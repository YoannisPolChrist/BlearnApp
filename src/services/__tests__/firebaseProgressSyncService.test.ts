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

vi.mock('firebase/firestore', () => ({
  doc: (...args: unknown[]) => ({ path: args.slice(1).map(String).join('/') }),
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
}));

describe('firebaseProgressSyncService', () => {
  beforeEach(() => {
    firestoreState.docs.clear();
    firestoreState.writes.length = 0;
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
  });
});
