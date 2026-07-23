import type { DocumentData, Firestore } from 'firebase/firestore';
import type { LearningCloudTombstone } from '@/lib/learningCloudLocalSyncState';
import {
  BUCKETED_ENTITY_DOCUMENT_COUNT,
  MAX_BATCH_PAYLOAD_BYTES,
  MAX_BATCH_WRITES,
  MAX_PARALLEL_BATCH_COMMITS,
  type BucketedSyncCollectionKey,
  type DeckScopedSyncCollectionKey,
  type SyncCollectionKey,
} from './constants';
import {
  getCollectionRef,
  getDeckScopedCollectionRef,
  waitForInterBatchCommitDelay,
  waitForPendingChunkWrites,
} from './transport';
import type { FirestoreSdk, LearningCloudReadOptions } from './types';
import {
  getApproximateFirestorePayloadBytes,
  runWithConcurrencyLimit,
  sanitizeFirestoreValue,
  stableStringify,
} from './utils';

interface BucketedLearningEntities<T extends { id: string }> {
  id: string;
  items: T[];
}

export function stripSyncMetadata<T>(data: DocumentData): T {
  const {
    syncedAt: _syncedAt,
    syncedByDeviceId: _syncedByDeviceId,
    ...payload
  } = data;
  return payload as T;
}

export async function loadCollection<T>(
  sdk: FirestoreSdk,
  firestore: Firestore,
  userId: string,
  key: SyncCollectionKey,
  options?: LearningCloudReadOptions,
): Promise<T[]> {
  const query = getCollectionRef(sdk, firestore, userId, key);
  const snapshot = options?.source === 'server' && typeof sdk.getDocsFromServer === 'function'
    ? await sdk.getDocsFromServer(query).catch(() => sdk.getDocs(query))
    : await sdk.getDocs(query);
  return snapshot.docs.map((entry) => stripSyncMetadata<T>(entry.data()));
}

function getItemSignature(item: { id: string } & Record<string, unknown>) {
  let maxRevision = 0;
  if (typeof item.updatedAt === 'number') maxRevision = Math.max(maxRevision, item.updatedAt);
  if (typeof item.lastReviewedAt === 'number') maxRevision = Math.max(maxRevision, item.lastReviewedAt);
  if (typeof item.dueAt === 'number') maxRevision = Math.max(maxRevision, item.dueAt);
  if (typeof item.createdAt === 'number') maxRevision = Math.max(maxRevision, item.createdAt);
  if (typeof item.reviewedAt === 'number') maxRevision = Math.max(maxRevision, item.reviewedAt);
  if (typeof item.lastOptimizerReviewCount === 'number') maxRevision = Math.max(maxRevision, item.lastOptimizerReviewCount);
  if (typeof item.lastOptimizerReviewCount === 'number') maxRevision = Math.max(maxRevision, item.lastOptimizerReviewCount);

  if (maxRevision > 0) {
    return `${item.id}:${maxRevision}`;
  }

  return stableStringify(item);
}

function getBucketedCollectionPrefix(key: BucketedSyncCollectionKey) {
  return key === 'noteBuckets' ? 'note_bucket' : 'card_bucket';
}

function getBucketedEntityDocumentId(
  key: BucketedSyncCollectionKey,
  entityId: string,
) {
  let hash = 0;
  for (let index = 0; index < entityId.length; index += 1) {
    hash = Math.imul(hash, 31) + entityId.charCodeAt(index);
    hash |= 0;
  }

  const bucketIndex = Math.abs(hash) % BUCKETED_ENTITY_DOCUMENT_COUNT;
  return `${getBucketedCollectionPrefix(key)}_${bucketIndex.toString().padStart(2, '0')}`;
}

function buildBucketedLearningEntities<T extends { id: string }>(
  key: BucketedSyncCollectionKey,
  items: T[],
): Array<BucketedLearningEntities<T>> {
  const buckets = new Map<string, T[]>();

  for (const item of items) {
    const bucketId = getBucketedEntityDocumentId(key, item.id);
    const bucketItems = buckets.get(bucketId);
    if (bucketItems) {
      bucketItems.push(item);
      continue;
    }

    buckets.set(bucketId, [item]);
  }

  return Array.from(buckets.entries())
    .sort(([leftId], [rightId]) => leftId.localeCompare(rightId))
    .map(([bucketId, bucketItems]) => ({
      id: bucketId,
      items: [...bucketItems].sort((left, right) => left.id.localeCompare(right.id)),
    }));
}

