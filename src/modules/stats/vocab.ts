import { useMemo } from 'react';
import { stateMeta } from '@/components/learn-review/meta';
import type { LearningCardState } from '@/lib/learning';
import { MS_DAY, REVIEW_TREND_LABEL_FORMATTER, VOCAB_STATE_COLORS, VOCAB_STATE_ORDER } from './constants';
import type { VocabDeckComparisonDatum } from './types';

function getStartOfToday(now = Date.now()) {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function countUniqueReviewedCardsBetween(
  reviewLogs: Array<{ cardId: string; reviewedAt: number }>,
  start: number,
  end = Number.POSITIVE_INFINITY,
) {
  return new Set(
    reviewLogs
      .filter((entry) => entry.reviewedAt >= start && entry.reviewedAt < end)
      .map((entry) => entry.cardId),
  ).size;
}

export function useVocabChartData(
  decks: Array<{ id: string; name: string }>,
  cards: Array<{ deckId: string; state: LearningCardState }>,
  reviewLogs: Array<{ reviewedAt: number; wasCorrect: boolean; deckId: string }>,
  getDeckStats: (deckId: string) => { totalCards: number; dueNowCount: number; overdueCount: number } | null,
) {
  return useMemo(() => {
    const stateCounts = cards.reduce<Record<LearningCardState, number>>(
      (accumulator, card) => {
        accumulator[card.state] += 1;
        return accumulator;
      },
      { new: 0, learning: 0, review: 0, relearning: 0 },
    );

    const stateDistribution = VOCAB_STATE_ORDER.map((state) => ({
      label: stateMeta[state].label,
      value: stateCounts[state],
      color: VOCAB_STATE_COLORS[state],
    }));

    const deckComparison = decks
      .map((deck) => {
        const stats = getDeckStats(deck.id);
        if (!stats) {
          return null;
        }

        return {
          label: deck.name,
          series: [
            {
              key: 'due',
              label: 'Fällig',
              value: stats.dueNowCount,
              color: 'hsl(var(--primary))',
            },
            {
              key: 'overdue',
              label: 'Überfällig',
              value: stats.overdueCount,
              color: 'hsl(var(--warning))',
            },
            {
              key: 'total',
              label: 'Gesamt',
              value: stats.totalCards,
              color: 'hsl(var(--accent))',
            },
          ],
        };
      })
      .filter((entry): entry is VocabDeckComparisonDatum => Boolean(entry))
      .sort((left, right) => right.series[2].value - left.series[2].value)
      .slice(0, 5);

    const now = Date.now();
    const reviewTrendStart = now - 13 * MS_DAY;
    const reviewCountByDay = new Array<number>(14).fill(0);
    const correctCountByDay = new Array<number>(14).fill(0);

    for (const entry of reviewLogs) {
      const bucketIndex = Math.floor((entry.reviewedAt - reviewTrendStart) / MS_DAY);
      if (bucketIndex < 0 || bucketIndex >= reviewCountByDay.length) {
        continue;
      }

      reviewCountByDay[bucketIndex] += 1;
      if (entry.wasCorrect) {
        correctCountByDay[bucketIndex] += 1;
      }
    }

    const reviewTrend = Array.from({ length: 14 }, (_, index) => {
      const bucketStart = reviewTrendStart + index * MS_DAY;

      return {
        label: REVIEW_TREND_LABEL_FORMATTER.format(new Date(bucketStart)),
        series: [
          {
            key: 'reviews',
            label: 'Reviews',
            value: reviewCountByDay[index] ?? 0,
            color: 'hsl(var(--primary))',
          },
          {
            key: 'correct',
            label: 'Richtig',
            value: correctCountByDay[index] ?? 0,
            color: 'hsl(var(--success))',
          },
        ] as const,
      };
    });

    return {
      deckComparison,
      reviewTrend,
      stateDistribution,
    };
  }, [cards, decks, getDeckStats, reviewLogs]);
}

export function useReviewMomentum(reviewLogs: Array<{ cardId: string; reviewedAt: number }>) {
  return useMemo(() => {
    const now = Date.now();
    const todayStart = getStartOfToday(now);
    const lastSevenDaysStart = todayStart - 6 * MS_DAY;
    const monthStart = new Date(new Date(now).getFullYear(), new Date(now).getMonth(), 1).getTime();

    return {
      today: countUniqueReviewedCardsBetween(reviewLogs, todayStart),
      lastSevenDays: countUniqueReviewedCardsBetween(reviewLogs, lastSevenDaysStart),
      month: countUniqueReviewedCardsBetween(reviewLogs, monthStart),
    };
  }, [reviewLogs]);
}
