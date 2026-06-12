import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';
import { premiumEase } from '@/lib/motion';

interface SuccessTileAnimationProps {
  eyebrow?: string;
  title?: string;
  description?: string;
  detail?: string;
  emoji?: string;
  children?: ReactNode;
  className?: string;
  variant?: 'hero' | 'compact';
}

const PARTICLE_POSITIONS = [
  { left: '11%', top: '58%', x: -54, y: -88, color: 'hsl(var(--mode-breathing-glow) / 0.9)' },
  { left: '17%', top: '46%', x: -70, y: -126, color: 'hsl(var(--accent) / 0.88)' },
  { left: '24%', top: '63%', x: -28, y: -98, color: 'hsl(var(--success) / 0.9)' },
  { left: '32%', top: '38%', x: -18, y: -138, color: 'hsl(var(--destructive) / 0.84)' },
  { left: '39%', top: '56%', x: -6, y: -104, color: 'hsl(var(--primary) / 0.84)' },
  { left: '47%', top: '44%', x: 0, y: -146, color: 'hsl(var(--mode-strict-glow) / 0.88)' },
  { left: '55%', top: '58%', x: 18, y: -116, color: 'hsl(var(--accent) / 0.88)' },
  { left: '63%', top: '40%', x: 34, y: -132, color: 'hsl(var(--success) / 0.9)' },
  { left: '71%', top: '54%', x: 46, y: -98, color: 'hsl(var(--mode-breathing-glow) / 0.9)' },
  { left: '77%', top: '43%', x: 62, y: -124, color: 'hsl(var(--destructive) / 0.84)' },
  { left: '84%', top: '60%', x: 52, y: -90, color: 'hsl(var(--primary) / 0.84)' },
  { left: '89%', top: '48%', x: 68, y: -118, color: 'hsl(var(--mode-strict-glow) / 0.88)' },
] as const;

