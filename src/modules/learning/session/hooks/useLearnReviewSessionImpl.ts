import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import {
  getReviewIntervalPreview,
  type BlockTargetType,
} from '@/lib/learning';
import { useOverlayDismissGuard } from '@/hooks/useOverlayDismissGuard';
import { getBlockingFlowQueryContext } from '@/lib/blockingFlowContext';
import { isAndroidPlatform } from '@/lib/platform';
import type { LearningReviewFeedbackEvent } from '@/modules/learning/store';
import {
  resolveAvailableDeckId,
  type LearningSessionController,
  type LearningSessionSnapshot,
} from '@/modules/learning/session';
import { reportFirstCardInteractive } from '@/modules/learning/session/sessionLatency';
import {
  clearSessionResumeSnapshot,
  saveSessionResumeSnapshot,
} from '@/modules/learning/session/sessionResumeSlot';
import { useAppStore } from '@/store/useAppStore';
import { useLearningStore } from '@/store/useLearningStore';
import { useLearnReviewBlockedNavigation } from './useLearnReviewBlockedNavigation';
import { useActiveLearningDeckData } from './useActiveLearningDeckData';
import { useDeferredReviewWrites } from './useDeferredReviewWrites';
import { useLearningHydrationFlag } from './useLearningHydrationFlag';
import { useLearnReviewDerivedState } from './useLearnReviewDerivedState';
import { useLearnReviewReviewActions } from './useLearnReviewReviewActions';
import { useLearnReviewSessionBootstrap } from './useLearnReviewSessionBootstrap';
import { useLearnReviewSessionCompletion } from './useLearnReviewSessionCompletion';
import { useLearnReviewSessionRequirements } from './useLearnReviewSessionRequirements';
import { useLearnReviewStrictFallback } from './useLearnReviewStrictFallback';
import { useLearnReviewTypedAnswerFlow } from './useLearnReviewTypedAnswerFlow';
import { useLearningSessionScopeRevisions } from './useLearningSessionScopeRevisions';

