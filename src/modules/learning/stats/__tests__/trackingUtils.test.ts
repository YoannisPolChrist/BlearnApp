import { describe, expect, it } from 'vitest';
import type { ReviewLog } from '@/modules/learning/domain/entities';
import {
  countDistinctActiveDays,
  countNewCardsIntroducedToday,
  countReviewsToday,
} from '@/modules/learning/stats/utils';

function buildLog(id: string, reviewedAt: number, overrides: Partial<ReviewLog> = {}): ReviewLog {
  return {
    id,
    deckId: 'deck_1',
    cardId: `card_${id}`,
    reviewedAt,
    rating: 'good',
    previousState: 'review',
    newState: 'review',
    scheduledDays: 1,
    elapsedDays: 1,
    wasCorrect: true,
    memoryStateBefore: null,
    memoryStateAfter: null,
    ...overrides,
  } as ReviewLog;
}

describe('Vokabeltracking utils', () => {
  it('counts reviews today against the LOCAL midnight boundary', () => {
    const now = new Date(2026, 5, 12, 12, 0, 0).getTime(); // local noon
    const todayMorning = new Date(2026, 5, 12, 0, 30, 0).getTime();
    const yesterdayEvening = new Date(2026, 5, 11, 23, 30, 0).getTime();

    const logs = [
      buildLog('a', todayMorning),
      buildLog('b', yesterdayEvening),
      buildLog('c', now - 1000),
    ];

    expect(countReviewsToday(logs, 'deck_1', now)).toBe(2);
  });

  it('only counts new-card introductions for the requested deck and day', () => {
    const now = new Date(2026, 5, 12, 12, 0, 0).getTime();
    const logs = [
      buildLog('a', now - 1000, { previousState: 'new' }),
      buildLog('b', now - 2000, { previousState: 'review' }),
      buildLog('c', now - 3000, { previousState: 'new', deckId: 'other_deck' }),
    ];

    expect(countNewCardsIntroducedToday(logs, 'deck_1', now)).toBe(1);
  });

  it('buckets distinct active days by LOCAL date, consistent with the daily counters', () => {
    // Two reviews 30 minutes apart across local midnight: 23:45 and 00:15.
    // In UTC bucketing (the old behavior) these can collapse into one day
    // for timezones ahead of UTC; locally they are clearly two days.
    const lateEvening = new Date(2026, 5, 11, 23, 45, 0).getTime();
    const earlyMorning = new Date(2026, 5, 12, 0, 15, 0).getTime();

    expect(countDistinctActiveDays([
      buildLog('a', lateEvening),
      buildLog('b', earlyMorning),
    ])).toBe(2);
  });
});
