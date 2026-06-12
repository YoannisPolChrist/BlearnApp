import { describe, expect, it } from 'vitest';
import {
  clearReviewFeedbackChannel,
  createReviewFeedbackEvent,
  getLastReviewFeedbackEvent,
  publishReviewFeedback,
  subscribeReviewFeedback,
} from '@/services/reviewFeedbackChannel';

describe('review feedback channel', () => {
  it('publishes and replays the latest event', () => {
    clearReviewFeedbackChannel();
    const events: string[] = [];
    const unsubscribe = subscribeReviewFeedback((event) => {
      events.push(event.message);
    });

    const event = createReviewFeedbackEvent('session', 'Hallo', { level: 'info' });
    publishReviewFeedback(event);

    expect(events).toContain('Hallo');
    expect(getLastReviewFeedbackEvent()?.message).toBe('Hallo');

    unsubscribe();
  });
});
