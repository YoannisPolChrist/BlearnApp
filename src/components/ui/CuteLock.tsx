import { motion, useReducedMotion } from 'framer-motion';
import { getModePalette } from '@/lib/semanticTones';
import type { InterventionMode } from '../InterventionOverlayScreen';
import { cn } from '@/lib/utils';

export function CuteLock({ mode, className }: { mode: InterventionMode; className?: string }) {
  const reducedMotion = useReducedMotion();
  const palette = getModePalette(mode === 'lock' ? 'strict' : mode === 'strict' ? 'reflection' : mode);

  return (
    <div className={cn("relative flex items-center justify-center overflow-visible", className)}>
      {/* Glow effect behind mascot */}
      <motion.div
        className={cn("absolute h-28 w-28 rounded-full opacity-35 blur-2xl", palette.glow)}
        animate={reducedMotion ? {} : { scale: [0.86, 1.14, 0.86], opacity: [0.26, 0.44, 0.26] }}
        transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
      />

      <motion.div
        animate={reducedMotion ? {} : { y: [0, -6, 0] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
        className="relative z-10 text-foreground"
      >
        <svg width="78" height="78" viewBox="0 0 78 78" fill="none" className="overflow-visible">
          <defs>
            <linearGradient id="cutelock-body" x1="14" y1="29" x2="64" y2="71" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="hsl(var(--card))" />
              <stop offset="1" stopColor="hsl(var(--surface-subtle))" />
            </linearGradient>
            <linearGradient id="cutelock-shackle" x1="26" y1="7" x2="52" y2="34" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="hsl(var(--primary))" />
              <stop offset="1" stopColor="hsl(var(--accent))" />
            </linearGradient>
          </defs>

          {/* Shackle (Padlock Loop) */}
          <motion.path
            d="M26 34V20C26 12.82 31.82 7 39 7C46.18 7 52 12.82 52 20V34"
            stroke="url(#cutelock-shackle)"
            strokeWidth="7"
            strokeLinecap="round"
            initial={reducedMotion ? {} : { rotate: -12, originX: "26px", originY: "34px" }}
            animate={reducedMotion ? {} : { rotate: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 14, delay: 0.15 }}
          />

          {/* Body */}
          <rect
            x="14"
            y="29"
            width="50"
            height="42"
            rx="15"
            fill="url(#cutelock-body)"
            stroke="hsl(var(--border))"
            strokeWidth="3.5"
            className="shadow-sm"
          />

          {/* Cute face elements */}
          {/* Eyes */}
          <circle cx="31" cy="46" r="3.5" fill="currentColor" />
          <circle cx="47" cy="46" r="3.5" fill="currentColor" />
          
          {/* Cheeks (pink blush) */}
          <circle cx="25" cy="50" r="3" fill="#FFA3A3" opacity="0.85" />
          <circle cx="53" cy="50" r="3" fill="#FFA3A3" opacity="0.85" />

          {/* Mouth (Happy smiley) */}
          <path
            d="M36 51.5C36 52.88 37.12 54 38.5 54C39.88 54 41 52.88 41 51.5"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </svg>
      </motion.div>
    </div>
  );
}
