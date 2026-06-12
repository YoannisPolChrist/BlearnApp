import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import imgWindow from '@/assets/challenge-window.jpg';
import { formatUnlockDurationLabel } from '@/lib/unlockDuration';
import { cn } from '@/lib/utils';

export interface CheckinShellClasses {
  overlay: string;
  indicatorActive: string;
  indicatorCurrent: string;
  indicatorIdle: string;
}

interface CheckinPageShellProps {
  children: ReactNode;
  step: number;
  isBlockedFlow: boolean;
  onBack: () => void;
  classes: CheckinShellClasses;
  targetLabel?: string | null;
  unlockDurationMinutes?: number | null;
}

export function CheckinPageShell({
  children,
  step,
  isBlockedFlow,
  onBack,
  classes,
  targetLabel,
  unlockDurationMinutes,
}: CheckinPageShellProps) {
  const unlockDurationLabel = formatUnlockDurationLabel(unlockDurationMinutes);

  return (
    <div className="relative mx-auto flex min-h-screen max-w-lg flex-col px-4 pt-8">
      <div className="pointer-events-none fixed inset-0 z-0">
        <div
          className="absolute inset-0 opacity-80 dark:opacity-50"
          style={{ backgroundImage: `url(${imgWindow})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
        />
        <div className={cn('absolute inset-0', classes.overlay)} />
      </div>

      <div className="relative z-10 mb-4 flex items-center">
        {isBlockedFlow ? (
          <div className="w-10" />
        ) : (
          <button
            onClick={onBack}
            className="rounded-full p-2 text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft size={22} />
          </button>
        )}
        <div className="flex-1 text-center">
          <span className="text-xs font-bold uppercase tracking-[3px] text-muted-foreground">
            {step === 0 && 'REFLEXION'}
            {step === 1 && 'REFLEXION'}
            {step === 2 && 'EMOTIONEN'}
            {step === 3 && 'FERTIG'}
          </span>
          {isBlockedFlow && unlockDurationLabel ? (
            <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground/68">
              {targetLabel ? `${targetLabel} | ${unlockDurationLabel}` : unlockDurationLabel}
            </p>
          ) : null}
        </div>
        <div className="w-10" />
      </div>

      <div className="relative z-10 mb-8 flex justify-center gap-2">
        {[0, 1, 2].map((indicatorStep) => (
          <motion.div
            key={indicatorStep}
            className={`h-1 rounded-full transition-all duration-500 ${
              indicatorStep < step
                ? classes.indicatorActive
                : indicatorStep === step
                  ? classes.indicatorCurrent
                  : classes.indicatorIdle
            }`}
            layout
          />
        ))}
      </div>

      <div className="relative z-10 flex flex-1 flex-col">{children}</div>
    </div>
  );
}
