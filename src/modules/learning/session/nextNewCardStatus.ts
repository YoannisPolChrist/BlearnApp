import {
  countDailyReviewActivity,
  countReviewsSinceLastNewCard,
} from '@/modules/learning/review/queues';
import { migrateLearningPreset } from '@/modules/learning/domain/presets';
import type { LearningCard, LearningPreset, ReviewLog } from '@/modules/learning/domain/entities';

interface BuildNextNewCardLabelOptions {
  cards: LearningCard[];
  deckId?: string;
  preset?: LearningPreset;
  reviewLogs: ReviewLog[];
  remainingCandidateIds: string[];
  cardStateById: Record<string, LearningCard['state']>;
  now?: number;
}

export interface NextNewCardStatus {
  label: string;
  detail: string;
  progressPercent: number;
  valueNow: number;
  valueMax: number;
  available: boolean;
}

function clampPercent(value: number) {
  return Math.min(100, Math.max(0, value));
}

export function buildNextNewCardStatus({
  cards,
  deckId,
  preset,
  reviewLogs,
  remainingCandidateIds,
  cardStateById,
  now = Date.now(),
}: BuildNextNewCardLabelOptions): NextNewCardStatus {
  const resolvedPreset = migrateLearningPreset(preset);
  const reviewsPerNewCard = Math.max(1, Math.round(resolvedPreset.reviewsBetweenNewCards));

  const nextNewCardOffset = remainingCandidateIds.findIndex((cardId) => cardStateById[cardId] === 'new');
  if (nextNewCardOffset >= 0) {
    if (nextNewCardOffset === 0) {
      return {
        label: 'Neue Vokabel: jetzt',
        detail: 'Die aktuelle Karte ist neu.',
        progressPercent: 100,
        valueNow: reviewsPerNewCard,
        valueMax: reviewsPerNewCard,
        available: true,
      };
    }

    // Fortschritt X/Y bis zur nächsten neuen Vokabel: zählt mit jeder
    // Wiederholung hoch und erreicht Y/Y genau dann, wenn die neue Karte kommt
    // (bei offset 0). So passt der Zähler immer zum tatsächlichen Auftauchen.
    const completedReviews = Math.min(
      reviewsPerNewCard,
      Math.max(0, reviewsPerNewCard - nextNewCardOffset),
    );
    return {
      label: `Neue Vokabel: ${completedReviews}/${reviewsPerNewCard}`,
      detail: 'Kommt in dieser Session.',
      progressPercent: clampPercent((completedReviews / reviewsPerNewCard) * 100),
      valueNow: completedReviews,
      valueMax: reviewsPerNewCard,
      available: true,
    };
  }

  const resolvedDeckId = deckId || cards[0]?.deckId;
  if (!resolvedDeckId) {
    return {
      label: 'Keine neue Vokabel im Deck',
      detail: 'Kein aktives Deck gefunden.',
      progressPercent: 0,
      valueNow: 0,
      valueMax: 1,
      available: false,
    };
  }

  const eligibleNewCardCount = cards.filter(
    (card) =>
      card.deckId === resolvedDeckId
      && card.state === 'new'
      && (card.dueAt ?? 0) <= Math.max(now, card.createdAt),
  ).length;

  if (eligibleNewCardCount === 0) {
    return {
      label: 'Keine neue Vokabel im Deck',
      detail: 'Alle verfügbaren Vokabeln wurden bereits eingeführt.',
      progressPercent: 0,
      valueNow: 0,
      valueMax: 1,
      available: false,
    };
  }

  const { newCardsIntroducedToday } = countDailyReviewActivity(reviewLogs, resolvedDeckId, now);
  if (newCardsIntroducedToday >= resolvedPreset.newCardsPerDay) {
    return {
      label: 'Heute keine neue Vokabel mehr',
      detail: 'Tageslimit für neue Vokabeln erreicht.',
      progressPercent: 100,
      valueNow: resolvedPreset.newCardsPerDay,
      valueMax: resolvedPreset.newCardsPerDay,
      available: false,
    };
  }

  const reviewsSinceLastNewCard = countReviewsSinceLastNewCard(reviewLogs, resolvedDeckId, now);
  const remainingReviews = Math.max(1, reviewsPerNewCard - (reviewsSinceLastNewCard % reviewsPerNewCard));
  const completedReviews = Math.max(0, reviewsPerNewCard - remainingReviews);

  return {
    label: `Neue Vokabel: ${completedReviews}/${reviewsPerNewCard}`,
    detail: `${completedReviews}/${reviewsPerNewCard} Wiederholungen geschafft`,
    progressPercent: clampPercent((completedReviews / reviewsPerNewCard) * 100),
    valueNow: completedReviews,
    valueMax: reviewsPerNewCard,
    available: true,
  };
}

export function buildNextNewCardLabel(options: BuildNextNewCardLabelOptions): string {
  return buildNextNewCardStatus(options).label;
}
