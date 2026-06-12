import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { AmbientOrbs } from '@/components/ui/AmbientOrbs';
import { premiumEase } from '@/lib/motion';
import { SuccessTileAnimation } from '@/components/ui/SuccessTileAnimation';

interface SuccessAnimationProps {
  visible: boolean;
  eyebrow?: string;
  message?: string;
  subMessage?: string;
  detailMessage?: string;
  emoji?: string;
  durationMs?: number;
  onAnimationDone?: () => void;
}

export function SuccessAnimation({
  visible,
  eyebrow,
  message = 'Erfolgreich',
  subMessage,
  detailMessage,
  emoji,
  durationMs = 1800,
  onAnimationDone,
}: SuccessAnimationProps) {
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (!visible || !onAnimationDone || typeof window === 'undefined') return;

    const timeout = window.setTimeout(onAnimationDone, reducedMotion ? Math.min(durationMs, 1200) : durationMs);
    return () => window.clearTimeout(timeout);
  }, [durationMs, onAnimationDone, reducedMotion, visible]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {visible ? (
        <motion.div
          aria-live="polite"
          aria-atomic="true"
          role="status"
          className="fixed inset-0 z-[160] flex items-center justify-center px-5 py-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: premiumEase }}
        >
          <motion.div
            aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.92),rgba(248,250,252,0.9)_34%,rgba(238,250,244,0.94)_100%)] lg:backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: premiumEase }}
          />
          <AmbientOrbs variant="overlay" className="opacity-85" />

          <motion.div
            className="pointer-events-none relative w-full max-w-[22rem]"
            initial={{ opacity: 0, y: 42, scale: 0.82, filter: 'blur(10px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: 20, scale: 0.92, filter: 'blur(6px)' }}
            transition={{
              type: 'spring',
              damping: 20,
              stiffness: 220,
              mass: 0.9,
            }}
          >
            <SuccessTileAnimation
              eyebrow={eyebrow}
              title={message}
              description={subMessage}
              detail={detailMessage}
              emoji={emoji}
            />
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
