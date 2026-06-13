import { describe, expect, it } from 'vitest';
import type { LearningPreset, ReviewLog, ReviewRating } from '../../domain/entities';
import { getDefaultFsrsWeights } from '../../domain/fsrs';
import {
  buildCardReplayHistories,
  computeReplayLogLoss,
  optimizeFsrsWeights,
} from '../weightOptimizer';

const DAY_MS = 24 * 60 * 60 * 1000;

function buildPreset(): LearningPreset {
  return {
    id: 'preset-test',
    name: 'Test',
    desiredRetention: 0.9,
    fsrsParams: getDefaultFsrsWeights(),
    newCardsPerDay: 20,
    maxReviewsPerDay: 200,
    reviewsBetweenNewCards: 5,
    learningStepsMinutes: [1, 10],
    relearningStepsMinutes: [10],
    reviewSortOrder: 'dueDate',
    burySiblings: false,
  } as LearningPreset;
}

function buildLog(
  cardId: string,
  reviewedAt: number,
  rating: ReviewRating,
): ReviewLog {
  return {
    id: `${cardId}-${reviewedAt}`,
    deckId: 'deck-1',
    cardId,
    reviewedAt,
    rating,
    previousState: 'review',
    newState: 'review',
    scheduledDays: 1,
    elapsedDays: 1,
    wasCorrect: rating !== 'again',
    memoryStateBefore: null,
    memoryStateAfter: null,
  };
}

/**
 * Synthetisches Szenario: ein Lerner, der nach kurzen Intervallen gut erinnert,
 * aber nach langen Intervallen überdurchschnittlich oft vergisst — die
 * Default-Gewichte überschätzen dort die Stabilität.
 */
function buildSyntheticLogs(cardCount: number): ReviewLog[] {
  const logs: ReviewLog[] = [];
  const start = Date.UTC(2026, 0, 1);

  for (let cardIndex = 0; cardIndex < cardCount; cardIndex += 1) {
    const cardId = `card-${cardIndex}`;
    let at = start + cardIndex * 60_000;
    // Lernphase: zwei schnelle erfolgreiche Reviews.
    logs.push(buildLog(cardId, at, 'good'));
    at += DAY_MS;
    logs.push(buildLog(cardId, at, 'good'));
    // Lange Pause → häufiges Vergessen (jede zweite Karte).
    at += 21 * DAY_MS;
    logs.push(buildLog(cardId, at, cardIndex % 2 === 0 ? 'again' : 'good'));
    at += 2 * DAY_MS;
    logs.push(buildLog(cardId, at, 'good'));
  }

  return logs;
}

describe('weightOptimizer', () => {
  it('baut Replay-Historien nur aus Karten mit ≥ 2 Reviews', () => {
    const logs = [
      buildLog('a', 1000, 'good'),
      buildLog('a', 2000, 'good'),
      buildLog('b', 1000, 'good'),
    ];
    const histories = buildCardReplayHistories(logs, 10_000);
    expect(histories).toHaveLength(1);
    expect(histories[0].cardId).toBe('a');
    expect(histories[0].reviews.map((review) => review.reviewedAt)).toEqual([1000, 2000]);
  });

  it('berechnet eine endliche Log-Loss über echte Historien', () => {
    const histories = buildCardReplayHistories(buildSyntheticLogs(20), 10_000);
    const { logLoss, scoredReviews } = computeReplayLogLoss(histories, getDefaultFsrsWeights(), 0.9);
    expect(scoredReviews).toBeGreaterThan(0);
    expect(Number.isFinite(logLoss)).toBe(true);
    expect(logLoss).toBeGreaterThan(0);
  });

  it('findet Gewichte, die die Holdout-Log-Loss gegenüber den Defaults verbessern', () => {
    const preset = buildPreset();
    const logs = buildSyntheticLogs(60);
    const result = optimizeFsrsWeights(logs, preset, { sweeps: 2 });

    expect(result.holdoutReviewCount).toBeGreaterThan(0);
    expect(result.improved).toBe(true);
    expect(result.proposedParams).not.toEqual(result.currentParams);
    expect(result.optimizedHoldoutLogLoss).toBeLessThan(result.baselineHoldoutLogLoss);
  });

  it('schlägt bei zu wenigen Daten keine Änderung vor', () => {
    const preset = buildPreset();
    const result = optimizeFsrsWeights([], preset);
    expect(result.improved).toBe(false);
    expect(result.proposedParams).toEqual(result.currentParams);
  });
});
