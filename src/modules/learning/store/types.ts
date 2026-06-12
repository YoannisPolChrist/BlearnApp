import type { StateCreator } from 'zustand';
import type {
  BlockTargetType,
  CardTemplateType,
  DeckAssignment,
  GateRule,
  ImportJob,
  ImportPayload,
  LearningCard,
  LearningDeck,
  LearningDeckStats,
  LearningNote,
  LearningPreset,
  ReviewLog,
  ReviewRating,
  ReviewResult,
  TemplateImportResult,
  UnlockGrant,
} from '@/lib/learning';
import type { LearningSessionSnapshot } from '../session';
import type { LearningMediaRegistry } from '../media/mediaRegistry';
import type { LearningMediaTransferQueue } from '../media/mediaTransferQueue';
import type { LearningSyncWorkerQueue } from '../workers/learningSyncWorker';
import type { LearningCloudSyncCursor } from '@/services/firebaseLearningSyncService';
import type { LearningCloudLocalSyncState } from '@/lib/learningCloudLocalSyncState';

export interface LearningStoreIndexes {
  reviewLogIndicesByDeckId: Record<string, number[]>;
}

export interface LearningManualCardInput {
  deckId?: string;
  deckName?: string;
  front: string;
  back: string;
  type: CardTemplateType;
  tags?: string[];
  language?: string;
  clozeText?: string;
  expectedAnswer?: string;
  mediaUrl?: string;
}

export interface LearningStoreState {
  activeDeckId?: string;
  activeDeckUpdatedAt?: number;
  decks: Record<string, LearningDeck>;
  notes: Record<string, LearningNote>;
  cards: Record<string, LearningCard>;
  reviewLogs: Record<string, ReviewLog>;
  presets: Record<string, LearningPreset>;
  assignments: DeckAssignment[];
  unlockGrants: UnlockGrant[];
  importJobs: ImportJob[];
  mediaRegistry: LearningMediaRegistry;
  mediaTransferQueue: LearningMediaTransferQueue;
  learningSyncWorkerQueue: LearningSyncWorkerQueue;
  learningCloudLocalSyncState: LearningCloudLocalSyncState;
  gateRule: GateRule;
  gateRuleUpdatedAt?: number;
  reviewSession: LearningReviewSessionState;
  indexes: LearningStoreIndexes;
}

export interface LearningBaseSlice {
  hydrateLearningState: (state: Partial<LearningStoreState>) => void;
  setActiveDeck: (deckId?: string) => void;
  setGateRule: (rule: Partial<GateRule>) => void;
  markLearningCloudSyncCompleted: (
    syncedAt?: number,
    cursor?: LearningCloudSyncCursor | null,
    stateSignature?: string,
  ) => void;
  recordLearningCloudEntityDeletions: (input: {
    deckIds?: string[];
    noteIds?: string[];
    cardIds?: string[];
    reviewLogIds?: string[];
    presetIds?: string[];
    deletedAt?: number;
  }) => void;
}

export interface LearningImportSlice {
  seedStarterDeck: () => void;
  importTemplateDeck: (templateId: string) => Promise<TemplateImportResult>;
  importFromCsv: (filename: string, content: string) => ImportJob;
  importFromJson: (filename: string, payload: ImportPayload) => ImportJob;
  importFromAnkiPackage: (filename: string, content: ArrayBuffer) => Promise<ImportJob>;
  createManualCard: (input: LearningManualCardInput) => ImportJob | null;
  exportDeckToJson: (deckId: string) => ImportPayload | null;
}

export interface LearningReviewSlice {
  upsertAssignment: (
    targetId: string,
    targetType: BlockTargetType,
    deckId: string,
    overrides?: Partial<
      Pick<
        DeckAssignment,
        'sessionCreditsRequired' | 'requiredCorrectReviews' | 'unlockDurationMinutes' | 'enabled' | 'presetId'
      >
    >,
  ) => void;
  removeAssignment: (targetId: string, targetType: BlockTargetType) => void;
  getAssignmentForTarget: (targetId: string, targetType: BlockTargetType) => DeckAssignment | undefined;
  getDeckById: (deckId: string) => LearningDeck | undefined;
  getPresetById: (presetId?: string) => LearningPreset;
  getResolvedPresetForDeck: (deckId: string) => LearningPreset;
  setDeckReviewMix: (deckId: string, reviewsBetweenNewCards: number) => void;
  getDeckStats: (deckId: string) => LearningDeckStats | null;
  getNoteByCardId: (cardId: string) => LearningNote | undefined;
  getDueCardsForDecks: (deckIds?: string[]) => LearningCard[];
  submitReview: (cardId: string, rating: ReviewRating, wasCorrect: boolean) => ReviewResult | null;
  revertReviewLog: (cardId: string) => void;
  registerUnlockGrant: (
    targetId: string,
    targetType: BlockTargetType,
    sourceDeckId: string,
    sessionCreditsRequired: number,
    unlockDurationMinutes: number,
  ) => UnlockGrant;
  getUnlockGrant: (targetId: string, targetType: BlockTargetType) => UnlockGrant | undefined;
}

export interface LearningReviewSessionHistoryEntry {
  id: string;
  snapshot: LearningSessionSnapshot;
  createdAt: number;
}

export interface LearningReviewFeedbackEvent {
  id: string;
  kind: 'undo' | 'redo' | 'toast' | 'session-completed' | 'unlock-request' | 'strict-fallback';
  message: string;
  createdAt: number;
  payload?: Record<string, unknown>;
}

export interface LearningReviewSessionState {
  status: 'idle' | 'active' | 'completed';
  sessionSnapshot?: LearningSessionSnapshot;
  reviewHistoryStack: LearningReviewSessionHistoryEntry[];
  feedbackEvents: LearningReviewFeedbackEvent[];
  timerVisible: boolean;
  deckUpdatedAtAtStart?: number;
  lastUpdatedAt?: number;
}

export interface LearningReviewSessionSlice {
  reviewSession: LearningReviewSessionState;
  startReviewSession: (
    snapshot: LearningSessionSnapshot,
    options?: { timerVisible?: boolean; deckUpdatedAt?: number },
  ) => void;
  updateReviewSessionSnapshot: (snapshot: LearningSessionSnapshot) => void;
  pushReviewSessionHistory: (snapshot: LearningSessionSnapshot) => void;
  undoReviewSession: () => LearningSessionSnapshot | null;
  clearReviewSession: () => void;
  completeReviewSession: () => void;
  setReviewSessionTimerVisible: (visible: boolean) => void;
  recordReviewFeedbackEvent: (
    event: Omit<LearningReviewFeedbackEvent, 'id' | 'createdAt'> & Partial<Pick<LearningReviewFeedbackEvent, 'id' | 'createdAt'>>,
  ) => LearningReviewFeedbackEvent;
  hydrateReviewSessionFromLogs: (
    snapshot: LearningSessionSnapshot,
    history?: LearningReviewSessionHistoryEntry[],
  ) => void;
}

export type LearningStore = LearningStoreState & LearningBaseSlice & LearningImportSlice & LearningReviewSlice & LearningReviewSessionSlice;
export type LearningStoreSliceCreator<TSlice> = StateCreator<LearningStore, [], [], TSlice>;
