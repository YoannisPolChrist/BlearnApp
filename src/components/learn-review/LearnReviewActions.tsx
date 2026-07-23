import { memo } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { type ReviewRating, type TypedAnswerMatchKind } from '@/lib/learning';
import { ctaFollowThrough, premiumEase, sectionItem } from '@/lib/motion';
import { triggerHapticFeedback } from '@/lib/haptics';
import { tonePalettes } from '@/lib/semanticTones';
import { cn } from '@/lib/utils';
import { ratingMeta } from '@/components/learn-review/meta';

interface LearnReviewActionsProps {
  attemptMessage: string | null;
  canUndo: boolean;
  intervalPreviews: Record<ReviewRating, string> | null;
  onCheckTypedAnswer: () => void;
  onRevealAnswer: () => void;
  onUndoReview: () => void;
  onReview: (rating: ReviewRating) => void;
  onTypedAnswerChange: (value: string) => void;
  reduceInterfaceMotion: boolean;
  requiresTypedAnswer: boolean;
  latestFeedbackMessage?: string | null;
  isBlockedFlow: boolean;
  revealed: boolean;
  typedAnswer: string;
  typedAnswerMatchKind?: TypedAnswerMatchKind | null;
  typedCorrect: boolean | null;
}

function LearnReviewActionsInner({
  attemptMessage,
  canUndo,
  intervalPreviews,
  onCheckTypedAnswer,
  onRevealAnswer,
  onUndoReview,
  onReview,
  onTypedAnswerChange,
  reduceInterfaceMotion,
  requiresTypedAnswer,
  latestFeedbackMessage,
  isBlockedFlow,
  revealed,
  typedAnswer,
  typedAnswerMatchKind,
  typedCorrect,
}: LearnReviewActionsProps) {
  const learnPalette = tonePalettes.learn;
  const isBlockedTypedAnswerFlow = isBlockedFlow && requiresTypedAnswer && !revealed;
  const handleTypedAnswerFocus = (event: React.FocusEvent<HTMLInputElement>) => {
    event.currentTarget.scrollIntoView({
      block: 'nearest',
      inline: 'nearest',
    });
  };
  const handleCheckTypedAnswer = () => {
    triggerHapticFeedback('selection');
    onCheckTypedAnswer();
  };
  const handleRevealAnswer = () => {
    triggerHapticFeedback('action');
    onRevealAnswer();
  };
  const handleReview = (rating: ReviewRating) => {
    triggerHapticFeedback(rating === 'again' ? 'selection' : 'action');
    onReview(rating);
  };
  const panelClassName = reduceInterfaceMotion
    ? `rounded-[1.45rem] border border-[hsl(var(--mode-learn-border)/0.24)] bg-[hsl(var(--background)/0.97)] shadow-[0_12px_26px_hsl(var(--mode-learn-glow)/0.08)] ${isBlockedTypedAnswerFlow ? 'p-3.5 sm:p-4' : 'p-2.5 sm:p-3'}`
    : `rounded-[1.45rem] border border-[hsl(var(--mode-learn-border)/0.28)] bg-[linear-gradient(180deg,hsl(var(--mode-learn-surface)/0.56),hsl(var(--background)/0.94))] shadow-[0_24px_60px_hsl(var(--mode-learn-glow)/0.14)] backdrop-blur-xl ${isBlockedTypedAnswerFlow ? 'p-3.5 sm:p-4' : 'p-2.5 sm:p-3'}`;
  const actionShellClassName = revealed
    ? 'fixed inset-x-3 bottom-[calc(0.8rem+env(safe-area-inset-bottom,0px))] z-30 mt-auto sm:sticky sm:inset-x-auto sm:bottom-0'
    : 'mt-auto';
  const attemptBadgeClassName =
    typedAnswerMatchKind === 'partial'
      ? tonePalettes.warning.badge
      : typedAnswerMatchKind === 'exact' || typedCorrect === true
        ? tonePalettes.success.badge
        : tonePalettes.destructive.badge;

  return (
    <motion.section
      variants={sectionItem}
      className={actionShellClassName}
      style={requiresTypedAnswer && !revealed ? { overflowAnchor: 'none' } : undefined}
    >
      {!revealed ? (
        <motion.div
          initial={reduceInterfaceMotion ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, ease: premiumEase }}
          className={panelClassName}
        >
          <div className={cn('flex flex-wrap items-center justify-between gap-2', isBlockedTypedAnswerFlow ? 'mb-3' : 'mb-2')}>
            <button
              type="button"
              onClick={onUndoReview}
              disabled={!canUndo}
              aria-label="Zurueck zur letzten Karte"
              className="btn-press inline-flex items-center gap-1.5 rounded-full border border-[hsl(var(--mode-learn-border)/0.22)] bg-background/82 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-foreground transition-opacity disabled:cursor-not-allowed disabled:opacity-45"
            >
              <ArrowLeft size={12} />
              Rückgängig
            </button>
            {latestFeedbackMessage ? (
              <div
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em]",
                  isBlockedFlow
                    ? "border-[hsl(var(--success)/0.38)] bg-[hsl(var(--success)/0.18)] text-[hsl(var(--success))]"
                    : "border-[hsl(var(--mode-learn-border)/0.22)] bg-[hsl(var(--mode-learn-surface)/0.4)] text-[hsl(var(--mode-learn-foreground)/0.88)]"
                )}
              >
                {latestFeedbackMessage}
              </div>
            ) : null}
          </div>

          {requiresTypedAnswer ? (
            <div className={isBlockedFlow ? 'space-y-3' : 'space-y-2.5'}>
              <div
                className={cn(
                  'gap-2 sm:gap-2.5',
                  isBlockedFlow
                    ? 'flex flex-col'
                    : 'grid grid-cols-[minmax(0,1fr)_auto_auto] items-stretch',
                )}
              >
                <Input
                  value={typedAnswer}
                  onChange={(event) => onTypedAnswerChange(event.target.value)}
                  onFocus={handleTypedAnswerFocus}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      if (isBlockedFlow) {
                        handleRevealAnswer();
                      } else {
                        handleCheckTypedAnswer();
                      }
                    }
                  }}
                  placeholder="Antwort eingeben"
                  aria-label={isBlockedFlow ? 'Antwortwort eingeben' : undefined}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  className={cn(
                    'min-w-0 rounded-[1.1rem] border-[hsl(var(--mode-learn-border)/0.46)] bg-background/94 px-4 text-base text-foreground shadow-[inset_0_1px_0_hsl(0_0%_100%/0.16)] placeholder:text-foreground/42 focus-visible:ring-[hsl(var(--mode-learn)/0.44)] focus-visible:ring-offset-[hsl(var(--background)/0.98)]',
                    isBlockedFlow ? 'h-14 w-full' : 'h-10 px-3 text-sm sm:h-11 sm:text-base',
                  )}
                />
                {!isBlockedFlow ? (
                  <motion.button
                    onClick={handleCheckTypedAnswer}
                    initial="rest"
                    animate="rest"
                    whileHover={reduceInterfaceMotion ? 'rest' : 'hover'}
                    whileTap={reduceInterfaceMotion ? 'rest' : 'tap'}
                    variants={ctaFollowThrough}
                    className="btn-press rounded-[1.1rem] border border-[hsl(var(--mode-learn-border)/0.42)] bg-[hsl(var(--mode-learn-surface)/0.72)] px-2.5 py-2 text-xs font-bold text-[hsl(var(--mode-learn-foreground))] shadow-[0_14px_30px_hsl(var(--mode-learn-glow)/0.1)] sm:px-3 sm:py-2.5 sm:text-sm"
                  >
                    <span className="whitespace-nowrap">Antwort prüfen</span>
                  </motion.button>
                ) : null}
                <motion.button
                  onClick={handleRevealAnswer}
                  initial="rest"
                  animate="rest"
                  whileHover={reduceInterfaceMotion ? 'rest' : 'hover'}
                  whileTap={reduceInterfaceMotion ? 'rest' : 'tap'}
                  variants={ctaFollowThrough}
                  className={cn(
                    'btn-press rounded-[1.1rem] px-2.5 py-2 text-xs font-bold sm:px-3 sm:py-2.5 sm:text-sm',
                    isBlockedFlow && 'h-14 w-full text-base',
                    learnPalette.button,
                  )}
                >
                  <span>Lösung zeigen</span>
                </motion.button>
              </div>
            </div>
          ) : (
            <motion.button
              onClick={handleRevealAnswer}
              initial="rest"
              animate="rest"
              whileHover={reduceInterfaceMotion ? 'rest' : 'hover'}
              whileTap={reduceInterfaceMotion ? 'rest' : 'tap'}
              variants={ctaFollowThrough}
              className={cn('btn-press w-full rounded-[1.15rem] px-4 py-3 text-base font-bold', learnPalette.button)}
            >
              Antwort zeigen
            </motion.button>
          )}

          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap gap-1.5">
              {attemptMessage ? (
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] ${attemptBadgeClassName}`}
                >
                  {attemptMessage}
                </span>
              ) : null}
            </div>
          </div>
        </motion.div>
      ) : (
        <motion.div
          initial={reduceInterfaceMotion ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, ease: premiumEase }}
          className={panelClassName}
        >
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={onUndoReview}
              disabled={!canUndo}
              aria-label="Zurueck zur letzten Karte"
              className="btn-press inline-flex items-center gap-1.5 rounded-full border border-[hsl(var(--mode-learn-border)/0.22)] bg-background/82 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-foreground transition-opacity disabled:cursor-not-allowed disabled:opacity-45"
            >
              <ArrowLeft size={12} />
              Rückgängig
            </button>
            {latestFeedbackMessage ? (
              <div
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em]",
                  isBlockedFlow
                    ? "border-[hsl(var(--success)/0.38)] bg-[hsl(var(--success)/0.18)] text-[hsl(var(--success))]"
                    : "border-[hsl(var(--mode-learn-border)/0.22)] bg-[hsl(var(--mode-learn-surface)/0.4)] text-[hsl(var(--mode-learn-foreground)/0.88)]"
                )}
              >
                {latestFeedbackMessage}
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-4 gap-1.5 sm:gap-2.5">
            {(['again', 'hard', 'good', 'easy'] as ReviewRating[]).map((rating, index) => {
              return (
                <motion.button
                  key={rating}
                  onClick={() => handleReview(rating)}
                  type="button"
                  initial={reduceInterfaceMotion ? false : { opacity: 0, y: 16, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1, x: 0 }}
                  whileHover={reduceInterfaceMotion ? undefined : { y: -4, scale: 1.02 }}
                  whileTap={reduceInterfaceMotion ? undefined : { y: 1, scale: 0.985 }}
                  transition={{ delay: index * 0.05, duration: 0.22, ease: premiumEase }}
                  className={`btn-press relative overflow-hidden rounded-[1.05rem] border border-[hsl(var(--mode-learn-border)/0.2)] bg-card/92 px-1.5 py-2.5 text-center text-foreground shadow-[0_18px_30px_rgba(0,0,0,0.12)] transition-[box-shadow,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[hsl(var(--mode-learn)/0.6)] focus-visible:ring-offset-background ${
                    ratingMeta[rating].accent
                  } cursor-pointer`}
                >
                  <div className={`absolute inset-x-0 top-0 h-1 ${ratingMeta[rating].stripe}`} />
                  <p className="mt-1 text-[0.9rem] font-black tracking-[-0.05em] sm:text-[1.05rem]">
                    {ratingMeta[rating].label}
                  </p>
                  <p className="mt-0.5 text-[8px] font-black uppercase tracking-[0.12em] text-foreground/70 sm:text-[10px]">
                    {intervalPreviews?.[rating]}
                  </p>
                </motion.button>
              );
            })}
          </div>
        </motion.div>
      )}
    </motion.section>
  );
}

export const LearnReviewActions = memo(LearnReviewActionsInner);
