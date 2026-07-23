
import type { ReviewLog } from '../domain/entities';
import { getLocalDateKey } from '@/lib/localDate';

export const DEFAULT_OPTIMIZER_MIN_REVIEWS = 300;
export const DEFAULT_OPTIMIZER_MIN_ACTIVE_DAYS = 14;
export const DEFAULT_OPTIMIZER_INTERVAL_DAYS = 30;
export const DEFAULT_OPTIMIZER_NEW_REVIEWS = 500;

export function countDistinctActiveDays(reviewLogs: ReviewLog[]): number {
  const activeDays = new Set<string>();
  reviewLogs.forEach((log) => {
    // Local date key, consistent with countReviewsToday's local-midnight
    // boundary. The previous toISOString() bucketed days in UTC, so reviews
    // near midnight could count toward the wrong day.
    activeDays.add(getLocalDateKey(log.reviewedAt));
  });
  return activeDays.size;
}

function getTodayStart(now = Date.now()): number {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function countReviewsToday(reviewLogs: ReviewLog[], deckId: string, now = Date.now()): number {
  const todayStart = getTodayStart(now);
  return reviewLogs.filter((log) => log.deckId === deckId && log.reviewedAt >= todayStart).length;
}

export function countNewCardsIntroducedToday(reviewLogs: ReviewLog[], deckId: string, now = Date.now()): number {
  const todayStart = getTodayStart(now);
  return reviewLogs.filter(
    (log) => log.deckId === deckId && log.reviewedAt >= todayStart && log.previousState === 'new',
  ).length;
}

export function getWeeklyReviewActivity(reviewLogs: ReviewLog[], deckId: string, now = Date.now()) {
  const weekStart = new Date(now);
  const daysSinceMonday = (weekStart.getDay() + 6) % 7;
  weekStart.setDate(weekStart.getDate() - daysSinceMonday);
  weekStart.setHours(0, 0, 0, 0);

  const weekDayKeys = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(weekStart);
    day.setDate(day.getDate() + index);
    return getLocalDateKey(day.getTime());
  });
  const weeklyLogs = reviewLogs.filter(
    (log) => log.deckId === deckId && log.reviewedAt >= weekStart.getTime() && log.reviewedAt <= now,
  );
  const activeDayKeys = new Set(weeklyLogs.map((log) => getLocalDateKey(log.reviewedAt)));

  return {
    reviewsThisWeek: weeklyLogs.length,
    reviewedDaysThisWeek: weekDayKeys.map((dayKey) => activeDayKeys.has(dayKey)),
  };
}
