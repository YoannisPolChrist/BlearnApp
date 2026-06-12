import {
  useCallback,
  useEffect,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react';
import type { BlockTargetType, LearningDeck } from '@/lib/learning';
import { waitForBlockingFlowPersistence } from '@/lib/blockingFlowPersistence';
import { flushLearningCloudSaveIfAvailable } from '@/lib/learningCloudImmediateSave';
import { withTimeout } from '@/lib/promiseTimeout';
import type { LearningReviewFeedbackEvent } from '@/modules/learning/store';
import type { useAppStore } from '@/store/useAppStore';
import type { useLearningStore } from '@/store/useLearningStore';

const MIN_SESSION_EMOTIONS = 1;
const MAX_SESSION_EMOTIONS = 3;

type RecordFeedback = (
  kind: LearningReviewFeedbackEvent['kind'],
  message: string,
  payload?: Record<string, unknown>,
) => LearningReviewFeedbackEvent;

interface UseLearnReviewSessionCompletionInput {
  activeDeck: LearningDeck | undefined;
  addCheckin: ReturnType<typeof useAppStore.getState>['addCheckin'];
  addInteraction: ReturnType<typeof useAppStore.getState>['addInteraction'];
  awaitingEmotionSelection: boolean;
  blockedFlowExhausted: boolean;
  exhaustedBlockedFlowAutoUnlockKeyRef: MutableRefObject<string | null>;
  handleContinueToTarget: () => Promise<void>;
  pendingCompletionKindRef: MutableRefObject<'review' | 'unlock' | null>;
  recordFeedback: RecordFeedback;
  registerUnlockGrant: ReturnType<typeof useLearningStore.getState>['registerUnlockGrant'];
  runPendingReviewWrites: () => void;
  selectedSessionEmotions: string[];
  sessionCreditsRequired: number;
  setAwaitingEmotionSelection: Dispatch<SetStateAction<boolean>>;
  setCompletedSessionVisible: Dispatch<SetStateAction<boolean>>;
  setSelectedSessionCategories: Dispatch<SetStateAction<string[]>>;
  setSelectedSessionEmotions: Dispatch<SetStateAction<string[]>>;
  targetId: string | undefined;
  targetType: BlockTargetType;
  unlockDurationMinutes: number;
  unlockTarget: ReturnType<typeof useAppStore.getState>['unlockTarget'];
}

export function useLearnReviewSessionCompletion({
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
}: UseLearnReviewSessionCompletionInput) {
  const finishUnlock = useCallback(
    async (sourceDeckId: string, count: number) => {
      if (!targetId) {
        return false;
      }

      runPendingReviewWrites();
      registerUnlockGrant(targetId, targetType, sourceDeckId, count, unlockDurationMinutes);
      unlockTarget(targetId, targetType, unlockDurationMinutes);
      try {
        await waitForBlockingFlowPersistence({ includeLearningStore: true });
      } catch (error) {
        console.warn('Learn overlay persistence did not settle before continuing to the blocked target:', error);
      }
      try {
        await withTimeout(
          flushLearningCloudSaveIfAvailable('blocked-learn-unlock'),
          3500,
          'blocked learn cloud save',
        );
      } catch (error) {
        console.warn('Learn overlay cloud sync did not settle before continuing to the blocked target:', error);
      }
      recordFeedback('unlock-request', 'Freischaltung abgeschlossen.');
      await handleContinueToTarget();
      return true;
    },
    [
      handleContinueToTarget,
      recordFeedback,
      registerUnlockGrant,
      runPendingReviewWrites,
      targetId,
      targetType,
      unlockDurationMinutes,
      unlockTarget,
    ],
  );

  useEffect(() => {
    if (!blockedFlowExhausted) {
      exhaustedBlockedFlowAutoUnlockKeyRef.current = null;
      return;
    }

    if (!activeDeck || !targetId) {
      return;
    }

    const nextAutoUnlockKey = [
      activeDeck.id,
      targetType,
      targetId,
      String(unlockDurationMinutes),
      String(sessionCreditsRequired),
    ].join('::');

    if (exhaustedBlockedFlowAutoUnlockKeyRef.current === nextAutoUnlockKey) {
      return;
    }

    exhaustedBlockedFlowAutoUnlockKeyRef.current = nextAutoUnlockKey;
    recordFeedback('unlock-request', 'Keine offene Learn-Karte mehr. Ziel wird freigegeben.');
    void finishUnlock(activeDeck.id, sessionCreditsRequired);
  }, [
    activeDeck,
    blockedFlowExhausted,
    exhaustedBlockedFlowAutoUnlockKeyRef,
    finishUnlock,
    recordFeedback,
    sessionCreditsRequired,
    targetId,
    targetType,
    unlockDurationMinutes,
  ]);

  const toggleSessionCategory = useCallback(
    (categoryId: string) => {
      setSelectedSessionCategories((current) =>
        current.includes(categoryId)
          ? current.filter((entry) => entry !== categoryId)
          : [...current, categoryId],
      );
    },
    [setSelectedSessionCategories],
  );

  const toggleSessionEmotion = useCallback(
    (emotionId: string) => {
      setSelectedSessionEmotions((current) =>
        current.includes(emotionId)
          ? current.filter((entry) => entry !== emotionId)
          : current.length < MAX_SESSION_EMOTIONS
            ? [...current, emotionId]
            : current,
      );
    },
    [setSelectedSessionEmotions],
  );

  const completeSessionEmotionStep = useCallback(() => {
    if (
      !awaitingEmotionSelection ||
      selectedSessionEmotions.length < MIN_SESSION_EMOTIONS ||
      selectedSessionEmotions.length > MAX_SESSION_EMOTIONS
    ) {
      return;
    }

    const completionKind = pendingCompletionKindRef.current;
    const sessionEmotions = [...selectedSessionEmotions];
    const completedAt = Date.now();
    const sessionSummary = activeDeck?.name || 'Lernsession abgeschlossen';
    pendingCompletionKindRef.current = null;
    setAwaitingEmotionSelection(false);
    setSelectedSessionCategories([]);
    setSelectedSessionEmotions([]);
    setCompletedSessionVisible(false);
    addCheckin({
      id: `learning-${completedAt}`,
      timestamp: completedAt,
      emotions: sessionEmotions,
      reflection: sessionSummary,
      chatHistory: [],
      breathingCompleted: false,
      targetApp: targetId || undefined,
    });
    addInteraction({
      timestamp: completedAt,
      type: 'learning',
      emotions: sessionEmotions,
      intention: sessionSummary,
      completed: true,
      targetApp: targetId || undefined,
    });
    recordFeedback('toast', 'Emotion gespeichert.');

    if (completionKind === 'unlock' && targetId && activeDeck) {
      void finishUnlock(activeDeck.id, sessionCreditsRequired);
      return;
    }

    setCompletedSessionVisible(true);
  }, [
    activeDeck,
    addCheckin,
    addInteraction,
    awaitingEmotionSelection,
    finishUnlock,
    pendingCompletionKindRef,
    recordFeedback,
    selectedSessionEmotions,
    sessionCreditsRequired,
    setAwaitingEmotionSelection,
    setCompletedSessionVisible,
    setSelectedSessionCategories,
    setSelectedSessionEmotions,
    targetId,
  ]);

  return {
    completeSessionEmotionStep,
    toggleSessionCategory,
    toggleSessionEmotion,
  };
}
