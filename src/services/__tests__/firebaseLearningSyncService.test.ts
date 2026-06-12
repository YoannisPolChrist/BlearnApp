import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildEntitiesFromRows, getDefaultLearningPresets } from '@/lib/learning';

const testState = vi.hoisted(() => ({
  db: new Map<string, unknown>(),
  listeners: new Map<string, Set<(snapshot: unknown) => void>>(),
}));

function clone<T>(value: T): T {
  return value === undefined || value === null
    ? value
    : JSON.parse(JSON.stringify(value));
}

function makeSnapshot(path: string) {
  const data = testState.db.get(path);
  return {
    id: path.split('/').at(-1) || path,
    exists: () => data !== undefined,
    data: () => clone(data),
  };
}

function emitSnapshot(path: string) {
  const callbacks = testState.listeners.get(path);
  if (!callbacks) {
    return;
  }

  const snapshot = makeSnapshot(path);
  for (const callback of callbacks) {
    callback(snapshot);
  }
}

function pathFromDocArgs(args: unknown[]) {
  if (args.length >= 2 && typeof args[0] === 'object' && args[0] !== null && 'path' in (args[0] as object)) {
    const [ref, id] = args as [{ path: string }, string];
    return `${ref.path}/${id}`;
  }

  return args.slice(1).map(String).join('/');
}

vi.mock('@/lib/firebase', () => ({
  ensureFirebaseFirestore: async () => ({ kind: 'mock-firestore' }),
  getFirebaseFirestore: () => ({ kind: 'mock-firestore' }),
  assertFirebaseWritesEnabled: () => true,
}));

vi.mock('firebase/firestore', () => ({
  collection: (...args: unknown[]) => ({ path: args.slice(1).map(String).join('/') }),
  doc: (...args: unknown[]) => ({ path: pathFromDocArgs(args) }),
  getDoc: async (ref: { path: string }) => makeSnapshot(ref.path),
  getDocs: async (ref: { path: string }) => {
    const prefix = `${ref.path}/`;
    const docs = Array.from(testState.db.entries())
      .filter(([path]) => path.startsWith(prefix) && path.split('/').length === ref.path.split('/').length + 1)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([path, data]) => ({
        id: path.split('/').at(-1) || path,
        data: () => clone(data),
      }));

    return { docs };
  },
  onSnapshot: (ref: { path: string }, next: (snapshot: unknown) => void) => {
    const listeners = testState.listeners.get(ref.path) || new Set<(snapshot: unknown) => void>();
    listeners.add(next);
    testState.listeners.set(ref.path, listeners);
    next(makeSnapshot(ref.path));

    return () => {
      const current = testState.listeners.get(ref.path);
      current?.delete(next);
      if (current && current.size === 0) {
        testState.listeners.delete(ref.path);
      }
    };
  },
  serverTimestamp: () => Date.now(),
  setDoc: async (ref: { path: string }, data: unknown, options?: { merge?: boolean }) => {
    const current = testState.db.get(ref.path);
    const nextValue =
      options?.merge && current && typeof current === 'object'
        ? { ...(clone(current) as Record<string, unknown>), ...(clone(data) as Record<string, unknown>) }
        : clone(data);
    testState.db.set(ref.path, nextValue);
    emitSnapshot(ref.path);
  },
  writeBatch: () => {
    const writes: Array<
      | { kind: 'set'; ref: { path: string }; data: unknown; options?: { merge?: boolean } }
      | { kind: 'delete'; ref: { path: string } }
    > = [];
    return {
      set: (ref: { path: string }, data: unknown, options?: { merge?: boolean }) => {
        writes.push({ kind: 'set', ref, data, options });
      },
      delete: (ref: { path: string }) => {
        writes.push({ kind: 'delete', ref });
      },
      commit: async () => {
        for (const write of writes) {
          if (write.kind === 'delete') {
            testState.db.delete(write.ref.path);
            emitSnapshot(write.ref.path);
            continue;
          }

          const current = testState.db.get(write.ref.path);
          const nextValue =
            write.options?.merge && current && typeof current === 'object'
              ? { ...(clone(current) as Record<string, unknown>), ...(clone(write.data) as Record<string, unknown>) }
              : clone(write.data);
          testState.db.set(write.ref.path, nextValue);
          emitSnapshot(write.ref.path);
        }
      },
    };
  },
  waitForPendingWrites: async () => {},
}));

