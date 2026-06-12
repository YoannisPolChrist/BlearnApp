import {
  MAX_TYPED_ANSWER_ATTEMPTS,
  advanceReviewQueue,
  shouldRequireTypedAnswer,
} from '@/lib/learning';
import type { LearningCard, LearningNote, ReviewRating } from '@/lib/learning';
import { evaluateTypedAnswer } from './typedAnswerService';
import { createLearningSessionSnapshot, createTimerSnapshot } from './sessionSnapshotFactory';
import type {
  LearningSessionContext,
  LearningSessionController,
  LearningSessionEvent,
  LearningSessionHistoryEntry,
  LearningSessionKind,
  LearningSessionSnapshot,
  LearningSessionTimerSnapshot,
} from './sessionTypes';

export { createLearningSessionSnapshot, createReviewSessionSnapshotFromCards, createUnlockSessionSnapshotFromContext, resolveAvailableDeckId } from './sessionSnapshotFactory';
export { getMaxTypedAnswerAttempts, getSessionCardAnswer, getSessionCardPrompt, hasTypedAnswerDirective, isSessionComplete, isSessionTypedAnswerCorrect, shouldSessionRequireTypedAnswer } from './sessionLearningAccessors';

const MAX_HISTORY_ENTRIES = 25;

function nowTimestamp(now?: number) {
  return now ?? Date.now();
}

function cloneHistoryState(snapshot: LearningSessionSnapshot): Partial<LearningSessionSnapshot> {
  const { history: _history, ...rest } = snapshot;
  return {
    ...rest,
    cardSnapshotsById: { ...snapshot.cardSnapshotsById },
    timer: { ...snapshot.timer },
  };
}

function resolveCurrentCardId(snapshot: LearningSessionSnapshot): string | undefined {
  return snapshot.currentCardId || snapshot.queue[0];
}

function createEvent(
  type: LearningSessionEvent['type'],
  at: number,
  payload?: Omit<LearningSessionEvent, 'type' | 'at'>,
): LearningSessionEvent {
  return {
    type,
    at,
    ...payload,
  };
}

function createHistoryEntry(
  kind: LearningSessionHistoryEntry['kind'],
  at: number,
  previous: Partial<LearningSessionSnapshot>,
  next: Partial<LearningSessionSnapshot>,
  cardId?: string,
  label?: string,
): LearningSessionHistoryEntry {
  return {
    kind,
    at,
    cardId,
    previous,
    next,
    label,
  };
}

class ReviewSessionControllerImpl implements LearningSessionController {
  private snapshot: LearningSessionSnapshot;

  constructor(initial: LearningSessionSnapshot) {
    this.snapshot = {
      ...initial,
      currentCardId: initial.currentCardId ?? initial.queue[0],
      status: initial.status ?? (initial.queue.length > 0 ? 'active' : 'completed'),
      history: [...(initial.history || [])],
      cardSnapshotsById: { ...(initial.cardSnapshotsById || {}) },
      timer: { ...createTimerSnapshot(initial.timer.limitMs), ...initial.timer },
    };
  }

  private commit(
    kind: LearningSessionHistoryEntry['kind'],
    next: Partial<LearningSessionSnapshot>,
    at = Date.now(),
    cardId?: string,
    label?: string,
    event?: LearningSessionEvent,
  ): LearningSessionEvent[] {
    const previous = cloneHistoryState(this.snapshot);
    const merged = {
      ...this.snapshot,
      ...next,
      currentCardId: next.currentCardId ?? resolveCurrentCardId({ ...this.snapshot, ...next } as LearningSessionSnapshot),
      updatedAt: at,
    } satisfies LearningSessionSnapshot;

    const nextHistory = createHistoryEntry(kind, at, previous, cloneHistoryState(merged), cardId, label);
    this.snapshot = {
      ...merged,
      history: [nextHistory, ...this.snapshot.history].slice(0, MAX_HISTORY_ENTRIES),
    };

    return event ? [event] : [];
  }

