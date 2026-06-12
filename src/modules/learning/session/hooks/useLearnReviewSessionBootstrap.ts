import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import {
  type BlockTargetType,
  type GateRule,
  type LearningCard,
  type LearningPreset,
  type ReviewLog,
} from '@/lib/learning';
import type { LearningReviewFeedbackEvent } from '@/modules/learning/store';
import {
  createLearningSessionController,
  createReviewSessionSnapshotFromCards,
  createUnlockSessionSnapshotFromContext,
  type LearningSessionController,
  type LearningSessionSnapshot,
} from '@/modules/learning/session';

export function useLearnReviewSessionBootstrap({
  activeDeckCards,
  activeDeckId,
  activeDeckReviewLogs,
  activePreset,
  awaitingEmotionSelection,
  completedSessionVisible,
  effectiveSessionCreditsRequired,
  gateRule,
  isBlockedFlow,
  learningHydrated,
  overlaySuccessVisible,
  pendingCompletionKindRef,
  reviewedCardIdsRef,
  reviewSessionCreditsRequired,
  sessionControllerRef,
  sessionCreditsRequired,
  setActiveDeck,
  setAwaitingEmotionSelection,
  setBlockedEasyHintVisible,
  setBlockedEasyPulseKey,
  setCompletedSessionVisible,
  setFeedbackEvents,
  setSelectedSessionCategories,
  setSelectedSessionEmotions,
  setSessionSnapshot,
  targetId,
  targetType,
  unlockDurationMinutes,
}: {
  activeDeckCards: LearningCard[];
  activeDeckId?: string;
  activeDeckReviewLogs: ReviewLog[];
  activePreset?: LearningPreset;
  awaitingEmotionSelection: boolean;
  completedSessionVisible: boolean;
  effectiveSessionCreditsRequired: number;
  gateRule: Partial<GateRule>;
  isBlockedFlow: boolean;
  learningHydrated: boolean;
  overlaySuccessVisible: boolean;
  pendingCompletionKindRef: MutableRefObject<'review' | 'unlock' | null>;
  reviewedCardIdsRef: MutableRefObject<Set<string>>;
  reviewSessionCreditsRequired: number;
  sessionControllerRef: MutableRefObject<LearningSessionController | null>;
  sessionCreditsRequired: number;
  setActiveDeck: (deckId: string) => void;
  setAwaitingEmotionSelection: Dispatch<SetStateAction<boolean>>;
  setBlockedEasyHintVisible: Dispatch<SetStateAction<boolean>>;
  setBlockedEasyPulseKey: Dispatch<SetStateAction<number>>;
  setCompletedSessionVisible: Dispatch<SetStateAction<boolean>>;
  setFeedbackEvents: Dispatch<SetStateAction<LearningReviewFeedbackEvent[]>>;
  setSelectedSessionCategories: Dispatch<SetStateAction<string[]>>;
  setSelectedSessionEmotions: Dispatch<SetStateAction<string[]>>;
  setSessionSnapshot: Dispatch<SetStateAction<LearningSessionSnapshot | undefined>>;
  targetId?: string;
  targetType: BlockTargetType;
  unlockDurationMinutes: number;
}) {
  useEffect(() => {
    if (!learningHydrated || !activeDeckId) {
      return;
    }

    setActiveDeck(activeDeckId);
  }, [activeDeckId, learningHydrated, setActiveDeck]);

  useEffect(() => {
    if (!learningHydrated) {
      return;
    }

    const currentSession = sessionControllerRef.current?.getSnapshot();
    const preserveCompletionFlow =
      awaitingEmotionSelection ||
      pendingCompletionKindRef.current !== null ||
      completedSessionVisible ||
      overlaySuccessVisible;

    if (currentSession && preserveCompletionFlow) {
      return;
    }

    const sessionKind = isBlockedFlow ? 'unlock' : 'review';
    const sessionIdentityChanged =
      !currentSession ||
      currentSession.kind !== sessionKind ||
      currentSession.deckId !== activeDeckId ||
      currentSession.targetId !== targetId ||
      currentSession.targetType !== targetType ||
      currentSession.unlockDurationMinutes !== unlockDurationMinutes;
    const sessionLengthChangedBeforeProgress = Boolean(
      currentSession
      && currentSession.sessionCreditsRequired !== effectiveSessionCreditsRequired
      && currentSession.history.length === 0
      && currentSession.countedReviews === 0
      && !currentSession.revealed,
    );
    const shouldBootstrapSession = sessionIdentityChanged || sessionLengthChangedBeforeProgress;

    if (!shouldBootstrapSession && sessionControllerRef.current) {
      return;
    }

    if (!currentSession || currentSession.deckId !== activeDeckId) {
      reviewedCardIdsRef.current.clear();
    }

    const unlockSnapshot = createUnlockSessionSnapshotFromContext({
      cards: activeDeckCards,
      notes: [],
      reviewLogs: activeDeckReviewLogs,
      deckId: activeDeckId,
      targetId,
      targetType,
      preset: activePreset,
      gateRule,
      sessionCreditsRequired,
      unlockDurationMinutes,
      ignoreNewCardsLimit: true,
      includeReviewAhead: false,
      excludeCardIds: reviewedCardIdsRef.current,
      now: Date.now(),
    });
    const reviewSnapshot = {
      ...createReviewSessionSnapshotFromCards(activeDeckCards, reviewSessionCreditsRequired, Date.now()),
      deckId: activeDeckId,
      unlockDurationMinutes,
      targetId,
      targetType,
    };
    const nextSnapshot = isBlockedFlow ? unlockSnapshot : reviewSnapshot;

    sessionControllerRef.current = createLearningSessionController(nextSnapshot);
    setSessionSnapshot(nextSnapshot);
    setFeedbackEvents([]);
    setAwaitingEmotionSelection(false);
    setSelectedSessionCategories([]);
    setSelectedSessionEmotions([]);
    setCompletedSessionVisible(false);
    pendingCompletionKindRef.current = null;
    setBlockedEasyHintVisible(false);
    setBlockedEasyPulseKey(0);
  }, [
    activeDeckCards,
    activeDeckId,
    activeDeckReviewLogs,
    activePreset,
    awaitingEmotionSelection,
    completedSessionVisible,
    effectiveSessionCreditsRequired,
    gateRule,
    isBlockedFlow,
    learningHydrated,
    overlaySuccessVisible,
    pendingCompletionKindRef,
    reviewedCardIdsRef,
    reviewSessionCreditsRequired,
    sessionControllerRef,
    sessionCreditsRequired,
    setAwaitingEmotionSelection,
    setBlockedEasyHintVisible,
    setBlockedEasyPulseKey,
    setCompletedSessionVisible,
    setFeedbackEvents,
    setSelectedSessionCategories,
    setSelectedSessionEmotions,
    setSessionSnapshot,
    targetId,
    targetType,
    unlockDurationMinutes,
  ]);
}
