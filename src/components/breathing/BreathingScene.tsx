import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

interface BreathingSceneProps {
  phase: 'rest' | 'inhale' | 'hold' | 'exhale';
  progress: number;
  duration: number;
  isActive: boolean;
  tone: 'breathing' | 'reflection' | 'strict';
  /** Number of fully completed breathing phases; keeps the orbit continuous between phase resets. */
  completedOrbitSegments?: number;
  reducedMotion?: boolean;
}

export function getContinuousOrbitRotation(completedSegments: number, progress: number) {
  return (completedSegments + Math.min(Math.max(progress, 0), 1)) * 360 - 90;
}

function getToneVars(tone: BreathingSceneProps['tone']) {
  if (tone === 'reflection') {
    return {
      core: 'hsl(var(--mode-reflection) / 0.84)',
      glow: 'hsl(var(--mode-reflection-glow) / 0.46)',
      line: 'hsl(var(--mode-reflection-border) / 0.56)',
      track: 'hsl(var(--mode-reflection-foreground) / 0.14)',
    };
  }

  if (tone === 'strict') {
    return {
      core: 'hsl(var(--mode-strict) / 0.84)',
      glow: 'hsl(var(--mode-strict-glow) / 0.46)',
      line: 'hsl(var(--mode-strict-border) / 0.56)',
      track: 'hsl(var(--mode-strict-foreground) / 0.14)',
    };
  }

  return {
    core: 'hsl(var(--mode-breathing) / 0.84)',
    glow: 'hsl(var(--mode-breathing-glow) / 0.46)',
    line: 'hsl(var(--mode-breathing-border) / 0.56)',
    track: 'hsl(var(--mode-breathing-foreground) / 0.14)',
  };
}

