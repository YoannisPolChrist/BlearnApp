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
} as const;
export const DEVICE_ID_STORAGE_KEY = 'blearn-learning-sync-device-id';
export const MAX_BATCH_WRITES = 250;
export const MAX_PARALLEL_BATCH_COMMITS = 1;
export const INTER_BATCH_COMMIT_DELAY_MS = 120;
export const DEFAULT_MUTATION_RETENTION_COUNT = 10;
export const MAX_MUTATION_DOCUMENT_BYTES = 900_000;
export const BUCKETED_ENTITY_DOCUMENT_COUNT = 64;

export type SyncCollectionKey = keyof typeof COLLECTIONS;
export type BucketedSyncCollectionKey = 'noteBuckets' | 'cardBuckets';
