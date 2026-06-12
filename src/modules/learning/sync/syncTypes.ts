import type {
  LearningCard,
  LearningDeck,
  LearningNote,
  LearningPreset,
  ReviewLog,
} from '@/lib/learning';

import type { LearningCloudState } from './learningCloudState';

export type SyncEntityType =
  | 'activeDeck'
  | 'card'
  | 'deck'
  | 'note'
  | 'preset'
  | 'reviewLog';

export type SyncMutationKind = 'append' | 'delete' | 'upsert';

export interface SyncCursor {
  clientId: string;
  sequence: number;
  updatedAt: number;
}

export interface SyncMutationPayloadMap {
  activeDeck: {
    activeDeckId?: string;
    activeDeckUpdatedAt?: number;
  };
  card: Partial<LearningCard> & Pick<LearningCard, 'id'>;
  deck: Partial<LearningDeck> & Pick<LearningDeck, 'id'>;
  note: Partial<LearningNote> & Pick<LearningNote, 'id'>;
  preset: Partial<LearningPreset> & Pick<LearningPreset, 'id'>;
  reviewLog: ReviewLog;
}

export interface SyncMutationEntry<TEntityType extends SyncEntityType = SyncEntityType> {
  mutationId: string;
  clientId: string;
  sequence: number;
  createdAt: number;
  entityType: TEntityType;
  entityId: string;
  kind: SyncMutationKind;
  baseRevision?: number;
  payload: SyncMutationPayloadMap[TEntityType];
}

export interface MutationLogState {
  clientId: string;
  lastSequence: number;
  acknowledgedCursor: SyncCursor | null;
  entries: SyncMutationEntry[];
}

export interface DeltaSyncState {
  clientId: string;
  cloudState: LearningCloudState;
  mutationLog: MutationLogState;
  appliedCursor: SyncCursor | null;
}

export interface DeltaSyncReconcileResult {
  cloudState: LearningCloudState;
  mutationLog: MutationLogState;
  appliedMutations: SyncMutationEntry[];
  pendingMutations: SyncMutationEntry[];
  appliedCursor: SyncCursor | null;
}

export interface SyncMutationInput<TEntityType extends SyncEntityType = SyncEntityType> {
  entityType: TEntityType;
  entityId: string;
  kind: SyncMutationKind;
  payload: SyncMutationPayloadMap[TEntityType];
  baseRevision?: number;
  mutationId?: string;
  createdAt?: number;
}

export function createSyncCursor(
  clientId: string,
  sequence: number,
  updatedAt = Date.now(),
): SyncCursor {
  return {
    clientId,
    sequence: Math.max(0, Math.round(sequence)),
    updatedAt: Math.max(0, Math.round(updatedAt)),
  };
}
