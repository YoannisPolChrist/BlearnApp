import type { Firestore } from 'firebase/firestore';
import { assertFirebaseWritesEnabled } from '@/lib/firebase';
import {
  getLearningCloudStateSignature,
  mergeLearningCloudStates,
  normalizeLearningCloudState,
  type LearningCloudState,
} from '@/lib/learningCloudSync';
import { normalizeRevisionTimestamp } from '@/modules/learning/sync/learningSyncMappers';
import {
  DEFAULT_MUTATION_RETENTION_COUNT,
  MAX_BATCH_WRITES,
  MAX_MUTATION_DOCUMENT_BYTES,
} from './constants';
import {
  compareSyncCursors,
  normalizeSyncCursor,
  sortMutationRecords,
} from './cursors';
import {
  getChangedItems,
  getDeletedIds,
  stripSyncMetadata,
} from './entities';
import { loadLearningCloudSyncCursorWithSdk } from './metadata';
import {
  ensureFirestore,
  getMetaDoc,
  getMutationCollectionRef,
  loadFirestoreSdk,
  waitForPendingChunkWrites,
} from './transport';
import type {
  FirestoreSdk,
  LearningCloudMeta,
  LearningCloudMutationDelta,
  LearningCloudMutationRecord,
  LearningCloudReadOptions,
  LearningCloudSyncCursor,
} from './types';
import {
  getApproximateFirestorePayloadBytes,
  sanitizeFirestoreValue,
  stableStringify,
} from './utils';
export function normalizeLearningCloudMutationRecord(
  record: Partial<LearningCloudMutationRecord> & { id?: string },
): LearningCloudMutationRecord | null {
  const cursor = normalizeSyncCursor(record.cursor)
    || normalizeSyncCursor({
      mutationId: record.id || '',
      mutationAt: record.mutationAt,
    });

  if (!cursor) {
    return null;
  }
  const delta = (record.delta || {}) as LearningCloudMutationDelta;
  const snapshot = record.snapshot
    ? normalizeLearningCloudState(record.snapshot as Partial<LearningCloudState>)
    : undefined;

  return {
    id: record.id?.trim() || cursor.mutationId,
    deviceId: typeof record.deviceId === 'string' ? record.deviceId : 'unknown',
    mutationAt: cursor.mutationAt,
    baseCursor: normalizeSyncCursor(record.baseCursor),
    cursor,
    delta,
    snapshot,
    acknowledgedAt: Number.isFinite(record.acknowledgedAt) ? record.acknowledgedAt : undefined,
  };
}
export async function loadMutationRecords(
  sdk: FirestoreSdk,
  firestore: Firestore,
  userId: string,
  afterCursor?: LearningCloudSyncCursor | null,
  options?: LearningCloudReadOptions,
): Promise<LearningCloudMutationRecord[]> {
  const query = getMutationCollectionRef(sdk, firestore, userId);
  const snapshot = options?.source === 'server' && typeof sdk.getDocsFromServer === 'function'
    ? await sdk.getDocsFromServer(query).catch(() => sdk.getDocs(query))
    : await sdk.getDocs(query);
  const records = snapshot.docs
    .map((entry) => normalizeLearningCloudMutationRecord(stripSyncMetadata<Partial<LearningCloudMutationRecord>>(entry.data())))
    .filter((entry): entry is LearningCloudMutationRecord => Boolean(entry));

  const filtered = afterCursor
    ? records.filter((record) => compareSyncCursors(record.cursor, afterCursor) > 0)
    : records;

  return sortMutationRecords(filtered);
}

export function hasMeaningfulTombstones(delta: LearningCloudMutationDelta) {
  return Boolean(
    (delta.deletedDeckIds && delta.deletedDeckIds.length > 0)
    || (delta.deletedNoteIds && delta.deletedNoteIds.length > 0)
    || (delta.deletedCardIds && delta.deletedCardIds.length > 0)
    || (delta.deletedReviewLogIds && delta.deletedReviewLogIds.length > 0)
    || (delta.deletedPresetIds && delta.deletedPresetIds.length > 0)
    || (delta.deletedSavedCardQueryIds && delta.deletedSavedCardQueryIds.length > 0)
    || (delta.deletedFilteredDeckLiteDefinitionIds && delta.deletedFilteredDeckLiteDefinitionIds.length > 0)
    || (delta.deletedFilteredDeckLiteRunIds && delta.deletedFilteredDeckLiteRunIds.length > 0)
  );
}

