import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { type LearningCard, type LearningDeck, type ReviewRating } from '@/lib/learning';
import { hapticSuccess, hapticTick } from '@/lib/haptics';
import type { LearningReviewFeedbackEvent } from '@/modules/learning/store';
import type { LearningSessionController, LearningSessionSnapshot } from '@/modules/learning/session';
import { useLearningStore } from '@/store/useLearningStore';

export function useLearnReviewReviewActions({
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
  setBlockedUnlockSignal,
  setBlockedEasyHintVisible,
  setBlockedEasyPulseKey,
  setCompletedSessionVisible,
  setSelectedSessionCategories,
  setSelectedSessionEmotions,
  submitReview,
  syncSessionSnapshot,
  targetId,
  typedCorrect,
}: {
  activeDeck?: LearningDeck;
  countedReviews: number;
  currentCard?: LearningCard;
  easyRatingBlocked: boolean;
  enqueueDeferredWrite: (write: () => void) => void;
  handleRevealAnswer: () => void;
  isBlockedFlow: boolean;
  pendingCompletionKindRef: MutableRefObject<'review' | 'unlock' | null>;
  recordFeedback: (
    kind: LearningReviewFeedbackEvent['kind'],
    message: string,
    payload?: Record<string, unknown>,
  ) => LearningReviewFeedbackEvent;
  requiresTypedAnswer: boolean;
  reviewedCardIdsRef: MutableRefObject<Set<string>>;
  revealed: boolean;
  sessionControllerRef: MutableRefObject<LearningSessionController | null>;
  sessionCreditsRequired: number;
  setAwaitingEmotionSelection: Dispatch<SetStateAction<boolean>>;
  setBlockedUnlockSignal: Dispatch<SetStateAction<number>>;
  setBlockedEasyHintVisible: Dispatch<SetStateAction<boolean>>;
  setBlockedEasyPulseKey: Dispatch<SetStateAction<number>>;
  setCompletedSessionVisible: Dispatch<SetStateAction<boolean>>;
  setSelectedSessionCategories: Dispatch<SetStateAction<string[]>>;
  setSelectedSessionEmotions: Dispatch<SetStateAction<string[]>>;
  submitReview: ReturnType<typeof useLearningStore.getState>['submitReview'];
  syncSessionSnapshot: () => LearningSessionSnapshot | null;
  targetId?: string;
  typedCorrect: boolean | null;
}) {
  const handleUndoReview = useCallback(() => {
    const events = sessionControllerRef.current?.undo() ?? [];
    if (events.length === 0) {
      return;
    }

    const undoEvent = events.find((event) => event.type === 'undo-applied');
    if (undoEvent?.payload?.kind === 'review' && undoEvent.cardId) {
      useLearningStore.getState().revertReviewLog(undoEvent.cardId as string);
    }

    syncSessionSnapshot();
    pendingCompletionKindRef.current = null;
    setAwaitingEmotionSelection(false);
    setSelectedSessionCategories([]);
    setSelectedSessionEmotions([]);
    setCompletedSessionVisible(false);
    recordFeedback('undo', 'Letzte Bewertung wurde rückgängig gemacht.');
  }, [
    pendingCompletionKindRef,
    recordFeedback,
    sessionControllerRef,
    setAwaitingEmotionSelection,
    setCompletedSessionVisible,
    setSelectedSessionCategories,
    setSelectedSessionEmotions,
    syncSessionSnapshot,
  ]);

  const handleGoToPreviousCard = useCallback(() => {
    handleUndoReview();
  }, [handleUndoReview]);

  const handleGoToNextCard = useCallback(() => {
    if (revealed) {
      return;
    }

    handleRevealAnswer();
  }, [handleRevealAnswer, revealed]);

  const handleReview = useCallback(
    (rating: ReviewRating) => {
      if (!currentCard || !activeDeck) return;

      // Nach einer falschen Tipp-Eingabe bleiben nur "Nochmal" und "Schwer" —
      // "Gut"/"Leicht" wären bei nicht gewusster Antwort unehrlich (FSRS-Qualität).
      if (easyRatingBlocked && (rating === 'easy' || rating === 'good')) {
        setBlockedEasyHintVisible(true);
        setBlockedEasyPulseKey((current) => current + 1);
        recordFeedback('toast', 'Nach falscher Eingabe nur Nochmal oder Schwer.');
        return;
      }

      const wasCorrect = requiresTypedAnswer ? typedCorrect === true : rating !== 'again';
      reviewedCardIdsRef.current.add(currentCard.id);

      const events =
        sessionControllerRef.current?.grade(rating, {
          cardId: currentCard.id,
          now: Date.now(),
          wasCorrect,
        }) ?? [];
      const nextSnapshot = syncSessionSnapshot();
      const nextCountedReviews = nextSnapshot?.countedReviews ?? countedReviews;
      const sessionCompleted = events.some((event) => event.type === 'session-completed');

      // Haptik (4b.4): Erfolg beim Freischalten, sonst ein leichtes Tick.
      if (sessionCompleted && targetId && nextCountedReviews >= sessionCreditsRequired) {
        hapticSuccess();
      } else {
        hapticTick();
      }

      if (sessionCompleted) {
        const isUnlockCompletion = Boolean(targetId) && nextCountedReviews >= sessionCreditsRequired;
        pendingCompletionKindRef.current = isUnlockCompletion ? 'unlock' : 'review';
        setSelectedSessionCategories([]);
        setSelectedSessionEmotions([]);
        setCompletedSessionVisible(false);
        if (isUnlockCompletion) {
          // Blocking-Flow: KEIN Emotions-Schritt — direkt zur Freischaltung
          // (deterministisch, ohne kurzes Aufblitzen der Emotionsabfrage).
          setAwaitingEmotionSelection(false);
          setBlockedUnlockSignal((value) => value + 1);
        } else {
          setAwaitingEmotionSelection(true);
        }
      }

      const persistReview = () => {
        const reviewResult = submitReview(currentCard.id, rating, wasCorrect);
        if (!reviewResult) {
          return;
        }

        if (reviewResult.updatedCard.state === 'suspended') {
          recordFeedback('toast', 'Karte suspendiert (Leech-Schutz).');
        } else if (sessionCompleted) {
          recordFeedback('session-completed', 'Session abgeschlossen.');
        } else {
          recordFeedback('toast', 'Bewertung gespeichert.');
        }
      };

      if (isBlockedFlow) {
        persistReview();
      } else {
        enqueueDeferredWrite(persistReview);
      }
    },
    [
      activeDeck,
      countedReviews,
      currentCard,
      easyRatingBlocked,
      enqueueDeferredWrite,
      isBlockedFlow,
      pendingCompletionKindRef,
      recordFeedback,
      requiresTypedAnswer,
      reviewedCardIdsRef,
      sessionControllerRef,
      sessionCreditsRequired,
      setAwaitingEmotionSelection,
      setBlockedUnlockSignal,
      setBlockedEasyHintVisible,
      setBlockedEasyPulseKey,
      setCompletedSessionVisible,
      setSelectedSessionCategories,
      setSelectedSessionEmotions,
      submitReview,
      syncSessionSnapshot,
      targetId,
      typedCorrect,
    ],
  );

  return {
    handleGoToNextCard,
    handleGoToPreviousCard,
    handleReview,
    handleUndoReview,
  };
}