describe('firebaseLearningSyncService', () => {
  beforeEach(() => {
    testState.db.clear();
    testState.listeners.clear();
  });

  it('pushes mutation records and keeps snapshot metadata compatible', async () => {
    const now = 1_700_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const { decks, notes, cards } = buildEntitiesFromRows(
      [{ deck: 'Spanish', front: 'hola', back: 'hello', type: 'basic' }],
      now,
    );

    const [{ saveLearningCloudState, loadLearningCloudSyncCursor, pullLearningCloudMutations }] = await Promise.all([
      import('@/services/firebaseLearningSyncService'),
    ]);

    await saveLearningCloudState(
      'user-1',
      {
        activeDeckId: decks[0].id,
        activeDeckUpdatedAt: decks[0].updatedAt,
        decks,
        notes,
        cards,
        reviewLogs: [],
        presets: getDefaultLearningPresets(),
        cardBrowser: {
          selectedDeckId: decks[0].id,
          searchDraft: 'hola',
          searchText: 'hola',
          stateFilter: 'review',
          sortBy: 'front',
          sortDirection: 'desc',
          selectedCardIds: [cards[0].id],
          savedSearchId: undefined,
          updatedAt: now + 1_000,
        },
        savedCardQueries: [],
        filteredDeckLiteDefinition: {
          id: 'filtered-deck-lite-default',
          name: 'Filtered Deck Lite',
          selectedDeckId: decks[0].id,
          primaryQuery: 'deck:Spanish',
          secondaryQuery: '',
          limit: 5,
          reschedule: false,
          allowEmpty: true,
          delayAgain: 10,
          delayHard: 30,
          delayGood: 120,
          updatedAt: now + 1_000,
        },
        filteredDeckLiteDefinitions: [],
        filteredDeckLiteRuns: [],
      },
      null,
      'device-a',
    );

    const meta = testState.db.get('users/user-1/learningMeta/profile') as Record<string, unknown>;
    const mutationDocs = Array.from(testState.db.entries()).filter(([path]) => path.startsWith('users/user-1/learningMutations/'));

    expect(meta.mutationCursor).toBeTruthy();
    expect(meta.lastMutationId).toBe(meta.mutationCursor && (meta.mutationCursor as { mutationId: string }).mutationId);
    expect(mutationDocs).toHaveLength(1);
    expect(await loadLearningCloudSyncCursor('user-1')).toEqual(meta.mutationCursor);

    const pulled = await pullLearningCloudMutations('user-1', null);
    expect(pulled.mutations).toHaveLength(1);
    expect(pulled.cursor).toEqual(meta.mutationCursor);
    expect((pulled.mutations[0]?.delta.cardBrowser?.searchText)).toBe('hola');
  });

  it('pulls newer mutation deltas on top of the snapshot state', async () => {
    const now = 1_700_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const { decks, notes, cards } = buildEntitiesFromRows(
      [{ deck: 'Spanish', front: 'hola', back: 'hello', type: 'basic' }],
      now,
    );

    const { saveLearningCloudState, loadLearningCloudState } = await import('@/services/firebaseLearningSyncService');

    await saveLearningCloudState(
      'user-2',
      {
        activeDeckId: decks[0].id,
        activeDeckUpdatedAt: decks[0].updatedAt,
        decks,
        notes,
        cards,
        reviewLogs: [],
        presets: getDefaultLearningPresets(),
        cardBrowser: {
          selectedDeckId: decks[0].id,
          searchDraft: '',
          searchText: '',
          stateFilter: 'all',
          sortBy: 'due',
          sortDirection: 'asc',
          selectedCardIds: [],
          updatedAt: now + 1_000,
        },
        savedCardQueries: [],
        filteredDeckLiteDefinition: {
          id: 'filtered-deck-lite-default',
          name: 'Filtered Deck Lite',
          selectedDeckId: decks[0].id,
          primaryQuery: '',
          secondaryQuery: '',
          limit: 25,
          reschedule: false,
          allowEmpty: true,
          delayAgain: 10,
          delayHard: 30,
          delayGood: 120,
          updatedAt: now + 1_000,
        },
        filteredDeckLiteDefinitions: [],
        filteredDeckLiteRuns: [],
      },
      null,
      'device-a',
    );

    const baseMeta = testState.db.get('users/user-2/learningMeta/profile') as Record<string, unknown>;
    const baseCursor = baseMeta.mutationCursor as { mutationId: string; mutationAt: number };

    await vi.dynamicImportSettled();

    testState.db.set('users/user-2/learningMutations/mutation_remote', {
      id: 'mutation_remote',
      deviceId: 'device-b',
      mutationAt: now + 5_000,
      baseCursor,
      cursor: {
        mutationId: 'mutation_remote',
        mutationAt: now + 5_000,
      },
      delta: {
        cardBrowser: {
          selectedDeckId: decks[0].id,
          searchDraft: 'bonjour',
          searchText: 'bonjour',
          stateFilter: 'review',
          sortBy: 'deck',
          sortDirection: 'asc',
          selectedCardIds: [],
          savedSearchId: undefined,
          updatedAt: now + 5_000,
        },
        savedCardQueries: [
          {
            id: 'remote-search',
            name: 'French search',
            searchText: 'bonjour',
            selectedDeckId: decks[0].id,
            stateFilter: 'review',
            sortBy: 'deck',
            sortDirection: 'asc',
            createdAt: now + 5_000,
            updatedAt: now + 5_000,
          },
        ],
      },
      snapshot: {
        activeDeckId: decks[0].id,
        activeDeckUpdatedAt: decks[0].updatedAt,
        decks,
        notes,
        cards,
        reviewLogs: [],
        presets: getDefaultLearningPresets(),
        cardBrowser: {
          selectedDeckId: decks[0].id,
          searchDraft: 'bonjour',
          searchText: 'bonjour',
          stateFilter: 'review',
          sortBy: 'deck',
          sortDirection: 'asc',
          selectedCardIds: [],
          updatedAt: now + 5_000,
        },
        savedCardQueries: [
          {
            id: 'remote-search',
            name: 'French search',
            searchText: 'bonjour',
            selectedDeckId: decks[0].id,
            stateFilter: 'review',
            sortBy: 'deck',
            sortDirection: 'asc',
            createdAt: now + 5_000,
            updatedAt: now + 5_000,
          },
        ],
        filteredDeckLiteDefinition: {
          id: 'filtered-deck-lite-default',
          name: 'Filtered Deck Lite',
          selectedDeckId: decks[0].id,
          primaryQuery: '',
          secondaryQuery: '',
          limit: 25,
          reschedule: false,
          allowEmpty: true,
          delayAgain: 10,
          delayHard: 30,
          delayGood: 120,
          updatedAt: now + 1_000,
        },
        filteredDeckLiteDefinitions: [],
        filteredDeckLiteRuns: [],
      },
      acknowledgedAt: now + 5_000,
    });

    testState.db.set('users/user-2/learningMeta/profile', {
      ...baseMeta,
      mutationCursor: baseCursor,
      lastMutationId: baseCursor.mutationId,
      lastMutationAt: baseCursor.mutationAt,
    });

    const loaded = await loadLearningCloudState('user-2');

    expect(loaded?.cardBrowser.searchText).toBe('bonjour');
    expect(loaded?.savedCardQueries).toHaveLength(1);
    expect(loaded?.savedCardQueries[0]?.id).toBe('remote-search');
    expect(loaded?.cardBrowser.sortBy).toBe('deck');
  });

  it('compacts acknowledged mutations without breaking the current cursor or delta state', async () => {
    const now = 1_700_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const initialEntities = buildEntitiesFromRows(
      [{ deck: 'Spanish', front: 'hola', back: 'hello', type: 'basic' }],
      now,
    );
    const updatedEntities = buildEntitiesFromRows(
      [{ deck: 'Spanish', front: 'hola', back: 'hello there', type: 'basic' }],
      now + 1_000,
    );

    const {
      saveLearningCloudState,
      compactLearningCloudMutations,
      loadLearningCloudState,
      pullLearningCloudMutations,
    } = await import('@/services/firebaseLearningSyncService');

    await saveLearningCloudState(
      'user-3',
      {
        activeDeckId: initialEntities.decks[0].id,
        activeDeckUpdatedAt: initialEntities.decks[0].updatedAt,
        decks: initialEntities.decks,
        notes: initialEntities.notes,
        cards: initialEntities.cards,
        reviewLogs: [],
        presets: getDefaultLearningPresets(),
        cardBrowser: {
          selectedDeckId: initialEntities.decks[0].id,
          searchDraft: '',
          searchText: '',
          stateFilter: 'all',
          sortBy: 'due',
          sortDirection: 'asc',
          selectedCardIds: [],
          updatedAt: now + 1_000,
        },
        savedCardQueries: [],
        filteredDeckLiteDefinition: {
          id: 'filtered-deck-lite-default',
          name: 'Filtered Deck Lite',
          selectedDeckId: initialEntities.decks[0].id,
          primaryQuery: '',
          secondaryQuery: '',
          limit: 25,
          reschedule: false,
          allowEmpty: true,
          delayAgain: 10,
          delayHard: 30,
          delayGood: 120,
          updatedAt: now + 1_000,
        },
        filteredDeckLiteDefinitions: [],
        filteredDeckLiteRuns: [],
      },
      null,
      'device-a',
    );

    await saveLearningCloudState(
      'user-3',
      {
        activeDeckId: updatedEntities.decks[0].id,
        activeDeckUpdatedAt: updatedEntities.decks[0].updatedAt,
        decks: updatedEntities.decks,
        notes: updatedEntities.notes,
        cards: updatedEntities.cards,
        reviewLogs: [],
        presets: getDefaultLearningPresets(),
        cardBrowser: {
          selectedDeckId: updatedEntities.decks[0].id,
          searchDraft: 'updated',
          searchText: 'updated',
          stateFilter: 'review',
          sortBy: 'front',
          sortDirection: 'desc',
          selectedCardIds: [],
          updatedAt: now + 2_000,
        },
        savedCardQueries: [],
        filteredDeckLiteDefinition: {
          id: 'filtered-deck-lite-default',
          name: 'Filtered Deck Lite',
          selectedDeckId: updatedEntities.decks[0].id,
          primaryQuery: '',
          secondaryQuery: '',
          limit: 25,
          reschedule: false,
          allowEmpty: true,
          delayAgain: 10,
          delayHard: 30,
          delayGood: 120,
          updatedAt: now + 2_000,
        },
        filteredDeckLiteDefinitions: [],
        filteredDeckLiteRuns: [],
      },
      null,
      'device-a',
    );

    const beforeCompaction = Array.from(testState.db.entries()).filter(([path]) => path.startsWith('users/user-3/learningMutations/'));
    expect(beforeCompaction).toHaveLength(2);

    const result = await compactLearningCloudMutations('user-3', { keepLatest: 1 });
    expect(result.deletedCount).toBe(1);

    const afterCompaction = Array.from(testState.db.entries()).filter(([path]) => path.startsWith('users/user-3/learningMutations/'));
    expect(afterCompaction).toHaveLength(1);

    const loaded = await loadLearningCloudState('user-3');
    expect(loaded?.cardBrowser.searchText).toBe('updated');
    expect((await pullLearningCloudMutations('user-3', null)).mutations).toHaveLength(1);
  });
});
