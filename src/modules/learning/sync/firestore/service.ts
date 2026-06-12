import { assertFirebaseWritesEnabled } from '@/lib/firebase';
import {
  getLearningCloudStateSignature,
  isLearningCloudStateEmpty,
  normalizeLearningCloudState,
  type LearningCloudState,
} from '@/lib/learningCloudSync';
import {
  getCardRevision,
  getDeckRevision,
  getNoteRevision,
  getPresetRevision,
  getReviewLogRevision,
} from '@/modules/learning/sync/learningSyncMappers';
import {
  compareSyncCursors,
  createSyntheticLearningCloudCursor,
  normalizeSyncCursor,
} from './cursors';
import {
  commitEntityChunks,
  deleteEntityChunks,
  getChangedItems,
  getDeletedIds,
  getDeletedIdsFromTombstones,
  getTimestampChangedItems,
  loadCollection,
  loadEntityCollectionWithBucketFallback,
  saveBucketedEntityChunks,
} from './entities';
import {
  loadLearningCloudMetaWithSdk,
  normalizeLearningCloudMeta,
  loadLearningCloudSyncCursorWithSdk,
} from './metadata';
import {
  buildLearningCloudMutationRecord,
  getPersistableLearningCloudMutationRecord,
  loadMutationRecords,
  mergeLearningStateWithMutations,
  writeLearningCloudMutationAndMeta,
} from './mutations';
import {
  ensureFirestore,
  getMetaDoc,
  loadFirestoreSdk,
} from './transport';
import type {
  LearningCloudMeta,
  LearningCloudReadOptions,
  LearningCloudSaveOptions,
} from './types';
import {
  getLearningCloudEntityCount,
  stableStringify,
} from './utils';

const inFlightLearningCloudSavePromises = new Map<string, Promise<LearningCloudMeta>>();
const inFlightLearningCloudSaveKeys = new Map<string, string>();

export async function loadLearningCloudState(
  userId: string,
  options?: LearningCloudReadOptions,
): Promise<LearningCloudState | null> {
  const sdk = await loadFirestoreSdk();
  const firestore = await ensureFirestore();
  const metaRef = getMetaDoc(sdk, firestore, userId);
  const [metaSnapshot, decks, notes, cards, reviewLogs, presets, mutations] = await Promise.all([
    options?.source === 'server' && typeof sdk.getDocFromServer === 'function'
      ? sdk.getDocFromServer(metaRef).catch(() => sdk.getDoc(metaRef))
      : sdk.getDoc(metaRef),
    loadCollection<LearningCloudState['decks'][number]>(sdk, firestore, userId, 'decks', options),
    loadEntityCollectionWithBucketFallback<LearningCloudState['notes'][number]>(sdk, firestore, userId, 'notes', options),
    loadEntityCollectionWithBucketFallback<LearningCloudState['cards'][number]>(sdk, firestore, userId, 'cards', options),
    loadCollection<LearningCloudState['reviewLogs'][number]>(sdk, firestore, userId, 'reviewLogs', options),
    loadCollection<LearningCloudState['presets'][number]>(sdk, firestore, userId, 'presets', options),
    loadMutationRecords(sdk, firestore, userId, undefined, options),
  ]);

  const meta = metaSnapshot.exists()
    ? normalizeLearningCloudMeta(metaSnapshot.data() as LearningCloudMeta)
    : null;
  const snapshotState = normalizeLearningCloudState({
    activeDeckId: meta?.activeDeckId,
    activeDeckUpdatedAt: meta?.activeDeckUpdatedAt,
    decks: Object.fromEntries(decks.map(d => [d.id, d])),
    notes: Object.fromEntries(notes.map(n => [n.id, n])),
    cards: Object.fromEntries(cards.map(c => [c.id, c])),
    reviewLogs: Object.fromEntries(reviewLogs.map(l => [l.id, l])),
    presets: Object.fromEntries(presets.map(p => [p.id, p])),
    assignments: meta?.assignments,
    gateRule: meta?.gateRule,
    gateRuleUpdatedAt: meta?.gateRuleUpdatedAt,
    cardBrowser: meta?.cardBrowser,
    savedCardQueries: meta?.savedCardQueries,
    filteredDeckLiteDefinition: meta?.filteredDeckLiteDefinition,
    filteredDeckLiteDefinitions: meta?.filteredDeckLiteDefinitions,
    filteredDeckLiteRuns: meta?.filteredDeckLiteRuns,
  });
  const snapshotCursor = normalizeSyncCursor(meta?.snapshotCursor)
    || normalizeSyncCursor(meta?.mutationCursor)
    || normalizeSyncCursor({
      mutationId: meta?.lastMutationId || '',
      mutationAt: meta?.lastMutationAt || meta?.clientUpdatedAt,
    });
  const pulledMutations = snapshotCursor
    ? mutations.filter((mutation) => compareSyncCursors(mutation.cursor, snapshotCursor) > 0)
    : mutations;
  const mergedState = mergeLearningStateWithMutations(snapshotState, pulledMutations);

  if (!meta && isLearningCloudStateEmpty(mergedState)) {
    return null;
  }

  return mergedState;
}

