import { AnimatePresence, motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { premiumEase } from '@/lib/motion';
import { cn } from '@/lib/utils';

interface InlineConfirmationBadgeProps {
  visible: boolean;
  label?: string;
  className?: string;
}

export function InlineConfirmationBadge({
  visible,
  label = 'Gespeichert',
  className,
}: InlineConfirmationBadgeProps) {
  return (
    <AnimatePresence initial={false}>
      {visible ? (
        <motion.span
          data-testid="inline-confirmation-badge"
          initial={{ opacity: 0, scale: 0.9, y: 6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: -4 }}
          transition={{ duration: 0.2, ease: premiumEase }}
          className={cn(
            'inline-flex items-center gap-1 rounded-full border border-success/25 bg-success/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-success',
            className,
          )}
        >
          <Check size={11} />
          {label}
        </motion.span>
      ) : null}
    </AnimatePresence>
  );
}
