import { motion } from 'framer-motion';
import { Play } from 'lucide-react';
import GlassCard from '@/components/GlassCard';
import type { TonePalette } from '@/lib/semanticTones';
import { cn } from '@/lib/utils';
import { cardCascade, cardCascadeItem, ctaFollowThrough, premiumEase } from '@/lib/motion';

export interface BreathingPatternLike {
  id: string;
  name: string;
  description: string;
}

interface BreathingIntroStepProps {
  isBlockedFlow: boolean;
  reducedMotion: boolean;
  activeTone: TonePalette;
  lockedPattern?: BreathingPatternLike;
  selectedPattern: string;
  patterns: BreathingPatternLike[];
  targetCycles: number;
  onSelectPattern: (patternId: string) => void;
  onSelectCycles: (cycles: number) => void;
  onStart: () => void;
}

export function BreathingIntroStep({
  isBlockedFlow,
  reducedMotion,
  activeTone,
  lockedPattern,
  selectedPattern,
  patterns,
  targetCycles,
  onSelectPattern,
  onSelectCycles,
  onStart,
}: BreathingIntroStepProps) {
  return (
    <motion.div
      key="intro"
      variants={cardCascade}
      initial="hidden"
      animate="show"
      exit={{ opacity: 0, y: -18, transition: { duration: 0.2, ease: premiumEase } }}
      className="flex w-full flex-1 flex-col items-center"
    >
      <motion.div variants={cardCascadeItem} className="mb-8 w-full space-y-3">
        {isBlockedFlow ? (
          <GlassCard elevation="raised" tone="reflection" className="flex items-start gap-4">
            <motion.div
              className="mt-1 h-3.5 w-3.5 rounded-full bg-[hsl(var(--mode-reflection))]"
              animate={reducedMotion ? undefined : { scale: [1, 1.14, 1], opacity: [0.84, 1, 0.84] }}
              transition={{ duration: 0.4, ease: premiumEase }}
            />
            <div className="space-y-1">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-foreground/62">Vorgegebenes Atemmuster</p>
              <p className="font-semibold text-foreground">{lockedPattern?.name}</p>
              <p className="text-sm text-foreground/72">{lockedPattern?.description}</p>
            </div>
          </GlassCard>
        ) : (
          patterns.map((pattern) => (
            <GlassCard
              key={pattern.id}
              interactive
              elevation="raised"
              tone={selectedPattern === pattern.id ? 'breathing' : 'default'}
              className={`flex items-center gap-4 ${selectedPattern === pattern.id ? 'surface-mode-breathing' : ''}`}
              onClick={() => onSelectPattern(pattern.id)}
            >
              <motion.div
                className={`h-3.5 w-3.5 rounded-full ${selectedPattern === pattern.id ? 'bg-[hsl(var(--mode-breathing))]' : 'bg-foreground/24'}`}
                animate={reducedMotion || selectedPattern !== pattern.id ? undefined : { scale: [1, 1.18, 1], opacity: [0.84, 1, 0.84] }}
                transition={{ duration: 0.4, ease: premiumEase }}
              />
              <div>
                <p className="font-semibold text-foreground">{pattern.name}</p>
                <p className="text-sm text-foreground/72">{pattern.description}</p>
              </div>
            </GlassCard>
          ))
        )}
      </motion.div>

      <motion.div variants={cardCascadeItem} className="mb-10">
        <p className="mb-3 text-center text-xs font-bold uppercase tracking-widest text-foreground/68">Zyklen</p>
        <div className="flex gap-3">
          {[3, 5, 8, 10].map((cycleCount) => (
            <motion.button
              key={cycleCount}
              onClick={() => onSelectCycles(cycleCount)}
              initial="rest"
              animate="rest"
              whileHover={reducedMotion ? 'rest' : 'hover'}
              whileTap={reducedMotion ? 'rest' : 'tap'}
              variants={ctaFollowThrough}
              className={`flex h-12 w-12 items-center justify-center rounded-full border text-sm font-bold transition-all ${
                targetCycles === cycleCount ? `${activeTone.button} border-transparent` : 'border-border/80 bg-card/88 text-foreground/72'
              }`}
            >
              {cycleCount}
            </motion.button>
          ))}
        </div>
      </motion.div>

      {!isBlockedFlow ? (
        <motion.button
          variants={cardCascadeItem}
          initial="rest"
          animate="rest"
          whileHover={reducedMotion ? 'rest' : 'hover'}
          whileTap={reducedMotion ? 'rest' : 'tap'}
          onClick={onStart}
          className={cn('relative flex h-20 w-20 items-center justify-center rounded-full', activeTone.button)}
        >
          <motion.div
            className="absolute inset-0 rounded-full border border-white/20"
            animate={reducedMotion ? undefined : { scale: [0.92, 1.04, 1], opacity: [0.22, 0.34, 0.22] }}
            transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
          />
          <Play size={32} className="relative ml-1" />
        </motion.button>
      ) : null}
    </motion.div>
  );
}
