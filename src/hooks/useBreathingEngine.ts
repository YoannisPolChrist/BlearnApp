import { useState, useRef, useCallback, useEffect } from 'react';
import { BREATHING_PATTERNS } from '@/store/useAppStore';
import { phaseSounds, phaseHaptics, playComplete, playTick, vibrateComplete } from '@/lib/breathingSounds';

interface UseBreathingEngineProps {
  patternId: string;
  targetCycles: number;
  onComplete: () => void;
  soundEnabled?: boolean;
  hapticEnabled?: boolean;
}

export function useBreathingEngine({
  patternId,
  targetCycles,
  onComplete,
  soundEnabled = true,
  hapticEnabled = true,
}: UseBreathingEngineProps) {
  const pattern = BREATHING_PATTERNS.find((p) => p.id === patternId) || BREATHING_PATTERNS[0];
  const [isActive, setIsActive] = useState(false);
  const [currentCycle, setCurrentCycle] = useState(0);
  const [currentPhaseIndex, setCurrentPhaseIndex] = useState(0);
  const [phaseTimeLeft, setPhaseTimeLeft] = useState(pattern.phases[0].duration);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevPhaseRef = useRef<number>(-1);

  const currentPhase = pattern.phases[currentPhaseIndex];

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  // Play sound + haptic on phase change
  useEffect(() => {
    if (!isActive || currentPhaseIndex === prevPhaseRef.current) return;
    prevPhaseRef.current = currentPhaseIndex;

    const phaseType = pattern.phases[currentPhaseIndex]?.type;
    if (!phaseType) return;

    if (soundEnabled) phaseSounds[phaseType]();
    if (hapticEnabled) phaseHaptics[phaseType]();
  }, [isActive, currentPhaseIndex, pattern, soundEnabled, hapticEnabled]);

  // Tick sound on last 3 seconds
  useEffect(() => {
    if (!isActive || !soundEnabled) return;
    if (phaseTimeLeft <= 3 && phaseTimeLeft > 0) {
      playTick();
    }
  }, [isActive, phaseTimeLeft, soundEnabled]);

  const start = useCallback(() => {
    prevPhaseRef.current = -1;
    setIsActive(true);
    setCurrentCycle(0);
    setCurrentPhaseIndex(0);
    setPhaseTimeLeft(pattern.phases[0].duration);
  }, [pattern]);

  const reset = useCallback(() => {
    clearTimer();
    prevPhaseRef.current = -1;
    setIsActive(false);
    setCurrentCycle(0);
    setCurrentPhaseIndex(0);
    setPhaseTimeLeft(pattern.phases[0].duration);
  }, [pattern]);

  useEffect(() => {
    if (!isActive) return;

    timerRef.current = setInterval(() => {
      setPhaseTimeLeft((prev) => {
        if (prev <= 1) {
          setCurrentPhaseIndex((phaseIdx) => {
            const nextPhaseIdx = phaseIdx + 1;
            if (nextPhaseIdx >= pattern.phases.length) {
              setCurrentCycle((cycle) => {
                const nextCycle = cycle + 1;
                if (nextCycle >= targetCycles) {
                  clearTimer();
                  setIsActive(false);
                  if (soundEnabled) playComplete();
                  if (hapticEnabled) vibrateComplete();
                  setTimeout(onComplete, 800);
                  return nextCycle;
                }
                return nextCycle;
              });
              return 0;
            }
            return nextPhaseIdx;
          });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return clearTimer;
  }, [isActive, pattern, targetCycles, onComplete, soundEnabled, hapticEnabled]);

  // Set correct time when phase changes
  useEffect(() => {
    if (isActive && phaseTimeLeft === 0) {
      setPhaseTimeLeft(pattern.phases[currentPhaseIndex].duration);
    }
  }, [currentPhaseIndex, isActive, pattern, phaseTimeLeft]);

  const progress = currentPhase
    ? 1 - phaseTimeLeft / currentPhase.duration
    : 0;

  return {
    isActive,
    currentCycle,
    currentPhaseIndex,
    phaseTimeLeft,
    currentPhase,
    progress,
    pattern,
    start,
    reset,
  };
}