async function loadBucketedCollection<T extends { id: string }>(
  sdk: FirestoreSdk,
  firestore: Firestore,
  userId: string,
  key: BucketedSyncCollectionKey,
  options?: LearningCloudReadOptions,
): Promise<T[]> {
  const buckets = await loadCollection<BucketedLearningEntities<T>>(sdk, firestore, userId, key, options);
  return buckets.flatMap((bucket) => (
    Array.isArray(bucket.items)
      ? bucket.items.filter((item): item is T => Boolean(item?.id))
      : []
  ));
}

export async function loadEntityCollectionWithBucketFallback<T extends { id: string }>(
  sdk: FirestoreSdk,
  firestore: Firestore,
  userId: string,
  key: 'notes' | 'cards',
  options?: LearningCloudReadOptions,
): Promise<T[]> {
  const bucketKey: BucketedSyncCollectionKey = key === 'notes' ? 'noteBuckets' : 'cardBuckets';
  const bucketedItems = await loadBucketedCollection<T>(sdk, firestore, userId, bucketKey, options);
  if (bucketedItems.length > 0) {
    return bucketedItems;
  }

  return loadCollection<T>(sdk, firestore, userId, key, options);
}

// ---------------------------------------------------------------------------
// Deck-scoped subcollection operations (new format)
// ---------------------------------------------------------------------------

/**
 * Load all individual documents from a single deck's subcollection:
 *   users/{uid}/learningDecks/{deckId}/{subcollection}/{docId}
 */
export async function loadDeckScopedCollection<T extends { id: string }>(
  sdk: FirestoreSdk,
  firestore: Firestore,
  userId: string,
  deckId: string,
  subcollectionKey: DeckScopedSyncCollectionKey,
  options?: LearningCloudReadOptions,
): Promise<T[]> {
  const query = getDeckScopedCollectionRef(sdk, firestore, userId, deckId, subcollectionKey);
  const snapshot = options?.source === 'server' && typeof sdk.getDocsFromServer === 'function'
    ? await sdk.getDocsFromServer(query).catch(() => sdk.getDocs(query))
    : await sdk.getDocs(query);
  // Skip the "meta" doc if present in a cards/notes/reviewLogs subcollection
  // (shouldn't happen, but be defensive).
  return snapshot.docs
    .filter((entry) => entry.id !== 'meta')
    .map((entry) => stripSyncMetadata<T>(entry.data()));
}

/**
 * Load entities from all deck subcollections in parallel.
 * If all deck subcollections are empty (first sync with old-format data),
 * returns an empty array so the caller can fall back to the old bucket read.
 */
export async function loadAllDeckScopedEntities<T extends { id: string }>(
  sdk: FirestoreSdk,
  firestore: Firestore,
  userId: string,
  deckIds: string[],
  subcollectionKey: DeckScopedSyncCollectionKey,
  options?: LearningCloudReadOptions,
): Promise<T[]> {
  if (deckIds.length === 0) {
    return [];
  }

  const results = await Promise.all(
    deckIds.map((deckId) =>
      loadDeckScopedCollection<T>(sdk, firestore, userId, deckId, subcollectionKey, options),
    ),
  );

  return results.flat();
}

/**
 * Load entities with automatic migration fallback:
 * 1. Try deck-scoped subcollections (new format)
 * 2. Load the legacy bucket/flat format as well while the migration is
 *    incomplete.
 * 3. Merge by id so a partially-written new-format collection can never hide
 *    legacy notes, cards, or review logs.
 */