export async function saveLearningCloudState(
  userId: string,
  nextState: LearningCloudState,
  previousState: LearningCloudState | null,
  deviceId: string,
  options?: LearningCloudSaveOptions,
): Promise<LearningCloudMeta> {
  assertFirebaseWritesEnabled('Learn-Cloud-Schreibzugriffe');
  const normalizedNextState = normalizeLearningCloudState(nextState);
  const normalizedPreviousState = previousState
    ? normalizeLearningCloudState(previousState)
    : null;
  const localSyncState = options?.localSyncState || null;
  const nextSignature = getLearningCloudStateSignature(normalizedNextState);
  const previousSignature = getLearningCloudStateSignature(normalizedPreviousState);
  const saveKey = JSON.stringify({
    deviceId,
    localSyncState: stableStringify(localSyncState),
    nextSignature,
    previousSignature,
    userId,
  });
  const existingSavePromise = inFlightLearningCloudSavePromises.get(userId);
  if (existingSavePromise && inFlightLearningCloudSaveKeys.get(userId) === saveKey) {
    return existingSavePromise;
  }

  const savePromise = (async () => {
    if (existingSavePromise) {
      try {
        await existingSavePromise;
      } catch {
        // Follow-up saves should still proceed after an earlier failure.
      }
    }

    const sdk = await loadFirestoreSdk();
    const firestore = await ensureFirestore();
    const now = Date.now();
    const currentMeta = await loadLearningCloudMetaWithSdk(sdk, firestore, userId);
    const localSyncSince = Number.isFinite(localSyncState?.lastSuccessfulSyncAt)
      ? Math.max(0, Math.round(localSyncState?.lastSuccessfulSyncAt as number))
      : null;
    const canUseLocalEntitySelection = Boolean(
      localSyncSince !== null
      && (
        normalizedPreviousState
        || currentMeta?.snapshotCursor
        || currentMeta?.mutationCursor
        || currentMeta?.lastMutationId
      ),
    );
    const changedDecks = canUseLocalEntitySelection && localSyncSince !== null
      ? getTimestampChangedItems(Object.values(normalizedNextState.decks), localSyncSince, getDeckRevision)
      : getChangedItems(Object.values(normalizedPreviousState?.decks || {}), Object.values(normalizedNextState.decks));
    const changedNotes = canUseLocalEntitySelection && localSyncSince !== null
      ? getTimestampChangedItems(Object.values(normalizedNextState.notes), localSyncSince, getNoteRevision)
      : getChangedItems(Object.values(normalizedPreviousState?.notes || {}), Object.values(normalizedNextState.notes));
    const changedCards = canUseLocalEntitySelection && localSyncSince !== null
      ? getTimestampChangedItems(Object.values(normalizedNextState.cards), localSyncSince, getCardRevision)
      : getChangedItems(Object.values(normalizedPreviousState?.cards || {}), Object.values(normalizedNextState.cards));
    const changedReviewLogs = canUseLocalEntitySelection && localSyncSince !== null
      ? getTimestampChangedItems(Object.values(normalizedNextState.reviewLogs), localSyncSince, getReviewLogRevision)
      : getChangedItems(Object.values(normalizedPreviousState?.reviewLogs || {}), Object.values(normalizedNextState.reviewLogs));
    const changedPresets = canUseLocalEntitySelection && localSyncSince !== null
      ? getTimestampChangedItems(Object.values(normalizedNextState.presets), localSyncSince, getPresetRevision)
      : getChangedItems(Object.values(normalizedPreviousState?.presets || {}), Object.values(normalizedNextState.presets));
    const deletedDeckIds = canUseLocalEntitySelection && localSyncSince !== null
      ? getDeletedIdsFromTombstones(localSyncState?.deletedDecks || [], localSyncSince)
      : getDeletedIds(Object.values(normalizedPreviousState?.decks || {}), Object.values(normalizedNextState.decks));
    const deletedNoteIds = canUseLocalEntitySelection && localSyncSince !== null
      ? getDeletedIdsFromTombstones(localSyncState?.deletedNotes || [], localSyncSince)
      : getDeletedIds(Object.values(normalizedPreviousState?.notes || {}), Object.values(normalizedNextState.notes));
    const deletedCardIds = canUseLocalEntitySelection && localSyncSince !== null
      ? getDeletedIdsFromTombstones(localSyncState?.deletedCards || [], localSyncSince)
      : getDeletedIds(Object.values(normalizedPreviousState?.cards || {}), Object.values(normalizedNextState.cards));
    const deletedReviewLogIds = canUseLocalEntitySelection && localSyncSince !== null
      ? getDeletedIdsFromTombstones(localSyncState?.deletedReviewLogs || [], localSyncSince)
      : getDeletedIds(Object.values(normalizedPreviousState?.reviewLogs || {}), Object.values(normalizedNextState.reviewLogs));
    const deletedPresetIds = canUseLocalEntitySelection && localSyncSince !== null
      ? getDeletedIdsFromTombstones(localSyncState?.deletedPresets || [], localSyncSince)
      : getDeletedIds(Object.values(normalizedPreviousState?.presets || {}), Object.values(normalizedNextState.presets));
    const affectedNoteEntityIds = Array.from(
      new Set([...changedNotes.map((note) => note.id), ...deletedNoteIds]),
    );
    const affectedCardEntityIds = Array.from(
      new Set([...changedCards.map((card) => card.id), ...deletedCardIds]),
    );
    const snapshotCursor = normalizeSyncCursor(currentMeta?.snapshotCursor)
      || normalizeSyncCursor(currentMeta?.mutationCursor)
      || null;
    const baseCursor = await loadLearningCloudSyncCursorWithSdk(sdk, firestore, userId);
    const mutation = buildLearningCloudMutationRecord(
      normalizedNextState,
      normalizedPreviousState,
      deviceId,
      baseCursor,
      now,
      { includeSnapshot: false },
    );
    const persistedMutation = mutation ? getPersistableLearningCloudMutationRecord(mutation) : null;
    const effectiveCursor = mutation?.cursor || createSyntheticLearningCloudCursor(now);
    const canUseMutationOnlySave = Boolean(
      normalizedPreviousState
      && persistedMutation
      && snapshotCursor,
    );

    if (!persistedMutation && mutation) {
      console.warn(
        `Skipping oversized learning cloud delta mutation for state (${getLearningCloudEntityCount(normalizedNextState)} entities, ${Object.keys(normalizedNextState.reviewLogs).length} review logs); falling back to snapshot writes.`,
      );
    }

    if (!canUseMutationOnlySave) {
      await commitEntityChunks(sdk, firestore, userId, 'decks', changedDecks, deviceId);
      await saveBucketedEntityChunks(
        sdk,
        firestore,
        userId,
        'noteBuckets',
        Object.values(normalizedNextState.notes),
        Object.values(normalizedPreviousState?.notes || {}),
        deviceId,
        canUseLocalEntitySelection
          ? {
              affectedEntityIds: affectedNoteEntityIds,
              forceRewriteAffectedBuckets: deletedNoteIds.length > 0,
            }
          : undefined,
      );
      await saveBucketedEntityChunks(
        sdk,
        firestore,
        userId,
        'cardBuckets',
        Object.values(normalizedNextState.cards),
        Object.values(normalizedPreviousState?.cards || {}),
        deviceId,
        canUseLocalEntitySelection
          ? {
              affectedEntityIds: affectedCardEntityIds,
              forceRewriteAffectedBuckets: deletedCardIds.length > 0,
            }
          : undefined,
      );
      await commitEntityChunks(sdk, firestore, userId, 'reviewLogs', changedReviewLogs, deviceId);
      await commitEntityChunks(sdk, firestore, userId, 'presets', changedPresets, deviceId);
      await deleteEntityChunks(sdk, firestore, userId, 'cards', deletedCardIds);
      await deleteEntityChunks(sdk, firestore, userId, 'notes', deletedNoteIds);
      await deleteEntityChunks(sdk, firestore, userId, 'reviewLogs', deletedReviewLogIds);
      await deleteEntityChunks(sdk, firestore, userId, 'decks', deletedDeckIds);
      await deleteEntityChunks(sdk, firestore, userId, 'presets', deletedPresetIds);
    }

    const meta: LearningCloudMeta = {
      schemaVersion: 2,
      activeDeckId: normalizedNextState.activeDeckId,
      activeDeckUpdatedAt: normalizedNextState.activeDeckUpdatedAt,
      assignments: normalizedNextState.assignments,
      gateRule: normalizedNextState.gateRule,
      gateRuleUpdatedAt: normalizedNextState.gateRuleUpdatedAt,
      cardBrowser: normalizedNextState.cardBrowser,
      savedCardQueries: normalizedNextState.savedCardQueries,
      filteredDeckLiteDefinition: normalizedNextState.filteredDeckLiteDefinition,
      filteredDeckLiteDefinitions: normalizedNextState.filteredDeckLiteDefinitions,
      filteredDeckLiteRuns: normalizedNextState.filteredDeckLiteRuns,
      snapshotCursor: canUseMutationOnlySave ? (snapshotCursor || undefined) : effectiveCursor,
      mutationCursor: effectiveCursor,
      mutationCount: persistedMutation ? 1 : 0,
      updatedByDeviceId: deviceId,
      clientUpdatedAt: now,
      lastMutationId: effectiveCursor.mutationId,
      lastMutationAt: effectiveCursor.mutationAt,
      deckCount: normalizedNextState.decks.length,
      noteCount: normalizedNextState.notes.length,
      cardCount: normalizedNextState.cards.length,
      reviewLogCount: normalizedNextState.reviewLogs.length,
      presetCount: normalizedNextState.presets.length,
    };

    await writeLearningCloudMutationAndMeta(sdk, firestore, userId, persistedMutation, meta);

    return meta;
  })();

  inFlightLearningCloudSavePromises.set(userId, savePromise);
  inFlightLearningCloudSaveKeys.set(userId, saveKey);

  try {
    return await savePromise;
  } finally {
    if (inFlightLearningCloudSavePromises.get(userId) === savePromise) {
      inFlightLearningCloudSavePromises.delete(userId);
      inFlightLearningCloudSaveKeys.delete(userId);
    }
  }
}