  getSnapshot = () => ({
    ...this.snapshot,
    history: [...this.snapshot.history],
    timer: { ...this.snapshot.timer },
  });

  serialize = () => this.getSnapshot();

  hydrate = (snapshot: LearningSessionSnapshot) => {
    this.snapshot = {
      ...snapshot,
      history: [...(snapshot.history || [])],
      cardSnapshotsById: { ...(snapshot.cardSnapshotsById || {}) },
      timer: { ...createTimerSnapshot(snapshot.timer.limitMs), ...snapshot.timer },
    };
  };

  reset = (next: Partial<LearningSessionSnapshot> = {}) => {
    this.snapshot = {
      ...this.snapshot,
      ...next,
      currentCardId: next.currentCardId ?? next.queue?.[0] ?? this.snapshot.currentCardId,
      queue: next.queue ?? this.snapshot.queue,
      candidateIds: next.candidateIds ?? this.snapshot.candidateIds,
      candidateCursor: next.candidateCursor ?? this.snapshot.candidateCursor,
      typedAnswer: next.typedAnswer ?? '',
      typedCorrect: next.typedCorrect ?? null,
      revealed: next.revealed ?? false,
      attemptCount: next.attemptCount ?? 0,
      attemptMessage: next.attemptMessage ?? null,
      countedReviews: next.countedReviews ?? 0,
      status: next.status ?? this.snapshot.status,
      cardSnapshotsById: next.cardSnapshotsById ? { ...next.cardSnapshotsById } : this.snapshot.cardSnapshotsById,
      timer: next.timer ? { ...this.snapshot.timer, ...next.timer } : this.snapshot.timer,
      updatedAt: Date.now(),
    };
  };

  start = (context: LearningSessionContext, kind: LearningSessionKind = 'unlock') => {
    const next = createLearningSessionSnapshot(context, kind);
    this.snapshot = {
      ...next,
      history: [],
      cardSnapshotsById: { ...next.cardSnapshotsById },
      timer: createTimerSnapshot(next.timer.limitMs),
    };
    return [
      createEvent('session-started', next.startedAt, {
        cardId: next.currentCardId,
        payload: {
          kind: next.kind,
          queueSize: next.queue.length,
        },
      }),
    ];
  };

  reveal = (now = Date.now()) => {
    if (!resolveCurrentCardId(this.snapshot) || this.snapshot.revealed) {
      return [];
    }

    return this.commit(
      'reveal',
      {
        revealed: true,
      },
      now,
      resolveCurrentCardId(this.snapshot),
      'reveal',
      createEvent('session-revealed', now, {
        cardId: resolveCurrentCardId(this.snapshot),
      }),
    );
  };