export function SuccessTileAnimation({
  eyebrow,
  title = 'Erfolgreich',
  description,
  detail,
  emoji,
  children,
  className,
  variant = 'hero',
}: SuccessTileAnimationProps) {
  const reducedMotion = useReducedMotion();
  const isCompact = variant === 'compact';
  const particles = useMemo(
    () => (isCompact ? PARTICLE_POSITIONS.slice(0, 6) : PARTICLE_POSITIONS),
    [isCompact],
  );
  const shellClassName = isCompact
    ? 'rounded-[1.6rem] border border-success/18 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(244,255,249,0.98))] px-4 py-4 text-center shadow-[0_20px_52px_rgba(16,185,129,0.16)] sm:px-5 sm:py-4'
    : 'rounded-[2.25rem] border border-success/18 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(242,255,249,0.96))] px-6 py-7 text-center shadow-[0_26px_70px_rgba(16,185,129,0.16)] sm:px-7 sm:py-8';
  const haloClassName = isCompact
    ? 'absolute left-1/2 top-3.5 h-20 w-20 -translate-x-1/2 rounded-full bg-success/12 blur-2xl'
    : 'absolute left-1/2 top-6 h-28 w-28 -translate-x-1/2 rounded-full bg-success/12 blur-2xl';
  const iconWrapClassName = isCompact
    ? 'relative mx-auto mb-3.5 flex h-16 w-16 items-center justify-center'
    : 'relative mx-auto mb-6 flex h-28 w-28 items-center justify-center';
  const iconOuterClassName = isCompact
    ? 'absolute inset-[0.45rem] rounded-full border border-success/28'
    : 'absolute inset-[0.8rem] rounded-full border border-success/28';
  const iconInnerClassName = isCompact
    ? 'relative flex h-12 w-12 items-center justify-center rounded-full bg-[radial-gradient(circle,rgba(52,211,153,0.24),rgba(16,185,129,0.08)_68%,transparent_100%)] text-success'
    : 'relative flex h-20 w-20 items-center justify-center rounded-full bg-[radial-gradient(circle,rgba(52,211,153,0.24),rgba(16,185,129,0.08)_68%,transparent_100%)] text-success';
  const titleClassName = isCompact
    ? `${eyebrow ? 'mt-1.5' : ''} text-lg font-black tracking-[-0.04em] text-foreground`
    : `${eyebrow ? 'mt-2' : ''} text-3xl font-black tracking-[-0.05em] text-foreground`;
  const descriptionClassName = isCompact
    ? 'mx-auto mt-1.5 max-w-[15rem] text-[12px] font-medium leading-relaxed text-foreground/72'
    : 'mx-auto mt-3 max-w-[18rem] text-sm font-medium leading-relaxed text-foreground/72 sm:text-[15px]';
  const detailClassName = isCompact
    ? 'mx-auto mt-1 max-w-[14rem] text-[10px] font-black uppercase tracking-[0.14em] text-foreground/46'
    : 'mx-auto mt-2 max-w-[16rem] text-[11px] font-black uppercase tracking-[0.16em] text-foreground/46';

  return (
    <div
      data-feedback-variant={variant}
      className={`relative overflow-hidden ${shellClassName} ${className ?? ''}`}
    >
      <motion.div
        aria-hidden="true"
        className={isCompact
          ? 'absolute inset-x-5 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(16,185,129,0.42),transparent)]'
          : 'absolute inset-x-8 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(16,185,129,0.42),transparent)]'}
        initial={{ opacity: 0, x: '-28%' }}
        animate={{ opacity: 1, x: '28%' }}
        transition={{ duration: isCompact ? 0.4 : 0.55, ease: premiumEase }}
      />
      <motion.div
        aria-hidden="true"
        className={haloClassName}
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1.15, opacity: 1 }}
        transition={{ duration: isCompact ? 0.45 : 0.6, ease: premiumEase }}
      />

      {!reducedMotion ? (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {particles.map((particle, index) => (
            <motion.span
              key={`${particle.left}-${particle.top}`}
              className={isCompact ? 'absolute h-2 w-2 rounded-full' : 'absolute h-2.5 w-2.5 rounded-full'}
              style={{ left: particle.left, top: particle.top, backgroundColor: particle.color }}
              initial={{ opacity: 0, scale: 0.3, x: 0, y: 0 }}
              animate={{
                opacity: [0, 0.95, 0],
                scale: [0.3, 1.18, 0],
                x: [0, particle.x],
                y: [0, isCompact ? particle.y * 0.55 : particle.y],
              }}
              transition={{
                duration: (isCompact ? 0.72 : 1.08) + index * 0.02,
                delay: (isCompact ? 0.12 : 0.26) + index * 0.018,
                ease: premiumEase,
              }}
            />
          ))}
        </div>
      ) : null}

      <div className="relative z-10">
        <div className={iconWrapClassName}>
          <motion.div
            className="absolute inset-0 rounded-full bg-success/10"
            initial={{ scale: 0 }}
            animate={{ scale: [0, 1.28, 1.08] }}
            transition={{ duration: isCompact ? 0.48 : 0.72, ease: premiumEase }}
          />
          <motion.div
            className={iconOuterClassName}
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: isCompact ? 0.36 : 0.5, ease: premiumEase, delay: 0.08 }}
          />
          <motion.div
            className={iconInnerClassName}
            initial={{ scale: 0.4, rotate: -120, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ type: 'spring', damping: 16, stiffness: 260, delay: 0.08 }}
          >
            {emoji ? (
              <motion.span
                className={isCompact ? 'text-3xl leading-none' : 'text-5xl leading-none'}
                initial={{ scale: 0.3, opacity: 0 }}
                animate={{ scale: [0.3, 1.18, 1], opacity: 1 }}
                transition={{ duration: isCompact ? 0.32 : 0.44, ease: premiumEase, delay: 0.18 }}
              >
                {emoji}
              </motion.span>
            ) : (
              <motion.span
                initial={{ scale: 0.3, opacity: 0 }}
                animate={{ scale: [0.3, 1.14, 1], opacity: 1 }}
                transition={{ duration: isCompact ? 0.32 : 0.44, ease: premiumEase, delay: 0.18 }}
              >
                <CheckCircle2 size={isCompact ? 28 : 44} strokeWidth={2.4} />
              </motion.span>
            )}
          </motion.div>
        </div>

        {eyebrow ? (
          <motion.p
            className={isCompact
              ? 'text-[10px] font-black uppercase tracking-[0.18em] text-success/78'
              : 'text-[11px] font-black uppercase tracking-[0.22em] text-success/78'}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: isCompact ? 0.18 : 0.24, ease: premiumEase, delay: 0.12 }}
          >
            {eyebrow}
          </motion.p>
        ) : null}

        <motion.p
          className={titleClassName}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: isCompact ? 0.2 : 0.26, ease: premiumEase, delay: 0.16 }}
        >
          {title}
        </motion.p>

        {description ? (
          <motion.p
            className={descriptionClassName}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: isCompact ? 0.22 : 0.28, ease: premiumEase, delay: 0.18 }}
          >
            {description}
          </motion.p>
        ) : null}

        {detail ? (
          <motion.p
            className={detailClassName}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: isCompact ? 0.22 : 0.28, ease: premiumEase, delay: 0.22 }}
          >
            {detail}
          </motion.p>
        ) : null}

        {children ? (
          <motion.div
            className={isCompact ? 'mt-4' : 'mt-6'}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: isCompact ? 0.22 : 0.28, ease: premiumEase, delay: 0.24 }}
          >
            {children}
          </motion.div>
        ) : null}
      </div>
    </div>
  );
}
