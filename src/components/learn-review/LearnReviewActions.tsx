import { memo } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { type ReviewRating, type TypedAnswerMatchKind } from '@/lib/learning';
import { ctaFollowThrough, premiumEase, sectionItem } from '@/lib/motion';
import { tonePalettes } from '@/lib/semanticTones';
import { cn } from '@/lib/utils';
import { ratingMeta } from '@/components/learn-review/meta';

interface LearnReviewActionsProps {
  attemptMessage: string | null;
  blockedEasyHintVisible: boolean;
  blockedEasyPulseKey: number;
  easyRatingBlocked: boolean;
  canUndo: boolean;
  intervalPreviews: Record<ReviewRating, string> | null;
  onCheckTypedAnswer: () => void;
  onRevealAnswer: () => void;
  onUndoReview: () => void;
  onReview: (rating: ReviewRating) => void;
  onTypedAnswerChange: (value: string) => void;
  reduceInterfaceMotion: boolean;
  remainingAttempts: number;
  requiresTypedAnswer: boolean;
  latestFeedbackMessage?: string | null;
  revealed: boolean;
  typedAnswer: string;
  typedAnswerMatchKind?: TypedAnswerMatchKind | null;
  typedCorrect: boolean | null;
}

function LearnReviewActionsInner({
  attemptMessage,
  blockedEasyHintVisible,
  blockedEasyPulseKey,
  easyRatingBlocked,
  canUndo,
  intervalPreviews,
  onCheckTypedAnswer,
  onRevealAnswer,
  onUndoReview,
  onReview,
  onTypedAnswerChange,
  reduceInterfaceMotion,
  remainingAttempts,
  requiresTypedAnswer,
  latestFeedbackMessage,
  revealed,
  typedAnswer,
  typedAnswerMatchKind,
  typedCorrect,
}: LearnReviewActionsProps) {
  const learnPalette = tonePalettes.learn;
  const handleTypedAnswerFocus = (event: React.FocusEvent<HTMLInputElement>) => {
    event.currentTarget.scrollIntoView({
      block: 'nearest',
      inline: 'nearest',
    });
  };
  const panelClassName = reduceInterfaceMotion
    ? 'rounded-[1.45rem] border border-[hsl(var(--mode-learn-border)/0.24)] bg-[hsl(var(--background)/0.97)] p-2.5 shadow-[0_12px_26px_hsl(var(--mode-learn-glow)/0.08)] sm:p-3'
    : 'rounded-[1.45rem] border border-[hsl(var(--mode-learn-border)/0.28)] bg-[linear-gradient(180deg,hsl(var(--mode-learn-surface)/0.56),hsl(var(--background)/0.94))] p-2.5 shadow-[0_24px_60px_hsl(var(--mode-learn-glow)/0.14)] backdrop-blur-xl sm:p-3';
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
              <div className="rounded-full border border-[hsl(var(--mode-learn-border)/0.22)] bg-[hsl(var(--mode-learn-surface)/0.4)] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[hsl(var(--mode-learn-foreground)/0.88)]">
                {latestFeedbackMessage}
              </div>
            ) : null}
          </div>

          {requiresTypedAnswer ? (
            <div className="space-y-2.5">
              <Input
                value={typedAnswer}
                onChange={(event) => onTypedAnswerChange(event.target.value)}
                onFocus={handleTypedAnswerFocus}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    onCheckTypedAnswer();
                  }
                }}
                placeholder="Antwort eingeben"
                className="h-10 rounded-[1.1rem] border-[hsl(var(--mode-learn-border)/0.46)] bg-background/94 text-sm text-foreground shadow-[inset_0_1px_0_hsl(0_0%_100%/0.16)] placeholder:text-foreground/42 focus-visible:ring-[hsl(var(--mode-learn)/0.44)] focus-visible:ring-offset-[hsl(var(--background)/0.98)] sm:h-11 sm:text-base"
              />

              <div className="grid gap-2 sm:grid-cols-[0.95fr_1.2fr]">
                <motion.button
                  onClick={onCheckTypedAnswer}
                  initial="rest"
                  animate="rest"
                  whileHover={reduceInterfaceMotion ? 'rest' : 'hover'}
                  whileTap={reduceInterfaceMotion ? 'rest' : 'tap'}
                  variants={ctaFollowThrough}
                  className="btn-press rounded-[1.1rem] border border-[hsl(var(--mode-learn-border)/0.42)] bg-[hsl(var(--mode-learn-surface)/0.72)] px-3 py-2.5 text-sm font-bold text-[hsl(var(--mode-learn-foreground))] shadow-[0_14px_30px_hsl(var(--mode-learn-glow)/0.1)]"
                >
                  Antwort prüfen
                </motion.button>
                <motion.button
                  onClick={onRevealAnswer}
                  initial="rest"
                  animate="rest"
                  whileHover={reduceInterfaceMotion ? 'rest' : 'hover'}
                  whileTap={reduceInterfaceMotion ? 'rest' : 'tap'}
                  variants={ctaFollowThrough}
                  className={cn('btn-press rounded-[1.1rem] px-3 py-2.5 text-sm font-bold', learnPalette.button)}
                >
                  Lösung zeigen
                </motion.button>
              </div>
            </div>
          ) : (
            <motion.button
              onClick={onRevealAnswer}
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
              {requiresTypedAnswer ? (
                <span className="rounded-full border border-border/75 bg-background/96 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-foreground/76">
                  {remainingAttempts} Versuche frei
                </span>
              ) : null}
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
              <div className="rounded-full border border-[hsl(var(--mode-learn-border)/0.22)] bg-[hsl(var(--mode-learn-surface)/0.4)] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[hsl(var(--mode-learn-foreground)/0.88)]">
                {latestFeedbackMessage}
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-4 gap-1.5 sm:gap-2.5">
            {(['again', 'hard', 'good', 'easy'] as ReviewRating[]).map((rating, index) => {
              const isDisabled = rating === 'easy' && easyRatingBlocked;
              const isBlockedEasy = rating === 'easy' && easyRatingBlocked;

              return (
                <motion.button
                  key={rating}
                  onClick={() => onReview(rating)}
                  type="button"
                  aria-disabled={isDisabled}
                  initial={reduceInterfaceMotion ? false : { opacity: 0, y: 16, scale: 0.97 }}
                  animate={
                    isBlockedEasy && blockedEasyPulseKey > 0 && !reduceInterfaceMotion
                      ? { opacity: 1, y: 0, scale: 1, x: [0, -7, 7, -5, 5, -2, 2, 0] }
                      : { opacity: 1, y: 0, scale: 1, x: 0 }
                  }
                  whileHover={reduceInterfaceMotion || isDisabled ? undefined : { y: -4, scale: 1.02 }}
                  whileTap={reduceInterfaceMotion || isDisabled ? undefined : { y: 1, scale: 0.985 }}
                  transition={{ delay: index * 0.05, duration: 0.22, ease: premiumEase }}
                  className={`btn-press relative overflow-hidden rounded-[1.05rem] border border-[hsl(var(--mode-learn-border)/0.2)] bg-card/92 px-1.5 py-2.5 text-center text-foreground shadow-[0_18px_30px_rgba(0,0,0,0.12)] transition-[box-shadow,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[hsl(var(--mode-learn)/0.6)] focus-visible:ring-offset-background ${
                    ratingMeta[rating].accent
                  } ${isDisabled ? 'cursor-not-allowed opacity-45' : 'cursor-pointer'}`}
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

          {easyRatingBlocked || blockedEasyHintVisible ? (
            <div className="mt-2 text-[10px] font-black uppercase tracking-[0.15em] text-foreground/68">
              Easy ist nach falscher Eingabe gesperrt. Nutze Good, Hard oder Again.
            </div>
          ) : null}
        </motion.div>
      )}
    </motion.section>
  );
}

export const LearnReviewActions = memo(LearnReviewActionsInner);
