import { lazy, Suspense } from 'react';
import { motion } from 'framer-motion';
import { isAndroidPlatform } from '@/lib/platform';

const BreathingSphere3D = lazy(() => import('@/components/BreathingSphere3D'));

interface BreathingSceneProps {
  phase: 'rest' | 'inhale' | 'hold' | 'exhale';
  progress: number;
  duration: number;
  isActive: boolean;
  tone: 'breathing' | 'reflection' | 'strict';
  reducedMotion?: boolean;
}

function getToneVars(tone: BreathingSceneProps['tone']) {
  if (tone === 'reflection') {
    return {
      base: 'hsl(var(--mode-reflection) / 0.78)',
      glow: 'hsl(var(--mode-reflection-glow) / 0.42)',
      ring: 'hsl(var(--mode-reflection-glow) / 0.36)',
      accent: 'hsl(var(--mode-reflection-border) / 0.18)',
    };
  }

  if (tone === 'strict') {
    return {
      base: 'hsl(var(--mode-strict) / 0.78)',
      glow: 'hsl(var(--mode-strict-glow) / 0.42)',
      ring: 'hsl(var(--mode-strict-glow) / 0.34)',
      accent: 'hsl(var(--mode-strict-border) / 0.18)',
    };
  }

  return {
    base: 'hsl(var(--mode-breathing) / 0.78)',
    glow: 'hsl(var(--mode-breathing-glow) / 0.42)',
    ring: 'hsl(var(--mode-breathing-glow) / 0.34)',
    accent: 'hsl(var(--mode-breathing-border) / 0.18)',
  };
}

function OptimizedBreathingScene({ phase, progress, duration, isActive, tone, reducedMotion }: BreathingSceneProps) {
  const palette = getToneVars(tone);
  const targetScale = phase === 'inhale' || phase === 'hold' ? 1.08 : 0.92;
  // Drive the progress ring with a CSS custom prop — avoids a Framer Motion
  // re-render on every progress tick (which happens every animation frame).
  const progressAngle = Math.min(Math.max(progress, 0), 1) * 360;
  const glowDuration = Math.max(duration, 2.4);

  return (
    <div className="relative flex h-[var(--breathing-scene-size)] w-[var(--breathing-scene-size)] max-w-full items-center justify-center [--breathing-scene-size:min(320px,calc(100vw-2rem))] sm:[--breathing-scene-size:380px]">
      {/* Ambient glow */}
      <motion.div
        className="absolute h-[calc(var(--breathing-scene-size)*0.82)] w-[calc(var(--breathing-scene-size)*0.82)] rounded-full blur-3xl"
        style={{
          background: `radial-gradient(circle, ${palette.glow} 0%, transparent 72%)`,
          willChange: 'transform, opacity',
        }}
        animate={reducedMotion ? { opacity: 0.78, scale: 1 } : { opacity: [0.64, 0.94, 0.64], scale: [0.94, 1.04, 0.94] }}
        transition={{ duration: glowDuration, repeat: reducedMotion ? 0 : Infinity, ease: 'easeInOut' }}
      />

      {/* Progress ring — updated every frame via CSS custom prop, no FM re-render */}
      <div
        className="absolute h-[calc(var(--breathing-scene-size)*0.7)] w-[calc(var(--breathing-scene-size)*0.7)] rounded-full"
        style={{
          background: `conic-gradient(${palette.ring} ${progressAngle}deg, transparent ${progressAngle}deg 360deg)`,
        }}
      >
        <div className="absolute inset-[6%] rounded-full bg-background/86 backdrop-blur-xl" />
      </div>

      {/* Main sphere — GPU-composited scale */}
      <motion.div
        className="relative h-[calc(var(--breathing-scene-size)*0.5)] w-[calc(var(--breathing-scene-size)*0.5)] rounded-full border border-white/10"
        style={{
          background: `radial-gradient(circle at 30% 28%, rgba(255,255,255,0.32) 0%, ${palette.accent} 28%, ${palette.base} 100%)`,
          boxShadow: `0 18px 60px ${palette.glow}, inset 0 1px 16px rgba(255,255,255,0.12)`,
          willChange: 'transform',
        }}
        animate={{
          scale: isActive ? targetScale : 1,
          opacity: phase === 'hold' ? 0.96 : 1,
        }}
        transition={{
          scale: { duration: Math.max(duration * 0.55, 0.7), ease: [0.16, 1, 0.3, 1] },
          opacity: { duration: 0.28, ease: 'easeInOut' },
        }}
      />
    </div>
  );
}

export function BreathingScene({ phase, progress, duration, isActive, tone, reducedMotion }: BreathingSceneProps) {
  if (isAndroidPlatform) {
    return (
      <OptimizedBreathingScene
        phase={phase}
        progress={progress}
        duration={duration}
        isActive={isActive}
        tone={tone}
        reducedMotion={reducedMotion}
      />
    );
  }

  const palette = getToneVars(tone);

  return (
    <Suspense
      fallback={
        <div className="flex h-[var(--breathing-scene-size)] w-[var(--breathing-scene-size)] max-w-full items-center justify-center [--breathing-scene-size:min(340px,calc(100vw-1rem))] sm:[--breathing-scene-size:400px]">
          <motion.div
            className="h-[calc(var(--breathing-scene-size)*0.5294117647)] w-[calc(var(--breathing-scene-size)*0.5294117647)] rounded-full"
            animate={reducedMotion ? undefined : { scale: [0.92, 1.06, 0.92] }}
            transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              background: `linear-gradient(135deg, ${palette.base}, ${palette.glow})`,
              boxShadow: `0 0 60px ${palette.ring}`,
            }}
          />
        </div>
      }
    >
      <BreathingSphere3D
        phase={phase}
        progress={progress}
        duration={duration}
        isActive={isActive}
        tone={tone}
        reducedMotion={reducedMotion}
      />
    </Suspense>
  );
}
