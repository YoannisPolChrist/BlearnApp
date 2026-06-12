import { useState, useCallback, useEffect } from 'react';
import { AnimatePresence, useReducedMotion } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import { useBreathingEngine } from '@/hooks/useBreathingEngine';
import { getBlockingFlowQueryContext } from '@/lib/blockingFlowContext';
import { useModeSettings } from '@/store/selectors';
import { useAppStore, BREATHING_PATTERNS } from '@/store/useAppStore';
import PageTransition from '@/components/PageTransition';
import { createBlockingFlowSearchParams } from '@/lib/nativeOverlayRuntime';
import { tonePalettes } from '@/lib/semanticTones';
import { BreathingPageShell } from '@/components/breathing/BreathingPageShell';
import { BreathingIntroStep } from '@/components/breathing/BreathingIntroStep';
import { BreathingExerciseStep } from '@/components/breathing/BreathingExerciseStep';

function parsePositiveInteger(value: string | null) {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export default function BreathingPage() {
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();
  const [searchParams] = useSearchParams();
  const blockingFlow = getBlockingFlowQueryContext(searchParams);
  const { incrementBreathingSessions, selectedPattern, setSelectedPattern } = useAppStore(
    useShallow((state) => ({
      incrementBreathingSessions: state.incrementBreathingSessions,
      selectedPattern: state.selectedPattern,
      setSelectedPattern: state.setSelectedPattern,
    })),
  );
  const { breathingRounds, interventionPatternId } = useModeSettings();
  const [targetCycles, setTargetCycles] = useState(5);
  const [showIntro, setShowIntro] = useState(!blockingFlow.isBlockedFlow);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [hapticEnabled, setHapticEnabled] = useState(true);
  const triggerPatternId = searchParams.get('patternId');
  const targetLabel = blockingFlow.targetLabel;
  const unlockDurationMinutes = parsePositiveInteger(searchParams.get('unlockDurationMinutes'));
  const isBlockedFlow = blockingFlow.isBlockedFlow;
  const activeTone = isBlockedFlow ? tonePalettes.reflection : tonePalettes.breathing;
  const sphereTone = isBlockedFlow ? 'reflection' as const : 'breathing' as const;
  const effectivePatternId = isBlockedFlow
    ? triggerPatternId || interventionPatternId || selectedPattern
    : selectedPattern;
  const effectiveTargetCycles = isBlockedFlow ? breathingRounds : targetCycles;
  const activePattern = BREATHING_PATTERNS.find((pattern) => pattern.id === effectivePatternId) ?? BREATHING_PATTERNS[0];

  const onComplete = useCallback(() => {
    const pattern = activePattern;
    const totalSeconds = pattern.phases.reduce((sum, phase) => sum + phase.duration, 0) * effectiveTargetCycles;
    incrementBreathingSessions(Math.round(totalSeconds / 60));

    const params = createBlockingFlowSearchParams(searchParams);
    navigate(params.toString() ? `/checkin?${params.toString()}` : '/checkin', { replace: true });
  }, [activePattern, effectiveTargetCycles, incrementBreathingSessions, navigate, searchParams]);

  const engine = useBreathingEngine({
    patternId: effectivePatternId,
    targetCycles: effectiveTargetCycles,
    onComplete,
    soundEnabled,
    hapticEnabled,
  });
  const { start: startEngine, isActive: isEngineActive } = engine;

  useEffect(() => {
    if (!triggerPatternId || isBlockedFlow) return;
    const requestedPattern = BREATHING_PATTERNS.find((pattern) => pattern.id === triggerPatternId);
    if (requestedPattern) {
      setSelectedPattern(requestedPattern.id);
    }
  }, [isBlockedFlow, setSelectedPattern, triggerPatternId]);

  useEffect(() => {
    if (!isBlockedFlow || isEngineActive) return;
    startEngine();
  }, [isBlockedFlow, isEngineActive, startEngine]);

  const handleStart = () => {
    setShowIntro(false);
    startEngine();
  };

  const handleReset = () => {
    engine.reset();
    setShowIntro(true);
  };

  return (
    <PageTransition variant="hero">
      <BreathingPageShell
        isBlockedFlow={isBlockedFlow}
        reducedMotion={Boolean(reducedMotion)}
        activeTone={activeTone}
        soundEnabled={soundEnabled}
        hapticEnabled={hapticEnabled}
        targetLabel={targetLabel}
        unlockDurationMinutes={unlockDurationMinutes}
        onBack={() => navigate(-1)}
        onToggleSound={() => setSoundEnabled((value) => !value)}
        onToggleHaptic={() => setHapticEnabled((value) => !value)}
      >
        <AnimatePresence mode="wait">
          {showIntro ? (
            <BreathingIntroStep
              isBlockedFlow={isBlockedFlow}
              reducedMotion={Boolean(reducedMotion)}
              activeTone={activeTone}
              lockedPattern={activePattern}
              selectedPattern={selectedPattern}
              patterns={BREATHING_PATTERNS}
              targetCycles={targetCycles}
              onSelectPattern={setSelectedPattern}
              onSelectCycles={setTargetCycles}
              onStart={handleStart}
            />
          ) : (
            <BreathingExerciseStep
              isBlockedFlow={isBlockedFlow}
              reducedMotion={Boolean(reducedMotion)}
              activeTone={activeTone}
              sphereTone={sphereTone}
              engine={engine}
              targetCycles={effectiveTargetCycles}
              onReset={handleReset}
            />
          )}
        </AnimatePresence>
      </BreathingPageShell>
    </PageTransition>
  );
}
