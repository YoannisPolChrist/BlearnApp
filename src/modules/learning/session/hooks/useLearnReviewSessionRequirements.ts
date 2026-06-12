import { useMemo } from 'react';
import {
  buildUnlockSessionCandidateIds,
  clampRequiredCorrectReviews,
  getDefaultGateRule,
  resolveSessionCreditsRequired,
  type GateRule,
  type LearningCard,
  type LearningPreset,
  type ReviewLog,
} from '@/lib/learning';

const EMPTY_STRING_LIST: string[] = [];

export function useLearnReviewSessionRequirements({
  activeDeckCards,
  activeDeckId,
  activeDeckReviewLogs,
  activePreset,
  assignment,
  gateRule,
  isBlockedFlow,
  learningHydrated,
  sessionUnlockDurationMinutes,
}: {
  activeDeckCards: LearningCard[];
  activeDeckId?: string;
  activeDeckReviewLogs: ReviewLog[];
  activePreset?: LearningPreset;
  assignment?: {
    sessionCreditsRequired?: number;
    unlockDurationMinutes?: number;
  };
  gateRule: Partial<GateRule>;
  isBlockedFlow: boolean;
  learningHydrated: boolean;
  sessionUnlockDurationMinutes: number | null;
}) {
  const configuredSessionCreditsRequired = resolveSessionCreditsRequired(
    assignment,
    resolveSessionCreditsRequired(gateRule, getDefaultGateRule().sessionCreditsRequired),
  );
  const reviewSessionCandidateIds = useMemo(
    () =>
      learningHydrated && activeDeckId
        ? buildUnlockSessionCandidateIds({
            cards: activeDeckCards,
            deckId: activeDeckId,
            reviewLogs: activeDeckReviewLogs,
            preset: activePreset,
            gateRule,
            ignoreNewCardsLimit: true,
            includeReviewAhead: !isBlockedFlow,
            now: Date.now(),
          })
        : EMPTY_STRING_LIST,
    [
      activeDeckCards,
      activeDeckId,
      activeDeckReviewLogs,
      activePreset,
      gateRule,
      isBlockedFlow,
      learningHydrated,
    ],
  );
  const sessionCreditsRequired = activeDeckCards.length > 0
    ? Math.min(
        clampRequiredCorrectReviews(configuredSessionCreditsRequired, activeDeckCards.length),
        activeDeckCards.length,
      )
    : configuredSessionCreditsRequired;
  const reviewSessionCreditsRequired = reviewSessionCandidateIds.length > 0
    ? reviewSessionCandidateIds.length
    : activeDeckCards.length;
  const effectiveSessionCreditsRequired = isBlockedFlow
    ? sessionCreditsRequired
    : reviewSessionCreditsRequired;
  const unlockDurationMinutes =
    sessionUnlockDurationMinutes ??
    assignment?.unlockDurationMinutes ??
    gateRule.unlockDurationMinutes ??
    getDefaultGateRule().unlockDurationMinutes;
  const typedAnswerMaxWords = gateRule.typedAnswerMaxWords ?? getDefaultGateRule().typedAnswerMaxWords;
  const typedAnswerEnabled = gateRule.typedAnswerEnabled ?? getDefaultGateRule().typedAnswerEnabled;

  return {
    effectiveSessionCreditsRequired,
    reviewSessionCreditsRequired,
    sessionCreditsRequired,
    typedAnswerEnabled,
    typedAnswerMaxWords,
    unlockDurationMinutes,
  };
}
