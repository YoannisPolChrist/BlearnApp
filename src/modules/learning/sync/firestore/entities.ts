import type { DocumentData, Firestore } from 'firebase/firestore';
import type { LearningCloudTombstone } from '@/lib/learningCloudLocalSyncState';
import {
  BUCKETED_ENTITY_DOCUMENT_COUNT,
  MAX_BATCH_WRITES,
  MAX_PARALLEL_BATCH_COMMITS,
  type BucketedSyncCollectionKey,
  type SyncCollectionKey,
} from './constants';
import {
  getCollectionRef,
  waitForInterBatchCommitDelay,
  waitForPendingChunkWrites,
} from './transport';
import type { FirestoreSdk, LearningCloudReadOptions } from './types';
import {
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
  if (typeof item.lastOptimizerRunAt === 'number') maxRevision = Math.max(maxRevision, item.lastOptimizerRunAt);
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

export async function commitEntityChunks<T extends { id: string }>(
  sdk: FirestoreSdk,
  firestore: Firestore,
  userId: string,
  key: SyncCollectionKey,
  items: T[],
  deviceId: string,
) {
  const chunkCommits: Array<() => Promise<void>> = [];

  for (let index = 0; index < items.length; index += MAX_BATCH_WRITES) {
    const chunk = items.slice(index, index + MAX_BATCH_WRITES);
    const hasMoreChunks = index + MAX_BATCH_WRITES < items.length;
    chunkCommits.push(async () => {
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
