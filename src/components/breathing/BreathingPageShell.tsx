import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Smartphone, Volume2, VolumeX } from 'lucide-react';
import { formatUnlockDurationLabel } from '@/lib/unlockDuration';
import { cn } from '@/lib/utils';
import type { TonePalette } from '@/lib/semanticTones';
import { ctaFollowThrough, sectionItem, sectionStagger } from '@/lib/motion';

interface BreathingPageShellProps {
  children: ReactNode;
  isBlockedFlow: boolean;
  reducedMotion: boolean;
  activeTone: TonePalette;
  soundEnabled: boolean;
  hapticEnabled: boolean;
  targetLabel?: string | null;
  unlockDurationMinutes?: number | null;
  onBack: () => void;
  onToggleSound: () => void;
  onToggleHaptic: () => void;
}

export function BreathingPageShell({
  children,
  isBlockedFlow,
  reducedMotion,
  activeTone,
  soundEnabled,
  hapticEnabled,
  targetLabel,
  unlockDurationMinutes,
  onBack,
  onToggleSound,
  onToggleHaptic,
}: BreathingPageShellProps) {
  const unlockDurationLabel = formatUnlockDurationLabel(unlockDurationMinutes);
  const shellBackground = isBlockedFlow
    ? 'radial-gradient(circle at 18% 18%, hsl(var(--mode-reflection-glow) / 0.28) 0%, transparent 34%), radial-gradient(circle at 82% 16%, hsl(var(--mode-reflection-border) / 0.18) 0%, transparent 28%), radial-gradient(circle at 50% 74%, hsl(var(--mode-reflection) / 0.12) 0%, transparent 42%), linear-gradient(180deg, hsl(var(--background) / 0.18) 0%, hsl(var(--background) / 0.82) 48%, hsl(var(--background)) 100%)'
    : 'radial-gradient(circle at 18% 18%, hsl(var(--mode-breathing-glow) / 0.3) 0%, transparent 34%), radial-gradient(circle at 82% 16%, hsl(var(--accent) / 0.18) 0%, transparent 28%), radial-gradient(circle at 50% 74%, hsl(var(--mode-breathing) / 0.14) 0%, transparent 42%), linear-gradient(180deg, hsl(var(--background) / 0.18) 0%, hsl(var(--background) / 0.82) 48%, hsl(var(--background)) 100%)';
  const ambientGlow = isBlockedFlow
    ? 'radial-gradient(circle, hsl(var(--mode-reflection-glow) / 0.18) 0%, hsl(var(--mode-reflection-glow) / 0.08) 38%, transparent 72%)'
    : 'radial-gradient(circle, hsl(var(--mode-breathing-glow) / 0.16) 0%, hsl(var(--mode-breathing-glow) / 0.06) 38%, transparent 72%)';

  return (
    <div className="relative mx-auto flex min-h-screen max-w-lg flex-col px-4 pt-8">
      <div className="pointer-events-none fixed inset-0 z-0">
        <div
          className="absolute inset-0 opacity-95 dark:opacity-80"
          style={{
            background: shellBackground,
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/24 via-background/76 to-background" />
      </div>

      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <motion.div
          className="absolute left-[10%] top-[18%] h-72 w-72 rounded-full"
          style={{
            background: ambientGlow,
          }}
          animate={
            reducedMotion
              ? { opacity: 0.24 }
              : {
                  x: [0, 20, 0],
                  y: [0, -14, 0],
                  scale: [1, 1.08, 1],
                  opacity: [0.2, 0.32, 0.2],
                }
          }
          transition={{ duration: 8.4, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      <motion.div variants={sectionStagger} initial="hidden" animate="show" className="relative z-10 flex w-full flex-1 flex-col">
        <motion.div variants={sectionItem} className="mb-8 flex w-full items-center">
          {isBlockedFlow ? (
            <div className="w-10" />
          ) : (
            <motion.button
              onClick={onBack}
              initial="rest"
              animate="rest"
              whileHover={reducedMotion ? 'rest' : 'hover'}
              whileTap={reducedMotion ? 'rest' : 'tap'}
              variants={ctaFollowThrough}
              className="btn-press rounded-full border border-border/70 bg-card/88 p-2 text-foreground/72"
            >
              <ArrowLeft size={22} />
            </motion.button>
          )}

          <div className="flex-1 text-center">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-foreground/68">Atemfokus</p>
            <h1 className="mt-1 font-serif text-2xl font-bold text-foreground">Atemübung</h1>
            {isBlockedFlow && unlockDurationLabel ? (
              <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-foreground/68">
                {targetLabel ? `${targetLabel} | ${unlockDurationLabel}` : unlockDurationLabel}
              </p>
            ) : null}
          </div>

          <div className="flex gap-2">
            <motion.button
              onClick={onToggleSound}
              initial="rest"
              animate="rest"
              whileHover={reducedMotion ? 'rest' : 'hover'}
              whileTap={reducedMotion ? 'rest' : 'tap'}
              variants={ctaFollowThrough}
              className={cn('rounded-full border p-2 transition-colors', soundEnabled ? activeTone.badge : 'border-border/70 bg-card/88 text-foreground/58')}
            >
              {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </motion.button>
            <motion.button
              onClick={onToggleHaptic}
              initial="rest"
              animate="rest"
              whileHover={reducedMotion ? 'rest' : 'hover'}
              whileTap={reducedMotion ? 'rest' : 'tap'}
              variants={ctaFollowThrough}
              className={cn('rounded-full border p-2 transition-colors', hapticEnabled ? activeTone.badge : 'border-border/70 bg-card/88 text-foreground/58')}
            >
              <Smartphone size={18} />
            </motion.button>
          </div>
        </motion.div>

        {children}
      </motion.div>
    </div>
  );
}
