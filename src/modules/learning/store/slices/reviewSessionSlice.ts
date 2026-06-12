import type { StateCreator } from 'zustand';
import {
  createLearningReviewFeedbackEvent,
  createLearningReviewHistoryEntry,
  createLearningReviewSessionState,
} from '../reviewSession';
import type { LearningReviewSessionSlice, LearningStore } from '../types';

export const createLearningReviewSessionSlice: StateCreator<LearningStore, [], [], LearningReviewSessionSlice> = (
  set,
  get,
) => ({
  reviewSession: createLearningReviewSessionState(),

  startReviewSession: (snapshot, options) =>
    set((state) => ({
      reviewSession: {
        ...createLearningReviewSessionState(),
        status: 'active',
        sessionSnapshot: { ...snapshot },
        reviewHistoryStack: [],
        feedbackEvents: [],
        timerVisible: options?.timerVisible ?? true,
        deckUpdatedAtAtStart: options?.deckUpdatedAt ?? state.activeDeckUpdatedAt,
        lastUpdatedAt: Date.now(),
      },
    })),

  updateReviewSessionSnapshot: (snapshot) =>
    set((state) => ({
      reviewSession: {
        ...state.reviewSession,
        sessionSnapshot: { ...snapshot },
        status: state.reviewSession.status === 'idle' ? 'active' : state.reviewSession.status,
        lastUpdatedAt: Date.now(),
      },
    })),

  pushReviewSessionHistory: (snapshot) =>
    set((state) => ({
      reviewSession: {
        ...state.reviewSession,
        reviewHistoryStack: [createLearningReviewHistoryEntry(snapshot), ...state.reviewSession.reviewHistoryStack],
        lastUpdatedAt: Date.now(),
      },
    })),

  undoReviewSession: () => {
    const current = get().reviewSession;
    const [nextEntry, ...remaining] = current.reviewHistoryStack;
    if (!nextEntry) {
      return null;
    }

    set({
      reviewSession: {
        ...current,
        sessionSnapshot: { ...nextEntry.snapshot },
        reviewHistoryStack: remaining,
        feedbackEvents: [
          createLearningReviewFeedbackEvent({
            kind: 'undo',
      message: 'Letzte Bewertung wurde rückgängig gemacht.',
            payload: { snapshotId: nextEntry.id },
          }),
          ...current.feedbackEvents,
        ],
        lastUpdatedAt: Date.now(),
      },
    });

    return { ...nextEntry.snapshot };
  },

  clearReviewSession: () =>
    set({
      reviewSession: createLearningReviewSessionState(),
    }),

  completeReviewSession: () =>
    set((state) => ({
      reviewSession: {
        ...state.reviewSession,
        status: 'completed',
        lastUpdatedAt: Date.now(),
      },
    })),

  setReviewSessionTimerVisible: (visible) =>
    set((state) => ({
      reviewSession: {
        ...state.reviewSession,
        timerVisible: visible,
        lastUpdatedAt: Date.now(),
      },
    })),

  recordReviewFeedbackEvent: (event) => {
    const feedbackEvent = createLearningReviewFeedbackEvent(event);
    set((state) => ({
      reviewSession: {
        ...state.reviewSession,
        feedbackEvents: [feedbackEvent, ...state.reviewSession.feedbackEvents].slice(0, 25),
        lastUpdatedAt: Date.now(),
      },
    }));
    return feedbackEvent;
  },

  hydrateReviewSessionFromLogs: (snapshot, history = []) =>
    set((state) => ({
      reviewSession: {
        ...state.reviewSession,
        status: snapshot.kind ? 'active' : 'idle',
        sessionSnapshot: { ...snapshot },
        reviewHistoryStack: history.map((entry) => ({
          ...entry,
          snapshot: { ...entry.snapshot },
        })),
        lastUpdatedAt: Date.now(),
      },
    })),
});
