import { motion } from 'framer-motion';
import { Globe, Search, Smartphone } from 'lucide-react';
import { ctaFollowThrough, premiumEase } from '@/lib/motion';
import { tonePalettes, type SemanticTone } from '@/lib/semanticTones';
import { formatUnlockDurationLabel } from '@/lib/unlockDuration';

type UnlockTargetType = 'app' | 'website' | 'search';
type UnlockTone = Extract<SemanticTone, 'normal' | 'strict' | 'reflection' | 'learn' | 'penalty' | 'breathing'>;

interface BlockingUnlockSuccessScreenProps {
  buttonLabel?: string;
  onContinue: () => void | Promise<void>;
  reduceInterfaceMotion?: boolean;
  targetId?: string | null;
  targetLabel?: string | null;
  targetType: UnlockTargetType;
  tone: UnlockTone;
  unlockDurationMinutes?: number | null;
}

export function BlockingUnlockSuccessScreen({
  buttonLabel = 'App freischalten',
  onContinue,
  reduceInterfaceMotion = false,
  targetId,
  targetLabel,
  targetType,
  tone,
  unlockDurationMinutes,
}: BlockingUnlockSuccessScreenProps) {
  const palette = tonePalettes[tone];
  const displayLabel = targetLabel?.trim() || targetId?.trim() || 'Freigabe';
  const durationLabel = formatUnlockDurationLabel(unlockDurationMinutes) || 'Freigabe aktiv';

  // This screen is on the latency-critical unlock path. Loading installed app
  // icons here pulls all app metadata over the native bridge and can jank the CTA.
  const fallbackIcon = (() => {
    if (targetType === 'website') {
      return <Globe size={42} strokeWidth={2.1} />;
    }
    if (targetType === 'search') {
      return <Search size={42} strokeWidth={2.1} />;
    }
    return <Smartphone size={42} strokeWidth={2.1} />;
  })();

  return (
    <div className="app-page app-page-compact page-shell-clip section-stack">
      <div className="flex min-h-[calc(100svh-6rem)] items-center justify-center">
        <motion.div
          initial={reduceInterfaceMotion ? false : { opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.28, ease: premiumEase }}
          className={`premium-shell ${palette.hero} relative w-full max-w-sm px-6 py-8 sm:px-8 sm:py-10`}
        >
          <div className={`pointer-events-none absolute -left-16 top-12 h-36 w-36 rounded-full blur-3xl ${palette.glow}`} />
          <div className={`pointer-events-none absolute -right-12 bottom-12 h-40 w-40 rounded-full blur-3xl ${palette.glow}`} />

          <div className="relative z-10 flex flex-col items-center text-center">
            <p className="text-sm font-black tracking-[-0.03em] text-foreground sm:text-base">
              {displayLabel}
            </p>

            <div className={`mt-5 flex h-28 w-28 items-center justify-center rounded-[2rem] ${palette.icon} sm:h-32 sm:w-32`}>
              {fallbackIcon}
            </div>

            <p className="mt-5 text-sm font-semibold text-foreground/76 sm:text-base">
              {durationLabel}
            </p>

            <motion.button
              initial="rest"
              animate="rest"
              whileHover={reduceInterfaceMotion ? 'rest' : 'hover'}
              whileTap={reduceInterfaceMotion ? 'rest' : 'tap'}
              variants={ctaFollowThrough}
              onClick={() => void onContinue()}
              className={`mt-6 inline-flex w-full items-center justify-center rounded-[1.5rem] px-5 py-4 text-base font-black ${palette.button}`}
            >
              {buttonLabel}
            </motion.button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
