import { beforeEach, describe, expect, it } from 'vitest';
import { useLearningStore } from '@/store/useLearningStore';
import {
  createLearningReviewSessionState,
  normalizeLearningReviewSessionState,
} from '../reviewSession';

function createSnapshot() {
  return {
    kind: 'review' as const,
    deckId: 'deck-1',
    sessionCreditsRequired: 3,
    queue: ['card-1'],
    candidateIds: ['card-1'],
    candidateCursor: 0,
    typedAnswer: '',
    typedCorrect: null,
    revealed: false,
    attemptCount: 0,
    attemptMessage: null,
    countedReviews: 0,
    startedAt: 1,
    updatedAt: 1,
  };
}

describe('learning review session store', () => {
  beforeEach(() => {
    useLearningStore.setState(useLearningStore.getInitialState(), true);
  });

  it('creates a clean default review session state', () => {
    expect(createLearningReviewSessionState()).toEqual({
      status: 'idle',
      reviewHistoryStack: [],
      feedbackEvents: [],
      timerVisible: true,
    });
  });

  it('drops stale sessions when the deck revision changes', () => {
    const normalized = normalizeLearningReviewSessionState(
      {
        status: 'active',
        sessionSnapshot: createSnapshot(),
        reviewHistoryStack: [{ id: 'history-1', snapshot: createSnapshot(), createdAt: 1 }],
        feedbackEvents: [{ id: 'event-1', kind: 'toast', message: 'hi', createdAt: 1 }],
        timerVisible: false,
        deckUpdatedAtAtStart: 10,
        lastUpdatedAt: 1,
      },
      20,
    );

    expect(normalized).toEqual(createLearningReviewSessionState());
  });

  it('tracks and restores review session snapshots and feedback events', () => {
    const snapshot = createSnapshot();

    useLearningStore.getState().startReviewSession(snapshot, {
      timerVisible: false,
      deckUpdatedAt: 10,
    });
    useLearningStore.getState().pushReviewSessionHistory(snapshot);
    const feedback = useLearningStore.getState().recordReviewFeedbackEvent({
      kind: 'toast',
      message: 'Saved',
    });

    expect(useLearningStore.getState().reviewSession.sessionSnapshot).toMatchObject({
      deckId: 'deck-1',
      queue: ['card-1'],
    });
    expect(useLearningStore.getState().reviewSession.timerVisible).toBe(false);
    expect(useLearningStore.getState().reviewSession.reviewHistoryStack).toHaveLength(1);
    expect(feedback.kind).toBe('toast');

    const restored = useLearningStore.getState().undoReviewSession();
    expect(restored).toMatchObject({
      deckId: 'deck-1',
      queue: ['card-1'],
    });
    expect(useLearningStore.getState().reviewSession.feedbackEvents[0]?.kind).toBe('undo');
  });
});