export function buildLearningCloudMutationDelta(
  previousState: LearningCloudState | null,
  nextState: LearningCloudState,
): LearningCloudMutationDelta {
  if (!previousState) {
    return {
      ...nextState,
    };
  }

  const delta: LearningCloudMutationDelta = {};
  if (previousState.activeDeckId !== nextState.activeDeckId) {
    delta.activeDeckId = nextState.activeDeckId;
  }
  if (previousState.activeDeckUpdatedAt !== nextState.activeDeckUpdatedAt) {
    delta.activeDeckUpdatedAt = nextState.activeDeckUpdatedAt;
  }

  const checkCollectionDelta = <T extends { id: string }>(
    previous: Record<string, T>,
    next: Record<string, T>
  ) => {
    const prevList = Object.values(previous);
    const nextList = Object.values(next);
    const changed = getChangedItems(prevList, nextList);
    const deleted = getDeletedIds(prevList, nextList);
    return { changed, deleted };
  };

  const decksDelta = checkCollectionDelta(previousState.decks, nextState.decks);
  if (decksDelta.changed.length > 0) delta.decks = Object.fromEntries(decksDelta.changed.map(d => [d.id, d]));
  if (decksDelta.deleted.length > 0) delta.deletedDeckIds = decksDelta.deleted;

  const notesDelta = checkCollectionDelta(previousState.notes, nextState.notes);
  if (notesDelta.changed.length > 0) delta.notes = Object.fromEntries(notesDelta.changed.map(n => [n.id, n]));
  if (notesDelta.deleted.length > 0) delta.deletedNoteIds = notesDelta.deleted;

  const cardsDelta = checkCollectionDelta(previousState.cards, nextState.cards);
  if (cardsDelta.changed.length > 0) delta.cards = Object.fromEntries(cardsDelta.changed.map(c => [c.id, c]));
  if (cardsDelta.deleted.length > 0) delta.deletedCardIds = cardsDelta.deleted;

  const reviewLogsDelta = checkCollectionDelta(previousState.reviewLogs, nextState.reviewLogs);
  if (reviewLogsDelta.changed.length > 0) delta.reviewLogs = Object.fromEntries(reviewLogsDelta.changed.map(l => [l.id, l]));
  if (reviewLogsDelta.deleted.length > 0) delta.deletedReviewLogIds = reviewLogsDelta.deleted;

  const presetsDelta = checkCollectionDelta(previousState.presets, nextState.presets);
  if (presetsDelta.changed.length > 0) delta.presets = Object.fromEntries(presetsDelta.changed.map(p => [p.id, p]));
  if (presetsDelta.deleted.length > 0) delta.deletedPresetIds = presetsDelta.deleted;

  const changedAssignments = getChangedItems(previousState.assignments, nextState.assignments);
  if (changedAssignments.length > 0 || previousState.assignments.length !== nextState.assignments.length) {
    delta.assignments = changedAssignments.length > 0 || nextState.assignments.length === 0 ? nextState.assignments : undefined;
    delta.assignments = nextState.assignments;
  }
  const prevGateRuleAt = normalizeRevisionTimestamp(previousState.gateRuleUpdatedAt);
  const nextGateRuleAt = normalizeRevisionTimestamp(nextState.gateRuleUpdatedAt);
  const gateRuleTimestampsDiffer = prevGateRuleAt !== nextGateRuleAt;
  const gateRuleChanged = gateRuleTimestampsDiffer
    || (prevGateRuleAt === 0 && stableStringify(previousState.gateRule) !== stableStringify(nextState.gateRule));
  if (gateRuleChanged) {
    delta.gateRule = nextState.gateRule;
  }
  if (gateRuleTimestampsDiffer) {
    delta.gateRuleUpdatedAt = nextState.gateRuleUpdatedAt;
  }
  if (stableStringify(previousState.cardBrowser) !== stableStringify(nextState.cardBrowser)) {
    delta.cardBrowser = nextState.cardBrowser;
  }
  if (stableStringify(previousState.savedCardQueries) !== stableStringify(nextState.savedCardQueries)) {
    delta.savedCardQueries = getChangedItems(previousState.savedCardQueries, nextState.savedCardQueries);
    delta.deletedSavedCardQueryIds = getDeletedIds(previousState.savedCardQueries, nextState.savedCardQueries);
  }
  if (
    stableStringify(previousState.filteredDeckLiteDefinition)
    !== stableStringify(nextState.filteredDeckLiteDefinition)
  ) {
    delta.filteredDeckLiteDefinition = nextState.filteredDeckLiteDefinition;
  }
  if (
    stableStringify(previousState.filteredDeckLiteDefinitions)
    !== stableStringify(nextState.filteredDeckLiteDefinitions)
  ) {
    delta.filteredDeckLiteDefinitions = getChangedItems(
      previousState.filteredDeckLiteDefinitions,
      nextState.filteredDeckLiteDefinitions,
    );
    delta.deletedFilteredDeckLiteDefinitionIds = getDeletedIds(
      previousState.filteredDeckLiteDefinitions,
      nextState.filteredDeckLiteDefinitions,
    );
  }
  if (stableStringify(previousState.filteredDeckLiteRuns) !== stableStringify(nextState.filteredDeckLiteRuns)) {
    delta.filteredDeckLiteRuns = getChangedItems(previousState.filteredDeckLiteRuns, nextState.filteredDeckLiteRuns);
    delta.deletedFilteredDeckLiteRunIds = getDeletedIds(
      previousState.filteredDeckLiteRuns,
      nextState.filteredDeckLiteRuns,
    );
  }

  return delta;
}

