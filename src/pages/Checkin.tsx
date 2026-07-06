import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore, EMOTION_CATEGORIES } from '@/store/useAppStore';
import PageTransition from '@/components/PageTransition';
import { useOverlayDismissGuard } from '@/hooks/useOverlayDismissGuard';
import { getBlockingFlowQueryContext } from '@/lib/blockingFlowContext';
import { waitForBlockingFlowPersistence } from '@/lib/blockingFlowPersistence';
import { primeNativeUnlockHandoff } from '@/lib/nativeUnlockHandoff';
import { isAndroidPlatform } from '@/lib/platform';
import { tonePalettes } from '@/lib/semanticTones';
import { cn } from '@/lib/utils';
import { openTarget } from '@/services/screenTimeService';
import { CheckinPageShell } from '@/components/checkin/CheckinPageShell';
import { CheckinTextStep } from '@/components/checkin/CheckinTextStep';
import { CheckinEmotionStep } from '@/components/checkin/CheckinEmotionStep';
import { CheckinCompletionStep } from '@/components/checkin/CheckinCompletionStep';
import { SuccessAnimation } from '@/components/ui/SuccessAnimation';
import {
  createEmotionLog,
  createAppUsageEvent,
  mapEmotionsToValenceArousalEnergy
} from '@/services/hermesSyncService';
import { useAuthStore } from '@/store/useAuthStore';
import { isFirebaseWriteEnabled } from '@/lib/firebase';

