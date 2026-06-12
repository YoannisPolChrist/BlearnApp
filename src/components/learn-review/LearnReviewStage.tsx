import { memo } from 'react';
import { motion } from 'framer-motion';
import GlassCard from '@/components/GlassCard';
import { AnkiRenderedContent } from '@/components/learn-review/AnkiRenderedContent';
import { premiumEase, sectionItem } from '@/lib/motion';
import type { TypedAnswerMatchKind } from '@/lib/learning';

function containsStructuredAnkiHtml(value: string) {
  return /<(table|thead|tbody|tr|td|th|h1|h2|h3|h4|h5|h6|p|ul|ol|details|section|article|div)\b/i.test(value);
}

interface LearnReviewStageProps {
  attemptMessage?: string | null;
  answerIsLong: boolean;
  cardAnswer: string;
  cardAnswerHtml: string;
  cardPrompt: string;
  cardPromptHtml: string;
  cardTemplateClass?: string;
  cardTemplateCss?: string;
  currentCardId: string;
  hasRichTemplateHtml: boolean;
  mediaAltBack: string;
  mediaAltFront: string;
  mediaUrl?: string;
  promptIsLong: boolean;
  reduceInterfaceMotion: boolean;
  revealed: boolean;
  requiresTypedAnswer: boolean;
  submittedTypedAnswer?: string;
  typedAnswerMatchKind?: TypedAnswerMatchKind | null;
  typedCorrect: boolean | null;
}

function getTypedFeedbackClasses(matchKind: TypedAnswerMatchKind) {
  if (matchKind === 'exact') {
    return 'border-success/30 bg-success/12 text-success';
  }

  if (matchKind === 'partial') {
    return 'border-warning/30 bg-warning/12 text-warning';
  }

  return 'border-destructive/30 bg-destructive/12 text-destructive';
}

function LearnReviewStageInner({
  attemptMessage,
  answerIsLong,
  cardAnswer,
  cardAnswerHtml,
  cardPrompt,
  cardPromptHtml,
  cardTemplateClass,
  cardTemplateCss,
  currentCardId,
  hasRichTemplateHtml,
  mediaAltBack,
  mediaAltFront,
  mediaUrl,
  promptIsLong,
  reduceInterfaceMotion,
  revealed,
  requiresTypedAnswer,
  submittedTypedAnswer,
  typedAnswerMatchKind,
}: LearnReviewStageProps) {
  const frontUsesStructuredHtml = containsStructuredAnkiHtml(cardPromptHtml);
  const backUsesStructuredHtml = containsStructuredAnkiHtml(cardAnswerHtml);
  const frontUsesTemplatePresentation =
    hasRichTemplateHtml || Boolean(cardTemplateCss) || Boolean(cardTemplateClass) || frontUsesStructuredHtml;
  const frontPlainTextClassName = promptIsLong
    ? 'text-[2rem] leading-[1.07] sm:text-[2.45rem]'
    : 'text-[2.25rem] leading-[1.03] sm:text-[2.75rem]';
  const frontContentClassName = frontUsesTemplatePresentation
    ? 'w-full max-w-full break-words text-[1rem] leading-6 text-foreground'
    : `max-w-2xl break-words font-black tracking-[-0.07em] text-foreground ${frontPlainTextClassName}`;
  const frontFeedbackVisible =
    requiresTypedAnswer && !revealed && typedAnswerMatchKind === 'incorrect' && Boolean(attemptMessage);
  const backFeedbackVisible =
    requiresTypedAnswer
    && revealed
    && Boolean(attemptMessage)
    && (typedAnswerMatchKind === 'exact' || typedAnswerMatchKind === 'partial');

  return (
    <motion.section variants={sectionItem} className="flex min-h-0 flex-col">
      <GlassCard
        elevation="hero"
        surface="hero"
        tone="learn"
        highlight
        ambient="subtle"
        className="premium-shell flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[1.75rem] p-0"
      >
        <motion.div
          key={`${currentCardId}-${revealed ? 'answer' : 'prompt'}`}
          initial={reduceInterfaceMotion ? false : { opacity: 0, y: 18, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.32, ease: premiumEase }}
          className="relative z-10 flex min-h-0 flex-col p-2.5 sm:p-3"
        >
          <div className="flex min-h-[17.75rem] flex-col rounded-[1.45rem] border border-[hsl(var(--mode-learn-border)/0.28)] bg-[linear-gradient(180deg,hsl(var(--mode-learn-surface)/0.42),hsl(var(--card)/0.9))] p-3.5 shadow-[inset_0_1px_0_hsl(0_0%_100%/0.2),0_22px_56px_hsl(var(--mode-learn-glow)/0.12)] sm:min-h-[19rem] sm:p-4">
            {mediaUrl ? (
              <div className="mb-4 overflow-hidden rounded-[1.25rem] border border-[hsl(var(--mode-learn-border)/0.3)]">
                <img
                  src={mediaUrl}
                  alt={revealed ? mediaAltBack : mediaAltFront}
                  className="h-32 w-full object-cover sm:h-40"
                />
              </div>
            ) : null}

            {!revealed ? (
              <div
                className={`flex flex-1 flex-col ${
                  frontUsesTemplatePresentation
                    ? 'items-stretch justify-start text-left'
                    : 'items-center justify-center text-center'
                }`}
              >
                <AnkiRenderedContent
                  html={cardPromptHtml}
                  textFallback={cardPrompt}
                  cardClassName={cardTemplateClass}
                  templateCss={cardTemplateCss}
                  scopeId={`${currentCardId}-front`}
                  className={frontContentClassName}
                />
                {frontFeedbackVisible ? (
                  <div
                    className={`mt-5 rounded-[1.15rem] border px-4 py-3 text-sm font-bold ${getTypedFeedbackClasses('incorrect')}`}
                  >
                    {attemptMessage}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto pr-1">
                {backFeedbackVisible && typedAnswerMatchKind ? (
                  <div
                    className={`mb-4 rounded-[1.15rem] border px-4 py-3 text-sm font-bold ${getTypedFeedbackClasses(typedAnswerMatchKind)}`}
                  >
                    <p>{attemptMessage}</p>
                    {submittedTypedAnswer ? (
                      <p className="mt-1 text-xs font-semibold opacity-80">Deine Eingabe: {submittedTypedAnswer}</p>
                    ) : null}
                  </div>
                ) : null}
                <AnkiRenderedContent
                  html={cardAnswerHtml}
                  textFallback={cardAnswer}
                  cardClassName={cardTemplateClass}
                  templateCss={cardTemplateCss}
                  scopeId={`${currentCardId}-back`}
                  className={
                    hasRichTemplateHtml || backUsesStructuredHtml
                      ? 'w-full max-w-full break-words text-[1rem] leading-6 text-foreground'
                      : `break-words font-black tracking-[-0.06em] text-foreground ${
                          answerIsLong
                            ? 'text-[1.9rem] leading-[1.1] sm:text-[2.35rem]'
                            : 'text-[2.15rem] leading-[1.03] sm:text-[2.65rem]'
                        }`
                  }
                />
              </div>
            )}
          </div>
        </motion.div>
      </GlassCard>
    </motion.section>
  );
}

export const LearnReviewStage = memo(LearnReviewStageInner);
