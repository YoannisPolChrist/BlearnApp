import { beforeEach, describe, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/react';
import { buildEntitiesFromRows, getDefaultGateRule, getDefaultLearningPresets } from '@/lib/learning';
import { normalizeLearningCloudState } from '@/lib/learningCloudSync';

const firestoreMockState = vi.hoisted(() => {
  const isPlainObject = (value: unknown): value is Record<string, unknown> => {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  };

  const assertNoUndefined = (value: unknown, path = 'root'): void => {
    if (value === undefined) {
      throw new Error(`Unexpected undefined at ${path}`);
    }

    if (Array.isArray(value)) {
      value.forEach((entry, index) => assertNoUndefined(entry, `${path}[${index}]`));
      return;
    }

    if (!isPlainObject(value)) {
      return;
    }

    Object.entries(value).forEach(([key, entry]) => {
      assertNoUndefined(entry, `${path}.${key}`);
    });
  };

  return {
    autoResolveBatchCommits: true,
    assertNoUndefined,
    batchDeleteWrites: [] as Array<{ ref: unknown }>,
    batchSetWrites: [] as Array<{ ref: unknown; data: unknown; options: unknown }>,
    batches: [] as Array<{
      setWrites: Array<{ ref: unknown; data: unknown; options: unknown }>;
      deleteWrites: Array<{ ref: unknown }>;
      commitCount: number;
    }>,
    fakeFirestore: { kind: 'firestore-test' },
    pendingBatchCommitResolvers: [] as Array<() => void>,
    setDocWrites: [] as Array<{ ref: unknown; data: unknown; options: unknown }>,
  };
});

const assertFirebaseWritesEnabledMock = vi.hoisted(() => vi.fn());
const ensureFirebaseFirestoreMock = vi.hoisted(() => vi.fn(async () => firestoreMockState.fakeFirestore));
const getFirebaseFirestoreMock = vi.hoisted(() => vi.fn(() => firestoreMockState.fakeFirestore));
const collectionMock = vi.hoisted(() => vi.fn((...segments: unknown[]) => ({ kind: 'collection', segments })));
const docMock = vi.hoisted(() => vi.fn((...segments: unknown[]) => ({ kind: 'doc', segments })));
const getDocMock = vi.hoisted(() => vi.fn(async () => ({
  exists: () => false,
  data: () => ({}),
})));
const getDocFromServerMock = vi.hoisted(() => vi.fn(async () => ({
  exists: () => false,
  data: () => ({}),
})));
const getDocsMock = vi.hoisted(() => vi.fn(async () => ({ docs: [] })));
const getDocsFromServerMock = vi.hoisted(() => vi.fn(async () => ({ docs: [] })));
const onSnapshotMock = vi.hoisted(() => vi.fn());
const orderByMock = vi.hoisted(() => vi.fn((...args: unknown[]) => ({ kind: 'orderBy', args })));
const serverTimestampMock = vi.hoisted(() => vi.fn(() => ({ __serverTimestamp: true })));
const queryMock = vi.hoisted(() => vi.fn((ref: unknown) => ref));
const waitForPendingWritesMock = vi.hoisted(() => vi.fn(async () => undefined));
const whereMock = vi.hoisted(() => vi.fn((...args: unknown[]) => ({ kind: 'where', args })));
const setDocMock = vi.hoisted(() => vi.fn(async (ref: unknown, data: unknown, options: unknown) => {
  firestoreMockState.assertNoUndefined(data);
  firestoreMockState.setDocWrites.push({ ref, data, options });
}));
const writeBatchMock = vi.hoisted(() => vi.fn(() => {
  const batchRecord = {
    setWrites: [] as Array<{ ref: unknown; data: unknown; options: unknown }>,
    deleteWrites: [] as Array<{ ref: unknown }>,
    commitCount: 0,
  };
  firestoreMockState.batches.push(batchRecord);

  return {
    set: (ref: unknown, data: unknown, options: unknown) => {
      firestoreMockState.assertNoUndefined(data);
      const entry = { ref, data, options };
      firestoreMockState.batchSetWrites.push(entry);
      batchRecord.setWrites.push(entry);
    },
    delete: vi.fn((ref: unknown) => {
      const entry = { ref };
      firestoreMockState.batchDeleteWrites.push(entry);
      batchRecord.deleteWrites.push(entry);
    }),
    commit: vi.fn(async () => {
      batchRecord.commitCount += 1;
      if (!firestoreMockState.autoResolveBatchCommits) {
        await new Promise<void>((resolve) => {
          firestoreMockState.pendingBatchCommitResolvers.push(resolve);
        });
      }
    }),
  };
}));

vi.mock('@/lib/firebase', () => ({
  assertFirebaseWritesEnabled: assertFirebaseWritesEnabledMock,
  ensureFirebaseFirestore: ensureFirebaseFirestoreMock,
  getFirebaseFirestore: getFirebaseFirestoreMock,
}));

vi.mock('firebase/firestore', () => ({
  collection: collectionMock,
  doc: docMock,
  getDoc: getDocMock,
  getDocFromServer: getDocFromServerMock,
  getDocs: getDocsMock,
  getDocsFromServer: getDocsFromServerMock,
  onSnapshot: onSnapshotMock,
  orderBy: orderByMock,
  query: queryMock,
  serverTimestamp: serverTimestampMock,
  setDoc: setDocMock,
  waitForPendingWrites: waitForPendingWritesMock,
  where: whereMock,
  writeBatch: writeBatchMock,
}));

import {
  pullLearningCloudMutations,
  pushLearningCloudMutation,
  loadLearningCloudState,
  subscribeToLearningCloudMetadata,
  saveLearningCloudState,
  saveLearningCloudSyncCursor,
} from '@/services/firebaseLearningSyncService';

/**
 * Helper: extract the collection path segments from a write's ref.
 * Returns array of path segments, e.g. ['users', 'uid', 'learningDecks', 'deckId', 'cards', 'cardId'].
 */
function getRefSegments(write: { ref: unknown }): string[] {
  const segments = (write.ref as { segments?: unknown[] }).segments;
  return Array.isArray(segments) ? segments.map(String) : [];
}

/**
 * Helper: find a batch set-write for a specific entity ID.
 * Works for both deck-scoped subcollection writes (cardId, noteId, reviewLogId)
 * and top-level collection writes (deckId, presetId, mutationId).
 */
function findWriteByEntityId(entityId: string) {
  return firestoreMockState.batchSetWrites.find((write) => {
    const segments = getRefSegments(write);
    return segments[segments.length - 1] === entityId;
  });
}

/**
 * Helper: find a batch set-write whose path includes a specific subcollection name.
 */
function findWritesInSubcollection(subcollectionName: string) {
  return firestoreMockState.batchSetWrites.filter((write) => {
    const segments = getRefSegments(write);
    return segments.includes(subcollectionName);
  });
}

/**
 * Helper: get all entity IDs written to a deck-scoped subcollection.
 */
function getDeckScopedWriteIds(subcollectionName: string) {
  return firestoreMockState.batchSetWrites
    .filter((write) => {
      const segments = getRefSegments(write);
      return segments.includes(subcollectionName);
    })
    .map((write) => {
      const segments = getRefSegments(write);
      return segments[segments.length - 1];
    })
    .filter((id): id is string => Boolean(id));
}

/**
 * Helper: get all write IDs that are direct entity docs in a top-level collection
 * (decks, presets, mutations, etc. — not bucket docs, not deck-scoped subcollection docs).
 */
function getTopLevelDirectWriteIds() {
  return firestoreMockState.batchSetWrites
    .map((write) => {
      const data = write.data as { id?: string };
      return data?.id;
    })
    .filter((id): id is string => typeof id === 'string');
}

describe('firebaseLearningSyncService', () => {
  beforeEach(() => {
    assertFirebaseWritesEnabledMock.mockClear();
    firestoreMockState.batchDeleteWrites.length = 0;
    firestoreMockState.batchSetWrites.length = 0;
    firestoreMockState.batches.length = 0;
    firestoreMockState.autoResolveBatchCommits = true;
    firestoreMockState.pendingBatchCommitResolvers.length = 0;
    firestoreMockState.setDocWrites.length = 0;
    ensureFirebaseFirestoreMock.mockClear();
    getFirebaseFirestoreMock.mockClear();
    collectionMock.mockClear();
    docMock.mockClear();
    getDocMock.mockClear();
    getDocFromServerMock.mockClear();
    getDocsMock.mockClear();
    getDocsFromServerMock.mockClear();
    onSnapshotMock.mockClear();
    orderByMock.mockClear();
    queryMock.mockClear();
    serverTimestampMock.mockClear();
    setDocMock.mockClear();
    waitForPendingWritesMock.mockClear();
    whereMock.mockClear();
    writeBatchMock.mockClear();

    getDocMock.mockResolvedValue({
      exists: () => false,
      data: () => ({}),
    });
    getDocFromServerMock.mockImplementation(() => getDocMock());
    getDocsMock.mockResolvedValue({ docs: [] });
    getDocsFromServerMock.mockImplementation(() => getDocsMock());
  });

  it('removes undefined fields before writing entities, mutations, and metadata', async () => {
    const now = 1_700_000_000_000;
    const { decks, notes, cards } = buildEntitiesFromRows(
      [{ deck: 'Spanish', front: 'hola', back: 'hello', type: 'basic' }],
      now,
    );
    const nextState = normalizeLearningCloudState({
      activeDeckId: decks[0].id,
      activeDeckUpdatedAt: decks[0].updatedAt,
      decks,
      notes,
      cards,
      reviewLogs: [],
      presets: getDefaultLearningPresets(),
    });

    await saveLearningCloudState('user-sync', nextState, null, 'device-test');

    expect(assertFirebaseWritesEnabledMock).toHaveBeenCalledWith('Learn-Cloud-Schreibzugriffe');

    expect(firestoreMockState.batchSetWrites.length).toBeGreaterThan(0);
    expect(firestoreMockState.setDocWrites).toHaveLength(0);

    // Entity documents remain in the complete legacy collections. This keeps
    // pre-migration vocabularies readable and prevents partial deck-scoped
    // copies from becoming authoritative.
    const noteWrite = findWriteByEntityId(notes[0].id);
    expect(noteWrite).toBeDefined();
    expect(noteWrite?.data).not.toHaveProperty('frontHtml');
    expect(noteWrite?.data).not.toHaveProperty('backHtml');
    expect(noteWrite?.data).not.toHaveProperty('templateCss');
    expect(noteWrite?.data).not.toHaveProperty('templateCardClass');

    const mutationWrite = firestoreMockState.batchSetWrites.find(
      (write) => typeof (write.data as { id?: string }).id === 'string'
        && (write.data as { id: string }).id.startsWith('mutation_'),
    );
    expect(mutationWrite).toBeDefined();
    expect(mutationWrite?.data).toHaveProperty('delta.notes.0.id', notes[0].id);
    expect(mutationWrite?.data).not.toHaveProperty('delta.notes.0.frontHtml');
    expect(mutationWrite?.data).not.toHaveProperty('delta.notes.0.backHtml');
    expect(mutationWrite?.data).not.toHaveProperty('delta.cardBrowser.savedSearchId');
    expect(mutationWrite?.data).not.toHaveProperty('snapshot');

    const mutationBatch = firestoreMockState.batches.find((batch) => batch.setWrites.includes(mutationWrite!));
    expect(mutationBatch).toBeDefined();
    expect(mutationBatch?.commitCount).toBe(1);
    expect(waitForPendingWritesMock).toHaveBeenCalled();

    const metaWrite = mutationBatch?.setWrites.find((write) => {
      const segments = getRefSegments(write);
      return segments.at(-2) === 'learningMeta' && segments.at(-1) === 'profile';
    });

    expect(metaWrite).toBeDefined();
  });

  it('skips every deck-scoped collection read for the repaired legacy-backed format', async () => {
    const now = 1_700_000_000_000;
    const { decks, notes, cards } = buildEntitiesFromRows(
      [{ deck: 'French', front: 'bonjour', back: 'hello', type: 'basic' }],
      now,
    );
    const toSnapshotDocument = <T,>(value: T) => ({ data: () => value });

    getDocMock.mockResolvedValue({
      exists: () => true,
      data: () => ({ schemaVersion: 2, deckScopedMigrationCompleted: false }),
    });
    getDocsMock.mockImplementation(async (ref: { segments?: unknown[] }) => {
      const path = (ref.segments || []).map(String);
      const collectionName = path.at(-1);
      if (collectionName === 'learningDecks') return { docs: decks.map(toSnapshotDocument) };
      if (collectionName === 'learningNotes') return { docs: notes.map(toSnapshotDocument) };
      if (collectionName === 'learningCards') return { docs: cards.map(toSnapshotDocument) };
      return { docs: [] };
    });

    const loaded = await loadLearningCloudState('user-sync');

    expect(loaded?.notes).toHaveLength(1);
    expect(loaded?.cards).toHaveLength(1);
    expect(collectionMock.mock.calls.some((args) => ['notes', 'cards', 'reviewLogs'].includes(String(args.at(-1))))).toBe(false);
  });

  it('keeps the compatibility reader enabled for an old partially migrated account', async () => {
    const now = 1_700_000_000_000;
    const { decks, notes, cards } = buildEntitiesFromRows(
      [{ deck: 'French', front: 'bonjour', back: 'hello', type: 'basic' }],
      now,
    );
    const nextState = normalizeLearningCloudState({
      activeDeckId: decks[0].id,
      activeDeckUpdatedAt: decks[0].updatedAt,
      decks,
      notes,
      cards,
      reviewLogs: [],
      presets: getDefaultLearningPresets(),
    });

    getDocMock.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ schemaVersion: 2, deckScopedMigrationCompleted: true }),
    });

    await saveLearningCloudState('user-sync', nextState, null, 'device-test');

    const metaWrite = firestoreMockState.batchSetWrites.find((write) => {
      const segments = getRefSegments(write);
      return segments.at(-2) === 'learningMeta' && segments.at(-1) === 'profile';
    });
    expect(metaWrite?.data).toHaveProperty('deckScopedMigrationCompleted', true);
  });

  it('persists learn configuration in cloud metadata', async () => {
    const now = 1_700_000_000_000;
    const { decks, notes, cards } = buildEntitiesFromRows(
      [{ deck: 'Spanish', front: 'hola', back: 'hello', type: 'basic' }],
      now,
    );
    const assignment = {
      id: 'assignment_spanish',
      targetId: 'app-spanish',
      targetType: 'app' as const,
      deckId: decks[0].id,
      unlockDurationMinutes: 45,
      enabled: true,
      updatedAt: now + 2_000,
    };
    const nextState = normalizeLearningCloudState({
      activeDeckId: decks[0].id,
      activeDeckUpdatedAt: decks[0].updatedAt,
      decks,
      notes,
      cards,
      reviewLogs: [],
      presets: getDefaultLearningPresets(),
      assignments: [assignment],
      gateRule: {
        ...getDefaultGateRule(),
        reviewAheadHours: 18,
      },
      gateRuleUpdatedAt: now + 3_000,
    });

    await saveLearningCloudState('user-sync', nextState, null, 'device-test');

    const metaWrite = firestoreMockState.batchSetWrites.find((write) => {
      const data = write.data as { schemaVersion?: number; id?: string };
      return data.schemaVersion === 2 && !data.id;
    });

    expect(metaWrite).toBeDefined();
    expect(metaWrite?.data).toHaveProperty('assignments.0.id', assignment.id);
    expect(metaWrite?.data).toHaveProperty('gateRule.reviewAheadHours', 18);
    expect(metaWrite?.data).toHaveProperty('gateRuleUpdatedAt', now + 3_000);
  });

  it('strips optional cursor fields when saving a null sync cursor', async () => {
    await saveLearningCloudSyncCursor('user-sync', null, 'device-test');

    expect(firestoreMockState.setDocWrites).toHaveLength(1);
    expect(firestoreMockState.setDocWrites[0]?.data).toHaveProperty('mutationCursor', null);
    expect(firestoreMockState.setDocWrites[0]?.data).not.toHaveProperty('lastMutationId');
    expect(firestoreMockState.setDocWrites[0]?.data).not.toHaveProperty('lastMutationAt');
  });

  it('writes standalone mutations and cursor metadata in the same batch', async () => {
    const now = 1_700_000_000_000;
    const { decks, notes, cards } = buildEntitiesFromRows(
      [{ deck: 'French', front: 'bonjour', back: 'hello', type: 'basic' }],
      now,
    );
    const nextState = normalizeLearningCloudState({
      activeDeckId: decks[0].id,
      activeDeckUpdatedAt: decks[0].updatedAt,
      decks,
      notes,
      cards,
      reviewLogs: [],
      presets: getDefaultLearningPresets(),
    });

    const mutation = await pushLearningCloudMutation('user-sync', nextState, null, 'device-test');

    expect(mutation).not.toBeNull();
    expect(firestoreMockState.setDocWrites).toHaveLength(0);

    const mutationBatch = firestoreMockState.batches.find((batch) => batch.setWrites.some((write) => (
      typeof (write.data as { id?: string }).id === 'string'
      && (write.data as { id: string }).id.startsWith('mutation_')
    )));

    expect(mutationBatch).toBeDefined();
    expect(mutationBatch?.commitCount).toBe(1);
    expect(
      mutationBatch?.setWrites.some((write) => {
        const segments = getRefSegments(write);
        return segments.at(-2) === 'learningMeta' && segments.at(-1) === 'profile';
      }),
    ).toBe(true);
  });

  it('queries only the mutation window starting at the local cursor', async () => {
    const cursor = {
      mutationId: 'mutation_1700000000000_local',
      mutationAt: 1_700_000_000_000,
    };

    await pullLearningCloudMutations('user-sync', cursor);

    expect(whereMock).toHaveBeenCalledWith('mutationAt', '>=', cursor.mutationAt);
    expect(orderByMock).toHaveBeenCalledWith('mutationAt', 'asc');
    expect(queryMock).toHaveBeenCalledTimes(1);
    expect(getDocsMock).toHaveBeenCalledTimes(1);
  });

  it('archives removed entities before deleting their active Firestore documents', async () => {
    const now = 1_700_000_000_000;
    const previous = buildEntitiesFromRows(
      [
        { deck: 'Spanish', front: 'hola', back: 'hello', type: 'basic' },
        { deck: 'Spanish', front: 'adios', back: 'bye', type: 'basic' },
      ],
      now,
    );
    const nextState = normalizeLearningCloudState({
      activeDeckId: previous.decks[0].id,
      activeDeckUpdatedAt: previous.decks[0].updatedAt,
      decks: previous.decks,
      notes: [previous.notes[0]],
      cards: [previous.cards[0]],
      reviewLogs: [],
      presets: getDefaultLearningPresets(),
    });
    const previousState = normalizeLearningCloudState({
      activeDeckId: previous.decks[0].id,
      activeDeckUpdatedAt: previous.decks[0].updatedAt,
      decks: previous.decks,
      notes: previous.notes,
      cards: previous.cards,
      reviewLogs: [],
      presets: getDefaultLearningPresets(),
    });

    await saveLearningCloudState('user-sync', nextState, previousState, 'device-test', {
      localSyncState: {
        version: 1,
        lastSuccessfulSyncAt: now - 10_000,
        deletedDecks: [],
        deletedNotes: [{ id: previous.notes[1].id, deletedAt: now + 1 }],
        deletedCards: [{ id: previous.cards[1].id, deletedAt: now + 1 }],
        deletedReviewLogs: [],
        deletedPresets: [],
      },
    });

    // In deck-scoped format, deleted entities should produce delete writes.
    // The deleted note/card IDs should not appear in set writes.
    const writtenNoteIds = getDeckScopedWriteIds('notes');
    const writtenCardIds = getDeckScopedWriteIds('cards');

    expect(writtenNoteIds).not.toContain(previous.notes[1].id);
    expect(writtenCardIds).not.toContain(previous.cards[1].id);
    expect(
      firestoreMockState.batchDeleteWrites.length
      + firestoreMockState.batchSetWrites.length,
    ).toBeGreaterThan(0);
    const archiveWrites = firestoreMockState.batchSetWrites.filter((write) =>
      Boolean((write.data as { entityType?: string }).entityType),
    );
    expect(archiveWrites).toEqual(expect.arrayContaining([
      expect.objectContaining({
        data: expect.objectContaining({ entityId: previous.notes[1].id, entityType: 'notes' }),
      }),
      expect.objectContaining({
        data: expect.objectContaining({ entityId: previous.cards[1].id, entityType: 'cards' }),
      }),
    ]));
  });

  it('waits for pending writes after each committed chunk', async () => {
    const now = 1_700_000_000_000;
    const { decks, notes, cards } = buildEntitiesFromRows(
      [{ deck: 'Spanish', front: 'hola', back: 'hello', type: 'basic' }],
      now,
    );
    const reviewLogs = Array.from({ length: 900 }, (_value, index) => ({
      id: `review-log-${index}`,
      deckId: decks[0].id,
      cardId: cards[0].id,
      reviewedAt: now + index,
      rating: 'good' as const,
      previousState: 'review' as const,
      newState: 'review' as const,
      scheduledDays: 3,
      elapsedDays: 2,
      wasCorrect: true,
      memoryStateBefore: { stability: 1.5, difficulty: 4.2 },
      memoryStateAfter: { stability: 1.7, difficulty: 4.0 },
    }));
    const nextState = normalizeLearningCloudState({
      activeDeckId: decks[0].id,
      activeDeckUpdatedAt: decks[0].updatedAt,
      decks,
      notes,
      cards,
      reviewLogs,
      presets: getDefaultLearningPresets(),
    });

    await saveLearningCloudState('user-sync', nextState, null, 'device-test');

    expect(waitForPendingWritesMock).toHaveBeenCalledTimes(firestoreMockState.batches.length);
    expect(firestoreMockState.batches.length).toBeGreaterThan(1);
  });

  it('does not rewrite entities when only Firestore field order differs', async () => {
    const now = 1_700_000_000_000;
    const { decks, notes, cards } = buildEntitiesFromRows(
      [{ deck: 'Spanish', front: 'hola', back: 'hello', type: 'basic' }],
      now,
    );
    const nextState = normalizeLearningCloudState({
      activeDeckId: decks[0].id,
      activeDeckUpdatedAt: decks[0].updatedAt,
      decks,
      notes,
      cards,
      reviewLogs: [],
      presets: getDefaultLearningPresets(),
    });
    const reorderObjectKeys = <T extends Record<string, unknown>>(value: T): T => {
      const reversedEntries = Object.entries(value).reverse();
      return Object.fromEntries(reversedEntries) as T;
    };
    const previousState = normalizeLearningCloudState({
      ...nextState,
      decks: nextState.decks.map((deck) => reorderObjectKeys(deck)),
      notes: nextState.notes.map((note) => reorderObjectKeys(note)),
      cards: nextState.cards.map((card) => reorderObjectKeys(card)),
      presets: nextState.presets.map((preset) => reorderObjectKeys(preset)),
    });

    await saveLearningCloudState('user-sync', nextState, previousState, 'device-test');

    // No entity writes should happen since nothing actually changed.
    const deckScopedCardWrites = findWritesInSubcollection('cards');
    const deckScopedNoteWrites = findWritesInSubcollection('notes');
    const deckScopedReviewLogWrites = findWritesInSubcollection('reviewLogs');

    const entityDocIds = new Set([
      ...nextState.decks.map((deck) => deck.id),
      ...nextState.presets.map((preset) => preset.id),
    ]);
    const topLevelEntityWrites = getTopLevelDirectWriteIds().filter((id) => entityDocIds.has(id));
    const mutationWrites = firestoreMockState.batchSetWrites.filter((write) => {
      const id = (write.data as { id?: string }).id;
      return typeof id === 'string' && id.startsWith('mutation_');
    });

    expect(topLevelEntityWrites).toHaveLength(0);
    expect(mutationWrites).toHaveLength(0);
    expect(deckScopedCardWrites).toHaveLength(0);
    expect(deckScopedNoteWrites).toHaveLength(0);
    expect(deckScopedReviewLogWrites).toHaveLength(0);
  });

  it('does not rewrite notes when Firestore omitted null optional fields', async () => {
    const now = 1_700_000_000_000;
    const { decks, notes, cards } = buildEntitiesFromRows(
      [{ deck: 'Spanish', front: 'hola', back: 'hello', type: 'basic' }],
      now,
    );
    const nextNote = { ...notes[0], mediaUrl: null };
    const { mediaUrl: _omittedMediaUrl, ...previousNote } = nextNote;
    const nextState = normalizeLearningCloudState({
      activeDeckId: decks[0].id,
      activeDeckUpdatedAt: decks[0].updatedAt,
      decks,
      notes: [nextNote],
      cards,
      reviewLogs: [],
      presets: getDefaultLearningPresets(),
    });
    const previousState = normalizeLearningCloudState({
      ...nextState,
      notes: [previousNote as typeof nextNote],
    });

    await saveLearningCloudState('user-sync', nextState, previousState, 'device-test');

    const deckScopedNoteWrites = findWritesInSubcollection('notes');
    const entityDocIds = new Set([
      ...nextState.decks.map((deck) => deck.id),
      ...nextState.presets.map((preset) => preset.id),
    ]);
    const topLevelEntityWrites = getTopLevelDirectWriteIds().filter((id) => entityDocIds.has(id));
    const mutationWrites = firestoreMockState.batchSetWrites.filter((write) => {
      const id = (write.data as { id?: string }).id;
      return typeof id === 'string' && id.startsWith('mutation_');
    });
    const deckScopedCardWrites = findWritesInSubcollection('cards');

    expect(topLevelEntityWrites).toHaveLength(0);
    expect(mutationWrites).toHaveLength(0);
    expect(deckScopedNoteWrites).toHaveLength(0);
    expect(deckScopedCardWrites).toHaveLength(0);
  });

  it('avoids mutation snapshots for large states but still writes entity snapshots and metadata', async () => {
    const now = 1_700_000_000_000;
    const { decks, notes, cards } = buildEntitiesFromRows(
      Array.from({ length: 760 }, (_value, index) => ({
        deck: 'Spanish',
        front: `hola-${index}`,
        back: `hello-${index}`,
        type: 'basic' as const,
      })),
      now,
    );
    const nextState = normalizeLearningCloudState({
      activeDeckId: decks[0].id,
      activeDeckUpdatedAt: decks[0].updatedAt,
      decks,
      notes,
      cards,
      reviewLogs: [],
      presets: getDefaultLearningPresets(),
    });

    await saveLearningCloudState('user-sync', nextState, null, 'device-test');

    const mutationWrite = firestoreMockState.batchSetWrites.find(
      (write) => typeof (write.data as { id?: string }).id === 'string'
        && (write.data as { id: string }).id.startsWith('mutation_'),
    );
    expect(mutationWrite?.data).not.toHaveProperty('snapshot');

    const metaWrite = firestoreMockState.batchSetWrites.find((write) => {
      const segments = getRefSegments(write);
      return segments.at(-2) === 'learningMeta' && segments.at(-1) === 'profile';
    });
    expect(metaWrite).toBeDefined();
    expect(metaWrite?.data).toHaveProperty('mutationCursor.mutationId');

    // Notes are now in deck-scoped subcollection paths.
    const noteWrite = findWriteByEntityId(notes[0].id);
    expect(noteWrite).toBeDefined();
  }, 15_000);

  it('uses delta-only mutation saves for follow-up syncs once a snapshot cursor exists', async () => {
    const now = 1_700_000_000_000;
    const previous = buildEntitiesFromRows(
      [{ deck: 'Spanish', front: 'hola', back: 'hello', type: 'basic' }],
      now,
    );
    const previousState = normalizeLearningCloudState({
      activeDeckId: previous.decks[0].id,
      activeDeckUpdatedAt: previous.decks[0].updatedAt,
      decks: previous.decks,
      notes: previous.notes,
      cards: previous.cards,
      reviewLogs: [],
      presets: getDefaultLearningPresets(),
    });
    const updatedCard = {
      ...previous.cards[0],
      dueAt: previous.cards[0].dueAt + 86_400_000,
      intervalDays: previous.cards[0].intervalDays + 1,
      lastReviewedAt: now + 5_000,
    };
    const nextState = normalizeLearningCloudState({
      ...previousState,
      cards: [updatedCard],
    });

    getDocMock.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        schemaVersion: 2,
        snapshotCursor: {
          mutationId: 'snapshot-1',
          mutationAt: now - 10_000,
        },
        mutationCursor: {
          mutationId: 'snapshot-1',
          mutationAt: now - 10_000,
        },
      }),
    });
    await saveLearningCloudState(
      'user-sync',
      nextState,
      previousState,
      'device-test',
      {
        localSyncState: {
          version: 1,
          lastSuccessfulSyncAt: now - 10_000,
          lastRemoteCursor: {
            mutationId: 'snapshot-1',
            mutationAt: now - 10_000,
          },
          deletedDecks: [],
          deletedNotes: [],
          deletedCards: [],
          deletedReviewLogs: [],
          deletedPresets: [],
        },
      },
    );

    const mutationWrite = firestoreMockState.batchSetWrites.find(
      (write) => typeof (write.data as { id?: string }).id === 'string'
        && (write.data as { id: string }).id.startsWith('mutation_'),
    );
    expect(mutationWrite).toBeDefined();
    expect(mutationWrite?.data).toHaveProperty('delta.cards');
    expect(mutationWrite?.data).toHaveProperty(`delta.cards.${updatedCard.id}.id`, updatedCard.id);
    expect(mutationWrite?.data).not.toHaveProperty('delta.notes');
    expect(mutationWrite?.data).not.toHaveProperty('snapshot');

    // The changed card is written to the durable complete collection, while
    // unchanged notes are not rewritten.
    const cardWrite = findWriteByEntityId(updatedCard.id);
    const noteWrite = findWriteByEntityId(previous.notes[0].id);
    const topLevelEntityWrites = getTopLevelDirectWriteIds().filter((id) => (
      nextState.decks.some((deck) => deck.id === id)
      || nextState.presets.some((preset) => preset.id === id)
      || nextState.reviewLogs.some((log) => log.id === id)
    ));

    expect(cardWrite).toBeDefined();
    expect(noteWrite).toBeUndefined();
    expect(topLevelEntityWrites).toHaveLength(0);

    const metaWrite = firestoreMockState.batchSetWrites.find((write) => {
      const segments = getRefSegments(write);
      return segments.at(-2) === 'learningMeta' && segments.at(-1) === 'profile';
    });
    expect(metaWrite?.data).toHaveProperty('snapshotCursor.mutationId', 'snapshot-1');
    expect(metaWrite?.data).toHaveProperty('mutationCursor.mutationId');
  });

  it('does not hard-delete a tombstone when no recoverable entity snapshot exists', async () => {
    const now = 1_700_000_000_000;
    const previous = buildEntitiesFromRows(
      [{ deck: 'Spanish', front: 'hola', back: 'hello', type: 'basic' }],
      now,
    );
    const previousState = normalizeLearningCloudState({
      activeDeckId: previous.decks[0].id,
      activeDeckUpdatedAt: previous.decks[0].updatedAt,
      decks: previous.decks,
      notes: previous.notes,
      cards: previous.cards,
      reviewLogs: [],
      presets: getDefaultLearningPresets(),
    });
    const deletedCardId = 'stale-card-tombstone-test';

    // Simulate a tombstone deletion: the deleted card is NOT in previousState,
    // but the local sync state has it in the tombstones list.
    // The save must not issue a destructive delete: without a snapshot the
    // document cannot be placed in the cloud archive for later recovery.
    await saveLearningCloudState(
      'user-sync',
      previousState,
      previousState,
      'device-test',
      {
        localSyncState: {
          version: 1,
          lastSuccessfulSyncAt: now - 10_000,
          deletedDecks: [],
          deletedNotes: [],
          deletedCards: [{ id: deletedCardId, deletedAt: now + 5_000 }],
          deletedReviewLogs: [],
          deletedPresets: [],
        },
      },
    );

    // The unchanged card must not be rewritten merely because another card was
    // removed. That avoids unnecessary Firestore writes.
    const cardWrite = findWriteByEntityId(previous.cards[0].id);
    expect(cardWrite).toBeUndefined();

    // A stale tombstone without its payload must not remove data from another
    // device. It is intentionally left for a later, recoverable reconciliation.
    const deleteRefSegments = firestoreMockState.batchDeleteWrites.map(
      (write) => getRefSegments(write),
    );
    expect(deleteRefSegments.some((segments) => segments.at(-1) === deletedCardId)).toBe(false);
  });

  it('reuses the in-flight save for identical concurrent requests', async () => {
    const now = 1_700_000_000_000;
    const { decks, notes, cards } = buildEntitiesFromRows(
      [{ deck: 'Spanish', front: 'hola', back: 'hello', type: 'basic' }],
      now,
    );
    const reviewLogs = Array.from({ length: 900 }, (_value, index) => ({
      id: `review-log-${index}`,
      deckId: decks[0].id,
      cardId: cards[0].id,
      reviewedAt: now + index,
      rating: 'good' as const,
      previousState: 'review' as const,
      newState: 'review' as const,
      scheduledDays: 3,
      elapsedDays: 2,
      wasCorrect: true,
      memoryStateBefore: { stability: 1.5, difficulty: 4.2 },
      memoryStateAfter: { stability: 1.7, difficulty: 4.0 },
    }));
    const nextState = normalizeLearningCloudState({
      activeDeckId: decks[0].id,
      activeDeckUpdatedAt: decks[0].updatedAt,
      decks,
      notes,
      cards,
      reviewLogs,
      presets: getDefaultLearningPresets(),
    });
    const previousState = normalizeLearningCloudState({
      activeDeckId: decks[0].id,
      activeDeckUpdatedAt: decks[0].updatedAt,
      decks,
      notes,
      cards,
      reviewLogs: [],
      presets: getDefaultLearningPresets(),
    });

    firestoreMockState.autoResolveBatchCommits = false;
    const firstSavePromise = saveLearningCloudState('user-sync', nextState, previousState, 'device-test');

    await waitFor(() => {
      expect(firestoreMockState.pendingBatchCommitResolvers.length).toBeGreaterThan(0);
    });

    const batchCountBeforeSecondSave = firestoreMockState.batches.length;
    const secondSavePromise = saveLearningCloudState('user-sync', nextState, previousState, 'device-test');

    await Promise.resolve();
    await Promise.resolve();
    expect(firestoreMockState.batches.length).toBe(batchCountBeforeSecondSave);

    firestoreMockState.autoResolveBatchCommits = true;
    firestoreMockState.pendingBatchCommitResolvers.splice(0).forEach((resolve) => resolve());
    await expect(firstSavePromise).resolves.toMatchObject({
      reviewLogCount: nextState.reviewLogs.length,
    });
    await expect(secondSavePromise).resolves.toMatchObject({
      reviewLogCount: nextState.reviewLogs.length,
    });
  });

  it('normalizes live metadata snapshots before delivering them to subscribers', async () => {
    let capturedNext: ((snapshot: unknown) => void) | null = null;
    const unsubscribeMock = vi.fn();
    onSnapshotMock.mockImplementationOnce((_ref, next) => {
      capturedNext = next;
      return unsubscribeMock;
    });

    const onChange = vi.fn();
    const onError = vi.fn();
    const unsubscribe = subscribeToLearningCloudMetadata('user-sync', onChange, onError);

    await waitFor(() => {
      expect(onSnapshotMock).toHaveBeenCalledTimes(1);
    });
    expect(capturedNext).toBeTypeOf('function');

    capturedNext?.({
      exists: () => true,
      data: () => ({
        schemaVersion: '7',
        activeDeckId: 'deck_1',
        activeDeckUpdatedAt: '1700000000000',
        deckCount: '12',
        noteCount: '9',
        cardCount: '15',
        reviewLogCount: '4',
        presetCount: '2',
        mutationCursor: {
          mutationId: 'cursor-1',
          mutationAt: 'not-a-number',
        },
        mutationCount: '3',
        updatedByDeviceId: 123,
        clientUpdatedAt: '1700000000123',
        lastMutationId: 456,
        lastMutationAt: '1700000000456',
      }),
    });

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      schemaVersion: 1,
      activeDeckId: 'deck_1',
      deckScopedMigrationCompleted: false,
      mutationCursor: undefined,
    }));
    expect(onError).not.toHaveBeenCalled();

    unsubscribe();
    expect(unsubscribeMock).toHaveBeenCalledTimes(1);
  });

  it('does not write per-deck meta documents after saving', async () => {
    const now = 1_700_000_000_000;
    const { decks, notes, cards } = buildEntitiesFromRows(
      [{ deck: 'Spanish', front: 'hola', back: 'hello', type: 'basic' }],
      now,
    );
    const nextState = normalizeLearningCloudState({
      activeDeckId: decks[0].id,
      activeDeckUpdatedAt: decks[0].updatedAt,
      decks,
      notes,
      cards,
      reviewLogs: [],
      presets: getDefaultLearningPresets(),
    });

    await saveLearningCloudState('user-sync', nextState, null, 'device-test');

    // The per-deck format was the incomplete migration path. It must not be
    // touched by normal saves anymore.
    const deckMetaWrite = firestoreMockState.batchSetWrites.find((write) => {
      const segments = getRefSegments(write);
      return segments.includes('learningDecks') && segments.at(-1) === 'meta';
    });

    expect(deckMetaWrite).toBeUndefined();
  });
});