function parsePositiveInteger(value: string | null) {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

const reflectionCheckinClasses = {
  overlay:
    'bg-[radial-gradient(circle_at_top,hsl(var(--mode-reflection-glow)/0.42),transparent_42%),linear-gradient(180deg,hsl(var(--mode-reflection)/0.16),hsl(var(--background)/0.84)_42%,hsl(var(--background)))]',
  indicatorActive: 'w-10 bg-[hsl(var(--mode-reflection))]',
  indicatorCurrent: 'w-10 bg-[hsl(var(--mode-reflection)/0.6)]',
  indicatorIdle: 'w-6 bg-[hsl(var(--mode-reflection-glow)/0.22)]',
  input:
    'w-full resize-none rounded-[1.7rem] border border-[hsl(var(--mode-reflection-border)/0.42)] bg-[hsl(var(--mode-reflection-surface)/0.34)] px-5 py-4 text-sm text-foreground shadow-[0_18px_42px_hsl(var(--mode-reflection-glow)/0.14)] backdrop-blur-sm transition-colors placeholder:text-foreground/38 focus:border-[hsl(var(--mode-reflection-border)/0.72)] focus:outline-none',
  summary: 'rounded-[1.5rem] border border-[hsl(var(--mode-reflection-border)/0.26)] bg-[hsl(var(--mode-reflection-surface)/0.24)] shadow-[0_16px_34px_hsl(var(--mode-reflection-glow)/0.1)]',
  chip: 'border border-[hsl(var(--mode-reflection-border)/0.3)] bg-background/70 px-3 py-1.5 text-sm font-semibold text-foreground',
} as const;

export default function CheckinPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const blockingFlow = getBlockingFlowQueryContext(searchParams);
  const targetId = searchParams.get('targetId');
  const targetApp = searchParams.get('targetApp') || searchParams.get('targetLabel') || targetId;
  const targetType = blockingFlow.targetType;
  const targetLabel = blockingFlow.targetLabel || targetApp || targetId;
  const resolvedTargetId = blockingFlow.targetId || null;
  const overlaySessionId = blockingFlow.overlaySessionId;
  const unlockDurationMinutes = parsePositiveInteger(searchParams.get('unlockDurationMinutes'));
  const isBlockedFlow = blockingFlow.isBlockedFlow;
  const isOverlayUnlockFlow = isAndroidPlatform && blockingFlow.isOverlayBlockingFlow;
  const {
    addCheckin,
    addInteraction,
    defaultUnlockDurationMinutes,
    incrementCheckins,
    streak,
    unlockTarget,
    updateStreak,
  } = useAppStore(
    useShallow((state) => ({
      addCheckin: state.addCheckin,
      addInteraction: state.addInteraction,
      defaultUnlockDurationMinutes: state.defaultUnlockDurationMinutes,
      incrementCheckins: state.incrementCheckins,
      streak: state.streak,
      unlockTarget: state.unlockTarget,
      updateStreak: state.updateStreak,
    })),
  );
  const checkinPalette = tonePalettes.reflection;
  const checkinClasses = reflectionCheckinClasses;

  const [step, setStep] = useState(0);
  const [whatAnswer, setWhatAnswer] = useState('');
  const [whyAnswer, setWhyAnswer] = useState('');
  const [selectedEmotions, setSelectedEmotions] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [emotionContext, setEmotionContext] = useState('');
  const [isContinuingToTarget, setIsContinuingToTarget] = useState(false);
  const [showSuccessAnim, setShowSuccessAnim] = useState(false);
  const { dismissOnce } = useOverlayDismissGuard({
    active: isOverlayUnlockFlow,
    overlaySessionId,
  });

  const canComplete =
    !isContinuingToTarget && selectedEmotions.length >= 1 && selectedEmotions.length <= 5;

  const toggleEmotion = (id: string) => {
    setSelectedEmotions((prev) =>
      prev.includes(id) ? prev.filter((emotionId) => emotionId !== id) : prev.length < 5 ? [...prev, id] : prev,
    );
  };

  const toggleCategory = (key: string) => {
    setSelectedCategories((prev) => (prev.includes(key) ? prev.filter((category) => category !== key) : [...prev, key]));
  };

  const finishCheckin = async () => {
    if (isContinuingToTarget) {
      return;
    }

    const reflection = [whatAnswer.trim(), whyAnswer.trim(), emotionContext.trim()].filter(Boolean).join(' - ');
    const completedAt = Date.now();
    const entry = {
      id: completedAt.toString(),
      timestamp: completedAt,
      emotions: selectedEmotions,
      reflection,
      chatHistory: [],
      breathingCompleted: false,
      targetApp: targetApp || undefined,
    };

    addCheckin(entry);
    addInteraction({
      timestamp: completedAt,
      type: 'checkin',
      emotions: selectedEmotions,
      intention: reflection,
      completed: true,
      targetApp: targetApp || undefined,
    });
    incrementCheckins();
    updateStreak();

    // Push to Firestore if authenticated & writes are enabled
    const userId = useAuthStore.getState().user?.uid;
    if (userId && isFirebaseWriteEnabled()) {
      const metrics = mapEmotionsToValenceArousalEnergy(selectedEmotions);
      
      // Push Emotion Log
      void createEmotionLog({
        userId,
        timestamp: completedAt,
        trigger_type: targetId ? 'after_app_usage' : 'manual',
        context: {
          location_type: 'unknown',
          activity: targetId ? 'pause' : 'unknown',
          time_of_day: new Date(completedAt).getHours() < 12 ? 'morning' : new Date(completedAt).getHours() < 18 ? 'afternoon' : 'evening',
          social_context: 'alone',
        },
        emotion: {
          valence: metrics.valence,
          arousal: metrics.arousal,
          primary: selectedEmotions[0] || 'Neutral',
          intensity: 5,
          tags: selectedEmotions,
        },
        body: {
          energy_level: metrics.energy,
          pain_level: 0,
          sensations: [],
        },
        cognition: {
          thought_summary: reflection || undefined,
          pattern_tags: [],
        },
        urge: {
          action: targetApp || undefined,
          intensity: targetId ? 7 : 0,
          resisted: false,
        },
        metadata: {
          entry_mode: 'manual',
        },
      }).catch(err => console.warn('[HermesSync] Emotion log push failed:', err));

      // Push App Usage Event if this checkin is for a blocked app intercept
      if (targetId) {
        const usageDuration = unlockDurationMinutes || defaultUnlockDurationMinutes || 15;
        void createAppUsageEvent({
          userId,
          started_at: completedAt,
          ended_at: completedAt + usageDuration * 60 * 1000,
          duration_minutes: usageDuration,
          app: {
            name: targetApp || targetId,
            category: 'unknown',
          },
          user_intent_before: 'avoidance',
          emotion_before: {
            valence: metrics.valence,
            arousal: metrics.arousal,
            energy: metrics.energy,
            tags: selectedEmotions,
          },
          emotion_after: {
            valence: metrics.valence,
            arousal: Math.max(1, metrics.arousal - 1),
            energy: metrics.energy,
            tags: [],
          },
          delta: {
            valence: 0,
            arousal: -1,
            energy: 0,
          },
          metadata: {
            entry_mode: 'automatic',
          },
        }).catch(err => console.warn('[HermesSync] App usage log push failed:', err));
      }
    }

    if (resolvedTargetId) {
      const explicitType = (targetType === 'website' || targetType === 'search') ? targetType : 'app';
      unlockTarget(resolvedTargetId, explicitType, unlockDurationMinutes ?? undefined);
    }

    if (isBlockedFlow) {
      try {
        await waitForBlockingFlowPersistence();
      } catch (error) {
        console.warn('Check-in persistence did not settle before continuing to the blocked target:', error);
      }
      setShowSuccessAnim(true);
      return;
    }

    setStep(4);
  };

  const handleBack = () => {
    if (targetApp && step > 0) {
      setStep(0);
      setWhatAnswer('');
      setWhyAnswer('');
      setSelectedEmotions([]);
      setSelectedCategories([]);
      setEmotionContext('');
      return;
    }

    navigate('/');
  };

  const handleContinueToTarget = async () => {
    if (isAndroidPlatform && resolvedTargetId) {
      if (isOverlayUnlockFlow) {
        try {
          await primeNativeUnlockHandoff(
            resolvedTargetId,
            targetType,
            unlockDurationMinutes ?? defaultUnlockDurationMinutes,
          );
        } catch (error) {
          console.warn('Native unlock handoff prime failed:', error);
        }

        try {
          await dismissOnce();
        } catch (error) {
          console.warn('Blocking overlay dismiss failed:', error);
        }
      }

      try {
        await openTarget(resolvedTargetId, targetType);
      } catch (error) {
        console.warn('Target open failed:', error);
        // Fallback: navigate home if target open fails
        navigate('/', { replace: true });
      }
      return;
    }

    navigate('/', { replace: true });
  };

  return (
    <PageTransition>
      <>
        <CheckinPageShell
          step={step}
          isBlockedFlow={isBlockedFlow}
          onBack={handleBack}
          classes={checkinClasses}
          targetLabel={targetLabel}
          unlockDurationMinutes={unlockDurationMinutes}
        >
          <AnimatePresence mode="wait">
            {step === 0 ? (
              <CheckinTextStep
                stepKey="what"
                title="Was möchtest du tun?"
                prompt="Beschreibe kurz, was du gerade vorhast."
                placeholder="z.B. Social Media öffnen, YouTube schauen..."
                value={whatAnswer}
                onChange={setWhatAnswer}
                onContinue={() => setStep(1)}
                buttonLabel="Weiter"
                inputClassName={checkinClasses.input}
                buttonClassName={checkinPalette.button}
                autoFocus
              />
            ) : null}

            {step === 1 ? (
              <CheckinTextStep
                stepKey="why"
                title="Warum möchtest du das tun?"
                prompt="Nimm dir einen Moment, um darüber nachzudenken."
                placeholder="Was ist der Grund dahinter?"
                value={whyAnswer}
                onChange={setWhyAnswer}
                onContinue={() => setStep(2)}
                buttonLabel="Weiter"
                inputClassName={checkinClasses.input}
                buttonClassName={checkinPalette.button}
                autoFocus
              />
            ) : null}

            {step === 2 ? (
              <CheckinEmotionStep
                stepKey="emotions"
                categories={EMOTION_CATEGORIES}
                selectedCategories={selectedCategories}
                selectedEmotions={selectedEmotions}
                onToggleCategory={toggleCategory}
                onToggleEmotion={toggleEmotion}
                onFinish={() => setStep(3)}
                canComplete={canComplete}
                isBlockedFlow={isBlockedFlow}
                isContinuingToTarget={isContinuingToTarget}
                badgeClassName={checkinPalette.badge}
                cardClassName={checkinPalette.button}
                summaryClassName={cn(checkinClasses.summary, checkinPalette.card)}
                chipClassName={checkinClasses.chip}
                finishLabel={isBlockedFlow ? 'Weiter zur App' : 'Weiter'}
              />
            ) : null}

            {step === 3 ? (
              <CheckinTextStep
                stepKey="emotion-context"
                title="Kontext zu deinen Emotionen"
                prompt="Schreibe kurz auf, warum du dich so fühlst (optional)."
                placeholder="z.B. Gestresst wegen der Arbeit, müde..."
                value={emotionContext}
                onChange={setEmotionContext}
                onContinue={finishCheckin}
                buttonLabel={isBlockedFlow ? 'Freischalten' : 'Fertig'}
                inputClassName={checkinClasses.input}
                buttonClassName={checkinPalette.button}
                optional={true}
                autoFocus
              />
            ) : null}

            {step === 4 ? (
              <CheckinCompletionStep
                targetApp={targetApp}
                targetId={targetId}
                targetType={targetType}
                targetLabel={targetLabel}
                unlockDurationMinutes={unlockDurationMinutes}
                streak={streak}
                onContinue={() => void handleContinueToTarget()}
              />
            ) : null}
          </AnimatePresence>
        </CheckinPageShell>
        <SuccessAnimation
          visible={showSuccessAnim}
          message={targetLabel || 'App'}
          subMessage={unlockDurationMinutes || defaultUnlockDurationMinutes ? `Freigeschaltet für ${unlockDurationMinutes || defaultUnlockDurationMinutes} Min.` : 'Freigabe aktiv'}
          onAnimationDone={async () => {
            setIsContinuingToTarget(true);
            try {
              await handleContinueToTarget();
            } catch (error) {
              setIsContinuingToTarget(false);
            }
          }}
        />
      </>
    </PageTransition>
  );
}
