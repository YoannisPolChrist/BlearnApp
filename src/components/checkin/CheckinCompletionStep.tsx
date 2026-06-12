import { motion } from 'framer-motion';
import { BlockingUnlockSuccessScreen } from '@/components/blocking/BlockingUnlockSuccessScreen';
import { SuccessTileAnimation } from '@/components/ui/SuccessTileAnimation';

interface CheckinCompletionStepProps {
  targetApp?: string | null;
  targetId?: string | null;
  targetType: 'app' | 'website' | 'search';
  targetLabel?: string | null;
  unlockDurationMinutes?: number | null;
  streak: number;
  onContinue: () => void;
}

export function CheckinCompletionStep({
  targetApp,
  targetId,
  targetType,
  targetLabel,
  unlockDurationMinutes,
  streak,
  onContinue,
}: CheckinCompletionStepProps) {
  return (
    <motion.div
      key="complete"
      initial={{ opacity: 0, y: 30, filter: 'blur(6px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      exit={{ opacity: 0, y: -20, filter: 'blur(6px)' }}
      transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
      className="relative z-10 flex flex-1 flex-col items-center justify-center py-16"
    >
      <div className="w-full max-w-sm">
        {targetApp ? (
          <BlockingUnlockSuccessScreen
            onContinue={onContinue}
            targetId={targetId || targetApp}
            targetLabel={targetLabel}
            targetType={targetType}
            tone="reflection"
            unlockDurationMinutes={unlockDurationMinutes}
          />
        ) : (
          <SuccessTileAnimation
            eyebrow="Check-in abgeschlossen"
            title="Erledigt"
            description={targetApp ? `${targetApp} ist jetzt vorübergehend verfügbar.` : `${streak} Tage Streak`}
            detail={targetApp ? 'Reflexion gespeichert' : 'Streak aktualisiert'}
            emoji="🌿"
          >
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onContinue}
              className="w-full rounded-2xl bg-success px-8 py-3.5 font-semibold text-success-foreground"
              style={{ boxShadow: '0 18px 42px hsl(var(--success) / 0.28)' }}
            >
              {targetApp ? 'Zur App' : 'Zum Dashboard'}
            </motion.button>
          </SuccessTileAnimation>
        )}
      </div>
    </motion.div>
  );
}
