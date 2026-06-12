
import type { LearningOptimizerStatus, LearningPreset, ReviewLog } from '../domain/entities';
import { clampNumber, roundTo } from '../domain/numbers';
import {
  DEFAULT_OPTIMIZER_INTERVAL_DAYS,
  DEFAULT_OPTIMIZER_MIN_ACTIVE_DAYS,
  DEFAULT_OPTIMIZER_MIN_REVIEWS,
  DEFAULT_OPTIMIZER_NEW_REVIEWS,
  countDistinctActiveDays,
} from './utils';

export function getLearningOptimizerStatus(
  reviewLogs: ReviewLog[],
  preset: LearningPreset,
  now = Date.now(),
): LearningOptimizerStatus {
  const relevantReviewCount = reviewLogs.length;
  const activeDays = countDistinctActiveDays(reviewLogs);
  const reviewsUntilEligible = Math.max(0, DEFAULT_OPTIMIZER_MIN_REVIEWS - relevantReviewCount);
  const activeDaysUntilEligible = Math.max(0, DEFAULT_OPTIMIZER_MIN_ACTIVE_DAYS - activeDays);

  if (reviewsUntilEligible > 0 || activeDaysUntilEligible > 0) {
    return {
      status: 'collecting',
      totalReviews: relevantReviewCount,
      activeDays,
      reviewsUntilEligible,
      activeDaysUntilEligible,
      reviewsUntilScheduled: Math.max(0, DEFAULT_OPTIMIZER_NEW_REVIEWS - relevantReviewCount),
    };
  }

  const lastRunAt = preset.lastOptimizerRunAt;
  const lastReviewCount = preset.lastOptimizerReviewCount ?? 0;
  const reviewsSinceLastRun = Math.max(0, relevantReviewCount - lastReviewCount);
  const nextRunAt = lastRunAt
    ? lastRunAt + DEFAULT_OPTIMIZER_INTERVAL_DAYS * 24 * 60 * 60 * 1000
    : now;

  if (!lastRunAt) {
    return {
      status: 'ready',
      totalReviews: relevantReviewCount,
      activeDays,
      reviewsUntilEligible: 0,
      activeDaysUntilEligible: 0,
      reviewsUntilScheduled: 0,
      nextRunAt: now,
    };
  }

  if (now >= nextRunAt && reviewsSinceLastRun >= DEFAULT_OPTIMIZER_NEW_REVIEWS) {
    return {
      status: 'ready',
      totalReviews: relevantReviewCount,
      activeDays,
      reviewsUntilEligible: 0,
      activeDaysUntilEligible: 0,
      reviewsUntilScheduled: 0,
      nextRunAt,
    };
  }

  return {
    status: 'scheduled',
    totalReviews: relevantReviewCount,
    activeDays,
    reviewsUntilEligible: 0,
    activeDaysUntilEligible: 0,
    reviewsUntilScheduled: Math.max(0, DEFAULT_OPTIMIZER_NEW_REVIEWS - reviewsSinceLastRun),
    nextRunAt,
  };
}

export function canAttemptLearningPresetOptimization(
  preset: LearningPreset,
  relevantReviewCount: number,
  now = Date.now(),
): boolean {
  const safeReviewCount = Math.max(0, Math.round(relevantReviewCount));
  if (safeReviewCount < DEFAULT_OPTIMIZER_MIN_REVIEWS) {
    return false;
  }

  const lastRunAt = preset.lastOptimizerRunAt;
  if (!lastRunAt) {
    return true;
  }

  const lastReviewCount = preset.lastOptimizerReviewCount ?? 0;
  const reviewsSinceLastRun = Math.max(0, safeReviewCount - lastReviewCount);
  if (reviewsSinceLastRun < DEFAULT_OPTIMIZER_NEW_REVIEWS) {
    return false;
  }

  const nextRunAt = lastRunAt + DEFAULT_OPTIMIZER_INTERVAL_DAYS * 24 * 60 * 60 * 1000;
  return now >= nextRunAt;
}

export function optimizeLearningPreset(
  preset: LearningPreset,
  reviewLogs: ReviewLog[],
  now = Date.now(),
): LearningPreset {
  const status = getLearningOptimizerStatus(reviewLogs, preset, now);
  if (status.status !== 'ready') {
    return preset;
  }

  const scoredLogs = reviewLogs.filter((log) => log.previousState !== 'new');
  if (scoredLogs.length === 0) {
    return {
      ...preset,
      updatedAt: now,
      lastOptimizerRunAt: now,
      lastOptimizerReviewCount: reviewLogs.length,
    };
  }

  const recallRate = scoredLogs.filter((log) => log.rating !== 'again' && log.wasCorrect).length / scoredLogs.length;
  let desiredRetention = preset.desiredRetention;

  if (recallRate < preset.desiredRetention - 0.03) {
    desiredRetention = clampNumber(preset.desiredRetention + 0.01, 0.85, 0.97);
  } else if (recallRate > preset.desiredRetention + 0.05) {
    desiredRetention = clampNumber(preset.desiredRetention - 0.01, 0.85, 0.97);
  }

  return {
    ...preset,
    desiredRetention: roundTo(desiredRetention, 2),
    updatedAt: now,
    lastOptimizerRunAt: now,
    lastOptimizerReviewCount: reviewLogs.length,
  };
}
