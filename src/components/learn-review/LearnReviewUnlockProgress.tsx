import { motion } from 'framer-motion';
import { premiumEase } from '@/lib/motion';

interface LearnReviewUnlockProgressProps {
  countedReviews: number;
  sessionCreditsRequired: number;
  progressPercent: number;
}

/**
 * Schmaler Fortschrittsbalken im Blocking-Flow: zeigt dem Nutzer, wie nah er an
 * der Freischaltung ist ("N von M richtig"). Die Daten werden ohnehin berechnet
 * (buildLearnReviewProgress), wurden bisher aber nie im blockierten Flow
 * gerendert — der Nutzer sah seinen Fortschritt zum Ziel nie (Plan P0.3).
 */
export function LearnReviewUnlockProgress({
  countedReviews,
  sessionCreditsRequired,
  progressPercent,
}: LearnReviewUnlockProgressProps) {
  if (sessionCreditsRequired <= 0) {
    return null;
  }

  const safeCounted = Math.min(countedReviews, sessionCreditsRequired);
  const remaining = Math.max(0, sessionCreditsRequired - safeCounted);
  const width = Math.min(100, Math.max(0, progressPercent));
  const label =
    remaining > 0
      ? `${safeCounted}/${sessionCreditsRequired} richtig · noch ${remaining}`
      : 'Geschafft – wird freigeschaltet …';

  return (
    <div
      className="rounded-[1.2rem] border border-[hsl(var(--mode-learn-border)/0.22)] bg-[hsl(var(--mode-learn-surface)/0.28)] px-4 py-3"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={sessionCreditsRequired}
      aria-valuenow={safeCounted}
      aria-label="Fortschritt bis zur Freischaltung"
    >
      <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.16em] text-[hsl(var(--mode-learn-foreground)/0.82)]">
        <span>Freischaltung</span>
        <span>{label}</span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[hsl(var(--mode-learn-border)/0.22)]">
        <motion.div
          className="h-full rounded-full bg-[hsl(var(--mode-learn))]"
          initial={false}
          animate={{ width: `${width}%` }}
          transition={{ duration: 0.4, ease: premiumEase }}
          style={{ willChange: 'width' }}
        />
      </div>
    </div>
  );
}
