
import type { LearningCard, LearningPreset, ReviewRating, ReviewResult } from '../domain/entities';
import { createId } from '../domain/id';
import { getDefaultLearningPreset, migrateLearningCard, migrateLearningPreset } from '../domain/presets';
import { fromFsrsCard, getCardMemoryState, getFsrsScheduler, toFsrsCard, toFsrsRating } from '../domain/fsrs';

function resolveBuildReviewArgs(
  presetOrNow?: LearningPreset | number,
  maybeNow?: number,
): { preset: LearningPreset; now: number } {
  if (typeof presetOrNow === 'number') {
    return {
      preset: getDefaultLearningPreset(),
      now: presetOrNow,
    };
  }

  return {
    preset: migrateLearningPreset(presetOrNow),
    now: maybeNow ?? Date.now(),
  };
}

export function getUnlockCredit(rating: ReviewRating, wasCorrect = true): number {
  if (!wasCorrect || rating === 'again') {
    return 0;
  }

  return 1;
}

export function scheduleReview(
  card: LearningCard,
  rating: ReviewRating,
  presetOrNow?: LearningPreset | number,
  maybeNow?: number,
): LearningCard {
  const { preset, now } = resolveBuildReviewArgs(presetOrNow, maybeNow);
  const scheduler = getFsrsScheduler(preset);
  const result = scheduler.next(toFsrsCard(migrateLearningCard(card), now), new Date(now), toFsrsRating(rating));
  return fromFsrsCard(card, result.card);
}

export function buildReviewResult(
  card: LearningCard,
  rating: ReviewRating,
  wasCorrect: boolean,
  presetOrNow?: LearningPreset | number,
  maybeNow?: number,
): ReviewResult {
  const { preset, now } = resolveBuildReviewArgs(presetOrNow, maybeNow);
  const effectiveRating = wasCorrect ? rating : 'again';
  const scheduler = getFsrsScheduler(preset);
  const currentCard = migrateLearningCard(card);
  const currentFsrsCard = toFsrsCard(currentCard, now);
  const record = scheduler.next(currentFsrsCard, new Date(now), toFsrsRating(effectiveRating));
  let updatedCard = fromFsrsCard(currentCard, record.card);
  
  const leechThreshold = preset.leechThreshold ?? 8;
  const leechAction = preset.leechAction ?? 'suspend';
  
  if (effectiveRating === 'again' && updatedCard.lapses >= leechThreshold) {
    if (leechAction === 'suspend') {
      updatedCard = {
        ...updatedCard,
        state: 'suspended',
      };
    }
  }

  const memoryStateBefore = getCardMemoryState(currentCard);
  const memoryStateAfter = updatedCard.memoryState;

  return {
    updatedCard,
    log: {
      id: createId('revlog'),
      deckId: card.deckId,
      cardId: card.id,
      reviewedAt: now,
      rating: effectiveRating,
      previousState: currentCard.state,
      newState: updatedCard.state,
      scheduledDays: Math.max(0, Math.round(record.log.scheduled_days)),
      elapsedDays: Math.max(0, Math.round(record.log.elapsed_days)),
      wasCorrect,
      memoryStateBefore,
      memoryStateAfter,
      previousCardSnapshot: { ...currentCard },
    },
    wasCorrect,
    countedReviews: getUnlockCredit(effectiveRating, wasCorrect),
  };
}

export function formatReviewInterval(dueAt: number, now = Date.now()): string {
  const diffMs = Math.max(0, dueAt - now);
  const totalMinutes = Math.round(diffMs / 60000);

  if (totalMinutes <= 0) return 'jetzt';
  if (totalMinutes < 60) return `${totalMinutes}m`;

  const totalHours = Math.round(totalMinutes / 60);
  if (totalHours < 24) return `${totalHours}h`;

  const totalDays = Math.round(totalHours / 24);
  if (totalDays < 30) return `${totalDays}d`;

  const totalMonths = Math.round(totalDays / 30);
  if (totalMonths < 12) return `${totalMonths}mo`;

  const totalYears = Math.round(totalMonths / 12);
  return `${totalYears}y`;
}

export function getReviewIntervalPreview(
  card: LearningCard,
  rating: ReviewRating,
  wasCorrect: boolean,
  presetOrNow?: LearningPreset | number,
  maybeNow?: number,
): string {
  const { now } = resolveBuildReviewArgs(presetOrNow, maybeNow);
  return formatReviewInterval(buildReviewResult(card, rating, wasCorrect, presetOrNow, maybeNow).updatedCard.dueAt, now);
}
