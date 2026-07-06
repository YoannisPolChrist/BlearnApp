import { useCallback, useMemo, type MutableRefObject } from 'react';
import { stateMeta } from '@/components/learn-review/meta';
import {
  MAX_TYPED_ANSWER_ATTEMPTS,
  buildUnlockSessionCandidateIds,
  getCardAnswer,
  getCardAnswerHtml,
  getCardPrompt,
  getCardPromptHtml,
  getCardTemplateClass,
  getCardTemplateCss,
  getTypedAnswerMatchKind,
  shouldRequireTypedAnswer,
  type GateRule,
  type LearningCard,
  type LearningDeck,
  type LearningPreset,
  type ReviewLog,
} from '@/lib/learning';
import { buildLearnReviewProgress, formatReviewMixLabel } from '@/lib/view-models/learn';
import type { LearningReviewFeedbackEvent } from '@/modules/learning/store';
import type { LearningSessionSnapshot } from '@/modules/learning/session';
import { buildNextNewCardStatus } from '@/modules/learning/session/nextNewCardStatus';
import { useLearningStore } from '@/store/useLearningStore';

const EMPTY_STRING_LIST: string[] = [];

export function useLearnReviewDerivedState({
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
}: {
  activeDeck?: LearningDeck;
  activeDeckCardById: Record<string, LearningCard>;
  activeDeckCardStateById: Record<string, LearningCard['state']>;
  activeDeckCards: LearningCard[];
  activeDeckId?: string;
  activeDeckReviewLogs: ReviewLog[];
  activePreset?: LearningPreset;
  awaitingEmotionSelection: boolean;
  currentSnapshot?: LearningSessionSnapshot;
  effectiveSessionCreditsRequired: number;
  feedbackEvents: LearningReviewFeedbackEvent[];
  gateRule: Partial<GateRule>;
  isBlockedFlow: boolean;
  learningHydrated: boolean;
  reviewedCardIdsRef: MutableRefObject<Set<string>>;
  targetId?: string;
  targetLabel?: string;
  typedAnswerEnabled: boolean;
  typedAnswerMaxWords: number;
}) {
  const previewCandidateIds = useMemo(
    () =>
      learningHydrated && activeDeckId
        ? buildUnlockSessionCandidateIds({
            cards: activeDeckCards,
            deckId: activeDeckId,
            reviewLogs: activeDeckReviewLogs,
            preset: activePreset,
            gateRule,
            ignoreNewCardsLimit: false,
            includeReviewAhead: !isBlockedFlow,
            excludeCardIds: isBlockedFlow ? reviewedCardIdsRef.current : undefined,
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
      reviewedCardIdsRef,
    ],
  );

  const currentCard = useMemo(() => {
    const reviewQueue = currentSnapshot?.queue ?? [];
    const currentCardId = currentSnapshot?.currentCardId ?? reviewQueue[0];
    if (!currentCardId) {
      return undefined;
    }

    return currentSnapshot?.cardSnapshotsById[currentCardId] ?? activeDeckCardById[currentCardId];
  }, [activeDeckCardById, currentSnapshot?.cardSnapshotsById, currentSnapshot?.currentCardId, currentSnapshot?.queue]);

  const currentNote = useLearningStore(
    useCallback((state) => {
      if (!currentCard?.noteId) {
        return undefined;
      }

      return state.notes[currentCard.noteId];
    }, [currentCard?.noteId]),
  );

  const typedAnswer = currentSnapshot?.typedAnswer ?? '';
  const revealed = currentSnapshot?.revealed ?? false;
  const typedCorrect = currentSnapshot?.typedCorrect ?? null;
  const attemptCount = currentSnapshot?.attemptCount ?? 0;
  const attemptMessage = currentSnapshot?.attemptMessage ?? null;
  const countedReviews = currentSnapshot?.countedReviews ?? 0;
  const sessionStartedAt = currentSnapshot?.startedAt;
  const sessionCardCount = currentSnapshot?.sessionCreditsRequired ?? effectiveSessionCreditsRequired;
  const requiresTypedAnswer =
    currentCard && currentNote
      ? shouldRequireTypedAnswer(currentCard, currentNote, typedAnswerMaxWords, typedAnswerEnabled)
      : false;
  const typedAnswerMatchKind =
    currentCard && currentNote && requiresTypedAnswer && typedAnswer.trim()
      ? getTypedAnswerMatchKind(currentCard, currentNote, typedAnswer)
      : null;
  const effectiveCorrect = requiresTypedAnswer ? typedCorrect === true : true;
  const remainingAttempts = Math.max(0, MAX_TYPED_ANSWER_ATTEMPTS - attemptCount);
  // "Gut"/"Einfach" sind nach einer falschen UND nach einer nur knapp ("partial",
  // 3-Buchstaben-Tippmodus) richtigen Eingabe oder bei direktem Aufdecken ohne Antwort gesperrt:
  // Ein Beinahe-Treffer ist kein voller Abruf und darf kein langes Easy/Good-Intervall verdienen.
  const easyRatingBlocked =
    requiresTypedAnswer &&
    (typedCorrect === false || typedCorrect === null || typedAnswerMatchKind === 'partial');

  // "Schwer" ist bei einer völlig falschen Antwort (oder bei direktem Aufdecken ohne Antwort)
  // ebenfalls gesperrt: Es bleibt dann nur "Nochmal", um eine ehrliche Wiederholung zu erzwingen.
  const hardRatingBlocked =
    requiresTypedAnswer &&
    (typedCorrect === false || typedCorrect === null);
  const cardPrompt = currentCard && currentNote ? getCardPrompt(currentCard, currentNote) : '';
  const cardAnswer = currentNote ? getCardAnswer(currentNote, currentCard ?? undefined) : '';
  const cardPromptHtml = currentCard && currentNote ? getCardPromptHtml(currentCard, currentNote) : '';
  const cardAnswerHtml = currentNote ? getCardAnswerHtml(currentNote, currentCard ?? undefined) : '';
  const cardTemplateCss = getCardTemplateCss(currentNote);
  const cardTemplateClass = getCardTemplateClass(currentNote);
  const hasRichTemplateHtml = Boolean(currentNote?.frontHtml || currentNote?.backHtml || currentNote?.templateCss);
  const { progressPercent, remainingCount } = useMemo(
    () =>
      buildLearnReviewProgress({
        sessionCreditsRequired: sessionCardCount,
        countedReviews,
      }),
    [countedReviews, sessionCardCount],
  );
  const promptIsLong = cardPrompt.length > 120;
  const answerIsLong = cardAnswer.length > 180;
  const currentStateMeta = currentCard ? stateMeta[currentCard.state] : null;
  const blockedTargetLabel = targetLabel ?? targetId ?? activeDeck?.name ?? 'dein Ziel';
  const hasUsableLearningDeck = Boolean(activeDeck && activeDeckCards.length > 0);
  const latestFeedbackMessage = feedbackEvents[0]?.message ?? null;
  const reviewStatus = currentSnapshot?.status ?? 'idle';
  const canUndo = (currentSnapshot?.history.length ?? 0) > 0 && reviewStatus !== 'idle';
  const showTimer = Boolean(sessionStartedAt);
  const totalCandidateCount = currentSnapshot?.candidateIds.length ?? 0;
  const currentCardPosition = useMemo(() => {
    const candidateIds = currentSnapshot?.candidateIds ?? [];
    const currentCardId = currentSnapshot?.currentCardId ?? currentSnapshot?.queue[0];
    if (!currentCardId) {
      return 0;
    }

    const candidateIndex = candidateIds.indexOf(currentCardId);
    return candidateIndex >= 0 ? candidateIndex + 1 : 0;
  }, [currentSnapshot?.candidateIds, currentSnapshot?.currentCardId, currentSnapshot?.queue]);
  const remainingCandidateIds = useMemo(() => {
    if (!currentSnapshot) {
      return EMPTY_STRING_LIST;
    }

    return [
      ...currentSnapshot.queue,
      ...currentSnapshot.candidateIds.slice(currentSnapshot.candidateCursor),
    ];
  }, [currentSnapshot]);
  const remainingPreviewCandidateIds = isBlockedFlow ? previewCandidateIds : remainingCandidateIds;
  const remainingNewCount = useMemo(
    () =>
      remainingPreviewCandidateIds.filter((cardId) => activeDeckCardStateById[cardId] === 'new').length,
    [activeDeckCardStateById, remainingPreviewCandidateIds],
  );
  const remainingReviewCount = Math.max(0, remainingPreviewCandidateIds.length - remainingNewCount);
  const nextNewCardStatus = useMemo(
    () =>
      buildNextNewCardStatus({
        cards: activeDeckCards,
        deckId: activeDeckId,
        preset: activePreset,
        reviewLogs: activeDeckReviewLogs,
        remainingCandidateIds: remainingPreviewCandidateIds,
        cardStateById: activeDeckCardStateById,
      }),
    [
      activeDeckCardStateById,
      activeDeckCards,
      activeDeckId,
      activeDeckReviewLogs,
      activePreset,
      remainingPreviewCandidateIds,
    ],
  );
  const nextNewCardLabel = nextNewCardStatus.label;
  const currentCardKindLabel = currentCard?.state === 'new' ? 'Neu' : currentCard ? 'Wiederholung' : 'Session';
  const reviewMixLabel = formatReviewMixLabel(activePreset?.reviewsBetweenNewCards ?? 15);
  const blockedFlowExhausted = Boolean(
    learningHydrated
    && isBlockedFlow
    && targetId
    && activeDeck
    && currentSnapshot
    && currentSnapshot.kind === 'unlock'
    && currentSnapshot.status === 'completed'
    && currentSnapshot.candidateIds.length === 0
    && !awaitingEmotionSelection,
  );

  return {
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
    hardRatingBlocked,
    effectiveCorrect,
    hasRichTemplateHtml,
    hasUsableLearningDeck,
    latestFeedbackMessage,
    nextNewCardLabel,
    nextNewCardStatus,
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
  };
}