  submitTypedAnswer = (
    answer: string,
    input: {
      card?: LearningCard;
      note?: LearningNote;
      now?: number;
      typedAnswerMaxWords?: number;
      typedAnswerEnabled?: boolean;
    } = {},
  ) => {
    const at = nowTimestamp(input.now);
    const currentCardId = input.card?.id ?? resolveCurrentCardId(this.snapshot);
    const previous = cloneHistoryState(this.snapshot);
    const nextTypedAnswer = answer;

    if (!currentCardId) {
      this.snapshot = {
        ...this.snapshot,
        typedAnswer: nextTypedAnswer,
        updatedAt: at,
      };
      return [createEvent('typed-answer-changed', at, { payload: { answer: nextTypedAnswer } })];
    }

    const requiresTypedAnswer =
      input.card && input.note
        ? shouldRequireTypedAnswer(
            input.card,
            input.note,
            input.typedAnswerMaxWords ?? 3,
            input.typedAnswerEnabled ?? true,
          )
        : false;
    const evaluation =
      input.card && input.note
        ? evaluateTypedAnswer(input.card, input.note, nextTypedAnswer, {
            maxAttempts: MAX_TYPED_ANSWER_ATTEMPTS,
            typedAnswerEnabled: input.typedAnswerEnabled ?? true,
            typedAnswerMaxWords: input.typedAnswerMaxWords ?? 3,
          })
        : null;

    const nextSnapshot: Partial<LearningSessionSnapshot> = {
      typedAnswer: nextTypedAnswer,
      typedCorrect: evaluation?.correct ?? null,
      attemptCount: evaluation && requiresTypedAnswer ? this.snapshot.attemptCount + 1 : this.snapshot.attemptCount,
      attemptMessage: evaluation?.message ?? null,
      revealed: evaluation?.autoReveal ? true : this.snapshot.revealed,
      status: evaluation?.autoReveal && this.snapshot.queue.length === 0 ? 'completed' : this.snapshot.status,
      updatedAt: at,
    };

    this.snapshot = {
      ...this.snapshot,
      ...nextSnapshot,
      currentCardId,
    };

    const events: LearningSessionEvent[] = [
      createEvent('typed-answer-changed', at, {
        cardId: currentCardId,
        payload: {
          answer: nextTypedAnswer,
          requiresTypedAnswer,
        },
      }),
    ];

    if (evaluation) {
      events.push(
        createEvent('typed-answer-evaluated', at, {
          cardId: currentCardId,
          payload: {
            correct: evaluation.correct,
            attemptsLeft: evaluation.attemptsLeft,
            autoReveal: evaluation.autoReveal,
            hasDirective: evaluation.hasDirective,
          },
          message: evaluation.message,
        }),
      );
    }

    if (evaluation?.autoReveal) {
      this.snapshot = {
        ...this.snapshot,
        revealed: true,
      };
      events.push(createEvent('session-revealed', at, { cardId: currentCardId }));
    }

    this.snapshot = {
      ...this.snapshot,
      history: [
        createHistoryEntry('typed-answer', at, previous, cloneHistoryState(this.snapshot), currentCardId, 'typed answer'),
        ...this.snapshot.history,
      ].slice(0, MAX_HISTORY_ENTRIES),
    };

    return events;
  };

  grade = (
    rating: ReviewRating,
    input: {
      cardId?: string;
      now?: number;
      wasCorrect?: boolean;
    } = {},
  ) => {
    const at = nowTimestamp(input.now);
    const cardId = input.cardId ?? resolveCurrentCardId(this.snapshot);

    if (!cardId) {
      return [];
    }

    const wasCorrect = input.wasCorrect ?? this.snapshot.typedCorrect ?? rating !== 'again';
    const countedReviews = wasCorrect && rating !== 'again' ? this.snapshot.countedReviews + 1 : this.snapshot.countedReviews;
    const previous = cloneHistoryState(this.snapshot);
    const previousQueue = this.snapshot.queue;
    let nextQueue = advanceReviewQueue(previousQueue, cardId);
    let nextCurrentCardId = nextQueue[0];
    let nextCandidateCursor = this.snapshot.candidateCursor;

    if (nextQueue.length === 0 && this.snapshot.candidateCursor < this.snapshot.candidateIds.length) {
      const nextCursor = this.snapshot.candidateCursor;
      const nextCandidateId = this.snapshot.candidateIds[nextCursor];

      nextQueue = nextCandidateId ? [nextCandidateId] : [];
      nextCurrentCardId = nextCandidateId;
      nextCandidateCursor = nextCandidateId ? nextCursor + 1 : nextCursor;
    }

    const nextStatus: LearningSessionSnapshot['status'] = nextQueue.length === 0 ? 'completed' : 'active';

    this.snapshot = {
      ...this.snapshot,
      queue: nextQueue,
      currentCardId: nextCurrentCardId,
      candidateCursor: nextCandidateCursor,
      revealed: false,
      typedAnswer: '',
      typedCorrect: null,
      attemptCount: 0,
      attemptMessage: null,
      countedReviews,
      status: nextStatus,
      updatedAt: at,
    };

    const events: LearningSessionEvent[] = [
      createEvent('review-applied', at, {
        cardId,
        rating,
        payload: {
          wasCorrect,
          countedReviews,
        },
      }),
      createEvent('queue-advanced', at, {
        cardId: nextCurrentCardId,
        payload: {
          previousQueueSize: previous.queue?.length ?? 0,
          nextQueueSize: nextQueue.length,
        },
      }),
    ];

    if (nextStatus === 'completed') {
      events.push(createEvent('session-completed', at, { cardId, payload: { countedReviews } }));
    }

    this.snapshot = {
      ...this.snapshot,
      history: [
        createHistoryEntry('review', at, previous, cloneHistoryState(this.snapshot), cardId, `grade:${rating}`),
        ...this.snapshot.history,
      ].slice(0, MAX_HISTORY_ENTRIES),
    };

    return events;
  };