export async function loadEntitiesWithMigrationFallback<T extends { id: string }>(
  sdk: FirestoreSdk,
  firestore: Firestore,
  userId: string,
  deckIds: string[],
  subcollectionKey: DeckScopedSyncCollectionKey,
  oldFormatKey: 'notes' | 'cards' | 'reviewLogs',
  options?: LearningCloudReadOptions,
  readDeckScopedCompatibilityData = true,
): Promise<T[]> {
  // The repaired writer stores entities in the established complete
  // collections. Only old accounts explicitly marked as migrated need this
  // additional compatibility read; otherwise reading every deck subcollection
  // would multiply Firestore document reads for no benefit.
  const deckScopedItems = readDeckScopedCompatibilityData
    ? await loadAllDeckScopedEntities<T>(
        sdk,
        firestore,
        userId,
        deckIds,
        subcollectionKey,
        options,
      )
    : [];

  // The deck-scoped migration was released before all existing cloud data had
  // been copied. Reading only whichever format happens to be non-empty turns a
  // partial copy into lost cards or notes. Always read the durable legacy
  // source during the transition, then let a newer scoped document override an
  // item with the same id.
  let legacyItems: T[];
  if (oldFormatKey === 'notes' || oldFormatKey === 'cards') {
    legacyItems = await loadEntityCollectionWithBucketFallback<T>(
      sdk,
      firestore,
      userId,
      oldFormatKey,
      options,
    );
  } else {
    // reviewLogs were stored as flat individual docs (not bucketed)
    legacyItems = await loadCollection<T>(sdk, firestore, userId, oldFormatKey, options);
  }

  return Array.from(new Map([
    ...legacyItems.map((item) => [item.id, item] as const),
    ...deckScopedItems.map((item) => [item.id, item] as const),
  ]).values());
}

export function getChangedItems<T extends { id: string }>(
  previousItems: T[],
  nextItems: T[],
): T[] {
  const previousById = new Map(previousItems.map((item) => [item.id, getItemSignature(item)]));

  return nextItems.filter((item) => previousById.get(item.id) !== getItemSignature(item));
}

export function getDeletedIds<T extends { id: string }>(previousItems: T[], nextItems: T[]) {
  const nextIds = new Set(nextItems.map((item) => item.id));
  return previousItems
    .map((item) => item.id)
    .filter((id) => !nextIds.has(id));
}

function getBucketsById<T extends { id: string }>(
  key: BucketedSyncCollectionKey,
  items: T[],
): Map<string, BucketedLearningEntities<T>> {
  return new Map(
    buildBucketedLearningEntities(key, items).map((bucket) => [bucket.id, bucket]),
  );
}

function getAffectedBucketIds(
  key: BucketedSyncCollectionKey,
  entityIds: string[],
): string[] {
  return Array.from(new Set(entityIds.map((entityId) => getBucketedEntityDocumentId(key, entityId)))).sort();
}

export function getTimestampChangedItems<T extends { id: string }>(
  items: T[],
  since: number,
  getRevision: (item: T) => number,
): T[] {
  return items.filter((item) => getRevision(item) > since);
}

export function getDeletedIdsFromTombstones(
  tombstones: LearningCloudTombstone[],
  since: number,
): string[] {
  return Array.from(
    new Set(
      tombstones
        .filter((entry) => entry.deletedAt > since)
        .map((entry) => entry.id),
    ),
  );
}

export function splitEntityWriteChunks<T extends { id: string }>(
  items: T[],
  deviceId: string,
  maxPayloadBytes = MAX_BATCH_PAYLOAD_BYTES,
): T[][] {
  const chunks: T[][] = [];
  let chunk: T[] = [];
  let chunkPayloadBytes = 0;

  for (const item of items) {
    const itemPayloadBytes = getApproximateFirestorePayloadBytes(
      sanitizeFirestoreValue({
        ...item,
        syncedAt: null,
        syncedByDeviceId: deviceId,
      }),
    );
    const exceedsBatchLimit = chunk.length >= MAX_BATCH_WRITES
      || (chunk.length > 0 && chunkPayloadBytes + itemPayloadBytes > maxPayloadBytes);

    if (exceedsBatchLimit) {
      chunks.push(chunk);
      chunk = [];
      chunkPayloadBytes = 0;
    }

    chunk.push(item);
    chunkPayloadBytes += itemPayloadBytes;
  }

  if (chunk.length > 0) {
    chunks.push(chunk);
  }

  return chunks;
}

export async function commitEntityChunks<T extends { id: string }>(
  sdk: FirestoreSdk,
  firestore: Firestore,
  userId: string,
  key: SyncCollectionKey,
  items: T[],
  deviceId: string,
) {
  const chunkCommits: Array<() => Promise<void>> = [];
  const chunks = splitEntityWriteChunks(items, deviceId);

  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index];
    const hasMoreChunks = index + 1 < chunks.length;
    chunkCommits.push(async () => {
      const chunkPayloadBytes = chunk.reduce((total, item) => (
        total + getApproximateFirestorePayloadBytes(
          sanitizeFirestoreValue({
            ...item,
            syncedAt: null,
            syncedByDeviceId: deviceId,
          }),
        )
      ), 0);
      console.info(
        `[LearningCloud] committing ${key} chunk ${index + 1}/${chunks.length}: ${chunk.length} documents, ${chunkPayloadBytes} bytes`,
      );
      const batch = sdk.writeBatch(firestore);

      for (const item of chunk) {
        const entityRef = sdk.doc(getCollectionRef(sdk, firestore, userId, key), item.id);
        batch.set(
          entityRef,
          sanitizeFirestoreValue({
            ...item,
            syncedAt: sdk.serverTimestamp(),
            syncedByDeviceId: deviceId,
          }),
          { merge: true },
        );
      }

      await batch.commit();
      await waitForPendingChunkWrites(sdk, firestore);

      if (hasMoreChunks) {
        await waitForInterBatchCommitDelay();
      }
    });
  }

  await runWithConcurrencyLimit(chunkCommits, MAX_PARALLEL_BATCH_COMMITS);
}

