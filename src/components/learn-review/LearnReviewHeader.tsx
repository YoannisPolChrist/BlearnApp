import { memo } from 'react';
import { ArrowLeft } from 'lucide-react';
import { SessionTimer } from '@/components/learn-review/SessionTimer';
import { tonePalettes } from '@/lib/semanticTones';
import { cn } from '@/lib/utils';

interface LearnReviewPageHeaderProps {
  activeDeckLoaded: boolean;
  currentCardKindLabel: string;
  currentCardPosition: number;
  isBlockedFlow: boolean;
  nextNewCardLabel: string;
  onBack: () => void;
  reviewMixLabel: string;
  sessionStartedAt?: number;
  showTimer?: boolean;
  showBackButton: boolean;
  totalCandidateCount: number;
}

function LearnReviewPageHeaderInner({
  activeDeckLoaded,
  currentCardKindLabel,
  currentCardPosition,
  isBlockedFlow,
  nextNewCardLabel,
  onBack,
  reviewMixLabel,
  sessionStartedAt,
  showTimer = true,
  showBackButton,
  totalCandidateCount,
}: LearnReviewPageHeaderProps) {
  const learnPalette = tonePalettes.learn;
  const visibleCardCount = Math.max(totalCandidateCount, currentCardPosition);

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
            <div className="flex flex-col items-end gap-1 text-right">
              <div
                className={cn(
                  'rounded-[1.05rem] px-3 py-1.5 text-right shadow-[0_14px_30px_hsl(var(--mode-learn-glow)/0.12)]',
                  learnPalette.badge,
                )}
              >
                <p className="text-[9px] font-black uppercase tracking-[0.15em]">Karte</p>
                <p className="text-[1.3rem] font-black tracking-[-0.05em]">
                  {visibleCardCount > 0 ? `${currentCardPosition}/${visibleCardCount}` : '0/0'}
                </p>
                <p className="text-[9px] font-black uppercase tracking-[0.14em] text-foreground/76">
                  {currentCardKindLabel}
                </p>
              </div>
              <p className="max-w-[12rem] text-[10px] font-black uppercase tracking-[0.14em] text-[hsl(var(--mode-learn-foreground)/0.72)]">
                {nextNewCardLabel}
              </p>
              <p className="text-[10px] font-semibold text-[hsl(var(--mode-learn-foreground)/0.64)]">
                Mix {reviewMixLabel}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export const LearnReviewPageHeader = memo(LearnReviewPageHeaderInner);
