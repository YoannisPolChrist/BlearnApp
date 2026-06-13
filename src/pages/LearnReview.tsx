import { useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import GlassCard from '@/components/GlassCard';
import PageTransition from '@/components/PageTransition';
import { CheckinEmotionStep } from '@/components/checkin/CheckinEmotionStep';
import { LearnReviewActions } from '@/components/learn-review/LearnReviewActions';
import { LearnReviewEmptyState } from '@/components/learn-review/LearnReviewEmptyState';
import { LearnReviewPageHeader } from '@/components/learn-review/LearnReviewHeader';
import { LearnReviewStage } from '@/components/learn-review/LearnReviewStage';
import { LearnReviewSuccessState } from '@/components/learn-review/LearnReviewSuccessState';
import { useLearnReviewSession } from '@/hooks/useLearnReviewSession';
import { useIsMobile } from '@/hooks/use-mobile';
import { sectionStagger } from '@/lib/motion';
import { tonePalettes } from '@/lib/semanticTones';
import { cn } from '@/lib/utils';
import { EMOTION_CATEGORIES } from '@/store/useAppStore';

export default function LearnReviewPage() {
  const reducedMotion = useReducedMotion();
  const isMobile = useIsMobile();
  const reduceInterfaceMotion = reducedMotion || isMobile;
  const showBackdropImage = !reduceInterfaceMotion;
  const session = useLearnReviewSession();
  const blockingBackdropStyle = session.isBlockedFlow
    ? {
        background:
          'radial-gradient(circle at top, hsl(var(--mode-learn-glow) / 0.14) 0%, transparent 34%), radial-gradient(circle at 86% 14%, hsl(var(--mode-learn) / 0.08) 0%, transparent 22%), linear-gradient(180deg, hsl(var(--surface-hero) / 0.98) 0%, hsl(var(--background) / 0.96) 34%, hsl(var(--background)) 100%)',
      }
    : undefined;

  useEffect(() => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'auto',
    });
  }, []);

  if (session.overlaySuccessVisible || (!session.targetId && session.success)) {
    return (
      <PageTransition variant="hero">
        <LearnReviewSuccessState
          blockedTargetLabel={session.blockedTargetLabel}
          onContinueToTarget={session.handleOverlaySuccessDone}
          reduceInterfaceMotion={reduceInterfaceMotion}
          targetId={session.targetId}
          targetType={session.targetType}
          unlockDurationMinutes={session.unlockDurationMinutes}
        />
      </PageTransition>
    );
  }

  return (
    <PageTransition variant="hero">
      <div className="relative min-h-screen">
        <div className="pointer-events-none fixed inset-0 z-0">
          {showBackdropImage && !session.isBlockedFlow ? (
            <div
              className="absolute inset-0 opacity-80 dark:opacity-58"
              style={{
                background:
                  'radial-gradient(circle at top, hsl(var(--mode-learn-glow) / 0.34) 0%, transparent 42%), radial-gradient(circle at 82% 18%, hsl(var(--mode-learn) / 0.16) 0%, transparent 30%), radial-gradient(circle at 18% 78%, hsl(var(--primary) / 0.12) 0%, transparent 34%)',
              }}
            />
          ) : null}
          <div
            className={`absolute inset-0 ${
              session.isBlockedFlow
                ? ''
                : showBackdropImage
                ? 'bg-[radial-gradient(circle_at_top,hsl(var(--mode-learn-glow)/0.34),transparent_42%),radial-gradient(circle_at_bottom_right,hsl(var(--mode-learn)/0.12),transparent_38%),linear-gradient(180deg,hsl(var(--mode-learn)/0.14),hsl(var(--background)/0.8)_42%,hsl(var(--background)))]'
                : 'bg-[radial-gradient(circle_at_top,hsl(var(--mode-learn-glow)/0.18),transparent_38%),linear-gradient(180deg,hsl(var(--mode-learn)/0.09),hsl(var(--background)/0.92)_36%,hsl(var(--background)))]'
            }`}
            style={blockingBackdropStyle}
          />
        </div>
        <div className="app-page app-page-compact relative z-10">
          <div className="page-shell-clip">
            <div
              className={`flex w-full flex-col gap-3 md:gap-4 ${
                session.revealed ? 'pb-[calc(8rem+env(safe-area-inset-bottom,0px))] sm:pb-0' : ''
              }`}
            >
              <LearnReviewPageHeader
                activeDeckLoaded={Boolean(session.activeDeck)}
                currentCardKindLabel={session.currentCardKindLabel}
                currentCardPosition={session.currentCardPosition}
                isBlockedFlow={session.isBlockedFlow}
                nextNewCardLabel={session.nextNewCardLabel}
                onBack={session.goBack}
                reviewMixLabel={session.reviewMixLabel}
                sessionStartedAt={session.sessionStartedAt}
                showTimer={session.showTimer}
                showBackButton={!session.isBlockedFlow}
                totalCandidateCount={session.totalCandidateCount}
              />

              {session.awaitingEmotionSelection ? (
                <motion.div
                  variants={sectionStagger}
                  initial={reduceInterfaceMotion ? false : 'hidden'}
                  animate="show"
                  className="flex min-h-0 min-w-0 flex-col gap-2.5 overflow-visible md:gap-3"
                >
                  <CheckinEmotionStep
                    stepKey="learn-emotions"
                    categories={EMOTION_CATEGORIES}
                    selectedCategories={session.selectedSessionCategories}
                    selectedEmotions={session.selectedSessionEmotions}
                    onToggleCategory={session.toggleSessionCategory}
                    onToggleEmotion={session.toggleSessionEmotion}
                    onFinish={session.completeSessionEmotionStep}
                    canComplete={
                      session.selectedSessionEmotions.length >= 1 &&
                      session.selectedSessionEmotions.length <= 3
                    }
                    maxSelections={3}
                    isBlockedFlow={session.isBlockedFlow}
                    badgeClassName={tonePalettes.learn.badge}
                    cardClassName={tonePalettes.learn.button}
                    summaryClassName={cn(
                      'rounded-[1.5rem] border border-[hsl(var(--mode-learn-border)/0.24)] bg-[hsl(var(--mode-learn-surface)/0.24)] shadow-[0_16px_34px_hsl(var(--mode-learn-glow)/0.1)]',
                      tonePalettes.learn.card,
                    )}
                    chipClassName="border border-[hsl(var(--mode-learn-border)/0.3)] bg-background/70 px-3 py-1.5 text-sm font-semibold text-foreground"
                    inactiveCategoryClassName="border-[hsl(var(--mode-learn-border)/0.24)] bg-[hsl(var(--background)/0.72)] text-foreground/78 backdrop-blur-sm hover:border-[hsl(var(--mode-learn-border)/0.38)] hover:bg-[hsl(var(--mode-learn-surface)/0.22)]"
                    inactiveEmotionClassName="border-[hsl(var(--mode-learn-border)/0.24)] bg-[hsl(var(--background)/0.76)] text-foreground backdrop-blur-sm hover:border-[hsl(var(--mode-learn-border)/0.42)] hover:bg-[hsl(var(--mode-learn-surface)/0.24)]"
                  />
                </motion.div>
              ) : !session.learningHydrated ? (
                <GlassCard elevation="hero" surface="hero" tone="learn" className="py-10 text-center sm:py-12">
                  <p className="text-lg font-semibold text-foreground">
                    {session.isBlockedFlow ? 'Freischaltung läuft …' : 'Lernsession lädt …'}
                  </p>
                </GlassCard>
              ) : session.blockedFlowExhausted ? (
                <GlassCard elevation="hero" surface="hero" tone="learn" className="py-10 text-center sm:py-12">
                  <p className="text-lg font-semibold text-foreground">Freigegeben ✓</p>
                </GlassCard>
              ) : !session.currentCard || !session.currentNote || !session.activeDeck ? (
                <LearnReviewEmptyState
                  isBlockedFlow={session.isBlockedFlow}
                  onRecoverBlockedFlow={session.handleFallbackToStrictBreathing}
                  onOpenLearnHub={session.openLearnHub}
                  activeDeckId={session.activeDeckId}
                />
              ) : (
                <motion.div
                  variants={sectionStagger}
                  initial={reduceInterfaceMotion ? false : 'hidden'}
                  animate="show"
                  className="flex min-h-0 min-w-0 flex-col gap-2.5 overflow-visible md:gap-3"
                >
                  <LearnReviewStage
                    attemptMessage={session.attemptMessage}
                    answerIsLong={session.answerIsLong}
                    cardAnswer={session.cardAnswer}
                    cardAnswerHtml={session.cardAnswerHtml}
                    cardPrompt={session.cardPrompt}
                    cardPromptHtml={session.cardPromptHtml}
                    cardTemplateClass={session.cardTemplateClass}
                    cardTemplateCss={session.cardTemplateCss}
                    currentCardId={session.currentCard.id}
                    hasRichTemplateHtml={session.hasRichTemplateHtml}
                    mediaAltBack={session.currentNote.back}
                    mediaAltFront={session.currentNote.front}
                    mediaUrl={session.currentNote.mediaUrl}
                    promptIsLong={session.promptIsLong}
                    reduceInterfaceMotion={reduceInterfaceMotion}
                    revealed={session.revealed}
                    requiresTypedAnswer={session.requiresTypedAnswer}
                    submittedTypedAnswer={session.submittedTypedAnswer}
                    typedAnswerMatchKind={session.typedAnswerMatchKind}
                    typedCorrect={session.typedCorrect}
                  />
                  <LearnReviewActions
                    canUndo={session.canUndo}
                    attemptMessage={session.attemptMessage}
                    blockedEasyHintVisible={session.blockedEasyHintVisible}
                    blockedEasyPulseKey={session.blockedEasyPulseKey}
                    easyRatingBlocked={session.easyRatingBlocked}
                    latestFeedbackMessage={session.latestFeedbackMessage}
                    intervalPreviews={session.intervalPreviews}
                    onCheckTypedAnswer={session.handleCheckTypedAnswer}
                    onRevealAnswer={session.handleRevealAnswer}
                    onReview={session.handleReview}
                    onUndoReview={session.handleUndoReview}
                    onTypedAnswerChange={session.setTypedAnswer}
                    reduceInterfaceMotion={reduceInterfaceMotion}
                    remainingAttempts={session.remainingAttempts}
                    requiresTypedAnswer={session.requiresTypedAnswer}
                    revealed={session.revealed}
                    typedAnswer={session.typedAnswer}
                    typedAnswerMatchKind={session.typedAnswerMatchKind}
                    typedCorrect={session.typedCorrect}
                  />
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
