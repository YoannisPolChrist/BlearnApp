import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  X,
  type LucideIcon,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { dialogCloseButtonClassName } from '@/components/ui/dialogStyles';

export interface SetupStep {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  bullets?: string[];
  actionLabel?: string;
  onAction?: () => Promise<void> | void;
  actionStateLabel?: string;
  completed?: boolean;
  icon?: LucideIcon;
  content?: ReactNode;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  steps: SetupStep[];
  finishLabel?: string;
  onFinish?: () => void;
  onDismiss?: () => void;
  lockUntilFinished?: boolean;
  canFinish?: boolean;
  allowCloseWhenLocked?: boolean;
}

const shellMotion = {
  initial: { opacity: 0, scale: 0.97, y: 10 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.97, y: -10 },
};

export default function SetupNarrativeDialog({
  open,
  onOpenChange,
  title,
  description,
  steps,
  finishLabel = 'Fertig',
  onFinish,
  onDismiss,
  lockUntilFinished = false,
  canFinish,
  allowCloseWhenLocked = false,
}: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [actionBusy, setActionBusy] = useState(false);
  const [isDocumentVisible, setIsDocumentVisible] = useState(
    () => typeof document === 'undefined' || document.visibilityState === 'visible',
  );
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const shouldReduceMotion = useReducedMotion();
  const animateDecorations = !shouldReduceMotion && isDocumentVisible;

  useEffect(() => {
    if (!open || typeof document === 'undefined') return undefined;

    const updateVisibility = () => setIsDocumentVisible(document.visibilityState === 'visible');
    updateVisibility();
    document.addEventListener('visibilitychange', updateVisibility);
    return () => document.removeEventListener('visibilitychange', updateVisibility);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setCurrentIndex(0);
    setActionBusy(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!scrollContainerRef.current) return;
    scrollContainerRef.current.scrollTop = 0;
  }, [currentIndex, open]);

  const currentStep = steps[currentIndex] ?? steps[0];
  const progress = useMemo(
    () => ((currentIndex + 1) / Math.max(steps.length, 1)) * 100,
    [currentIndex, steps.length],
  );
  const allDone = useMemo(() => steps.every((step) => step.completed), [steps]);
  const isLast = currentIndex === steps.length - 1;
  const isFirst = currentIndex === 0;
  const finishReady = canFinish ?? allDone;
  const nextDisabled =
    actionBusy || (isLast && lockUntilFinished && !finishReady);
  const StepIcon = currentStep?.icon || Sparkles;

  const handleDialogClose = () => {
    if (lockUntilFinished && !finishReady && !allowCloseWhenLocked) return;
    onDismiss?.();
    onOpenChange(false);
  };

  const handleAction = async () => {
    if (!currentStep?.onAction) return;
    setActionBusy(true);
    try {
      await currentStep.onAction();
    } finally {
      setActionBusy(false);
    }
  };

  const handlePrevious = () => {
    setCurrentIndex((value) => Math.max(value - 1, 0));
  };

  const handleNext = () => {
    if (isLast) {
      if (lockUntilFinished && !finishReady) return;
      onFinish?.();
      onOpenChange(false);
      return;
    }

    setCurrentIndex((value) => Math.min(value + 1, steps.length - 1));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideCloseButton
        onInteractOutside={(event) => {
          if (lockUntilFinished) event.preventDefault();
        }}
        onEscapeKeyDown={(event) => {
          if (lockUntilFinished) event.preventDefault();
        }}
        className="h-[100dvh] max-h-[100dvh] w-screen max-w-none overflow-hidden rounded-none border-0 bg-background p-0 shadow-[0_30px_120px_hsl(var(--foreground)/0.14)] sm:h-[92vh] sm:max-h-[92vh] sm:w-[calc(100vw-2rem)] sm:max-w-3xl sm:rounded-[2rem] sm:border"
      >
        <div className="relative h-full overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.18),transparent_35%),radial-gradient(circle_at_bottom_right,hsl(var(--accent)/0.18),transparent_35%)]" />

          <motion.div
            className="absolute left-[-3rem] top-10 h-32 w-32 rounded-full bg-primary/10 blur-3xl"
            animate={animateDecorations ? { x: [0, 18, 0], y: [0, -10, 0] } : { x: 0, y: 0 }}
            transition={{ duration: 5, repeat: animateDecorations ? Infinity : 0, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute bottom-10 right-[-2rem] h-36 w-36 rounded-full bg-accent/10 blur-3xl"
            animate={animateDecorations ? { x: [0, -20, 0], y: [0, 12, 0] } : { x: 0, y: 0 }}
            transition={{ duration: 5.8, repeat: animateDecorations ? Infinity : 0, ease: 'easeInOut' }}
          />

          <div className="relative z-10 flex h-full flex-col">
            <div className="border-b border-border/70 px-4 py-4 sm:px-8 sm:py-6">
              <DialogHeader className="gap-3 text-left">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <DialogTitle className="text-xl font-black tracking-[-0.04em] text-foreground sm:text-3xl">
                      {title}
                    </DialogTitle>
                    <DialogDescription className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:mt-2">
                      {description}
                    </DialogDescription>
                  </div>
                  <div className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-primary sm:px-3 sm:text-[11px] sm:tracking-[0.16em]">
                    Schritt {currentIndex + 1}/{steps.length}
                  </div>
                  <button
                    type="button"
                    onClick={handleDialogClose}
                    className={`${dialogCloseButtonClassName} ml-auto static h-11 w-11 disabled:opacity-40`}
                    aria-label={'Dialog schließen'}
                    disabled={
                      lockUntilFinished && !finishReady && !allowCloseWhenLocked
                    }
                  >
                    <X size={18} />
                  </button>
                </div>
              </DialogHeader>

              <div className="mt-4 sm:mt-5">
                <div className="mb-3 h-2 overflow-hidden rounded-full bg-muted/70">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-primary via-accent to-primary"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
                  />
                </div>

                <div className="hidden gap-2 overflow-x-auto pb-1 sm:flex">
                  {steps.map((step, index) => {
                    const isActive = index === currentIndex;
                    const Icon = step.icon || Sparkles;

                    return (
                      <motion.button
                        key={step.id}
                        type="button"
                        onClick={() => setCurrentIndex(index)}
                        className={`flex min-h-[4.5rem] min-w-[14rem] items-center gap-3 rounded-[1.25rem] border px-3 py-3 text-left transition-all ${
                          isActive
                            ? 'border-primary/30 bg-primary/10 shadow-[0_18px_40px_hsl(var(--primary)/0.12)]'
                            : step.completed
                              ? 'border-success/20 bg-success/10'
                              : 'border-border/70 bg-card/70'
                        }`}
                        whileTap={{ scale: 0.98 }}
                      >
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
                            isActive
                              ? 'bg-primary text-primary-foreground'
                              : step.completed
                                ? 'bg-success text-success-foreground'
                                : 'bg-background text-muted-foreground'
                          }`}
                        >
                          {step.completed ? (
                            <Check size={18} />
                          ) : (
                            <Icon size={18} />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">
                            {step.eyebrow}
                          </p>
                          <p className="line-clamp-2 text-sm font-bold leading-tight text-foreground">
                            {step.title}
                          </p>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div
              ref={scrollContainerRef}
              className="flex-1 overflow-y-auto px-4 py-4 sm:px-8 sm:py-6"
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStep?.id ?? 'step'}
                  variants={shellMotion}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                  className="space-y-5 pb-2"
                >
                  <div className="rounded-[1.5rem] border border-border/70 bg-card/70 p-4 shadow-[0_18px_48px_hsl(var(--foreground)/0.06)] sm:rounded-[1.75rem] sm:p-6">
                    <div className="flex items-start gap-4">
                      <motion.div
                        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl sm:h-14 sm:w-14 sm:rounded-[1.4rem] ${
                          currentStep?.completed
                            ? 'bg-success/12 text-success'
                            : 'bg-primary/12 text-primary'
                        }`}
                        animate={animateDecorations ? { scale: [1, 1.04, 1] } : { scale: 1 }}
                        transition={{
                          duration: 1.8,
                          repeat: animateDecorations ? Infinity : 0,
                          ease: 'easeInOut',
                        }}
                      >
                        <StepIcon size={24} />
                      </motion.div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                          {currentStep?.eyebrow}
                        </p>
                        <h3 className="mt-1 text-xl font-black tracking-[-0.04em] text-foreground sm:mt-2 sm:text-[1.7rem]">
                          {currentStep?.title}
                        </h3>
                        <p className="mt-2 text-sm leading-6 text-foreground/86 sm:mt-3 sm:text-[0.95rem]">
                          {currentStep?.description}
                        </p>
                      </div>
                    </div>
                  </div>

                  {currentStep?.bullets?.length ? (
                    <div className="rounded-[1.5rem] border border-border/70 bg-background/55 p-3.5 sm:rounded-[1.75rem] sm:p-5">
                      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                        Was passiert jetzt?
                      </p>
                      <div className="mt-3 space-y-2.5 sm:mt-4 sm:space-y-3">
                        {currentStep.bullets.map((bullet, index) => (
                          <motion.div
                            key={bullet}
                            className="flex items-start gap-3 rounded-[1.15rem] bg-card/80 px-3.5 py-3 sm:px-4"
                            initial={{ opacity: 0, x: 14, scale: 0.98 }}
                            animate={{ opacity: 1, x: 0, scale: 1 }}
                            transition={{ delay: index * 0.05, duration: 0.22 }}
                          >
                            <span
                              className={`mt-1 h-2.5 w-2.5 rounded-full ${
                                currentStep.completed
                                  ? 'bg-success'
                                  : 'bg-primary'
                              }`}
                            />
                            <span className="text-sm leading-6 text-foreground/82 sm:text-[0.95rem]">
                              {bullet}
                            </span>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {currentStep?.onAction ? (
                    <motion.button
                      onClick={() => {
                        void handleAction();
                      }}
                      disabled={actionBusy}
                      className="btn-press flex w-full items-center justify-center gap-2 rounded-[1.3rem] bg-primary px-5 py-4 text-base font-bold text-primary-foreground shadow-[0_20px_40px_hsl(var(--primary)/0.18)] disabled:opacity-60"
                      whileTap={{ scale: 0.985 }}
                    >
                      {actionBusy
                        ? 'Wird geöffnet...'
                        : currentStep.completed
                          ? currentStep.actionStateLabel || 'Erledigt'
                          : currentStep.actionLabel}
                    </motion.button>
                  ) : null}

                  {currentStep?.content ? (
                    <div className="rounded-[1.75rem] border border-border/70 bg-card/75 p-3 shadow-[0_18px_48px_hsl(var(--foreground)/0.05)]">
                      {currentStep.content}
                    </div>
                  ) : null}

                  <div className="flex flex-col gap-3 border-t border-border/70 pt-4 sm:flex-row sm:items-center sm:justify-end">
                    {!isFirst ? (
                      <button
                        onClick={handlePrevious}
                        className="btn-press inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card/80 px-4 py-3 text-sm font-bold text-foreground sm:w-auto"
                      >
                        <ChevronLeft size={16} />
                        {'Zurück'}
                      </button>
                    ) : null}

                    <button
                      onClick={handleNext}
                      disabled={nextDisabled}
                      className={`btn-press inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold disabled:opacity-50 sm:w-auto ${
                        isLast && finishReady
                          ? 'bg-success text-success-foreground'
                          : 'bg-primary text-primary-foreground'
                      }`}
                    >
                      {isLast ? finishLabel : 'Weiter'}
                      {!isLast ? <ChevronRight size={16} /> : null}
                    </button>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
