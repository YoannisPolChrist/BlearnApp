import { afterEach, describe, expect, it, vi } from 'vitest';
import { countUniqueNewCardsBetween, useReviewMomentum } from '@/modules/stats/vocab';
import { renderHook } from '@testing-library/react';

afterEach(() => {
  vi.useRealTimers();
});

describe('vocabulary statistics', () => {
  it('counts only cards first learned from the new state', () => {
    const start = 1_700_000_000_000;
    const end = start + 60_000;

    expect(countUniqueNewCardsBetween([
      { cardId: 'new-card', reviewedAt: start + 1, previousState: 'new' },
      { cardId: 'review-card', reviewedAt: start + 2, previousState: 'review' },
      { cardId: 'new-card', reviewedAt: start + 3, previousState: 'review' },
    ], start, end)).toBe(1);
  });

  it('calculates the selected day, week, month, or total learning progress without double-counting reviews', () => {
    const now = new Date('2026-07-18T12:00:00Z').getTime();
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const reviewLogs = [
      { cardId: 'today', reviewedAt: now - 1_000, previousState: 'new' as const },
      { cardId: 'week', reviewedAt: now - 4 * 86_400_000, previousState: 'new' as const },
      { cardId: 'month', reviewedAt: now - 12 * 86_400_000, previousState: 'new' as const },
      { cardId: 'old', reviewedAt: now - 45 * 86_400_000, previousState: 'new' as const },
      { cardId: 'today', reviewedAt: now - 500, previousState: 'review' as const },
    ];
    const monthReference = new Date('2026-07-01T12:00:00Z');
    const { result, rerender } = renderHook(
      ({ range }: { range: 'day' | 'week' | 'month' | 'total' }) => useReviewMomentum(reviewLogs, range, monthReference),
      { initialProps: { range: 'day' as const } },
    );

    expect(result.current).toBe(1);

    rerender({ range: 'week' });
    expect(result.current).toBe(2);

    rerender({ range: 'month' });
    expect(result.current).toBe(3);

    rerender({ range: 'total' });
    expect(result.current).toBe(4);
  });
});
