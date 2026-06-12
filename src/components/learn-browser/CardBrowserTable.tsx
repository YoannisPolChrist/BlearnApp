import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { BookOpenText, CheckCircle2, Clock3, Layers3, Tag } from 'lucide-react';
import GlassCard from '@/components/GlassCard';
import { useIsMobile } from '@/hooks/use-mobile';
import { premiumEase, shouldAnimateDenseList } from '@/lib/motion';
import { tonePalettes } from '@/lib/semanticTones';
import { cn } from '@/lib/utils';
import type { CardBrowserRow } from '@/hooks/useCardBrowser';

interface CardBrowserTableProps {
  rows: CardBrowserRow[];
  selectedCardId?: string;
  onSelectCard: (cardId: string) => void;
}

export function CardBrowserTable({ rows, selectedCardId, onSelectCard }: CardBrowserTableProps) {
  const learnPalette = tonePalettes.learn;
  const reducedMotion = useReducedMotion();
  const isMobile = useIsMobile();
  const [hasAnimatedRows, setHasAnimatedRows] = useState(false);
  const allowRowEntryMotion = !hasAnimatedRows && shouldAnimateDenseList({
    reducedMotion,
    isMobile,
    itemCount: rows.length,
    maxAnimatedItems: 16,
  });

  useEffect(() => {
    if (rows.length === 0 || hasAnimatedRows) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      setHasAnimatedRows(true);
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [hasAnimatedRows, rows.length]);

  return (
    <GlassCard tone="learn" surface="featured" className="overflow-hidden p-0">
      <div className="flex items-center justify-between border-b border-border/70 px-4 py-3 sm:px-5">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-foreground/62">Karten</p>
          <p className="mt-1 text-sm text-foreground/72">{rows.length} Eintraege im Browser</p>
        </div>
        <div className={cn('rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em]', learnPalette.badge)}>
          Learn
        </div>
      </div>

      <div className="max-h-[32rem] overflow-y-auto">
        <div className="hidden grid-cols-[1.6fr_1.2fr_.7fr_.7fr_.7fr] gap-3 border-b border-border/60 px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-foreground/52 sm:grid">
          <span>Vorderseite</span>
          <span>Deck</span>
          <span>Status</span>
          <span>Fällig</span>
          <span>Intervall</span>
        </div>

        <div className="divide-y divide-border/55">
          {rows.map((row, index) => {
            const selected = row.cardId === selectedCardId;

            return (
              <motion.button
                key={row.cardId}
                onClick={() => onSelectCard(row.cardId)}
                initial={allowRowEntryMotion ? { opacity: 0, y: 10 } : false}
                animate={allowRowEntryMotion ? { opacity: 1, y: 0 } : undefined}
                transition={allowRowEntryMotion ? { duration: 0.22, delay: Math.min(index, 10) * 0.016, ease: premiumEase } : undefined}
                style={{ contentVisibility: 'auto', containIntrinsicSize: '88px' }}
                className={cn(
                  'w-full px-4 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
                  selected && 'bg-[hsl(var(--mode-learn-surface)/0.58)]',
                )}
              >
                <div className="grid gap-3 sm:grid-cols-[1.6fr_1.2fr_.7fr_.7fr_.7fr] sm:items-center">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-black tracking-[-0.03em] text-foreground">{row.front}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-foreground/64">
                      <span className="inline-flex items-center gap-1">
                        <BookOpenText size={13} />
                        {row.back}
                      </span>
                    </p>
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-foreground/88">{row.deckName}</p>
                    <p className="mt-1 flex flex-wrap gap-1.5">
                      {row.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/90 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-foreground/68"
                        >
                          <Tag size={11} />
                          {tag}
                        </span>
                      ))}
                    </p>
                  </div>

                  <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/90 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-foreground/70">
                    <CheckCircle2 size={11} />
                    {row.stateLabel}
                  </span>

                  <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/90 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-foreground/70">
                    <Clock3 size={11} />
                    {row.dueLabel}
                  </span>

                  <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/90 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-foreground/70">
                    <Layers3 size={11} />
                    {row.intervalDays}d
                  </span>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>
    </GlassCard>
  );
}
