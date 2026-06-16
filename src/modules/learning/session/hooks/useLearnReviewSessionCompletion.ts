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
const schedulePostUnlockTask = (task: () => void) => {
  window.setTimeout(task, 0);
};

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
  blockedUnlockSignal: number;
  exhaustedBlockedFlowAutoUnlockKeyRef: MutableRefObject<string | null>;
  pendingCompletionKindRef: MutableRefObject<'review' | 'unlock' | null>;
  recordFeedback: RecordFeedback;
  registerUnlockGrant: ReturnType<typeof useLearningStore.getState>['registerUnlockGrant'];
  runPendingReviewWrites: () => void;
  setOverlaySuccessVisible: Dispatch<SetStateAction<boolean>>;
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
  blockedUnlockSignal,
  exhaustedBlockedFlowAutoUnlockKeyRef,
  pendingCompletionKindRef,
  recordFeedback,
  registerUnlockGrant,
  runPendingReviewWrites,
  setOverlaySuccessVisible,
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

      // Freischaltung SOFORT & synchron: Pending-Writes flushen, Grant
      // registrieren, Ziel entsperren — danach den Erfolgs-Screen unmittelbar
      // zeigen. Persistenz (IndexedDB-Settle) + Cloud-Sync liefen früher VOR dem
      // Erfolgs-Screen per await → bei langsamem/abgehängtem Sync drehte der
      // Button/Screen bis zu mehreren Sekunden ("lädt ewig"). Jetzt laufen sie
      // im Hintergrund; die lokale Freischaltung (unlockTarget) + das WAL sind
      // bereits synchron persistiert, Durability bleibt also erhalten.
      runPendingReviewWrites();
      registerUnlockGrant(targetId, targetType, sourceDeckId, count, unlockDurationMinutes);
      unlockTarget(targetId, targetType, unlockDurationMinutes);
      recordFeedback('unlock-request', 'Freischaltung abgeschlossen.');
      setOverlaySuccessVisible(true);

      void (async () => {
        try {
          await waitForBlockingFlowPersistence({ includeLearningStore: true });
        } catch (error) {
          console.warn('Learn overlay persistence did not settle in the background:', error);
        }
        try {
          await withTimeout(
            flushLearningCloudSaveIfAvailable('blocked-learn-unlock'),
            3500,
            'blocked learn cloud save',
          );
        } catch (error) {
          console.warn('Learn overlay cloud sync did not settle in the background:', error);
        }
      })();

      return true;
    },
    [
      recordFeedback,
      registerUnlockGrant,
      runPendingReviewWrites,
      setOverlaySuccessVisible,
      targetId,
      targetType,
      unlockDurationMinutes,
      unlockTarget,
    ],
  );

  // Legacy-Fallback (derzeit ungenutzt): Beide Flows laufen jetzt über den
  // Emotions-Check-in → completeSessionEmotionStep → finishUnlock. Dieser
  // blockedUnlockSignal-Pfad würde direkt (ohne Emotions-Schritt) freischalten,
  // wird von review-actions aber nicht mehr getriggert. Bewusst belassen als
  // sichere Direkt-Freischaltung, falls künftig ein Emotions-loser Pfad nötig ist.
  useEffect(() => {
    if (blockedUnlockSignal <= 0 || pendingCompletionKindRef.current !== 'unlock') {
      return;
    }
    if (!activeDeck || !targetId) {
      return;
    }

    pendingCompletionKindRef.current = null;
    void finishUnlock(activeDeck.id, sessionCreditsRequired);
  }, [
    activeDeck,
    blockedUnlockSignal,
    finishUnlock,
    pendingCompletionKindRef,
    sessionCreditsRequired,
    targetId,
  ]);

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

    const recordEmotionOutcome = () => {
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
    };

    if (completionKind === 'unlock' && targetId && activeDeck) {
      void finishUnlock(activeDeck.id, sessionCreditsRequired);
      schedulePostUnlockTask(recordEmotionOutcome);
      return;
    }

    recordEmotionOutcome();
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
