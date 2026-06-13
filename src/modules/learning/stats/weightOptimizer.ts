import { createEmptyCard, fsrs, generatorParameters, State, type Card as FsrsCard } from 'ts-fsrs';
import type { LearningPreset, ReviewLog } from '../domain/entities';
import { sanitizeFsrsParams, toFsrsRating } from '../domain/fsrs';

/**
 * Echte FSRS-Gewichtsoptimierung (Masterplan 4.3): trainiert die w-Parameter
 * per Koordinatenabstieg auf der Log-Loss der Forgetting-Curve über die echten
 * ReviewLogs. Bewertet wird auf einem Holdout (Karten-Split), damit nie ein
 * Overfit-Vorschlag entsteht. Läuft im Web Worker; das Ergebnis ist nur ein
 * VORSCHLAG — übernommen wird ausschließlich nach Nutzerbestätigung.
 */

export interface WeightOptimizationOptions {
  /** Anteil der Karten im Trainings-Split (Rest = Holdout). */
  trainSplitRatio?: number;
  /** Koordinatenabstieg-Durchläufe über alle Parameter. */
  sweeps?: number;
  /** Relative Startschrittweite pro Parameter. */
  initialStepRatio?: number;
  /** Obergrenze der verwendeten Logs (neueste zuerst), schützt den Worker. */
  maxReviewLogs?: number;
}

export interface WeightOptimizationResult {
  proposedParams: number[];
  currentParams: number[];
  baselineHoldoutLogLoss: number;
  optimizedHoldoutLogLoss: number;
  trainReviewCount: number;
  holdoutReviewCount: number;
  /** True nur, wenn der Vorschlag die Holdout-Log-Loss verbessert. */
  improved: boolean;
}

interface CardReplayHistory {
  cardId: string;
  reviews: Array<{ reviewedAt: number; rating: ReviewLog['rating']; recalled: boolean }>;
}

const LOG_LOSS_EPSILON = 1e-6;
const DEFAULT_OPTIONS: Required<WeightOptimizationOptions> = {
  trainSplitRatio: 0.8,
  sweeps: 2,
  initialStepRatio: 0.05,
  maxReviewLogs: 10_000,
};

