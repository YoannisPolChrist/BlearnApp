import type {
  BlockTargetType,
  GateRule,
  LearningCard,
  LearningDeck,
  LearningNote,
  LearningPreset,
  ReviewLog,
  ReviewRating,
} from '@/lib/learning';

export type LearningSessionKind = 'review' | 'unlock';
export type LearningSessionStatus = 'idle' | 'active' | 'paused' | 'completed';
export type LearningSessionEventType =
  | 'session-started'
  | 'session-revealed'
  | 'typed-answer-changed'
  | 'typed-answer-evaluated'
  | 'review-applied'
  | 'queue-advanced'
  | 'undo-applied'
  | 'session-completed'
  | 'timer-started'
  | 'timer-paused'
  | 'timer-resumed'
  | 'timer-stopped';

export interface LearningSessionTimerSnapshot {
  isRunning: boolean;
  isPaused: boolean;
  elapsedMs: number;
  startedAt?: number;
  pausedAt?: number;
  limitMs?: number;
}

export interface LearningSessionHistoryEntry {
  kind: 'typed-answer' | 'reveal' | 'review' | 'queue';
  at: number;
  cardId?: string;
  previous: Partial<LearningSessionSnapshot>;
  next: Partial<LearningSessionSnapshot>;
  label?: string;
}

export interface LearningSessionEvent {
  type: LearningSessionEventType;
  at: number;
  cardId?: string;
  rating?: ReviewRating;
  message?: string;
  payload?: Record<string, unknown>;
}

export interface LearningSessionContext {
  cards: LearningCard[];
  notes: LearningNote[];
  reviewLogs: ReviewLog[];
  deckId?: string;
  targetId?: string;
  targetType?: BlockTargetType;
  preset?: LearningPreset;
  gateRule?: Partial<GateRule>;
  sessionCreditsRequired: number;
  unlockDurationMinutes?: number;
  ignoreNewCardsLimit?: boolean;
  includeReviewAhead?: boolean;
  excludeCardIds?: Set<string>;
  now?: number;
}

export interface LearningSessionSnapshot {
  kind: LearningSessionKind;
  status: LearningSessionStatus;
  deckId?: string;
  targetId?: string;
  targetType?: BlockTargetType;
  currentCardId?: string;
  sessionCreditsRequired: number;
  unlockDurationMinutes?: number;
  queue: string[];
  candidateIds: string[];
  candidateCursor: number;
  cardSnapshotsById: Record<string, LearningCard>;
  // Wie oft eine Karte im Unlock-Flow bei falscher Antwort ans Queue-Ende
  // zurückgeschoben wurde (Re-Queue). Ab MAX_UNLOCK_REQUEUES zählt die
  // Exposition als Credit, damit eine unbekannte Karte keinen Frust-Loop erzeugt.
  requeueCountsByCardId: Record<string, number>;
  typedAnswer: string;
  typedCorrect: boolean | null;
  revealed: boolean;
  attemptCount: number;
  attemptMessage: string | null;
  countedReviews: number;
  startedAt: number;
  updatedAt: number;
  history: LearningSessionHistoryEntry[];
  timer: LearningSessionTimerSnapshot;
}

export interface LearningSessionController {
  getSnapshot: () => LearningSessionSnapshot;
  hydrate: (snapshot: LearningSessionSnapshot) => void;
  reset: (next?: Partial<LearningSessionSnapshot>) => void;
  start: (context: LearningSessionContext, kind?: LearningSessionKind) => LearningSessionEvent[];
  serialize: () => LearningSessionSnapshot;
  reveal: (now?: number) => LearningSessionEvent[];
  submitTypedAnswer: (
    answer: string,
    input?: {
      card?: LearningCard;
      note?: LearningNote;
      now?: number;
      typedAnswerMaxWords?: number;
      typedAnswerEnabled?: boolean;
    },
  ) => LearningSessionEvent[];
  grade: (
    rating: ReviewRating,
    input?: {
      cardId?: string;
      now?: number;
      wasCorrect?: boolean;
    },
  ) => LearningSessionEvent[];
  undo: (now?: number) => LearningSessionEvent[];
  recordCurrentCard: (cardId?: string) => void;
  setTypedAnswer: (value: string) => void;
  setTypedCorrect: (value: boolean | null) => void;
  setRevealed: (value: boolean) => void;
  setAttemptMessage: (value: string | null) => void;
  incrementAttemptCount: () => void;
  resetCurrentCardState: () => void;
  advanceQueue: (reviewedCardId: string) => void;
  setTimerSnapshot: (snapshot: Partial<LearningSessionTimerSnapshot>) => void;
}
