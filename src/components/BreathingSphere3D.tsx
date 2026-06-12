import { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

interface BreathingSphere3DProps {
  phase: 'inhale' | 'hold' | 'exhale' | 'rest';
  progress: number;
  duration: number;
  isActive: boolean;
  tone?: 'breathing' | 'reflection' | 'strict';
  reducedMotion?: boolean;
}

const isLowDPR = typeof window !== 'undefined' && window.devicePixelRatio <= 1;

// Refined, softer aesthetics
const phasePalettes: Record<
  NonNullable<BreathingSphere3DProps['tone']>,
  {
    gradient: string;
    shadow: string;
    backdrop: string;
  }
> = {
  breathing: {
    gradient: 'linear-gradient(135deg, hsl(183 70% 65% / 0.8), hsl(190 75% 45% / 0.8))',
    shadow: 'hsla(183, 70%, 55%, 0.4)',
    backdrop: 'hsl(183 50% 50% / 0.1)',
  },
  strict: {
    gradient: 'linear-gradient(135deg, hsl(260 75% 75% / 0.8), hsl(270 65% 55% / 0.8))',
    shadow: 'hsla(260, 75%, 65%, 0.4)',
    backdrop: 'hsl(260 50% 60% / 0.1)',
  },
  reflection: {
    gradient: 'linear-gradient(135deg, hsl(195 85% 70% / 0.8), hsl(205 80% 55% / 0.8))',
    shadow: 'hsla(195, 85%, 60%, 0.4)',
    backdrop: 'hsl(195 50% 60% / 0.1)',
  },
};

// Target scales for the overlapping rings to create depth
const scales = {
  inhale: [1.2, 1.4, 1.6],
  hold: [1.2, 1.4, 1.6],
  exhale: [0.7, 0.8, 0.9],
  rest: [0.7, 0.8, 0.9],
};

export default function BreathingSphere3D({
  phase,
  progress,
  duration,
  isActive,
  tone = 'breathing',
  reducedMotion: reducedMotionOverride,
}: BreathingSphere3DProps) {
  const prefersReducedMotion = useReducedMotion();
  const reducedMotion = reducedMotionOverride ?? prefersReducedMotion;
  
  const palette = phasePalettes[tone];
  const activeScales = isActive ? scales[phase] : [1, 1, 1];
  const cycleDuration = Math.max(duration, 2);
  
  return (
    <div className="relative flex h-[var(--breathing-scene-size)] w-[var(--breathing-scene-size)] max-w-full items-center justify-center [--breathing-scene-size:min(340px,calc(100vw-1rem))] sm:[--breathing-scene-size:400px]">
      
      {/* Background ambient glow */}
      <motion.div
        className="absolute inset-[15%] rounded-full blur-3xl"
        style={{
          background: palette.backdrop,
          willChange: 'transform, opacity',
        }}
        animate={reducedMotion ? { scale: 1, opacity: 0.5 } : { scale: [0.9, 1.1, 0.9], opacity: [0.4, 0.8, 0.4] }}
        transition={{ duration: cycleDuration, repeat: reducedMotion ? 0 : Infinity, ease: 'easeInOut' }}
      />

      {/* Layered rings for the 'flower' petal breathing effect */}
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="absolute inset-[25%] rounded-full mix-blend-screen dark:mix-blend-lighten"
          style={{
            background: palette.gradient,
            boxShadow: `0 0 40px ${palette.shadow}, inset 0 0 20px rgba(255,255,255,0.5)`,
            willChange: 'transform, opacity',
            opacity: 0.4 - i * 0.1,
          }}
          animate={{
            scale: activeScales[i],
            rotate: isActive ? (phase === 'inhale' || phase === 'hold' ? 45 * (i + 1) : 0) : 0,
          }}
          transition={{
            scale: { duration: cycleDuration * 0.8, ease: [0.25, 1, 0.35, 1] },
            rotate: { duration: cycleDuration * 0.8, ease: 'easeInOut' },
          }}
        />
      ))}

      {/* Center core */}
      <motion.div
        className="absolute inset-[35%] rounded-full border border-white/30"
        style={{
          background: 'linear-gradient(145deg, rgba(255,255,255,0.8), rgba(255,255,255,0.2))',
          boxShadow: `0 10px 30px ${palette.shadow}, inset 0 2px 10px rgba(255,255,255,0.8)`,
          backdropFilter: 'blur(8px)',
          willChange: 'transform',
        }}
        animate={{
          scale: isActive ? (phase === 'inhale' || phase === 'hold' ? 1.1 : 0.85) : 1,
        }}
        transition={{
          duration: cycleDuration * 0.7,
          ease: [0.25, 1, 0.35, 1],
        }}
      />
      
      {/* Tiny orbital dot indicating progress */}
      {!reducedMotion && isActive && (
        <motion.div 
          className="absolute inset-[15%] rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
        >
          <div 
            className="absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full shadow-[0_0_10px_rgba(255,255,255,0.8)]"
            style={{ 
              background: 'white',
              opacity: isActive ? 0.8 : 0 
            }} 
          />
        </motion.div>
      )}
    </div>
  );
}

