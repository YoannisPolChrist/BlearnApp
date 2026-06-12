import { AnimatePresence, motion } from 'framer-motion';
import { RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import GlassCard from '@/components/GlassCard';
import { premiumEase } from '@/lib/motion';
import { BreathingScene } from './BreathingScene';

interface BreathingExerciseStepProps {
  isBlockedFlow: boolean;
  reducedMotion: boolean;
  activeTone: { badge: string; button: string };
  sphereTone: 'breathing' | 'reflection' | 'strict';
  engine: {
    currentPhase?: { type: 'rest' | 'inhale' | 'hold' | 'exhale'; duration: number; instruction: string };
    phaseTimeLeft: number;
    progress: number;
    currentCycle: number;
    currentPhaseIndex: number;
    pattern: { phases: Array<{ type: 'rest' | 'inhale' | 'hold' | 'exhale'; duration: number }> };
    isActive: boolean;
  };
  targetCycles: number;
  onReset: () => void;
}

export function BreathingExerciseStep({
  isBlockedFlow,
  reducedMotion,
  activeTone,
  sphereTone,
  engine,
  targetCycles,
  onReset,
}: BreathingExerciseStepProps) {
  const progressToneVars = isBlockedFlow
    ? {
        active: 'bg-[hsl(var(--mode-reflection))]',
        current: 'bg-[hsl(var(--mode-reflection-glow)/0.72)]',
        shadow: '0 0 8px hsl(var(--mode-reflection-glow) / 0.28)',
      }
    : {
        active: 'bg-[hsl(var(--mode-breathing))]',
        current: 'bg-[hsl(var(--mode-breathing-glow)/0.72)]',
        shadow: '0 0 8px hsl(var(--mode-breathing-glow) / 0.28)',
      };

  return (
    <motion.div
      key="exercise"
      initial={{ opacity: 0, scale: 0.94, filter: 'blur(10px)' }}
      animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
      transition={{ duration: 0.42, ease: premiumEase }}
      className="flex min-h-0 flex-1 flex-col items-center justify-center"
    >
      <div className="relative mb-6 flex w-full items-center justify-center">
        <BreathingScene
          phase={engine.currentPhase?.type || 'rest'}
          progress={engine.progress}
          duration={engine.currentPhase?.duration || 4}
          isActive={engine.isActive}
          tone={sphereTone}
          reducedMotion={reducedMotion}
        />

        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <AnimatePresence mode="wait">
              <motion.p
                key={engine.currentPhase?.instruction}
                initial={{ opacity: 0, y: 8, filter: 'blur(4px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -8, filter: 'blur(4px)' }}
                transition={{ duration: 0.28, ease: premiumEase }}
                className="text-lg font-bold text-foreground drop-shadow-lg"
              >
                {engine.currentPhase?.instruction}
              </motion.p>
            </AnimatePresence>
            <motion.p
              key={engine.phaseTimeLeft}
              initial={{ scale: 1.16, opacity: 0.3 }}
              animate={{ scale: 1, opacity: 0.92 }}
              transition={{ type: 'spring', stiffness: 420, damping: 24 }}
              className="mt-1 text-4xl font-black text-foreground/92 drop-shadow-lg"
            >
              {engine.phaseTimeLeft}
            </motion.p>
          </div>
        </div>
      </div>

      <div className="mb-8 flex gap-2">
        {Array.from({ length: targetCycles }).map((_, index) => (
          <motion.div
            key={index}
            className={`h-2.5 w-8 rounded-full ${
              index < engine.currentCycle
                ? progressToneVars.active
                : index === engine.currentCycle
                  ? progressToneVars.current
                  : 'bg-muted/70'
            }`}
            animate={index === engine.currentCycle && !reducedMotion ? { scaleX: [0.76, 1, 0.92] } : { scaleX: 1 }}
            transition={{ duration: 0.7, ease: premiumEase }}
            style={
              index < engine.currentCycle
                ? {
                    boxShadow: progressToneVars.shadow,
                  }
                : undefined
            }
          />
        ))}
      </div>

      <GlassCard elevation="raised" surface="featured" tone={isBlockedFlow ? 'reflection' : 'breathing'} className="px-4 py-3">
        <div className="flex flex-wrap items-center justify-center gap-3">
          {engine.pattern.phases.map((phase, index) => (
            <motion.div
              key={`${phase.type}-${index}`}
              className={cn(
                'rounded-full px-4 py-1.5 text-xs font-bold transition-all',
                index === engine.currentPhaseIndex ? activeTone.badge : 'bg-background/86 text-foreground/62',
              )}
              animate={index === engine.currentPhaseIndex && !reducedMotion ? { scale: [1, 1.08, 1], y: [0, -1, 0] } : { scale: 1, y: 0 }}
              transition={{ duration: 0.36, ease: premiumEase }}
            >
              {phase.type === 'inhale' && 'Ein'}
              {phase.type === 'hold' && 'Halten'}
              {phase.type === 'exhale' && 'Aus'}
              {phase.type === 'rest' && 'Pause'}
            </motion.div>
          ))}
        </div>
      </GlassCard>

      {!isBlockedFlow ? (
        <motion.button
          onClick={onReset}
          initial="rest"
          animate="rest"
          whileHover={reducedMotion ? 'rest' : 'hover'}
          whileTap={reducedMotion ? 'rest' : 'tap'}
          className="mt-8 flex items-center gap-2 text-sm text-foreground/72 transition-colors hover:text-foreground"
        >
          <RotateCcw size={14} />
          Zurücksetzen
        </motion.button>
      ) : null}
    </motion.div>
  );
}
