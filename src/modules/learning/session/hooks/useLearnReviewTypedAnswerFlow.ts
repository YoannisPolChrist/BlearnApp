import { useCallback, type MutableRefObject } from 'react';
import {
  MAX_TYPED_ANSWER_ATTEMPTS,
  type LearningCard,
  type LearningNote,
} from '@/lib/learning';
import {
  evaluateTypedAnswer,
  type LearningSessionController,
  type LearningSessionSnapshot,
} from '@/modules/learning/session';
import type { LearningReviewFeedbackEvent } from '@/modules/learning/store';

type RecordFeedback = (
  kind: LearningReviewFeedbackEvent['kind'],
  message: string,
  payload?: Record<string, unknown>,
) => LearningReviewFeedbackEvent;

interface UseLearnReviewTypedAnswerFlowInput {
  currentCard: LearningCard | undefined;
  currentNote: LearningNote | undefined;
  recordFeedback: RecordFeedback;
  requiresTypedAnswer: boolean;
  sessionControllerRef: MutableRefObject<LearningSessionController | null>;
  syncSessionSnapshot: () => LearningSessionSnapshot | null;
  typedAnswerDraft: string;
  typedAnswerEnabled: boolean;
  typedAnswerMaxWords: number;
}

export function useLearnReviewTypedAnswerFlow({
  currentCard,
  currentNote,
  recordFeedback,
  requiresTypedAnswer,
  sessionControllerRef,
  syncSessionSnapshot,
  typedAnswerDraft,
  typedAnswerEnabled,
  typedAnswerMaxWords,
}: UseLearnReviewTypedAnswerFlowInput) {
  const handleCheckTypedAnswer = useCallback(() => {
    if (!currentCard || !currentNote || !requiresTypedAnswer) return;

    if (!typedAnswerDraft.trim()) {
      sessionControllerRef.current?.setAttemptMessage('Erst antworten');
      syncSessionSnapshot();
      recordFeedback('toast', 'Erst antworten');
      return;
    }

    const events =
      sessionControllerRef.current?.submitTypedAnswer(typedAnswerDraft, {
        card: currentCard,
        note: currentNote,
        now: Date.now(),
        typedAnswerEnabled,
        typedAnswerMaxWords,
      }) ?? [];

    syncSessionSnapshot();
    const evaluationEvent = events.find((event) => event.type === 'typed-answer-evaluated');
    if (evaluationEvent?.message) {
      recordFeedback('toast', evaluationEvent.message);
    }
    if (events.some((event) => event.type === 'session-revealed')) {
      recordFeedback('toast', 'Lösung angezeigt');
    }
  }, [
    currentCard,
    currentNote,
    recordFeedback,
    requiresTypedAnswer,
    sessionControllerRef,
    syncSessionSnapshot,
    typedAnswerDraft,
    typedAnswerEnabled,
    typedAnswerMaxWords,
  ]);

  const handleRevealAnswer = useCallback(() => {
    if (!currentCard || !currentNote) return;

    const controller = sessionControllerRef.current;
    controller?.setTypedAnswer(typedAnswerDraft);

    if (requiresTypedAnswer) {
      const trimmedTypedAnswer = typedAnswerDraft.trim();
      if (!trimmedTypedAnswer) {
        controller?.setTypedCorrect(false);
        controller?.setAttemptMessage(null);
      } else {
        const evaluation = evaluateTypedAnswer(currentCard, currentNote, typedAnswerDraft, {
          maxAttempts: MAX_TYPED_ANSWER_ATTEMPTS,
          typedAnswerEnabled,
          typedAnswerMaxWords,
        });
        controller?.setTypedCorrect(evaluation.correct);
        controller?.setAttemptMessage(evaluation.correct ? evaluation.message : null);
      }
    } else {
      controller?.setTypedCorrect(null);
      controller?.setAttemptMessage(null);
    }

    controller?.reveal(Date.now());
    syncSessionSnapshot();
    recordFeedback('toast', 'Lösung angezeigt');
  }, [
    currentCard,
    currentNote,
    recordFeedback,
    requiresTypedAnswer,
    sessionControllerRef,
    syncSessionSnapshot,
    typedAnswerDraft,
    typedAnswerEnabled,
    typedAnswerMaxWords,
  ]);

  return {
    handleCheckTypedAnswer,
    handleRevealAnswer,
  };
}