function normalizeMutationState(baseState: LearningCloudState, mutation: LearningCloudMutationRecord) {
  const payload = mutation.snapshot || mutation.delta;
  const mergedState = payload ? mergeLearningCloudStates(baseState, payload) : baseState;
  const delta = mutation.delta;

  if (!hasMeaningfulTombstones(delta)) {
    return mergedState;
  }

  return normalizeLearningCloudState({
    ...mergedState,
    decks: delta.deletedDeckIds?.length
      ? Object.fromEntries(Object.values(mergedState.decks).filter((deck) => !delta.deletedDeckIds?.includes(deck.id)).map(d => [d.id, d]))
      : mergedState.decks,
    notes: delta.deletedNoteIds?.length
      ? Object.fromEntries(Object.values(mergedState.notes).filter((note) => !delta.deletedNoteIds?.includes(note.id)).map(n => [n.id, n]))
      : mergedState.notes,
    cards: delta.deletedCardIds?.length
      ? Object.fromEntries(Object.values(mergedState.cards).filter((card) => !delta.deletedCardIds?.includes(card.id)).map(c => [c.id, c]))
      : mergedState.cards,
    reviewLogs: delta.deletedReviewLogIds?.length
      ? Object.fromEntries(Object.values(mergedState.reviewLogs).filter((log) => !delta.deletedReviewLogIds?.includes(log.id)).map(l => [l.id, l]))
      : mergedState.reviewLogs,
    presets: delta.deletedPresetIds?.length
      ? Object.fromEntries(Object.values(mergedState.presets).filter((preset) => !delta.deletedPresetIds?.includes(preset.id)).map(p => [p.id, p]))
      : mergedState.presets,
    savedCardQueries: delta.deletedSavedCardQueryIds?.length
      ? mergedState.savedCardQueries.filter((query) => !delta.deletedSavedCardQueryIds?.includes(query.id))
      : mergedState.savedCardQueries,
    filteredDeckLiteDefinitions: delta.deletedFilteredDeckLiteDefinitionIds?.length
      ? mergedState.filteredDeckLiteDefinitions.filter(
          (definition) => !delta.deletedFilteredDeckLiteDefinitionIds?.includes(definition.id),
        )
      : mergedState.filteredDeckLiteDefinitions,
    filteredDeckLiteRuns: delta.deletedFilteredDeckLiteRunIds?.length
      ? mergedState.filteredDeckLiteRuns.filter(
          (run) => !delta.deletedFilteredDeckLiteRunIds?.includes(run.id),
        )
      : mergedState.filteredDeckLiteRuns,
  });
}

