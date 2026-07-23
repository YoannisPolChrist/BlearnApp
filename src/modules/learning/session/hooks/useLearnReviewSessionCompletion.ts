import {
  useCallback,
  useEffect,
  useState,
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
import {
  createLearningLog,
  createEmotionLog,
  mapEmotionsToValenceArousalEnergy
} from '@/services/hermesSyncService';
import { useAuthStore } from '@/store/useAuthStore';
import { isFirebaseWriteEnabled } from '@/lib/firebase';

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
  isBlockedFlow: boolean;
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
  sessionStartedAt?: number;
}

export function useLearnReviewSessionCompletion({
  activeDeck,
  addCheckin,
  addInteraction,
  isBlockedFlow,
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
  sessionStartedAt,
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

  const [awaitingEmotionContext, setAwaitingEmotionContext] = useState(false);
  const [sessionEmotionContext, setSessionEmotionContext] = useState('');

  const goToEmotionContextStep = useCallback(() => {
    if (
      !awaitingEmotionSelection ||
      selectedSessionEmotions.length < MIN_SESSION_EMOTIONS ||
      selectedSessionEmotions.length > MAX_SESSION_EMOTIONS
    ) {
      return;
    }
    setAwaitingEmotionSelection(false);
    setAwaitingEmotionContext(true);
  }, [awaitingEmotionSelection, selectedSessionEmotions, setAwaitingEmotionSelection]);

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

  const completeSessionTextStep = useCallback(() => {
    if (
      !awaitingEmotionContext ||
      selectedSessionEmotions.length < MIN_SESSION_EMOTIONS ||
      selectedSessionEmotions.length > MAX_SESSION_EMOTIONS
    ) {
      return;
    }

    const completionKind = pendingCompletionKindRef.current;
    const sessionEmotions = [...selectedSessionEmotions];
    const completedAt = Date.now();
    const textContext = sessionEmotionContext.trim();
    const sessionSummary = textContext
      ? `${activeDeck?.name || 'Lernsession'}: ${textContext}`
      : (activeDeck?.name || 'Lernsession abgeschlossen');
    const blockingContext = isBlockedFlow ? {
      flow: 'learning' as const,
      targetId: targetId || undefined,
      targetType,
      targetLabel: targetId || undefined,
    } : undefined;

    pendingCompletionKindRef.current = null;
    setAwaitingEmotionContext(false);
    setAwaitingEmotionSelection(false);
    setSelectedSessionCategories([]);
    setSelectedSessionEmotions([]);
    setSessionEmotionContext('');
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
        blockingContext,
      });
      addInteraction({
        timestamp: completedAt,
        type: 'learning',
        emotions: sessionEmotions,
        intention: sessionSummary,
        completed: true,
        targetApp: targetId || undefined,
        blockingContext,
      });
      recordFeedback('toast', 'Emotion gespeichert.');

      // Push to Firestore if authenticated & writes are enabled
      const userId = useAuthStore.getState().user?.uid;
      if (userId && isFirebaseWriteEnabled()) {
        const metrics = mapEmotionsToValenceArousalEnergy(sessionEmotions);
        const interactionId = `learning_${completedAt}_${activeDeck?.id || 'deck'}`;
        
        // Push Emotion Log
        void createEmotionLog({
          userId,
          interaction_id: interactionId,
          timestamp: completedAt,
          trigger_type: isBlockedFlow ? 'app_prompt' : targetId ? 'after_app_usage' : 'manual',
          context: {
            location_type: 'unknown',
            activity: 'learning',
            time_of_day: new Date(completedAt).getHours() < 12 ? 'morning' : new Date(completedAt).getHours() < 18 ? 'afternoon' : 'evening',
            social_context: 'alone',
          },
          emotion: {
            valence: metrics.valence,
            arousal: metrics.arousal,
            primary: sessionEmotions[0] || 'Neutral',
            intensity: 5,
            tags: sessionEmotions,
          },
          body: {
            energy_level: metrics.energy,
            pain_level: 0,
            sensations: [],
          },
          cognition: {
            thought_summary: textContext || undefined,
            pattern_tags: [],
          },
          urge: {
            action: targetId || undefined,
            intensity: targetId ? 7 : 0,
            resisted: true,
          },
          blocking_context: blockingContext ? {
            flow: blockingContext.flow,
            target_id: blockingContext.targetId,
            target_type: blockingContext.targetType,
            target_label: blockingContext.targetLabel,
          } : undefined,
          metadata: {
            entry_mode: isBlockedFlow ? 'prompted' : 'manual',
          },
        }).catch(err => console.warn('[HermesSync] Emotion log push failed:', err));

        // Push Learning Log
        const durationMs = sessionStartedAt ? (completedAt - sessionStartedAt) : (5 * 60 * 1000);
        const durationMinutes = Math.max(1, Math.ceil(durationMs / 60000));
        const wordsReviewed = sessionCreditsRequired || 5;

        void createLearningLog({
          userId,
          interaction_id: interactionId,
          started_at: sessionStartedAt || (completedAt - 5 * 60 * 1000),
          ended_at: completedAt,
          duration_minutes: durationMinutes,
          session: {
            type: 'vocabulary',
            language: activeDeck?.language || 'de',
            topic: activeDeck?.name || 'Vokabeln',
            difficulty_level: 'B1',
          },
          vocabulary: {
            words_learned: 0,
            words_reviewed: wordsReviewed,
            accuracy_percent: 100, // assumed 100% or high since they passed the gate
          },
          state_before: {
            energy: 5,
            focus: 6,
            resistance: 4,
          },
          state_after: {
            energy: metrics.energy,
            focus: 7,
            confidence: 7,
            frustration: sessionEmotions.includes('frustrated') ? 6 : 2,
          },
          goal_progress: {
            daily_goal_words: 20,
            current_total_words: wordsReviewed,
            percentage: Math.min(100, Math.round((wordsReviewed / 20) * 100)),
          },
          metadata: {
            entry_mode: 'automatic',
          },
        }).catch(err => console.warn('[HermesSync] Learning log push failed:', err));
      }
    };

    if (completionKind === 'unlock' && targetId && activeDeck) {
      recordEmotionOutcome();
      void finishUnlock(activeDeck.id, sessionCreditsRequired);
      return;
    }

    recordEmotionOutcome();
    setCompletedSessionVisible(true);
  }, [
    activeDeck,
    addCheckin,
    addInteraction,
    awaitingEmotionContext,
    finishUnlock,
    pendingCompletionKindRef,
    recordFeedback,
    selectedSessionEmotions,
    sessionCreditsRequired,
    sessionEmotionContext,
    setAwaitingEmotionSelection,
    setCompletedSessionVisible,
    setSelectedSessionCategories,
    setSelectedSessionEmotions,
    isBlockedFlow,
    targetId,
    targetType,
    sessionStartedAt,
  ]);

  return {
    completeSessionEmotionStep: goToEmotionContextStep,
    completeSessionTextStep,
    awaitingEmotionContext,
    sessionEmotionContext,
    setSessionEmotionContext,
    toggleSessionCategory,
    toggleSessionEmotion,
  };
}