function parsePositiveInteger(value: string | null) {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function createFeedbackEvent(
  kind: LearningReviewFeedbackEvent['kind'],
  message: string,
  payload?: Record<string, unknown>,
): LearningReviewFeedbackEvent {
  return {
    id: `review-feedback_${Math.random().toString(36).slice(2, 10)}`,
    kind,
    message,
    createdAt: Date.now(),
    payload,
  };
}

export function useLearnReviewSession() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const blockingFlow = getBlockingFlowQueryContext(searchParams);
  const deckId = searchParams.get('deckId') || undefined;
  const targetId = blockingFlow.targetId;
  const targetType = blockingFlow.targetType as BlockTargetType;
  const overlaySessionId = blockingFlow.overlaySessionId;
  const targetLabel = blockingFlow.targetLabel;
  const sessionUnlockDurationMinutes = parsePositiveInteger(searchParams.get('unlockDurationMinutes'));
  const routeSuccess = searchParams.get('success') === 'true';
  const isBlockedFlow = blockingFlow.isBlockedFlow;
  const isAndroidOverlayUnlockFlow = isAndroidPlatform && blockingFlow.isOverlayBlockingFlow;
  const learningHydrated = useLearningHydrationFlag();

  const gateRule = useLearningStore((state) => state.gateRule);
  const assignment = useLearningStore(
    useCallback(
      (state) =>
        targetId
          ? state.getAssignmentForTarget(targetId, targetType)
          : undefined,
      [targetId, targetType],
    ),
  );
  const activeDeckId = useLearningStore(
    useCallback(
      (state) =>
        resolveAvailableDeckId({
          preferredDeckIds: [assignment?.deckId, deckId, state.activeDeckId],
          decks: Object.values(state.decks),
          cards: Object.values(state.cards),
        }),
      [assignment?.deckId, deckId],
    ),
  );
  const {
    deckScopeRevision,
    presetScopeRevision,
    cardScopeRevision,
    reviewLogScopeRevision,
  } = useLearningSessionScopeRevisions(activeDeckId, isBlockedFlow);
  const activeDeckDataRevision = `${deckScopeRevision}__${presetScopeRevision}__${cardScopeRevision}__${reviewLogScopeRevision}`;
  const {
    seedStarterDeck,
    submitReview,
    registerUnlockGrant,
    setActiveDeck,
    getResolvedPresetForDeck,
  } = useLearningStore(
    useShallow((state) => ({
      seedStarterDeck: state.seedStarterDeck,
      submitReview: state.submitReview,
      registerUnlockGrant: state.registerUnlockGrant,
      setActiveDeck: state.setActiveDeck,
      getResolvedPresetForDeck: state.getResolvedPresetForDeck,
    })),
  );
  const { addCheckin, addInteraction, unlockTarget } = useAppStore(
    useShallow((state) => ({
      addCheckin: state.addCheckin,
      addInteraction: state.addInteraction,
      unlockTarget: state.unlockTarget,
    })),
  );
  const [overlaySuccessVisible, setOverlaySuccessVisible] = useState(false);
  const [overlaySuccessHandled, setOverlaySuccessHandled] = useState(false);
  const [awaitingEmotionSelection, setAwaitingEmotionSelection] = useState(false);
  const [selectedSessionCategories, setSelectedSessionCategories] = useState<string[]>([]);
  const [selectedSessionEmotions, setSelectedSessionEmotions] = useState<string[]>([]);
  const [completedSessionVisible, setCompletedSessionVisible] = useState(false);
  const [blockedEasyHintVisible, setBlockedEasyHintVisible] = useState(false);
  const [blockedEasyPulseKey, setBlockedEasyPulseKey] = useState(0);
  const [typedAnswerDraft, setTypedAnswerDraft] = useState('');
  const [sessionSnapshot, setSessionSnapshot] = useState<LearningSessionSnapshot>();
  const [feedbackEvents, setFeedbackEvents] = useState<LearningReviewFeedbackEvent[]>([]);
  const pendingCompletionKindRef = useRef<'review' | 'unlock' | null>(null);
  const sessionControllerRef = useRef<LearningSessionController | null>(null);
  const reviewedCardIdsRef = useRef<Set<string>>(new Set());
  const exhaustedBlockedFlowAutoUnlockKeyRef = useRef<string | null>(null);
  const { enqueueDeferredWrite, runPendingReviewWrites } = useDeferredReviewWrites();
  const success = routeSuccess || completedSessionVisible;
  const { dismissOnce } = useOverlayDismissGuard({
    active: isAndroidOverlayUnlockFlow,
    overlaySessionId,
  });

  const {
    activeDeck,
    activePreset,
    activeDeckCards,
    activeDeckReviewLogs,
    activeDeckCardById,
    activeDeckCardStateById,
  } = useActiveLearningDeckData({
    activeDeckId,
    activeDeckDataRevision,
    getResolvedPresetForDeck,
    isBlockedFlow,
  });
  const {
    effectiveSessionCreditsRequired,
    reviewSessionCreditsRequired,
    sessionCreditsRequired,
    typedAnswerEnabled,
    typedAnswerMaxWords,
    unlockDurationMinutes,
  } = useLearnReviewSessionRequirements({
    activeDeckCards,
    activeDeckId,
    activeDeckReviewLogs,
    activePreset,
    assignment,
    gateRule,
    isBlockedFlow,
    learningHydrated,
    sessionUnlockDurationMinutes,
  });

  useLearnReviewSessionBootstrap({
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
  });

  const syncSessionSnapshot = useCallback(() => {
    const nextSnapshot = sessionControllerRef.current?.serialize();
    if (!nextSnapshot) {
      return null;
    }

    startTransition(() => {
      setSessionSnapshot(nextSnapshot);
    });
    return nextSnapshot;
  }, []);

  const recordFeedback = useCallback(
    (
      kind: LearningReviewFeedbackEvent['kind'],
      message: string,
      payload?: Record<string, unknown>,
    ) => {
      const nextEvent = createFeedbackEvent(kind, message, {
        targetId,
        targetType,
        deckId: activeDeckId,
        ...payload,
      });
      startTransition(() => {
        setFeedbackEvents((current) => [nextEvent, ...current].slice(0, 25));
      });
      return nextEvent;
    },
    [activeDeckId, targetId, targetType],
  );

  const currentSnapshot = sessionControllerRef.current?.getSnapshot() ?? sessionSnapshot;
  const {
    answerIsLong,
    attemptMessage,
    blockedFlowExhausted,
    blockedTargetLabel,
    canUndo,
    cardAnswer,
    cardAnswerHtml,
    cardPrompt,
    cardPromptHtml,
    cardTemplateClass,
    cardTemplateCss,
    countedReviews,
    currentCard,
    currentCardKindLabel,
    currentCardPosition,
    currentNote,
    currentStateMeta,
    easyRatingBlocked,
    effectiveCorrect,
    hasRichTemplateHtml,
    hasUsableLearningDeck,
    latestFeedbackMessage,
    nextNewCardLabel,
    progressPercent,
    promptIsLong,
    remainingAttempts,
    remainingCount,
    remainingNewCount,
    remainingReviewCount,
    requiresTypedAnswer,
    revealed,
    reviewMixLabel,
    sessionCardCount,
    sessionStartedAt,
    showTimer,
    totalCandidateCount,
    typedAnswer,
    typedAnswerMatchKind,
    typedCorrect,
  } = useLearnReviewDerivedState({
    activeDeck,
    activeDeckCardById,
    activeDeckCardStateById,
    activeDeckCards,
    activeDeckId,
    activeDeckReviewLogs,
    activePreset,
    awaitingEmotionSelection,
    currentSnapshot,
    effectiveSessionCreditsRequired,
    feedbackEvents,
    gateRule,
    isBlockedFlow,
    learningHydrated,
    reviewedCardIdsRef,
    targetId,
    targetLabel,
    typedAnswerEnabled,
    typedAnswerMaxWords,
  });

  useEffect(() => {
    setTypedAnswerDraft(typedAnswer);
  }, [currentCard?.id, revealed, typedAnswer]);

  // Latenz-Budget 2.3: erste interaktive Karte im Blocking-Flow loggen (< 800 ms Ziel).
  useEffect(() => {
    if (isBlockedFlow && currentCard) {
      reportFirstCardInteractive();
    }
  }, [currentCard, isBlockedFlow]);

  // Session-Resume (5.4): aktiven Fortschritt synchron sichern, damit ein
  // Prozess-Tod die Session nicht zurücksetzt; Abschluss räumt den Slot.
  useEffect(() => {
    if (!currentSnapshot) {
      return;
    }
    if (currentSnapshot.status === 'completed') {
      clearSessionResumeSnapshot();
      return;
    }
    saveSessionResumeSnapshot(currentSnapshot);
  }, [currentSnapshot, currentSnapshot?.status, currentSnapshot?.updatedAt]);

  useLearnReviewStrictFallback({
    activeDeckId,
    assignmentDeckId: assignment?.deckId,
    deckId,
    hasUsableLearningDeck,
    isBlockedFlow,
    learningHydrated,
    navigate,
    searchParams,
    success,
    targetId,
    targetType,
  });

  const intervalPreviews = useMemo(() => {
    if (!currentCard) return null;

    const now = Date.now();
    return {
      again: getReviewIntervalPreview(currentCard, 'again', effectiveCorrect, activePreset, now),
      hard: getReviewIntervalPreview(currentCard, 'hard', effectiveCorrect, activePreset, now),
      good: getReviewIntervalPreview(currentCard, 'good', effectiveCorrect, activePreset, now),
      easy: getReviewIntervalPreview(currentCard, 'easy', effectiveCorrect, activePreset, now),
    };
  }, [activePreset, currentCard, effectiveCorrect]);

  const {
    goBack,
    handleContinueToTarget,
    handleFallbackToStrictBreathing,
    handleOverlaySuccessDone,
    openLearnHub,
  } = useLearnReviewBlockedNavigation({
    dismissOnce,
    isAndroidOverlayUnlockFlow,
    isBlockedFlow,
    navigate,
    overlaySessionId,
    overlaySuccessHandled,
    searchParams,
    setOverlaySuccessHandled,
    targetId,
    targetType,
    unlockDurationMinutes,
  });

  const { handleCheckTypedAnswer, handleRevealAnswer } = useLearnReviewTypedAnswerFlow({
    currentCard,
    currentNote,
    recordFeedback,
    requiresTypedAnswer,
    sessionControllerRef,
    syncSessionSnapshot,
    typedAnswerDraft,
    typedAnswerEnabled,
    typedAnswerMaxWords,
  });

  const {
    handleGoToNextCard,
    handleGoToPreviousCard,
    handleReview,
    handleUndoReview,
  } = useLearnReviewReviewActions({
    activeDeck,
    countedReviews,
    currentCard,
    easyRatingBlocked,
    enqueueDeferredWrite,
    handleRevealAnswer,
    isBlockedFlow,
    pendingCompletionKindRef,
    recordFeedback,
    requiresTypedAnswer,
    reviewedCardIdsRef,
    revealed,
    sessionControllerRef,
    sessionCreditsRequired,
    setAwaitingEmotionSelection,
    setBlockedEasyHintVisible,
    setBlockedEasyPulseKey,
    setCompletedSessionVisible,
    setSelectedSessionCategories,
    setSelectedSessionEmotions,
    submitReview,
    syncSessionSnapshot,
    targetId,
    typedCorrect,
  });

  const {
    completeSessionEmotionStep,
    toggleSessionCategory,
    toggleSessionEmotion,
  } = useLearnReviewSessionCompletion({
    activeDeck,
    addCheckin,
    addInteraction,
    awaitingEmotionSelection,
    blockedFlowExhausted,
    exhaustedBlockedFlowAutoUnlockKeyRef,
    handleContinueToTarget,
    pendingCompletionKindRef,
    recordFeedback,
    registerUnlockGrant,
    runPendingReviewWrites,
    selectedSessionEmotions,
    sessionCreditsRequired,
    setAwaitingEmotionSelection,
    setCompletedSessionVisible,
    setSelectedSessionCategories,
    setSelectedSessionEmotions,
    targetId,
    targetType,
    unlockDurationMinutes,
    unlockTarget,
  });

  return {
    activeDeck,
    answerIsLong,
    attemptMessage,
    blockedEasyHintVisible,
    blockedEasyPulseKey,
    blockedFlowExhausted,
    blockedTargetLabel,
    canUndo,
    cardAnswer,
    cardAnswerHtml,
    cardPrompt,
    cardPromptHtml,
    cardTemplateClass,
    cardTemplateCss,
    hasRichTemplateHtml,
    countedReviews,
    currentCard,
    currentCardKindLabel,
    currentCardPosition,
    currentNote,
    currentStateMeta,
    easyRatingBlocked,
    goBack,
    handleGoToNextCard,
    handleGoToPreviousCard,
    handleCheckTypedAnswer,
    handleContinueToTarget,
    handleFallbackToStrictBreathing,
    handleOverlaySuccessDone,
    handleRevealAnswer,
    handleReview,
    handleUndoReview,
    hasUsableLearningDeck,
    awaitingEmotionSelection,
    intervalPreviews,
    isBlockedFlow,
    learningHydrated,
    latestFeedbackMessage,
    openLearnHub,
    overlaySuccessVisible,
    progressPercent,
    promptIsLong,
    nextNewCardLabel,
    remainingNewCount,
    remainingReviewCount,
    remainingAttempts,
    remainingCount,
    requiresTypedAnswer,
    completeSessionEmotionStep,
    selectedSessionCategories,
    selectedSessionEmotions,
    toggleSessionCategory,
    toggleSessionEmotion,
    revealed,
    reviewMixLabel,
    sessionCardCount,
    sessionCreditsRequired,
    sessionStartedAt,
    setTypedAnswer: setTypedAnswerDraft,
    showTimer,
    submittedTypedAnswer: typedAnswer,
    success,
    targetId,
    targetType,
    totalCandidateCount,
    typedAnswer: typedAnswerDraft,
    typedAnswerMatchKind,
    typedCorrect,
    unlockDurationMinutes,
  };
}
