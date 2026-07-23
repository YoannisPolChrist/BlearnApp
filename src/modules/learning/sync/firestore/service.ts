import { assertFirebaseWritesEnabled } from '@/lib/firebase';
import {
  getLearningCloudStateSignature,
  getLearningCloudEntitySignature,
  isLearningCloudStateEmpty,
  mergeLearningCloudStates,
  normalizeLearningCloudState,
  withLearningCloudDeletionTombstones,
  type LearningCloudState,
} from '@/lib/learningCloudSync';
import {
  createSyntheticLearningCloudCursor,
  normalizeSyncCursor,
} from './cursors';
import {
  archiveEntityChunks,
  commitEntityChunks,
  deleteEntityChunks,
  getChangedItems,
  getDeletedIds,
  getDeletedIdsFromTombstones,
  loadCollection,
  loadEntitiesWithMigrationFallback,
} from './entities';
import {
  loadLearningCloudMetaWithSdk,
  normalizeLearningCloudMeta,
} from './metadata';
import {
  buildLearningCloudMutationRecord,
  getPersistableLearningCloudMutationRecord,
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

function getRecoverableDeletedEntities<T extends { id: string }>(
  ids: string[],
  ...sources: Array<Record<string, T> | undefined | null>
): T[] {
  const entitiesById = new Map<string, T>();
  for (const source of sources) {
    if (!source) continue;
    for (const entity of Object.values(source)) {
      if (!entitiesById.has(entity.id)) {
        entitiesById.set(entity.id, entity);
      }
    }
  }

  return ids.flatMap((id) => {
    const entity = entitiesById.get(id);
    return entity ? [entity] : [];
  });
}

export async function loadLearningCloudState(
  userId: string,
  options?: LearningCloudReadOptions,
): Promise<LearningCloudState | null> {
  const sdk = await loadFirestoreSdk();
  const firestore = await ensureFirestore();
  const metaRef = getMetaDoc(sdk, firestore, userId);

  // Load the root metadata and deck list first. The metadata tells us whether
  // an old account can still contain deck-scoped compatibility data.
  const [metaSnapshot, decks] = await Promise.all([
    options?.source === 'server' && typeof sdk.getDocFromServer === 'function'
      ? sdk.getDocFromServer(metaRef).catch(() => sdk.getDoc(metaRef))
      : sdk.getDoc(metaRef),
    loadCollection<LearningCloudState['decks'][number]>(sdk, firestore, userId, 'decks', options),
  ]);
  const meta = metaSnapshot.exists()
    ? normalizeLearningCloudMeta(metaSnapshot.data() as LearningCloudMeta)
    : null;
  const deckIds = decks.map((d) => d.id);
  const readDeckScopedCompatibilityData = meta?.deckScopedMigrationCompleted === true;

  // Entity documents plus the metadata document are the complete Firestore
  // snapshot. Mutation records are an optimization/audit trail, never a
  // required reconstruction source for a device returning after compaction.
  const [notes, cards, reviewLogs, presets] = await Promise.all([
    loadEntitiesWithMigrationFallback<LearningCloudState['notes'][number]>(
      sdk, firestore, userId, deckIds, 'notes', 'notes', options, readDeckScopedCompatibilityData,
    ),
    loadEntitiesWithMigrationFallback<LearningCloudState['cards'][number]>(
      sdk, firestore, userId, deckIds, 'cards', 'cards', options, readDeckScopedCompatibilityData,
    ),
    loadEntitiesWithMigrationFallback<LearningCloudState['reviewLogs'][number]>(
      sdk, firestore, userId, deckIds, 'reviewLogs', 'reviewLogs', options, readDeckScopedCompatibilityData,
    ),
    loadCollection<LearningCloudState['presets'][number]>(sdk, firestore, userId, 'presets', options),
  ]);

  const snapshotState = normalizeLearningCloudState({
    activeDeckId: meta?.activeDeckId,
    activeDeckUpdatedAt: meta?.activeDeckUpdatedAt,
    decks,
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
    entityTombstones: meta?.entityTombstones,
  });
  const mergedState = snapshotState;

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
  const normalizedNextState = withLearningCloudDeletionTombstones(
    previousState ? normalizeLearningCloudState(previousState) : null,
    normalizeLearningCloudState(nextState),
    Date.now(),
  );
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
    const currentMeta = await loadLearningCloudMetaWithSdk(sdk, firestore, userId, { source: 'server' });
    let authoritativeRemoteState: LearningCloudState | null = null;
    if (currentMeta) {
      const remoteCursor = normalizeSyncCursor(currentMeta.snapshotCursor)
        || normalizeSyncCursor(currentMeta.mutationCursor)
        || normalizeSyncCursor({
          mutationId: currentMeta.lastMutationId || '',
          mutationAt: currentMeta.lastMutationAt || currentMeta.clientUpdatedAt,
        });
      // Firestore entity documents form the durable source of truth. A local
      // cursor can predate compacted mutations, so a mutation suffix is never
      // sufficient evidence for resolving a concurrent save.
      authoritativeRemoteState = await loadLearningCloudState(userId, { source: 'server' });
    }

    const authoritativeState = authoritativeRemoteState
      ? normalizeLearningCloudState(authoritativeRemoteState)
      : normalizedPreviousState;
    const resolvedNextState = mergeLearningCloudStates(normalizedNextState, authoritativeState);

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
    const changedDecks = getChangedItems(Object.values(authoritativeState?.decks || {}), Object.values(resolvedNextState.decks));
    const changedNotes = getChangedItems(Object.values(authoritativeState?.notes || {}), Object.values(resolvedNextState.notes));
    const changedCards = getChangedItems(Object.values(authoritativeState?.cards || {}), Object.values(resolvedNextState.cards));
    const changedReviewLogs = getChangedItems(Object.values(authoritativeState?.reviewLogs || {}), Object.values(resolvedNextState.reviewLogs));
    const changedPresets = getChangedItems(Object.values(authoritativeState?.presets || {}), Object.values(resolvedNextState.presets));
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
    const archivedDecks = getRecoverableDeletedEntities(
      deletedDeckIds,
      authoritativeState?.decks,
      normalizedPreviousState?.decks,
    );
    const archivedNotes = getRecoverableDeletedEntities(
      deletedNoteIds,
      authoritativeState?.notes,
      normalizedPreviousState?.notes,
    );
    const archivedCards = getRecoverableDeletedEntities(
      deletedCardIds,
      authoritativeState?.cards,
      normalizedPreviousState?.cards,
    );
    const archivedReviewLogs = getRecoverableDeletedEntities(
      deletedReviewLogIds,
      authoritativeState?.reviewLogs,
      normalizedPreviousState?.reviewLogs,
    );
    const archivedPresets = getRecoverableDeletedEntities(
      deletedPresetIds,
      authoritativeState?.presets,
      normalizedPreviousState?.presets,
    );
    const snapshotCursor = normalizeSyncCursor(currentMeta?.snapshotCursor)
      || normalizeSyncCursor(currentMeta?.mutationCursor)
      || null;
    const baseCursor = currentMeta
      ? (normalizeSyncCursor(currentMeta.snapshotCursor)
        || normalizeSyncCursor(currentMeta.mutationCursor)
        || normalizeSyncCursor({
          mutationId: currentMeta.lastMutationId || '',
          mutationAt: currentMeta.lastMutationAt || currentMeta.clientUpdatedAt,
        }))
      : null;
    const mutation = buildLearningCloudMutationRecord(
      resolvedNextState,
      authoritativeState,
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

    // Entity documents are the durable source of truth. Keep notes, cards and
    // review logs in the established complete collections until a future
    // migration can prove a full copy before switching readers. The earlier
    // deck-scoped writer marked partial copies as complete and stranded cards
    // without their notes.
    {
      await commitEntityChunks(sdk, firestore, userId, 'decks', changedDecks, deviceId);
      await commitEntityChunks(sdk, firestore, userId, 'notes', changedNotes, deviceId);
      await commitEntityChunks(sdk, firestore, userId, 'cards', changedCards, deviceId);
      await commitEntityChunks(sdk, firestore, userId, 'reviewLogs', changedReviewLogs, deviceId);
      await commitEntityChunks(sdk, firestore, userId, 'presets', changedPresets, deviceId);

      // Never remove a cloud entity unless the exact payload has first been
      // copied to the user's archive. A stale tombstone without its payload is
      // deliberately a no-op: preserving another device's data is safer than
      // irreversible deletion.
      await archiveEntityChunks(sdk, firestore, userId, 'notes', archivedNotes, deviceId, now);
      await archiveEntityChunks(sdk, firestore, userId, 'cards', archivedCards, deviceId, now);
      await archiveEntityChunks(sdk, firestore, userId, 'reviewLogs', archivedReviewLogs, deviceId, now);
      await archiveEntityChunks(sdk, firestore, userId, 'decks', archivedDecks, deviceId, now);
      await archiveEntityChunks(sdk, firestore, userId, 'presets', archivedPresets, deviceId, now);

      await deleteEntityChunks(sdk, firestore, userId, 'notes', archivedNotes.map((entity) => entity.id));
      await deleteEntityChunks(sdk, firestore, userId, 'cards', archivedCards.map((entity) => entity.id));
      await deleteEntityChunks(sdk, firestore, userId, 'reviewLogs', archivedReviewLogs.map((entity) => entity.id));
      await deleteEntityChunks(sdk, firestore, userId, 'decks', archivedDecks.map((entity) => entity.id));
      await deleteEntityChunks(sdk, firestore, userId, 'presets', archivedPresets.map((entity) => entity.id));
    }

    const meta: LearningCloudMeta = {
      schemaVersion: 2,
      activeDeckId: resolvedNextState.activeDeckId,
      activeDeckUpdatedAt: resolvedNextState.activeDeckUpdatedAt,
      assignments: resolvedNextState.assignments,
      gateRule: resolvedNextState.gateRule,
      gateRuleUpdatedAt: resolvedNextState.gateRuleUpdatedAt,
      cardBrowser: resolvedNextState.cardBrowser,
      savedCardQueries: resolvedNextState.savedCardQueries,
      filteredDeckLiteDefinition: resolvedNextState.filteredDeckLiteDefinition,
      filteredDeckLiteDefinitions: resolvedNextState.filteredDeckLiteDefinitions,
      filteredDeckLiteRuns: resolvedNextState.filteredDeckLiteRuns,
      entityTombstones: resolvedNextState.entityTombstones,
      // Every save commits the changed entity documents before this metadata
      // batch. Advancing the snapshot cursor keeps the metadata honest: it
      // always points at a complete Firestore entity snapshot, not a partial
      // mutation window that an older device may no longer be able to replay.
      snapshotCursor: effectiveCursor,
      mutationCursor: effectiveCursor,
      mutationCount: persistedMutation ? 1 : 0,
      updatedByDeviceId: deviceId,
      clientUpdatedAt: now,
      lastMutationId: effectiveCursor.mutationId,
      lastMutationAt: effectiveCursor.mutationAt,
      deckCount: Object.keys(resolvedNextState.decks).length,
      noteCount: Object.keys(resolvedNextState.notes).length,
      cardCount: Object.keys(resolvedNextState.cards).length,
      reviewLogCount: Object.keys(resolvedNextState.reviewLogs).length,
      presetCount: Object.keys(resolvedNextState.presets).length,
      entitySignature: getLearningCloudEntitySignature(resolvedNextState),
      // A historic account may have unique cards only in the old deck-scoped
      // collections. Do not turn off its compatibility reader during an
      // unrelated review save; that would make those cards disappear on the
      // next load. A future explicit migration may flip this only after it
      // has proven and copied the complete legacy data set.
      deckScopedMigrationCompleted: currentMeta?.deckScopedMigrationCompleted === true,
    };

    await writeLearningCloudMutationAndMeta(sdk, firestore, userId, persistedMutation, meta);

    return { ...meta, resolvedState: resolvedNextState };
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