export function mergeLearningStateWithMutations(
  baseState: LearningCloudState,
  mutations: LearningCloudMutationRecord[],
): LearningCloudState {
  return mutations.reduce(
    (state, mutation) => normalizeMutationState(state, mutation),
    baseState,
  );
}

export function applyLearningCloudMutations(
  baseState?: Partial<LearningCloudState> | null,
  mutations: LearningCloudMutationRecord[] = [],
): LearningCloudState {
  return mergeLearningStateWithMutations(
    normalizeLearningCloudState(baseState),
    sortMutationRecords(mutations),
  );
}

interface LearningCloudMutationCompactionOptions {
  keepLatest?: number;
  preserveMutationId?: string | null;
}

async function deleteMutationRecords(
  sdk: FirestoreSdk,
  firestore: Firestore,
  userId: string,
  mutationIds: string[],
): Promise<void> {
  for (let index = 0; index < mutationIds.length; index += MAX_BATCH_WRITES) {
    const batch = sdk.writeBatch(firestore);
    const chunk = mutationIds.slice(index, index + MAX_BATCH_WRITES);

    for (const mutationId of chunk) {
      batch.delete(sdk.doc(getMutationCollectionRef(sdk, firestore, userId), mutationId));
    }

    await batch.commit();
    await waitForPendingChunkWrites(sdk, firestore);
  }
}

export async function compactLearningCloudMutations(
  userId: string,
  options: LearningCloudMutationCompactionOptions = {},
): Promise<{ deletedCount: number; keptMutationIds: string[] }> {
  assertFirebaseWritesEnabled('Learn-Cloud-Schreibzugriffe');
  const sdk = await loadFirestoreSdk();
  const firestore = await ensureFirestore();
  const records = sortMutationRecords(await loadMutationRecords(sdk, firestore, userId));
  const keepLatest = Math.max(1, Math.round(options.keepLatest ?? DEFAULT_MUTATION_RETENTION_COUNT));
  const retainedRecords = records.slice(-keepLatest);
  const keptMutationIds = new Set(retainedRecords.map((record) => record.id));

  if (options.preserveMutationId) {
    const preserved = records.find((record) => record.id === options.preserveMutationId);
    if (preserved) {
      keptMutationIds.add(preserved.id);
    }
  }

  const deletions = records
    .filter((record) => !keptMutationIds.has(record.id))
    .map((record) => record.id);

  await deleteMutationRecords(sdk, firestore, userId, deletions);

  return {
    deletedCount: deletions.length,
    keptMutationIds: Array.from(keptMutationIds),
  };
}

export function buildLearningCloudMutationRecord(
  normalizedNextState: LearningCloudState,
  normalizedPreviousState: LearningCloudState | null,
  deviceId: string,
  baseCursor: LearningCloudSyncCursor | null,
  mutationAt: number,
  options?: { includeSnapshot?: boolean },
): LearningCloudMutationRecord | null {
  const delta = buildLearningCloudMutationDelta(normalizedPreviousState, normalizedNextState);

  if (
    !delta.activeDeckId
    && delta.activeDeckUpdatedAt === undefined
    && !delta.decks
    && !delta.notes
    && !delta.cards
    && !delta.reviewLogs
    && !delta.presets
    && !delta.assignments
    && !delta.gateRule
    && delta.gateRuleUpdatedAt === undefined
    && !delta.cardBrowser
    && !delta.savedCardQueries
    && !delta.filteredDeckLiteDefinition
    && !delta.filteredDeckLiteDefinitions
    && !delta.filteredDeckLiteRuns
    && !hasMeaningfulTombstones(delta)
    && getLearningCloudStateSignature(normalizedNextState) === getLearningCloudStateSignature(normalizedPreviousState)
  ) {
    return null;
  }

  const mutationId = `mutation_${mutationAt}_${Math.random().toString(36).slice(2, 10)}`;
  return {
    id: mutationId,
    deviceId,
    mutationAt,
    baseCursor,
    cursor: {
      mutationId,
      mutationAt,
    },
    delta,
    snapshot: options?.includeSnapshot === false ? undefined : normalizedNextState,
    acknowledgedAt: mutationAt,
  };
}

