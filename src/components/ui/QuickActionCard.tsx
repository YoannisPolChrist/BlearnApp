import { motion, useReducedMotion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { ChevronRight } from 'lucide-react';
import GlassCard from '@/components/GlassCard';
import { useIsMobile } from '@/hooks/use-mobile';
import { ctaFollowThrough, premiumEase } from '@/lib/motion';
import { tonePalettes, type SemanticTone } from '@/lib/semanticTones';
import { cn } from '@/lib/utils';
import { getInteractiveCardProps } from './interactiveCard';

type ActionTone = Exclude<SemanticTone, 'default'>;

interface QuickActionCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  onClick: () => void;
  tone?: ActionTone;
  badge?: string;
  className?: string;
  motionPreset?: 'soft' | 'dense' | 'hero';
  dataTourId?: string;
}

export function QuickActionCard({
  icon: Icon,
  title,
  description,
  onClick,
  tone = 'primary',
  badge,
  className,
  motionPreset = 'soft',
  dataTourId,
}: QuickActionCardProps) {
  const reducedMotion = useReducedMotion();
  const isMobile = useIsMobile();
  const allowHoverMotion = !reducedMotion && !isMobile;
  const allowTapMotion = !reducedMotion;
  const palette = tonePalettes[tone];
  const interactiveProps = getInteractiveCardProps(onClick);

  return (
    <GlassCard
      interactive
      onClick={onClick}
      {...interactiveProps}
      elevation="raised"
      surface={motionPreset === 'hero' ? 'hero' : 'featured'}
      tilt
      accentGlow={motionPreset === 'hero'}
      ambient={motionPreset === 'hero' ? 'subtle' : 'none'}
      motionPreset={motionPreset}
      tone={tone}
      data-tour-id={dataTourId}
      className={cn(
        'group h-full overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        className,
      )}
    >
      <div className="relative z-10 flex h-full flex-col">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3 sm:mb-4">
          <motion.div
            className={cn('relative flex h-12 w-12 items-center justify-center rounded-2xl', palette.icon)}
            initial={false}
            whileHover={allowHoverMotion ? { scale: 1.04, rotate: -3 } : undefined}
            transition={allowHoverMotion ? { duration: 0.22, ease: premiumEase } : { duration: 0 }}
          >
            <motion.div
              aria-hidden="true"
              className="absolute inset-1 rounded-[1rem] border border-white/18"
              initial={false}
              animate={{ opacity: 0.24, scale: 0.98 }}
              whileHover={allowHoverMotion ? { opacity: 0.46, scale: 1.02 } : undefined}
              transition={allowHoverMotion ? { duration: 0.18, ease: premiumEase } : { duration: 0 }}
            />
            <Icon size={22} strokeWidth={2.3} />
          </motion.div>

          {badge ? (
            <motion.span
              className={cn(
                'max-w-full rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em]',
                palette.badge,
              )}
              initial={false}
              whileHover={allowHoverMotion ? { y: -1, scale: 1.02 } : undefined}
              transition={allowHoverMotion ? { duration: 0.18, ease: premiumEase } : { duration: 0 }}
            >
              {badge}
            </motion.span>
          ) : null}
        </div>

        <div className="flex flex-1 flex-col">
          <p className="break-words text-sm font-black tracking-[-0.03em] text-foreground sm:text-base">{title}</p>
          <p className="mt-1 flex-1 break-words text-[13px] leading-relaxed text-foreground/72 sm:text-sm">
            {description}
          </p>
        </div>

        <motion.div
          className={cn(
            'mt-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-foreground/68 sm:mt-4 sm:text-xs',
            palette.text,
          )}
          initial="rest"
          animate="rest"
          whileHover={allowHoverMotion ? 'hover' : 'rest'}
          whileTap={allowTapMotion ? 'tap' : 'rest'}
          variants={ctaFollowThrough}
        >
          Öffnen
          <motion.span
            initial={false}
            whileHover={allowHoverMotion ? { x: 4 } : undefined}
            whileTap={allowTapMotion ? { x: 2 } : undefined}
            transition={allowTapMotion ? { duration: 0.18, ease: premiumEase } : { duration: 0 }}
          >
            <ChevronRight size={14} />
          </motion.span>
        </motion.div>
      </div>
    </GlassCard>
  );
}
