import { useMemo, useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

interface BreathingSphere3DProps {
  phase: 'inhale' | 'hold' | 'exhale' | 'rest';
  progress: number;
  duration: number;
  isActive: boolean;
  tone?: 'breathing' | 'reflection' | 'strict';
  reducedMotion?: boolean;
}

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
    shadow: 'hsla(183, 70%, 55%, 0.45)',
    backdrop: 'hsl(183 50% 50% / 0.1)',
  },
  strict: {
    gradient: 'linear-gradient(135deg, hsl(260 75% 75% / 0.8), hsl(270 65% 55% / 0.8))',
    shadow: 'hsla(260, 75%, 65%, 0.45)',
    backdrop: 'hsl(260 50% 60% / 0.1)',
  },
  reflection: {
    gradient: 'linear-gradient(135deg, hsl(195 85% 70% / 0.8), hsl(205 80% 55% / 0.8))',
    shadow: 'hsla(195, 85%, 60%, 0.45)',
    backdrop: 'hsl(195 50% 60% / 0.1)',
  },
};

// Target scales for the overlapping rings to create depth
const scales = {
  inhale: [1.25, 1.45, 1.65],
  hold: [1.25, 1.45, 1.65],
  exhale: [0.72, 0.82, 0.92],
  rest: [0.72, 0.82, 0.92],
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

  // Track progress reset to avoid backward-spinning animation on phase change
  const prevProgressRef = useRef(progress);
  const isResetting = progress < prevProgressRef.current - 0.01;
  useEffect(() => {
    prevProgressRef.current = progress;
  }, [progress]);
  
  return (
    <div className="relative flex h-[var(--breathing-scene-size)] w-[var(--breathing-scene-size)] max-w-full items-center justify-center [--breathing-scene-size:min(340px,calc(100vw-1rem))] sm:[--breathing-scene-size:400px]">
      
      {/* Background ambient glow - dynamically breathing */}
      <motion.div
        className="absolute inset-[5%] rounded-full blur-3xl"
        style={{
          background: palette.backdrop,
          willChange: 'transform, opacity',
        }}
        animate={
          reducedMotion
            ? { scale: 1, opacity: 0.5 }
            : {
                scale: isActive && (phase === 'inhale' || phase === 'hold') ? 1.25 : 0.85,
                opacity: isActive && (phase === 'inhale' || phase === 'hold') ? 0.85 : 0.4,
              }
        }
        transition={{ duration: cycleDuration * 0.8, ease: 'easeInOut' }}
      />

      {/* Layered rings for the 'flower' petal breathing effect */}
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="absolute inset-[25%] rounded-full mix-blend-screen dark:mix-blend-lighten"
          style={{
            background: palette.gradient,
            willChange: 'transform, opacity',
          }}
          animate={{
            scale: activeScales[i],
            rotate: isActive ? (phase === 'inhale' || phase === 'hold' ? 45 * (i + 1) : 0) : 0,
            opacity: isActive
              ? (phase === 'inhale' || phase === 'hold' ? 0.55 - i * 0.12 : 0.32 - i * 0.08)
              : 0.4 - i * 0.1,
            boxShadow: isActive
              ? (phase === 'inhale' || phase === 'hold'
                ? `0 0 ${60 + i * 20}px ${palette.shadow}, inset 0 0 ${30 + i * 10}px rgba(255,255,255,0.6)`
                : `0 0 ${30 + i * 10}px ${palette.shadow}, inset 0 0 ${15 + i * 5}px rgba(255,255,255,0.4)`)
              : `0 0 40px ${palette.shadow}, inset 0 0 20px rgba(255,255,255,0.5)`,
          }}
          transition={{
            scale: { duration: cycleDuration * 0.8, ease: [0.25, 1, 0.35, 1] },
            rotate: { duration: cycleDuration * 0.8, ease: 'easeInOut' },
            opacity: { duration: cycleDuration * 0.8, ease: 'easeInOut' },
            boxShadow: { duration: cycleDuration * 0.8, ease: [0.25, 1, 0.35, 1] },
          }}
        />
      ))}

      {/* Soft pulsing aura behind the center core */}
      {!reducedMotion && isActive && (
        <motion.div
          className="absolute inset-[35%] rounded-full border border-white/10"
          style={{
            background: palette.backdrop,
            boxShadow: `0 0 40px ${palette.shadow}`,
            willChange: 'transform, opacity',
            pointerEvents: 'none',
          }}
          animate={{
            scale: phase === 'inhale' || phase === 'hold' ? 1.38 : 0.82,
            opacity: phase === 'inhale' || phase === 'hold' ? 0.4 : 0.06,
          }}
          transition={{
            duration: cycleDuration * 0.85,
            ease: 'easeInOut',
          }}
        />
      )}

      {/* Center core */}
      <motion.div
        className="absolute inset-[35%] rounded-full border"
        style={{
          background: 'linear-gradient(145deg, rgba(255,255,255,0.85), rgba(255,255,255,0.25))',
          backdropFilter: 'blur(10px)',
          willChange: 'transform',
        }}
        animate={{
          scale: isActive ? (phase === 'inhale' || phase === 'hold' ? 1.15 : 0.85) : 1,
          borderColor: isActive
            ? (phase === 'inhale' || phase === 'hold' ? 'rgba(255, 255, 255, 0.6)' : 'rgba(255, 255, 255, 0.25)')
            : 'rgba(255, 255, 255, 0.3)',
          boxShadow: isActive
            ? (phase === 'inhale' || phase === 'hold'
              ? `0 16px 40px ${palette.shadow}, inset 0 2px 16px rgba(255,255,255,0.9)`
              : `0 6px 20px ${palette.shadow}, inset 0 2px 8px rgba(255,255,255,0.6)`)
            : `0 10px 30px ${palette.shadow}, inset 0 2px 10px rgba(255,255,255,0.8)`,
        }}
        transition={{
          duration: cycleDuration * 0.75,
          ease: [0.25, 1, 0.35, 1],
        }}
      />
      
      {/* Smooth orbital progress track & indicator dot */}
      {!reducedMotion && isActive && (
        <div className="absolute inset-[15%] pointer-events-none">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            {/* Soft background track ring */}
            <circle
              cx="50"
              cy="50"
              r="48"
              fill="none"
              stroke="rgba(255, 255, 255, 0.08)"
              strokeWidth="1.2"
            />
          </svg>
          <motion.div
            className="absolute inset-0 rounded-full"
            animate={{ rotate: progress * 360 - 90 }}
            transition={{
              type: 'tween',
              ease: 'linear',
              duration: isResetting ? 0 : 1,
            }}
          >
            <div className="absolute top-1/2 -right-1.5 h-3.5 w-3.5 -translate-y-1/2 rounded-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.95)] border border-white/20" />
          </motion.div>
        </div>
      )}
    </div>
  );
}

