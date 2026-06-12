import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

const pageTransition = {
  initial: { opacity: 0, y: 30, filter: 'blur(6px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
  exit: { opacity: 0, y: -20, filter: 'blur(6px)' },
  transition: { duration: 0.32, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
};

interface CheckinTextStepProps {
  stepKey: string;
  title: string;
  prompt: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onContinue: () => void;
  buttonLabel: string;
  inputClassName: string;
  buttonClassName: string;
  autoFocus?: boolean;
}

export function CheckinTextStep({
  stepKey,
  title,
  prompt,
  placeholder,
  value,
  onChange,
  onContinue,
  buttonLabel,
  inputClassName,
  buttonClassName,
  autoFocus,
}: CheckinTextStepProps) {
  const canContinue = value.trim().length > 0;

  return (
    <motion.div key={stepKey} {...pageTransition} className="relative z-10 flex flex-1 flex-col">
      <div className="flex flex-1 flex-col items-center justify-center">
        <motion.h2
          className="mb-3 text-center font-serif text-3xl font-bold text-foreground"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
        >
          {title}
        </motion.h2>
        <motion.p
          className="mb-10 text-center text-sm text-muted-foreground"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          {prompt}
        </motion.p>

        <motion.div
          className="w-full"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.14 }}
        >
          <textarea
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder}
            rows={3}
            className={inputClassName}
            autoFocus={autoFocus}
          />
        </motion.div>
      </div>

      <div className="pb-8">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={onContinue}
          disabled={!canContinue}
          className={cn('flex w-full items-center justify-center gap-2 rounded-2xl py-4 font-semibold disabled:opacity-30', buttonClassName)}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {buttonLabel}
        </motion.button>
      </div>
    </motion.div>
  );
}
