import { useEffect } from "react";
import { Brain, Sparkles } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { premiumEase } from "@/lib/motion";

const INTRO_DURATION_MS = 1450;
const REDUCED_MOTION_DURATION_MS = 180;

const timeline = {
  impulses: 0.08,
  focus: 0.56,
  symbol: 0.82,
  message: 0.96,
} as const;

interface FirstLaunchAnimationProps {
  active: boolean;
  onComplete: () => void;
}

export default function FirstLaunchAnimation({
  active,
  onComplete,
}: FirstLaunchAnimationProps) {
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (!active) {
      return undefined;
    }

    const timeoutId = window.setTimeout(
      onComplete,
      shouldReduceMotion ? REDUCED_MOTION_DURATION_MS : INTRO_DURATION_MS,
    );

    return () => window.clearTimeout(timeoutId);
  }, [active, onComplete, shouldReduceMotion]);

  const skip = () => onComplete();
  const duration = shouldReduceMotion ? 0.16 : 0.44;

  return (
    <AnimatePresence>
      {active ? (
        <motion.button
          type="button"
          aria-label="Einführung überspringen"
          className="fixed inset-0 z-[100] flex min-h-dvh w-full cursor-default items-center justify-center overflow-hidden border-0 bg-[hsl(var(--background))] p-0 text-left text-foreground"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.025, filter: "blur(5px)" }}
          transition={{
            duration: shouldReduceMotion ? 0.12 : 0.2,
            ease: premiumEase,
          }}
          onPointerDown={skip}
        >
          <span
            aria-hidden="true"
            className="absolute inset-0 opacity-95"
            style={{
              background:
                "radial-gradient(circle at 50% 46%, hsl(var(--primary) / 0.24), transparent 27%), radial-gradient(circle at 50% 42%, hsl(var(--accent) / 0.12), transparent 48%), hsl(var(--background))",
            }}
          />

          <motion.span
            aria-hidden="true"
            className="absolute h-56 w-56 rounded-full border border-primary/20"
            initial={{ opacity: 0, scale: 0.38 }}
            animate={{ opacity: 1, scale: [0.38, 0.9, 1.7] }}
            transition={{
              duration: shouldReduceMotion ? 0.14 : 1.08,
              ease: premiumEase,
            }}
          />

          <span className="relative flex h-64 w-64 items-center justify-center">
            {[
              [-54, -18, -16],
              [54, 12, 19],
              [-4, 54, -8],
            ].map(([x, y, rotate], index) => (
              <motion.span
                key={index}
                aria-hidden="true"
                className="absolute h-[2px] w-20 rounded-full bg-gradient-to-r from-transparent via-primary to-transparent shadow-[0_0_22px_hsl(var(--primary)/0.7)]"
                initial={{ opacity: 0, x, y, rotate, scaleX: 0.45 }}
                animate={
                  shouldReduceMotion
                    ? { opacity: 0 }
                    : {
                        opacity: [0, 0.92, 0.78, 0],
                        x: [x, x * 0.82, 0],
                        y: [y, y * 1.12, 0],
                        rotate: [rotate, rotate * -0.55, 0],
                        scaleX: [0.45, 1, 0.15],
                      }
                }
                transition={{
                  duration: 0.78,
                  delay: timeline.impulses + index * 0.045,
                  ease: premiumEase,
                }}
              />
            ))}

            <motion.span
              aria-hidden="true"
              className="absolute h-14 w-14 rounded-full border border-primary/40 bg-primary/10 shadow-[0_0_54px_hsl(var(--primary)/0.5)]"
              initial={{ opacity: 0, scale: 0.2 }}
              animate={
                shouldReduceMotion
                  ? { opacity: 0, scale: 0.8 }
                  : { opacity: [0, 1, 0.18], scale: [0.2, 1, 2.65] }
              }
              transition={{
                duration: 0.68,
                delay: timeline.focus,
                ease: premiumEase,
              }}
            />

            <motion.span
              className="relative flex h-20 w-20 items-center justify-center rounded-[1.8rem] border border-primary/30 bg-background/82 text-primary shadow-[0_26px_70px_hsl(var(--primary)/0.26)] backdrop-blur-md"
              initial={{
                opacity: 0,
                scale: 0.42,
                y: 14,
                rotate: -12,
                filter: "blur(10px)",
              }}
              animate={{
                opacity: 1,
                scale: 1,
                y: 0,
                rotate: 0,
                filter: "blur(0px)",
              }}
              transition={{
                duration,
                delay: shouldReduceMotion ? 0 : timeline.symbol,
                ease: premiumEase,
              }}
            >
              <Brain size={34} strokeWidth={1.8} />
              <Sparkles
                className="absolute -right-2 -top-2 text-accent"
                size={20}
                strokeWidth={2.1}
              />
            </motion.span>
          </span>

          <motion.span
            className="absolute bottom-[18vh] text-center"
            initial={{ opacity: 0, y: 14, scale: 0.96, filter: "blur(7px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            transition={{
              duration,
              delay: shouldReduceMotion ? 0 : timeline.message,
              ease: premiumEase,
            }}
          >
            <span className="block text-[11px] font-black uppercase tracking-[0.32em] text-primary/75">
              Blearn
            </span>
            <span className="mt-2 block text-2xl font-black tracking-[-0.045em] text-foreground sm:text-3xl">
              Kurz innehalten.
            </span>
          </motion.span>
        </motion.button>
      ) : null}
    </AnimatePresence>
  );
}