export function getPersistableLearningCloudMutationRecord(
  mutation: LearningCloudMutationRecord | null,
): LearningCloudMutationRecord | null {
  if (!mutation) {
    return null;
  }

  const sanitizedMutation = sanitizeFirestoreValue({
    ...mutation,
    syncedAt: { __serverTimestamp: true },
  });
  const mutationSizeBytes = getApproximateFirestorePayloadBytes(sanitizedMutation);

  if (mutationSizeBytes <= MAX_MUTATION_DOCUMENT_BYTES) {
    return mutation;
  }

  console.warn(
    `Skipping oversized learning cloud mutation document (${mutationSizeBytes} bytes); relying on snapshot reload instead.`,
  );
  return null;
}

export async function writeLearningCloudMutationAndMeta(
  sdk: FirestoreSdk,
  firestore: Firestore,
  userId: string,
  mutation: LearningCloudMutationRecord | null,
  meta: LearningCloudMeta,
): Promise<void> {
  const batch = sdk.writeBatch(firestore);

  if (mutation) {
    batch.set(
      sdk.doc(getMutationCollectionRef(sdk, firestore, userId), mutation.id),
      sanitizeFirestoreValue({
        ...mutation,
        syncedAt: sdk.serverTimestamp(),
      }),
      { merge: true },
    );
  }

  batch.set(
    getMetaDoc(sdk, firestore, userId),
    sanitizeFirestoreValue({
      ...meta,
      updatedAt: sdk.serverTimestamp(),
    }),
    { merge: true },
  );

  await batch.commit();
  await waitForPendingChunkWrites(sdk, firestore);
}

export async function pullLearningCloudMutations(
  userId: string,
  afterCursor?: LearningCloudSyncCursor | null,
  options?: LearningCloudReadOptions,
): Promise<{ cursor: LearningCloudSyncCursor | null; mutations: LearningCloudMutationRecord[] }> {
  const sdk = await loadFirestoreSdk();
  const firestore = await ensureFirestore();
  const mutations = await loadMutationRecords(sdk, firestore, userId, afterCursor, options);
  return {
    cursor: mutations.at(-1)?.cursor || normalizeSyncCursor(afterCursor) || null,
    mutations,
  };
}

export async function pushLearningCloudMutation(
  userId: string,
  nextState: LearningCloudState,
  previousState: LearningCloudState | null,
  deviceId: string,
): Promise<LearningCloudMutationRecord | null> {
  assertFirebaseWritesEnabled('Learn-Cloud-Schreibzugriffe');
  const normalizedNextState = normalizeLearningCloudState(nextState);
  const normalizedPreviousState = previousState ? normalizeLearningCloudState(previousState) : null;
  const sdk = await loadFirestoreSdk();
  const firestore = await ensureFirestore();
  const baseCursor = await loadLearningCloudSyncCursorWithSdk(sdk, firestore, userId);
  const now = Date.now();
  const mutation = buildLearningCloudMutationRecord(
    normalizedNextState,
    normalizedPreviousState,
    deviceId,
    baseCursor,
    now,
    { includeSnapshot: false },
  );
  const persistedMutation = getPersistableLearningCloudMutationRecord(mutation);

  if (!mutation) {
    return null;
  }

  await writeLearningCloudMutationAndMeta(
    sdk,
    firestore,
    userId,
    persistedMutation,
    {
      schemaVersion: 2,
      snapshotCursor: baseCursor || undefined,
      mutationCursor: mutation.cursor,
      updatedByDeviceId: deviceId,
      clientUpdatedAt: now,
      lastMutationId: mutation.id,
      lastMutationAt: mutation.mutationAt,
    },
  );

  try {
    await compactLearningCloudMutations(userId, {
      keepLatest: DEFAULT_MUTATION_RETENTION_COUNT,
      preserveMutationId: mutation.id,
    });
  } catch (error) {
    console.warn('Learning cloud mutation compaction failed:', error);
  }

  return mutation;
}
