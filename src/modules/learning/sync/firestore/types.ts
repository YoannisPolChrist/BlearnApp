import type { LearningCloudLocalSyncState } from '@/lib/learningCloudLocalSyncState';
import type { LearningCloudState } from '@/lib/learningCloudSync';

export interface LearningCloudSyncCursor {
  mutationId: string;
  mutationAt: number;
}

export interface LearningCloudMutationDelta extends Partial<LearningCloudState> {
  deletedDeckIds?: string[];
  deletedNoteIds?: string[];
  deletedCardIds?: string[];
  deletedReviewLogIds?: string[];
  deletedPresetIds?: string[];
  deletedSavedCardQueryIds?: string[];
  deletedFilteredDeckLiteDefinitionIds?: string[];
  deletedFilteredDeckLiteRunIds?: string[];
}

export interface LearningCloudMutationRecord {
  id: string;
  deviceId: string;
  mutationAt: number;
  baseCursor?: LearningCloudSyncCursor | null;
  cursor: LearningCloudSyncCursor;
  delta: LearningCloudMutationDelta;
  snapshot?: LearningCloudState;
  acknowledgedAt?: number;
}

export interface LearningCloudMeta {
  schemaVersion: number;
  activeDeckId?: string;
  activeDeckUpdatedAt?: number;
  deckCount?: number;
  noteCount?: number;
  cardCount?: number;
  reviewLogCount?: number;
  presetCount?: number;
  cardBrowser?: LearningCloudState['cardBrowser'];
  savedCardQueries?: LearningCloudState['savedCardQueries'];
  filteredDeckLiteDefinition?: LearningCloudState['filteredDeckLiteDefinition'];
  filteredDeckLiteDefinitions?: LearningCloudState['filteredDeckLiteDefinitions'];
  filteredDeckLiteRuns?: LearningCloudState['filteredDeckLiteRuns'];
  assignments?: LearningCloudState['assignments'];
  gateRule?: LearningCloudState['gateRule'];
  gateRuleUpdatedAt?: number;
  snapshotCursor?: LearningCloudSyncCursor;
  mutationCursor?: LearningCloudSyncCursor;
  mutationCount?: number;
  updatedByDeviceId?: string;
  clientUpdatedAt?: number;
  lastMutationId?: string;
  lastMutationAt?: number;
}

export interface LearningCloudReadOptions {
  source?: 'default' | 'server';
}

export interface LearningCloudSaveOptions {
  localSyncState?: LearningCloudLocalSyncState | null;
}

export type FirestoreSdk = typeof import('firebase/firestore');
