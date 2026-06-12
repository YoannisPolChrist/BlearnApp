
import type { ReviewLog } from '../domain/entities';

export const DEFAULT_OPTIMIZER_MIN_REVIEWS = 300;
export const DEFAULT_OPTIMIZER_MIN_ACTIVE_DAYS = 14;
export const DEFAULT_OPTIMIZER_INTERVAL_DAYS = 30;
export const DEFAULT_OPTIMIZER_NEW_REVIEWS = 500;

export function countDistinctActiveDays(reviewLogs: ReviewLog[]): number {
  const activeDays = new Set<string>();
  reviewLogs.forEach((log) => {
    activeDays.add(new Date(log.reviewedAt).toISOString().slice(0, 10));
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
