import { motion, useReducedMotion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import GlassCard from '@/components/GlassCard';
import { useIsMobile } from '@/hooks/use-mobile';
import { ctaFollowThrough, premiumEase } from '@/lib/motion';
import { tonePalettes, type SemanticTone } from '@/lib/semanticTones';
import { cn } from '@/lib/utils';
import { getInteractiveCardProps } from './interactiveCard';

type MetricTone = Exclude<SemanticTone, 'default'>;

interface MetricCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  hint: string;
  tone?: MetricTone;
  onClick?: () => void;
  motionPreset?: 'soft' | 'dense' | 'hero';
}

export function MetricCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = 'primary',
  onClick,
  motionPreset = 'soft',
}: MetricCardProps) {
  const palette = tonePalettes[tone];
  const reducedMotion = useReducedMotion();
  const isMobile = useIsMobile();
  const allowHoverMotion = !reducedMotion && !isMobile;
  const allowTapMotion = !reducedMotion;
  const allowEntryMotion = !reducedMotion;
  const isTextValue = typeof value === 'string' && Number.isNaN(Number(value));
  const interactiveProps = getInteractiveCardProps(onClick);

  return (
    <GlassCard
      interactive={Boolean(onClick)}
      onClick={onClick}
      {...interactiveProps}
      elevation="raised"
      surface={motionPreset === 'hero' ? 'hero' : 'featured'}
      tilt={Boolean(onClick)}
      accentGlow={motionPreset === 'hero'}
      ambient={motionPreset === 'hero' ? 'subtle' : 'none'}
      motionPreset={motionPreset}
      tone={tone}
      className={cn(
        'group h-full overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
      )}
    >
      <div
        aria-hidden="true"
        className={cn('pointer-events-none absolute right-[-10%] top-0 h-28 w-28 rounded-full blur-3xl opacity-80', palette.glow)}
      />

      <div className="relative z-10 flex h-full flex-col">
        <div className="mb-3 flex flex-col gap-3 sm:mb-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="break-words text-[11px] font-black uppercase tracking-[0.18em] text-foreground/68">{label}</p>
            <motion.p
              key={String(value)}
              initial={allowEntryMotion ? { opacity: 0, y: 14, scale: 0.96 } : false}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={allowEntryMotion ? { duration: 0.26, ease: premiumEase } : { duration: 0 }}
              className={cn(
                'mt-2 break-words font-black text-foreground',
                isTextValue
                  ? 'text-xl leading-tight tracking-[-0.04em] sm:text-2xl'
                  : 'text-2xl tracking-[-0.06em] sm:text-3xl',
              )}
            >
              {value}
            </motion.p>
            <p className="mt-1 break-words text-[13px] font-medium leading-relaxed text-foreground/72 sm:hidden">{hint}</p>
          </div>

          <motion.div
            className={cn(
              'relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl sm:h-12 sm:w-12',
              palette.icon,
            )}
            initial="rest"
            animate="rest"
            whileHover={allowHoverMotion ? 'hover' : 'rest'}
            whileTap={allowTapMotion ? 'tap' : 'rest'}
            variants={ctaFollowThrough}
          >
            <motion.div
              aria-hidden="true"
              className="absolute inset-1 rounded-[1rem] border border-white/18"
              initial={false}
              animate={{ opacity: 0.2, scale: 0.98 }}
              whileHover={allowHoverMotion ? { opacity: 0.42, scale: 1.02 } : undefined}
              transition={allowHoverMotion ? { duration: 0.18, ease: premiumEase } : { duration: 0 }}
            />
            <Icon size={22} strokeWidth={2.3} />
          </motion.div>
        </div>

        <div className="relative mb-3 h-1.5 overflow-hidden rounded-full bg-muted/55">
          <motion.div
            className={cn('h-full rounded-full bg-gradient-to-r', palette.line)}
            initial={allowEntryMotion ? { scaleX: 0.3, opacity: 0.5 } : false}
            animate={{ scaleX: 1, opacity: 1 }}
            transition={allowEntryMotion ? { duration: 0.28, ease: premiumEase } : { duration: 0 }}
            style={{ transformOrigin: 'left' }}
          />
        </div>

        <p className="hidden break-words text-[13px] font-medium leading-relaxed text-foreground/72 sm:block sm:text-sm">{hint}</p>
      </div>
    </GlassCard>
  );
}
