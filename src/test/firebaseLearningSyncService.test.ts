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
const getDocsMock = vi.hoisted(() => vi.fn(async () => ({ docs: [] })));
const onSnapshotMock = vi.hoisted(() => vi.fn());
const serverTimestampMock = vi.hoisted(() => vi.fn(() => ({ __serverTimestamp: true })));
const waitForPendingWritesMock = vi.hoisted(() => vi.fn(async () => undefined));
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
  getDocs: getDocsMock,
  onSnapshot: onSnapshotMock,
  serverTimestamp: serverTimestampMock,
  setDoc: setDocMock,
  waitForPendingWrites: waitForPendingWritesMock,
  writeBatch: writeBatchMock,
}));

import {
  pushLearningCloudMutation,
  subscribeToLearningCloudMetadata,
  saveLearningCloudState,
  saveLearningCloudSyncCursor,
} from '@/services/firebaseLearningSyncService';

function getBucketItems(write: { data: unknown }) {
  const items = (write.data as { items?: Array<{ id?: string }> }).items;
  return Array.isArray(items) ? items : [];
}

function findBucketWriteByItemId(itemId: string) {
  return firestoreMockState.batchSetWrites.find((write) => (
    getBucketItems(write).some((item) => item.id === itemId)
  ));
}

function getBucketWriteItemIds() {
  return firestoreMockState.batchSetWrites.flatMap((write) => (
    getBucketItems(write)
      .map((item) => item.id)
      .filter((id): id is string => typeof id === 'string')
  ));
}

function getDirectWriteIds() {
  return firestoreMockState.batchSetWrites
    .map((write) => (write.data as { id?: string }).id)
    .filter((id): id is string => typeof id === 'string');
}

function getBucketIndex(entityId: string) {
  let hash = 0;
  for (let index = 0; index < entityId.length; index += 1) {
    hash = Math.imul(hash, 31) + entityId.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash) % 64;
}

