import { useEffect, useState } from 'react';
import {
  clearReviewFeedbackChannel,
  getLastReviewFeedbackEvent,
  publishReviewFeedback,
  subscribeReviewFeedback,
  type ReviewFeedbackEvent,
} from '@/services/reviewFeedbackChannel';

export function useReviewFeedback() {
  const [latestEvent, setLatestEvent] = useState<ReviewFeedbackEvent | null>(() => getLastReviewFeedbackEvent());

  useEffect(() => subscribeReviewFeedback(setLatestEvent), []);

  return {
    latestEvent,
    publishReviewFeedback,
    clearReviewFeedbackChannel,
  };
}
