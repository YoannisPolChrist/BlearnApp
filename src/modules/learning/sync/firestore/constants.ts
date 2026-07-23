export const USERS_COLLECTION = 'users';
export const META_COLLECTION = 'learningMeta';
export const META_DOCUMENT_ID = 'profile';
export const COLLECTIONS = {
  decks: 'learningDecks',
  notes: 'learningNotes',
  cards: 'learningCards',
  noteBuckets: 'learningNoteBuckets',
  cardBuckets: 'learningCardBuckets',
  reviewLogs: 'learningReviewLogs',
  presets: 'learningPresets',
  mutations: 'learningMutations',
  archives: 'learningArchive',
} as const;

/**
 * Deck-scoped subcollection names.  These live *under* each deck document:
 *
 *   users/{uid}/learningDecks/{deckId}/cards/{cardId}
 *   users/{uid}/learningDecks/{deckId}/notes/{noteId}
 *   users/{uid}/learningDecks/{deckId}/reviewLogs/{logId}
 *   users/{uid}/learningDecks/{deckId}/meta
 */
export const SUBCOLLECTIONS = {
  cards: 'cards',
  notes: 'notes',
  reviewLogs: 'reviewLogs',
  meta: 'meta',
} as const;

export const DEVICE_ID_STORAGE_KEY = 'blearn-learning-sync-device-id';
export const MAX_BATCH_WRITES = 250;
// Firestore rejects complete write requests above 10 MiB. Its encoded write
// format can add substantial overhead for large nested card buckets, so keep
// batches at 1 MiB of JSON payload instead of relying on the 10 MiB limit.
export const MAX_BATCH_PAYLOAD_BYTES = 1 * 1024 * 1024;
export const MAX_PARALLEL_BATCH_COMMITS = 1;
export const INTER_BATCH_COMMIT_DELAY_MS = 120;
export const DEFAULT_MUTATION_RETENTION_COUNT = 10;
export const MAX_MUTATION_DOCUMENT_BYTES = 900_000;
export const BUCKETED_ENTITY_DOCUMENT_COUNT = 64;

export type SyncCollectionKey = keyof typeof COLLECTIONS;
export type BucketedSyncCollectionKey = 'noteBuckets' | 'cardBuckets';
export type DeckScopedSyncCollectionKey = 'cards' | 'notes' | 'reviewLogs';