function createMatchingBucketId(seedId: string, prefix: string) {
  const targetBucketIndex = getBucketIndex(seedId);
  for (let attempt = 0; attempt < 20_000; attempt += 1) {
    const candidate = `${prefix}-${attempt}`;
    if (getBucketIndex(candidate) === targetBucketIndex) {
      return candidate;
    }
  }

  throw new Error(`Could not find matching bucket id for ${seedId}`);
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
    getDocsMock.mockClear();
    onSnapshotMock.mockClear();
    serverTimestampMock.mockClear();
    setDocMock.mockClear();
    waitForPendingWritesMock.mockClear();
    writeBatchMock.mockClear();

    getDocMock.mockResolvedValue({
      exists: () => false,
      data: () => ({}),
    });
    getDocsMock.mockResolvedValue({ docs: [] });
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

    const noteWrite = findBucketWriteByItemId(notes[0].id);
    expect(noteWrite).toBeDefined();
    expect(noteWrite?.data).not.toHaveProperty('items.0.frontHtml');
    expect(noteWrite?.data).not.toHaveProperty('items.0.backHtml');
    expect(noteWrite?.data).not.toHaveProperty('items.0.templateCss');
    expect(noteWrite?.data).not.toHaveProperty('items.0.templateCardClass');

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
      const segments = (write.ref as { segments?: string[] }).segments || [];
      return segments.at(-2) === 'learningMeta' && segments.at(-1) === 'profile';
    });

    expect(metaWrite).toBeDefined();
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
        const segments = (write.ref as { segments?: string[] }).segments || [];
        return segments.at(-2) === 'learningMeta' && segments.at(-1) === 'profile';
      }),
    ).toBe(true);
  });

  it('deletes removed entities from Firestore so a full reload sees only the latest state', async () => {
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

    await saveLearningCloudState('user-sync', nextState, previousState, 'device-test');

    const writtenBucketItemIds = getBucketWriteItemIds();

    expect(writtenBucketItemIds).not.toContain(previous.notes[1].id);
    expect(writtenBucketItemIds).not.toContain(previous.cards[1].id);
    expect(
      firestoreMockState.batchDeleteWrites.length
      + firestoreMockState.batchSetWrites.filter((write) => getBucketItems(write).length > 0).length,
    ).toBeGreaterThan(0);
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

    const entityDocIds = new Set([
      ...nextState.decks.map((deck) => deck.id),
      ...nextState.presets.map((preset) => preset.id),
    ]);
    const entityWrites = getDirectWriteIds().filter((id) => entityDocIds.has(id));
    const mutationWrites = firestoreMockState.batchSetWrites.filter((write) => {
      const id = (write.data as { id?: string }).id;
      return typeof id === 'string' && id.startsWith('mutation_');
    });
    const bucketWrites = firestoreMockState.batchSetWrites.filter((write) => getBucketItems(write).length > 0);

    expect(entityWrites).toHaveLength(0);
    expect(mutationWrites).toHaveLength(0);
    expect(bucketWrites).toHaveLength(0);
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

    const entityDocIds = new Set([
      ...nextState.decks.map((deck) => deck.id),
      ...nextState.presets.map((preset) => preset.id),
    ]);
    const entityWrites = getDirectWriteIds().filter((id) => entityDocIds.has(id));
    const mutationWrites = firestoreMockState.batchSetWrites.filter((write) => {
      const id = (write.data as { id?: string }).id;
      return typeof id === 'string' && id.startsWith('mutation_');
    });
    const bucketWrites = firestoreMockState.batchSetWrites.filter((write) => getBucketItems(write).length > 0);

    expect(entityWrites).toHaveLength(0);
    expect(mutationWrites).toHaveLength(0);
    expect(bucketWrites).toHaveLength(0);
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
      const segments = (write.ref as { segments?: string[] }).segments || [];
      return segments.at(-2) === 'learningMeta' && segments.at(-1) === 'profile';
    });
    expect(metaWrite).toBeDefined();
    expect(metaWrite?.data).toHaveProperty('mutationCursor.mutationId');

    const noteWrite = findBucketWriteByItemId(notes[0].id);
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

    await saveLearningCloudState('user-sync', nextState, previousState, 'device-test');

    const mutationWrite = firestoreMockState.batchSetWrites.find(
      (write) => typeof (write.data as { id?: string }).id === 'string'
        && (write.data as { id: string }).id.startsWith('mutation_'),
    );
    expect(mutationWrite).toBeDefined();
    expect(mutationWrite?.data).toHaveProperty('delta.cards');
    expect(mutationWrite?.data).toHaveProperty(`delta.cards.${updatedCard.id}.id`, updatedCard.id);
    expect(mutationWrite?.data).not.toHaveProperty('delta.notes');
    expect(mutationWrite?.data).not.toHaveProperty('snapshot');

    const bucketWrites = firestoreMockState.batchSetWrites.filter((write) => getBucketItems(write).length > 0);
    const directEntityWrites = getDirectWriteIds().filter((id) => (
      nextState.decks.some((deck) => deck.id === id)
      || nextState.presets.some((preset) => preset.id === id)
      || nextState.reviewLogs.some((log) => log.id === id)
    ));
    expect(bucketWrites).toHaveLength(0);
    expect(directEntityWrites).toHaveLength(0);

    const metaWrite = firestoreMockState.batchSetWrites.find((write) => {
      const segments = (write.ref as { segments?: string[] }).segments || [];
      return segments.at(-2) === 'learningMeta' && segments.at(-1) === 'profile';
    });
    expect(metaWrite?.data).toHaveProperty('snapshotCursor.mutationId', 'snapshot-1');
    expect(metaWrite?.data).toHaveProperty('mutationCursor.mutationId');
  });

  it('rewrites affected card buckets from tombstones even when the local previous snapshot already dropped the deleted card', async () => {
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
    const deletedCardId = createMatchingBucketId(previous.cards[0].id, 'stale-card');

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

    const bucketWrite = findBucketWriteByItemId(previous.cards[0].id);
    expect(bucketWrite).toBeDefined();
    expect(firestoreMockState.batchDeleteWrites.length).toBeGreaterThan(0);
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

    expect(onChange).toHaveBeenCalledWith({
      schemaVersion: 1,
      activeDeckId: 'deck_1',
      activeDeckUpdatedAt: undefined,
      deckCount: undefined,
      noteCount: undefined,
      cardCount: undefined,
      reviewLogCount: undefined,
      presetCount: undefined,
      cardBrowser: undefined,
      savedCardQueries: undefined,
      filteredDeckLiteDefinition: undefined,
      filteredDeckLiteDefinitions: undefined,
      filteredDeckLiteRuns: undefined,
      mutationCursor: undefined,
      mutationCount: undefined,
      updatedByDeviceId: undefined,
      clientUpdatedAt: undefined,
      lastMutationId: undefined,
      lastMutationAt: undefined,
    });
    expect(onError).not.toHaveBeenCalled();

    unsubscribe();
    expect(unsubscribeMock).toHaveBeenCalledTimes(1);
  });
});