  undo = (now = Date.now()) => {
    const [latest, ...rest] = this.snapshot.history;
    if (!latest) {
      return [];
    }

    this.snapshot = {
      ...this.snapshot,
      ...latest.previous,
      history: rest,
      updatedAt: now,
    };

    return [
      createEvent('undo-applied', now, {
        cardId: latest.cardId,
        message: latest.label,
        payload: {
          kind: latest.kind,
        },
      }),
    ];
  };

  recordCurrentCard = (cardId?: string) => {
    this.snapshot = {
      ...this.snapshot,
      currentCardId: cardId ?? resolveCurrentCardId(this.snapshot),
      updatedAt: Date.now(),
    };
  };

  setTimerSnapshot = (snapshot: Partial<LearningSessionTimerSnapshot>) => {
    this.snapshot = {
      ...this.snapshot,
      timer: {
        ...this.snapshot.timer,
        ...snapshot,
      },
      updatedAt: Date.now(),
    };
  };

  setTypedAnswer = (value: string) => {
    this.snapshot = { ...this.snapshot, typedAnswer: value, updatedAt: Date.now() };
  };

  setTypedCorrect = (value: boolean | null) => {
    this.snapshot = { ...this.snapshot, typedCorrect: value, updatedAt: Date.now() };
  };

  setRevealed = (value: boolean) => {
    this.snapshot = { ...this.snapshot, revealed: value, updatedAt: Date.now() };
  };

  setAttemptMessage = (value: string | null) => {
    this.snapshot = { ...this.snapshot, attemptMessage: value, updatedAt: Date.now() };
  };

  incrementAttemptCount = () => {
    this.snapshot = {
      ...this.snapshot,
      attemptCount: this.snapshot.attemptCount + 1,
      updatedAt: Date.now(),
    };
  };

  resetCurrentCardState = () => {
    this.snapshot = {
      ...this.snapshot,
      typedAnswer: '',
      typedCorrect: null,
      revealed: false,
      attemptCount: 0,
      attemptMessage: null,
      updatedAt: Date.now(),
    };
  };

  advanceQueue = (reviewedCardId: string) => {
    const nextQueue = advanceReviewQueue(this.snapshot.queue, reviewedCardId);
    if (nextQueue.length > 0) {
      this.snapshot = {
        ...this.snapshot,
        queue: nextQueue,
        currentCardId: nextQueue[0],
        updatedAt: Date.now(),
      };
      return;
    }

    if (this.snapshot.candidateCursor >= this.snapshot.candidateIds.length) {
      this.snapshot = {
        ...this.snapshot,
        queue: [],
        currentCardId: undefined,
        status: 'completed',
        updatedAt: Date.now(),
      };
      return;
    }

    const nextCursor = this.snapshot.candidateCursor;
    const nextCandidateId = this.snapshot.candidateIds[nextCursor];
    this.snapshot = {
      ...this.snapshot,
      queue: nextCandidateId ? [nextCandidateId] : [],
      currentCardId: nextCandidateId,
      candidateCursor: nextCandidateId ? nextCursor + 1 : nextCursor,
      status: nextCandidateId ? 'active' : 'completed',
      updatedAt: Date.now(),
    };
  };
}

export function createLearningSessionController(
  initial: LearningSessionSnapshot,
): LearningSessionController {
  return new ReviewSessionControllerImpl(initial);
}

export type { ReviewRating } from '@/lib/learning';
