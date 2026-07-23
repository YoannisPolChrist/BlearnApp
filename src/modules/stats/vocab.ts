import { useMemo } from 'react';
import { stateMeta } from '@/components/learn-review/meta';
import type { LearningCardState } from '@/lib/learning';
import { MS_DAY, REVIEW_TREND_LABEL_FORMATTER, VOCAB_STATE_COLORS, VOCAB_STATE_ORDER } from './constants';
import type { TimeRange, VocabDeckComparisonDatum } from './types';

export function countUniqueNewCardsBetween(
  reviewLogs: Array<{ cardId: string; reviewedAt: number; previousState: LearningCardState }>,
  start: number,
  end = Number.POSITIVE_INFINITY,
) {
  const reviewedCardIds = new Set<string>();
  for (const entry of reviewLogs) {
    if (entry.previousState === 'new' && entry.reviewedAt >= start && entry.reviewedAt < end) {
      reviewedCardIds.add(entry.cardId);
    }
  }
  return reviewedCardIds.size;
}

function getStartOfLocalDay(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}

export function getLearningRangeBounds(
  range: TimeRange,
  monthReference = new Date(),
  now = Date.now(),
) {
  if (range === 'total') {
    return { startMs: Number.NEGATIVE_INFINITY, endMs: now };
  }

  let start: Date;
  let end: Date;

  if (range === 'month') {
    start = new Date(monthReference.getFullYear(), monthReference.getMonth(), 1);
    end = new Date(monthReference.getFullYear(), monthReference.getMonth() + 1, 1);
  } else if (range === 'week') {
    start = getStartOfLocalDay(monthReference);
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    end = new Date(start);
    end.setDate(end.getDate() + 7);
  } else {
    start = getStartOfLocalDay(monthReference);
    end = new Date(start);
    end.setDate(end.getDate() + 1);
  }

  return { startMs: start.getTime(), endMs: Math.min(end.getTime(), now) };
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

export function useReviewMomentum(
  reviewLogs: Array<{ cardId: string; reviewedAt: number; previousState: LearningCardState }>,
  range: TimeRange = 'day',
  monthReference = new Date(),
) {
  return useMemo(() => {
    const referenceDate = range === 'month' ? monthReference : new Date();
    const { startMs, endMs } = getLearningRangeBounds(range, referenceDate);
    return countUniqueNewCardsBetween(reviewLogs, startMs, endMs);
  }, [monthReference, range, reviewLogs]);
}