export function BreathingScene({
  phase,
  progress,
  duration,
  isActive,
  tone,
  completedOrbitSegments = 0,
  reducedMotion = false,
}: BreathingSceneProps) {
  const palette = getToneVars(tone);
  const isExpanded = isActive && (phase === 'inhale' || phase === 'hold');
  const isHolding = isActive && phase === 'hold';
  const clampedProgress = Math.min(Math.max(progress, 0), 1);
  const orbitRadius = 45;
  const orbitLength = 2 * Math.PI * orbitRadius;
  const phaseDuration = Math.max(duration * 0.7, 0.7);
  const previousProgressRef = useRef(clampedProgress);
  const isProgressReset = clampedProgress < previousProgressRef.current - 0.001;

  useEffect(() => {
    previousProgressRef.current = clampedProgress;
  }, [clampedProgress]);

  const settleTransition = {
    duration: phaseDuration,
    ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
  };

  return (
    <div
      data-testid="breathing-scene"
      data-phase={phase}
      data-tone={tone}
      className="relative flex h-[var(--breathing-scene-size)] w-[var(--breathing-scene-size)] max-w-full items-center justify-center [--breathing-scene-size:min(320px,calc(100vw-2rem))] sm:[--breathing-scene-size:380px]"
    >
      {/* The field expands and settles with the actual breath instead of running its own decorative loop. */}
      <motion.div
        className="absolute h-[calc(var(--breathing-scene-size)*1.04)] w-[calc(var(--breathing-scene-size)*1.04)] rounded-full blur-3xl"
        style={{
          background: `radial-gradient(circle, ${palette.glow} 0%, transparent 62%)`,
          willChange: 'transform, opacity',
        }}
        animate={reducedMotion ? { opacity: 0.48, scale: 1 } : {
          opacity: isExpanded ? 0.92 : 0.36,
          scale: isExpanded ? 1.08 : 0.78,
        }}
        transition={settleTransition}
      />

      {/* Fine concentric lines keep the composition calm and give the expansion a visible spatial rhythm. */}
      {[0, 1, 2].map((index) => (
        <motion.div
          key={index}
          className="absolute rounded-full border"
          style={{
            height: `calc(var(--breathing-scene-size) * ${0.53 + index * 0.105})`,
            width: `calc(var(--breathing-scene-size) * ${0.53 + index * 0.105})`,
            borderColor: palette.line,
            willChange: 'transform, opacity',
          }}
          animate={reducedMotion ? { opacity: 0.11, scale: 1 } : {
            opacity: isExpanded ? 0.26 - index * 0.055 : 0.06 - index * 0.008,
            scale: isExpanded ? 1.08 + index * 0.075 : 0.83 + index * 0.035,
          }}
          transition={{ ...settleTransition, delay: index * 0.045 }}
        />
      ))}

      {/* The orbit is the only explicit time indicator; SVG interpolation smooths the engine's second-by-second ticks. */}
      <svg
        className="absolute h-[calc(var(--breathing-scene-size)*0.78)] w-[calc(var(--breathing-scene-size)*0.78)] -rotate-90"
        viewBox="0 0 100 100"
        aria-hidden="true"
      >
        <circle cx="50" cy="50" r={orbitRadius} fill="none" stroke={palette.track} strokeWidth="1.25" />
        <circle
          cx="50"
          cy="50"
          r={orbitRadius}
          fill="none"
          stroke={palette.line}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={orbitLength}
          strokeDashoffset={orbitLength * (1 - clampedProgress)}
          style={{ transition: reducedMotion || isProgressReset ? 'none' : 'stroke-dashoffset 1s linear' }}
        />
      </svg>

      {!reducedMotion && isActive ? (
        <motion.div
          className="pointer-events-none absolute h-[calc(var(--breathing-scene-size)*0.78)] w-[calc(var(--breathing-scene-size)*0.78)] rounded-full"
          animate={{ rotate: getContinuousOrbitRotation(completedOrbitSegments, clampedProgress) }}
          transition={{ duration: 1, ease: 'linear' }}
        >
          <div
            className="absolute -right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border border-white/50 bg-white/90"
            style={{ boxShadow: `0 0 16px ${palette.glow}` }}
          />
        </motion.div>
      ) : null}

      {/* The core moves as one quiet body of light: larger and brighter on inhale, composed on hold, then softly receding. */}
      <motion.div
        className="relative h-[calc(var(--breathing-scene-size)*0.5)] w-[calc(var(--breathing-scene-size)*0.5)] overflow-hidden rounded-full border border-white/20"
        style={{
          background: `radial-gradient(circle at 31% 26%, rgba(255,255,255,0.58) 0%, ${palette.core} 44%, rgba(0,0,0,0.13) 100%)`,
          boxShadow: `0 18px 62px ${palette.glow}, inset 0 1px 22px rgba(255,255,255,0.18)`,
          willChange: 'transform, opacity',
        }}
        animate={reducedMotion ? { opacity: 1, scale: 1 } : {
          opacity: isHolding ? 0.94 : 1,
          scale: isExpanded ? 1.1 : 0.88,
        }}
        transition={settleTransition}
      >
        <motion.div
          className="absolute inset-[10%] rounded-full"
          style={{
            background: 'radial-gradient(circle at 36% 28%, rgba(255,255,255,0.66), rgba(255,255,255,0.05) 52%, transparent 72%)',
            willChange: 'transform, opacity',
          }}
          animate={reducedMotion ? { opacity: 0.45, x: 0, y: 0, scale: 1 } : {
            opacity: isExpanded ? 0.9 : 0.34,
            x: isExpanded ? 8 : -5,
            y: isExpanded ? -7 : 4,
            scale: isExpanded ? 1.09 : 0.9,
          }}
          transition={settleTransition}
        />
        <motion.div
          className="absolute inset-[27%] rounded-full border border-white/25"
          animate={reducedMotion ? { opacity: 0.18, scale: 1 } : {
            opacity: isExpanded ? 0.42 : 0.1,
            scale: isExpanded ? 1.16 : 0.76,
          }}
          transition={settleTransition}
        />
      </motion.div>
    </div>
  );
}