export async function deleteEntityChunks(
  sdk: FirestoreSdk,
  firestore: Firestore,
  userId: string,
  key: SyncCollectionKey,
  ids: string[],
) {
  if (ids.length === 0) {
    return;
  }

  const chunkCommits: Array<() => Promise<void>> = [];

  for (let index = 0; index < ids.length; index += MAX_BATCH_WRITES) {
    const chunk = ids.slice(index, index + MAX_BATCH_WRITES);
    const hasMoreChunks = index + MAX_BATCH_WRITES < ids.length;
    chunkCommits.push(async () => {
      const batch = sdk.writeBatch(firestore);

      for (const id of chunk) {
        batch.delete(sdk.doc(getCollectionRef(sdk, firestore, userId, key), id));
      }

      await batch.commit();
      await waitForPendingChunkWrites(sdk, firestore);

      if (hasMoreChunks) {
        await waitForInterBatchCommitDelay();
      }
    });
  }

  await runWithConcurrencyLimit(chunkCommits, MAX_PARALLEL_BATCH_COMMITS);
}

/**
 * Stores a recoverable copy before an active learning entity is deleted.
 * Archive documents are deliberately append-only: a later restore can select
 * the exact deletion version without relying on an old device's local cache.
 */
export async function archiveEntityChunks<T extends { id: string }>(
  sdk: FirestoreSdk,
  firestore: Firestore,
  userId: string,
  entityType: Exclude<SyncCollectionKey, 'archives' | 'mutations'>,
  items: T[],
  deviceId: string,
  archivedAt: number,
) {
  if (items.length === 0) {
    return;
  }

  const chunks = splitEntityWriteChunks(items, deviceId);
  const archiveCollection = getCollectionRef(sdk, firestore, userId, 'archives');
  const chunkCommits = chunks.map((chunk, index) => async () => {
    const batch = sdk.writeBatch(firestore);
    for (const item of chunk) {
      const archiveId = `${entityType}_${item.id}_${archivedAt}`;
      batch.set(
        sdk.doc(archiveCollection, archiveId),
        sanitizeFirestoreValue({
          id: archiveId,
          entityId: item.id,
          entityType,
          payload: item,
          archivedAt: sdk.serverTimestamp(),
          clientArchivedAt: archivedAt,
          archivedByDeviceId: deviceId,
        }),
      );
    }
    await batch.commit();
    await waitForPendingChunkWrites(sdk, firestore);
    if (index + 1 < chunks.length) {
      await waitForInterBatchCommitDelay();
    }
  });

  await runWithConcurrencyLimit(chunkCommits, MAX_PARALLEL_BATCH_COMMITS);
}

// ---------------------------------------------------------------------------
// Deck-scoped write helpers (new format)
// ---------------------------------------------------------------------------

/**
 * Group entities by their deckId, then write each group as individual
 * documents to the corresponding deck subcollection:
 *
 *   users/{uid}/learningDecks/{deckId}/{subcollection}/{entityId}
 */
export async function commitDeckScopedEntityChunks<
  T extends { id: string; deckId: string },
