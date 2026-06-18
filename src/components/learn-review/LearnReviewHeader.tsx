import { memo } from 'react';
import { ArrowLeft } from 'lucide-react';
import { SessionTimer } from '@/components/learn-review/SessionTimer';
import { SignatureRing } from '@/components/ui/SignatureRing';
import { cn } from '@/lib/utils';

interface LearnReviewPageHeaderProps {
  activeDeckLoaded: boolean;
  countedReviews: number;
  currentCardKindLabel: string;
  currentCardPosition: number;
  isBlockedFlow: boolean;
  nextNewCardLabel: string;
  onBack: () => void;
  reviewMixLabel: string;
  sessionCardCount: number;
  sessionStartedAt?: number;
  showTimer?: boolean;
  showBackButton: boolean;
  totalCandidateCount: number;
}

function LearnReviewPageHeaderInner({
  activeDeckLoaded,
  countedReviews,
  currentCardKindLabel,
  currentCardPosition,
  isBlockedFlow,
  nextNewCardLabel,
  onBack,
  reviewMixLabel,
  sessionCardCount,
  sessionStartedAt,
  showTimer = true,
  showBackButton,
  totalCandidateCount,
}: LearnReviewPageHeaderProps) {
  const visibleCardCount = Math.max(totalCandidateCount, currentCardPosition);
  const ringProgress = visibleCardCount > 0 ? currentCardPosition / visibleCardCount : 0;
  const unlockCount = Math.min(Math.max(0, countedReviews), Math.max(0, sessionCardCount));

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-2">
        {showBackButton ? (
          <button
            onClick={onBack}
            className="btn-press flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[hsl(var(--mode-learn-border)/0.34)] bg-[hsl(var(--mode-learn-surface)/0.42)] text-[hsl(var(--mode-learn-foreground))] shadow-[0_12px_28px_hsl(var(--mode-learn-glow)/0.12)] hover:text-foreground sm:h-11 sm:w-11"
          >
            <ArrowLeft size={18} />
          </button>
        ) : null}

        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[hsl(var(--mode-learn-foreground)/0.74)]">
            {isBlockedFlow ? 'Learn-Freischaltung' : 'Lernrunde'}
          </p>
          <h1 className="break-words text-[1.45rem] font-black tracking-[-0.05em] text-foreground sm:text-[1.9rem]">
            Vokabel fuer Vokabel
          </h1>
        </div>

        <div className="flex min-w-[7.2rem] flex-col items-end gap-1">
          {activeDeckLoaded && sessionStartedAt ? (
            <SessionTimer startedAt={sessionStartedAt} visible={showTimer} />
          ) : null}
          {activeDeckLoaded ? (
            <div className="flex flex-col items-end gap-1.5 text-right">
              <SignatureRing
                progress={ringProgress}
                size={64}
                strokeWidth={5}
                className="text-[hsl(var(--mode-learn-foreground))]"
                aria-label={`Karte ${currentCardPosition} von ${visibleCardCount}`}
              >
                <span className="text-[1.05rem] font-black leading-none tracking-[-0.04em] text-foreground">
                  {visibleCardCount > 0 ? `${currentCardPosition}/${visibleCardCount}` : '0/0'}
                </span>
              </SignatureRing>
              <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[hsl(var(--mode-learn-foreground)/0.72)]">
                {currentCardKindLabel}
              </p>
              <div className="flex max-w-[13rem] flex-wrap justify-end gap-1">
                <span className="rounded-full border border-[hsl(var(--mode-learn-border)/0.34)] bg-[hsl(var(--mode-learn-surface)/0.46)] px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-[hsl(var(--mode-learn-foreground)/0.68)]">
                  Mix {reviewMixLabel}
                </span>
                <span className="rounded-full border border-[hsl(var(--mode-learn-border)/0.48)] bg-[hsl(var(--mode-learn-glow)/0.12)] px-2 py-1 text-[10px] font-extrabold leading-tight text-[hsl(var(--mode-learn-foreground))]">
                  {nextNewCardLabel}
                </span>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export const LearnReviewPageHeader = memo(LearnReviewPageHeaderInner);
