export type ReviewFeedbackKind = 'toast' | 'undo-label' | 'redo-label' | 'session' | 'timer';

export interface ReviewFeedbackEvent {
  kind: ReviewFeedbackKind;
  at: number;
  message: string;
  level?: 'info' | 'success' | 'warning' | 'error';
  payload?: Record<string, unknown>;
}

type ReviewFeedbackListener = (event: ReviewFeedbackEvent) => void;

const listeners = new Set<ReviewFeedbackListener>();
let lastEvent: ReviewFeedbackEvent | null = null;

export function publishReviewFeedback(event: ReviewFeedbackEvent) {
  lastEvent = event;
  listeners.forEach((listener) => listener(event));
}

export function subscribeReviewFeedback(listener: ReviewFeedbackListener) {
  listeners.add(listener);
  if (lastEvent) {
    listener(lastEvent);
  }

  return () => {
    listeners.delete(listener);
  };
}

export function clearReviewFeedbackChannel() {
  listeners.clear();
  lastEvent = null;
}

export function getLastReviewFeedbackEvent() {
  return lastEvent;
}

export function createReviewFeedbackEvent(
  kind: ReviewFeedbackKind,
  message: string,
  payload?: Partial<ReviewFeedbackEvent>,
): ReviewFeedbackEvent {
  return {
    kind,
    at: payload?.at ?? Date.now(),
    message,
    level: payload?.level,
    payload: payload?.payload,
  };
}