>(
  sdk: FirestoreSdk,
  firestore: Firestore,
  userId: string,
  subcollectionKey: DeckScopedSyncCollectionKey,
  items: T[],
  deviceId: string,
) {
  if (items.length === 0) {
    return;
  }

  const chunkCommits: Array<() => Promise<void>> = [];
  const chunks = splitEntityWriteChunks(items, deviceId);

  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index];
    const hasMoreChunks = index + 1 < chunks.length;
    chunkCommits.push(async () => {
      const chunkPayloadBytes = chunk.reduce((total, item) => (
        total + getApproximateFirestorePayloadBytes(
          sanitizeFirestoreValue({
            ...item,
            syncedAt: null,
            syncedByDeviceId: deviceId,
          }),
        )
      ), 0);
      console.info(
        `[LearningCloud] committing deck-scoped ${subcollectionKey} chunk ${index + 1}/${chunks.length}: ${chunk.length} documents, ${chunkPayloadBytes} bytes`,
      );
      const batch = sdk.writeBatch(firestore);

      for (const item of chunk) {
        const entityRef = sdk.doc(
          getDeckScopedCollectionRef(sdk, firestore, userId, item.deckId, subcollectionKey),
          item.id,
        );
        batch.set(
          entityRef,
          sanitizeFirestoreValue({
            ...item,
            syncedAt: sdk.serverTimestamp(),
            syncedByDeviceId: deviceId,
          }),
          { merge: true },
        );
      }

      await batch.commit();
      await waitForPendingChunkWrites(sdk, firestore);

      if (hasMoreChunks) {
        await waitForInterBatchCommitDelay();
      }
    });
  }

  await runWithConcurrencyLimit(chunkCommits, MAX_PARALLEL_BATCH_COMMITS);
}

/**
 * Delete entities from deck-scoped subcollections.
 * Each entity must carry its deckId so we know which subcollection to
 * delete from.
 */
export async function deleteDeckScopedEntityChunks<
  T extends { id: string; deckId: string },
>(
  sdk: FirestoreSdk,
  firestore: Firestore,
  userId: string,
  subcollectionKey: DeckScopedSyncCollectionKey,
  items: T[],
) {
  if (items.length === 0) {
    return;
  }

  const chunkCommits: Array<() => Promise<void>> = [];

  for (let index = 0; index < items.length; index += MAX_BATCH_WRITES) {
    const chunk = items.slice(index, index + MAX_BATCH_WRITES);
    const hasMoreChunks = index + MAX_BATCH_WRITES < items.length;
    chunkCommits.push(async () => {
      const batch = sdk.writeBatch(firestore);

      for (const item of chunk) {
        batch.delete(
          sdk.doc(
            getDeckScopedCollectionRef(sdk, firestore, userId, item.deckId, subcollectionKey),
            item.id,
          ),
        );
      }

      await batch.commit();
      await waitForPendingChunkWrites(sdk, firestore);

      if (hasMoreChunks) {
        await waitForInterBatchCommitDelay();
      }
    });
  }

  await runWithConcurrencyLimit(chunkCommits, MAX_PARALLEL_BATCH_COMMITS);
}

export async function saveBucketedEntityChunks<T extends { id: string }>(
  sdk: FirestoreSdk,
  firestore: Firestore,
  userId: string,
  key: BucketedSyncCollectionKey,
  nextItems: T[],
  previousItems: T[],
  deviceId: string,
  options?: { affectedEntityIds?: string[]; forceRewriteAffectedBuckets?: boolean },
) {
  const affectedBucketIds = options?.affectedEntityIds
    ? getAffectedBucketIds(key, options.affectedEntityIds)
    : null;
  const previousBucketsById = getBucketsById(key, previousItems);
  const nextBucketsById = getBucketsById(key, nextItems);

  const bucketIdsToCompare = affectedBucketIds
    ? affectedBucketIds
    : Array.from(new Set([...previousBucketsById.keys(), ...nextBucketsById.keys()])).sort();

  const previousBuckets = bucketIdsToCompare
    .map((bucketId) => previousBucketsById.get(bucketId))
    .filter((bucket): bucket is BucketedLearningEntities<T> => Boolean(bucket));
  const nextBuckets = bucketIdsToCompare
    .map((bucketId) => nextBucketsById.get(bucketId))
    .filter((bucket): bucket is BucketedLearningEntities<T> => Boolean(bucket));
  const changedBuckets = options?.forceRewriteAffectedBuckets
    ? nextBuckets
    : getChangedItems(previousBuckets, nextBuckets);
  const deletedBucketIds = bucketIdsToCompare.filter((bucketId) => (
    !nextBucketsById.has(bucketId)
    && (
      previousBucketsById.has(bucketId)
      || Boolean(options?.forceRewriteAffectedBuckets)
    )
  ));

  await commitEntityChunks(sdk, firestore, userId, key, changedBuckets, deviceId);
  await deleteEntityChunks(sdk, firestore, userId, key, deletedBucketIds);
}
