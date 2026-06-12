import { motion, useReducedMotion } from 'framer-motion';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

interface AmbientOrbsProps {
  className?: string;
  variant?: 'hero' | 'overlay';
  disabled?: boolean;
}

const orbSets = {
  hero: [
    {
      className: 'left-[-8%] top-[-10%] h-48 w-48 bg-[radial-gradient(circle,_hsl(var(--primary)/0.18)_0%,_transparent_72%)]',
      animate: { x: [0, 20, 0], y: [0, -18, 0], scale: [1, 1.08, 1] },
      duration: 11,
    },
    {
      className: 'right-[-10%] top-[12%] h-56 w-56 bg-[radial-gradient(circle,_hsl(var(--accent)/0.16)_0%,_transparent_74%)]',
      animate: { x: [0, -18, 0], y: [0, 16, 0], scale: [1.08, 0.96, 1.08] },
      duration: 14,
    },
    {
      className: 'bottom-[-16%] left-[24%] h-44 w-44 bg-[radial-gradient(circle,_hsl(var(--success)/0.12)_0%,_transparent_72%)]',
      animate: { x: [0, 14, 0], y: [0, -12, 0], scale: [1, 1.1, 1] },
      duration: 12,
    },
  ],
  overlay: [
    {
      className: 'left-[8%] top-[18%] h-72 w-72 bg-[radial-gradient(circle,_hsl(var(--primary)/0.16)_0%,_transparent_75%)]',
      animate: { x: [0, 26, 0], y: [0, -22, 0], scale: [1, 1.14, 1] },
      duration: 12,
    },
    {
      className: 'right-[4%] bottom-[12%] h-64 w-64 bg-[radial-gradient(circle,_hsl(var(--accent)/0.14)_0%,_transparent_76%)]',
      animate: { x: [0, -22, 0], y: [0, 18, 0], scale: [1.06, 0.94, 1.06] },
      duration: 13,
    },
  ],
} as const;

export function AmbientOrbs({ className, variant = 'hero', disabled = false }: AmbientOrbsProps) {
  const reducedMotion = useReducedMotion();
  const isMobile = useIsMobile();
  if (disabled) {
    return null;
  }
  const shouldAnimate = !reducedMotion && !isMobile;
  const visibleOrbs = shouldAnimate
    ? orbSets[variant]
    : orbSets[variant].slice(0, variant === 'hero' ? 2 : 1);

  return (
    <div className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}>
      {visibleOrbs.map((orb, index) => (
        <motion.div
          key={`${variant}-${index}`}
          className={cn('absolute rounded-full blur-3xl', orb.className)}
          animate={shouldAnimate ? orb.animate : { opacity: 0.72, scale: 1 }}
          transition={shouldAnimate ? { duration: orb.duration, repeat: Infinity, ease: 'easeInOut' } : undefined}
        />
      ))}
    </div>
  );
}