function hashCardId(cardId: string): number {
  let hash = 0;
  for (let index = 0; index < cardId.length; index += 1) {
    hash = (hash * 31 + cardId.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

export function buildCardReplayHistories(reviewLogs: ReviewLog[], maxReviewLogs: number): CardReplayHistory[] {
  const limitedLogs = reviewLogs.length > maxReviewLogs
    ? [...reviewLogs].sort((left, right) => right.reviewedAt - left.reviewedAt).slice(0, maxReviewLogs)
    : reviewLogs;
  const byCard = new Map<string, CardReplayHistory>();

  for (const log of limitedLogs) {
    if (!log.cardId || !Number.isFinite(log.reviewedAt)) {
      continue;
    }
    let history = byCard.get(log.cardId);
    if (!history) {
      history = { cardId: log.cardId, reviews: [] };
      byCard.set(log.cardId, history);
    }
    history.reviews.push({
      reviewedAt: log.reviewedAt,
      rating: log.rating,
      // FSRS-Konvention: "again" = vergessen, alles andere = erinnert.
      recalled: log.rating !== 'again',
    });
  }

  const histories: CardReplayHistory[] = [];
  for (const history of byCard.values()) {
    history.reviews.sort((left, right) => left.reviewedAt - right.reviewedAt);
    // Nur Karten mit mindestens zwei Reviews tragen Information über die Kurve.
    if (history.reviews.length >= 2) {
      histories.push(history);
    }
  }
  return histories;
}

/**
 * Replayt jede Kartenhistorie mit den Kandidaten-Gewichten und summiert die
 * binäre Log-Loss der vorhergesagten Retrievability gegen das echte Ergebnis.
 */
export function computeReplayLogLoss(
  histories: CardReplayHistory[],
  params: number[],
  desiredRetention: number,
): { logLoss: number; scoredReviews: number } {
  const scheduler = fsrs(generatorParameters({
    request_retention: Math.min(0.99, Math.max(0.75, desiredRetention)),
    w: params,
    enable_fuzz: false,
    enable_short_term: true,
  }));

  let totalLoss = 0;
  let scoredReviews = 0;

  for (const history of histories) {
    let card: FsrsCard = createEmptyCard(new Date(history.reviews[0].reviewedAt));
    for (const review of history.reviews) {
      const reviewDate = new Date(review.reviewedAt);
      if (card.state !== State.New && card.last_review) {
        const retrievability = scheduler.get_retrievability(card, reviewDate, false);
        const clamped = Math.min(1 - LOG_LOSS_EPSILON, Math.max(LOG_LOSS_EPSILON, retrievability));
        totalLoss += review.recalled ? -Math.log(clamped) : -Math.log(1 - clamped);
        scoredReviews += 1;
      }
      card = scheduler.next(card, reviewDate, toFsrsRating(review.rating)).card;
    }
  }

  return {
    logLoss: scoredReviews > 0 ? totalLoss / scoredReviews : Number.POSITIVE_INFINITY,
    scoredReviews,
  };
}

export function optimizeFsrsWeights(
  reviewLogs: ReviewLog[],
  preset: LearningPreset,
  options?: WeightOptimizationOptions,
): WeightOptimizationResult {
  const { trainSplitRatio, sweeps, initialStepRatio, maxReviewLogs } = {
    ...DEFAULT_OPTIONS,
    ...options,
  };
  const currentParams = sanitizeFsrsParams(preset.fsrsParams);
  const histories = buildCardReplayHistories(reviewLogs, maxReviewLogs);

  const trainHistories: CardReplayHistory[] = [];
  const holdoutHistories: CardReplayHistory[] = [];
  for (const history of histories) {
    if ((hashCardId(history.cardId) % 100) / 100 < trainSplitRatio) {
      trainHistories.push(history);
    } else {
      holdoutHistories.push(history);
    }
  }

  const baselineTrain = computeReplayLogLoss(trainHistories, currentParams, preset.desiredRetention);
  const baselineHoldout = computeReplayLogLoss(holdoutHistories, currentParams, preset.desiredRetention);

  if (!Number.isFinite(baselineTrain.logLoss) || !Number.isFinite(baselineHoldout.logLoss)) {
    return {
      proposedParams: currentParams,
      currentParams,
      baselineHoldoutLogLoss: baselineHoldout.logLoss,
      optimizedHoldoutLogLoss: baselineHoldout.logLoss,
      trainReviewCount: baselineTrain.scoredReviews,
      holdoutReviewCount: baselineHoldout.scoredReviews,
      improved: false,
    };
  }

  // Koordinatenabstieg: pro Sweep jeden Parameter einzeln rauf/runter probieren,
  // Verbesserungen behalten, Schrittweite pro Sweep halbieren.
  let bestParams = [...currentParams];
  let bestTrainLoss = baselineTrain.logLoss;
  let stepRatio = initialStepRatio;

  for (let sweep = 0; sweep < sweeps; sweep += 1) {
    for (let paramIndex = 0; paramIndex < bestParams.length; paramIndex += 1) {
      const baseValue = bestParams[paramIndex];
      const stepSize = Math.max(0.01, Math.abs(baseValue) * stepRatio);

      for (const direction of [1, -1]) {
        const candidate = [...bestParams];
        candidate[paramIndex] = baseValue + direction * stepSize;
        const sanitized = sanitizeFsrsParams(candidate);
        const { logLoss } = computeReplayLogLoss(trainHistories, sanitized, preset.desiredRetention);
        if (logLoss < bestTrainLoss) {
          bestParams = sanitized;
          bestTrainLoss = logLoss;
          break;
        }
      }
    }
    stepRatio /= 2;
  }

  const optimizedHoldout = computeReplayLogLoss(holdoutHistories, bestParams, preset.desiredRetention);
  const improved =
    optimizedHoldout.scoredReviews > 0
    && optimizedHoldout.logLoss < baselineHoldout.logLoss
    && bestParams.some((value, index) => value !== currentParams[index]);

  return {
    proposedParams: improved ? bestParams : currentParams,
    currentParams,
    baselineHoldoutLogLoss: baselineHoldout.logLoss,
    optimizedHoldoutLogLoss: improved ? optimizedHoldout.logLoss : baselineHoldout.logLoss,
    trainReviewCount: baselineTrain.scoredReviews,
    holdoutReviewCount: baselineHoldout.scoredReviews,
    improved,
  };
}
