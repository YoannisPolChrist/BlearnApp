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

function formatOffsetLabel(nextNewCardOffset: number) {
  if (nextNewCardOffset === 0) {
    return 'Neue Vokabel: jetzt';
  }

  return `Nächste neue Vokabel in ${nextNewCardOffset} ${nextNewCardOffset === 1 ? 'Karte' : 'Karten'}`;
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
  const nextNewCardOffset = remainingCandidateIds.findIndex((cardId) => cardStateById[cardId] === 'new');
  if (nextNewCardOffset >= 0) {
    const totalSteps = Math.max(1, nextNewCardOffset + 1);
    return {
      label: formatOffsetLabel(nextNewCardOffset),
      detail: nextNewCardOffset === 0 ? 'Die aktuelle Karte ist neu.' : 'Kommt in dieser Session.',
      progressPercent: clampPercent(((totalSteps - nextNewCardOffset) / totalSteps) * 100),
      valueNow: totalSteps - nextNewCardOffset,
      valueMax: totalSteps,
      available: true,
    };
  }

  const resolvedPreset = migrateLearningPreset(preset);
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

  const reviewsPerNewCard = Math.max(1, Math.round(resolvedPreset.reviewsBetweenNewCards));
  const reviewsSinceLastNewCard = countReviewsSinceLastNewCard(reviewLogs, resolvedDeckId, now);
  const remainingReviews = Math.max(1, reviewsPerNewCard - (reviewsSinceLastNewCard % reviewsPerNewCard));
  const completedReviews = Math.max(0, reviewsPerNewCard - remainingReviews);

  return {
    label: `Noch ${remainingReviews} ${remainingReviews === 1 ? 'Wiederholung' : 'Wiederholungen'} bis zur neuen Vokabel`,
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
