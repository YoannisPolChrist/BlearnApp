import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface BrandMarkProps {
  className?: string;
  size?: number;
  withHalo?: boolean;
  /** Enables a subtle ambient breathing pulse on the mark (hero use-cases). */
  withAnimation?: boolean;
}

export function BrandMark({ className, size = 44, withHalo = false, withAnimation = false }: BrandMarkProps) {
  const inner = (
    <div
      className={cn(
        'brand-mark relative inline-flex shrink-0 items-center justify-center rounded-[28%]',
        withHalo && 'brand-mark-halo',
        className,
      )}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 88 88" className="h-full w-full overflow-visible">
        <defs>
          <linearGradient id="blearn-brand-bg" x1="12" y1="10" x2="78" y2="78" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#12384B" />
            <stop offset="0.58" stopColor="#1E6D73" />
            <stop offset="1" stopColor="#D88A2D" />
          </linearGradient>
          <radialGradient id="blearn-brand-glow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(28 20) rotate(45) scale(56)">
            <stop offset="0" stopColor="rgba(255,255,255,0.34)" />
            <stop offset="1" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
          <linearGradient id="blearn-brand-stroke" x1="24" y1="18" x2="64" y2="70" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#FFF8ED" />
            <stop offset="1" stopColor="#F3E5CC" />
          </linearGradient>
        </defs>

        <rect x="6" y="6" width="76" height="76" rx="24" fill="url(#blearn-brand-bg)" />
        <rect x="6" y="6" width="76" height="76" rx="24" fill="url(#blearn-brand-glow)" opacity="0.9" />
        <path
          d="M28 18V70"
          fill="none"
          stroke="url(#blearn-brand-stroke)"
          strokeWidth="12"
          strokeLinecap="round"
        />
        <path
          d="M28 20H44C54 20 60 25.6 60 34C60 42.4 54 48 44 48H28"
          fill="none"
          stroke="url(#blearn-brand-stroke)"
          strokeWidth="12"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M28 48H46C56.6 48 62 53.8 62 62C62 70.2 56.6 70 46 70H28"
          fill="none"
          stroke="url(#blearn-brand-stroke)"
          strokeWidth="12"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Accent dot — pulses gently when withAnimation is active */}
        {withAnimation ? (
          <motion.circle
            cx="66"
            cy="24"
            r="5"
            fill="#F8C26A"
            animate={{ scale: [1, 1.28, 1], opacity: [0.84, 1, 0.84] }}
            transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut', delay: 0.8 }}
            style={{ transformOrigin: '66px 24px' }}
          />
        ) : (
          <circle cx="66" cy="24" r="5" fill="#F8C26A" />
        )}
      </svg>
    </div>
  );

  if (!withAnimation) return inner;

  return (
    <motion.div
      style={{ willChange: 'transform, opacity', display: 'inline-flex' }}
      animate={{
        scale: [0.97, 1.04, 0.97],
        opacity: [0.86, 1, 0.86],
      }}
      transition={{ duration: 5.2, repeat: Infinity, ease: 'easeInOut' }}
    >
      {inner}
    </motion.div>
  );
}

interface BrandLockupProps {
  className?: string;
  titleClassName?: string;
  subtitleClassName?: string;
  compact?: boolean;
  subtitle?: string;
}

export function BrandLockup({
  className,
  titleClassName,
  subtitleClassName,
  compact = false,
  subtitle = 'Digitaler Fokus mit System',
}: BrandLockupProps) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <BrandMark size={compact ? 40 : 52} withHalo={!compact} />
      <div className="min-w-0">
        <p className={cn('brand-wordmark truncate text-xl font-black tracking-[-0.08em] text-foreground', compact && 'text-lg', titleClassName)}>
          Blearn
        </p>
        <p className={cn('truncate text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground/75', subtitleClassName)}>
          {subtitle}
        </p>
      </div>
    </div>
  );
}
