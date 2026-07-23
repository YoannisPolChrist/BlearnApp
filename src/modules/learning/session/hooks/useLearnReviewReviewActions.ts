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
  enqueueDeferredWrite,
  handleRevealAnswer,
  isBlockedFlow,
  pendingCompletionKindRef,
  recordFeedback,
  reviewedCardIdsRef,
  revealed,
  sessionControllerRef,
  sessionCreditsRequired,
  setAwaitingEmotionSelection,
  setBlockedUnlockSignal,
  setCompletedSessionVisible,
  setSelectedSessionCategories,
  setSelectedSessionEmotions,
  submitReview,
  syncSessionSnapshot,
  targetId,
}: {
  activeDeck?: LearningDeck;
  countedReviews: number;
  currentCard?: LearningCard;
  enqueueDeferredWrite: (write: () => void) => void;
  handleRevealAnswer: () => void;
  isBlockedFlow: boolean;
  pendingCompletionKindRef: MutableRefObject<'review' | 'unlock' | null>;
  recordFeedback: (
    kind: LearningReviewFeedbackEvent['kind'],
    message: string,
    payload?: Record<string, unknown>,
  ) => LearningReviewFeedbackEvent;
  reviewedCardIdsRef: MutableRefObject<Set<string>>;
  revealed: boolean;
  sessionControllerRef: MutableRefObject<LearningSessionController | null>;
  sessionCreditsRequired: number;
  setAwaitingEmotionSelection: Dispatch<SetStateAction<boolean>>;
  setBlockedUnlockSignal: Dispatch<SetStateAction<number>>;
  setCompletedSessionVisible: Dispatch<SetStateAction<boolean>>;
  setSelectedSessionCategories: Dispatch<SetStateAction<string[]>>;
  setSelectedSessionEmotions: Dispatch<SetStateAction<string[]>>;
  submitReview: ReturnType<typeof useLearningStore.getState>['submitReview'];
  syncSessionSnapshot: () => LearningSessionSnapshot | null;
  targetId?: string;
}) {
  const handleUndoReview = useCallback(() => {
    const events = sessionControllerRef.current?.undo() ?? [];
    if (events.length === 0) {
      return;
    }

    const undoEvent = events.find((event) => event.type === 'undo-applied');
    if (undoEvent?.payload?.kind === 'review' && undoEvent.cardId) {
      const undoneCardId = undoEvent.cardId as string;
      useLearningStore.getState().revertReviewLog(undoneCardId);
      // Die Karte ist wieder offen — aus dem "bereits bewertet"-Set entfernen,
      // sonst schließt der Blocking-Flow sie aus der Vorschau/Neu-Bootstrap aus
      // und die Fortschrittsanzeige (Rest, nächste neue Karte) zählt zu niedrig.
      reviewedCardIdsRef.current.delete(undoneCardId);
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
    reviewedCardIdsRef,
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

      const wasCorrect = rating !== 'again';
      reviewedCardIdsRef.current.add(currentCard.id);

      const events =
        sessionControllerRef.current?.grade(rating, {
          cardId: currentCard.id,
          now: Date.now(),
          wasCorrect,
        }) ?? [];
      const nextSnapshot = syncSessionSnapshot();
      const sessionCompleted = events.some((event) => event.type === 'session-completed');
      // Im Blocking-Flow garantiert das Re-Queue (sessionController.grade), dass die
      // Queue erst leerläuft, wenn jede Karte einen Credit verdient hat — Abschluss
      // bedeutet also: die erreichbare Aufgabe ist erfüllt → freischalten. Damit kann
      // eine falsche Antwort nicht mehr in der Sackgasse "fertig, aber nicht frei" enden.
      const isUnlockCompletion = sessionCompleted && Boolean(targetId);

      // Haptik (4b.4): Erfolg beim Freischalten, sonst ein leichtes Tick.
      if (isUnlockCompletion) {
        hapticSuccess();
      } else {
        hapticTick();
      }

      if (sessionCompleted) {
        pendingCompletionKindRef.current = isUnlockCompletion ? 'unlock' : 'review';
        setSelectedSessionCategories([]);
        setSelectedSessionEmotions([]);
        setCompletedSessionVisible(false);
        // BEIDE Flows zeigen jetzt den Emotions-Check-in (User-Wunsch: im
        // Blocking-Flow wieder Emotionen wählen). Sicher gegen den alten #10-Bug
        // ("beantwortet, aber schaltet nicht frei"), weil completeSessionEmotionStep
        // danach finishUnlock aufruft und finishUnlock die Freischaltung synchron
        // erteilt + den Erfolgs-Screen ohne await zeigt — es kann also nie an einem
        // hängenden Async-Schritt scheitern.
        setAwaitingEmotionSelection(true);
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
      currentCard,
      enqueueDeferredWrite,
      isBlockedFlow,
      pendingCompletionKindRef,
      recordFeedback,
      reviewedCardIdsRef,
      sessionControllerRef,
      setAwaitingEmotionSelection,
      setCompletedSessionVisible,
      setSelectedSessionCategories,
      setSelectedSessionEmotions,
      submitReview,
      syncSessionSnapshot,
      targetId,
    ],
  );

  return {
    handleGoToNextCard,
    handleGoToPreviousCard,
    handleReview,
    handleUndoReview,
  };
}
