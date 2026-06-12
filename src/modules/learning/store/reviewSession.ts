import type { LearningSessionSnapshot } from '../session';
import type {
  LearningReviewFeedbackEvent,
  LearningReviewSessionHistoryEntry,
  LearningReviewSessionState,
} from './types';

function createId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createLearningReviewSessionState(): LearningReviewSessionState {
  return {
    status: 'idle',
    reviewHistoryStack: [],
    feedbackEvents: [],
    timerVisible: true,
  };
}

export function normalizeLearningReviewSessionState(
  state?: Partial<LearningReviewSessionState> | null,
  activeDeckUpdatedAt?: number,
): LearningReviewSessionState {
  const baseState = createLearningReviewSessionState();

  if (
    state?.sessionSnapshot
    && Number.isFinite(activeDeckUpdatedAt)
    && Number.isFinite(state.deckUpdatedAtAtStart)
    && state.deckUpdatedAtAtStart !== activeDeckUpdatedAt
  ) {
    return baseState;
  }

  return {
    ...baseState,
    ...state,
    status: state?.status === 'active' || state?.status === 'completed' ? state.status : 'idle',
    sessionSnapshot: state?.sessionSnapshot ? { ...state.sessionSnapshot } : undefined,
    reviewHistoryStack: Array.isArray(state?.reviewHistoryStack)
      ? state.reviewHistoryStack.map((entry) => ({
          ...entry,
          snapshot: { ...entry.snapshot } as LearningSessionSnapshot,
        }))
      : [],
    feedbackEvents: Array.isArray(state?.feedbackEvents)
      ? state.feedbackEvents.map((entry) => ({ ...entry }))
      : [],
    timerVisible: Boolean(state?.timerVisible ?? baseState.timerVisible),
    deckUpdatedAtAtStart: Number.isFinite(state?.deckUpdatedAtAtStart) ? state?.deckUpdatedAtAtStart : undefined,
    lastUpdatedAt: Number.isFinite(state?.lastUpdatedAt) ? state?.lastUpdatedAt : undefined,
  };
}

export function createLearningReviewFeedbackEvent(
  event: Omit<LearningReviewFeedbackEvent, 'id' | 'createdAt'> & Partial<Pick<LearningReviewFeedbackEvent, 'id' | 'createdAt'>>,
): LearningReviewFeedbackEvent {
  return {
    id: event.id || createId('review_feedback'),
    kind: event.kind,
    message: event.message,
    createdAt: event.createdAt || Date.now(),
    payload: event.payload,
  };
}

export function createLearningReviewHistoryEntry(snapshot: LearningSessionSnapshot): LearningReviewSessionHistoryEntry {
  return {
    id: createId('review_history'),
    snapshot: { ...snapshot },
    createdAt: Date.now(),
  };
}
