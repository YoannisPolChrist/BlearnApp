import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { motionDurations, premiumEase } from '@/lib/motion';
import {
  subscribeSuccessFeedback,
  type SuccessFeedbackPayload,
} from '@/lib/successFeedback';
import { SuccessTileAnimation } from '@/components/ui/SuccessTileAnimation';

const DEFAULT_DURATION_MS = 1650;
const EXIT_BUFFER_MS = 180;

export function SuccessFeedbackHost() {
  const reducedMotion = useReducedMotion();
  const [current, setCurrent] = useState<SuccessFeedbackPayload | null>(null);
  const [visible, setVisible] = useState(false);
  const closeTimeoutRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const finalizeTimeoutRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const tokenRef = useRef(0);

  useEffect(() => {
    const clearTimers = () => {
      if (closeTimeoutRef.current !== null) {
        window.clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
      }
      if (finalizeTimeoutRef.current !== null) {
        window.clearTimeout(finalizeTimeoutRef.current);
        finalizeTimeoutRef.current = null;
      }
    };

    const scheduleDismiss = (payload: SuccessFeedbackPayload) => {
      const token = ++tokenRef.current;
      const durationMs = reducedMotion
        ? Math.min(payload.durationMs ?? DEFAULT_DURATION_MS, 1100)
        : payload.durationMs ?? DEFAULT_DURATION_MS;

      clearTimers();
      setCurrent(payload);
      setVisible(true);

      closeTimeoutRef.current = window.setTimeout(() => {
        if (token !== tokenRef.current) return;

        setVisible(false);
        finalizeTimeoutRef.current = window.setTimeout(() => {
          if (token !== tokenRef.current) return;

          setCurrent(null);
          Promise.resolve(payload.onDone?.()).catch((error) => {
            console.warn('Success feedback onDone failed:', error);
          });
        }, EXIT_BUFFER_MS);
      }, durationMs);
    };

    const unsubscribe = subscribeSuccessFeedback(scheduleDismiss);

    return () => {
      unsubscribe();
      clearTimers();
    };
  }, [reducedMotion]);

  if (typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <AnimatePresence>
      {current && visible ? (
        <motion.div
          data-testid="success-feedback-host"
          data-feedback-layout="compact"
          aria-live="polite"
          aria-atomic="true"
          role="status"
          className="pointer-events-none fixed inset-x-0 top-0 z-[170] flex justify-center px-4"
          style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.9rem)' }}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: motionDurations.exit, ease: premiumEase }}
        >
          <motion.div
            className="absolute inset-x-8 top-2 h-10 rounded-full bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.16),transparent_72%)] blur-2xl"
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: premiumEase }}
          />
          <motion.div
            className="relative w-full max-w-[20rem] sm:max-w-[21rem]"
            initial={{ opacity: 0, y: -16, scale: 0.94, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -10, scale: 0.96, filter: 'blur(4px)' }}
            transition={{
              type: 'spring',
              damping: 22,
              stiffness: 260,
              mass: 0.86,
            }}
          >
            <SuccessTileAnimation
              eyebrow={current.eyebrow}
              title={current.title}
              description={current.description}
              detail={current.detail}
              emoji={current.emoji}
              variant="compact"
            />
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
