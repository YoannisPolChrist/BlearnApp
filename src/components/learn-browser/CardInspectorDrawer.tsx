import { motion } from 'framer-motion';
import { ArrowRight, Bookmark, CalendarDays, Layers3, MoonStar, PauseCircle, PlayCircle } from 'lucide-react';
import GlassCard from '@/components/GlassCard';
import { ctaFollowThrough, premiumEase } from '@/lib/motion';
import { tonePalettes } from '@/lib/semanticTones';
import { cn } from '@/lib/utils';
import { useLearningStore } from '@/store/useLearningStore';
import type { CardBrowserRow } from '@/hooks/useCardBrowser';

interface CardInspectorDrawerProps {
  row?: CardBrowserRow;
  onOpenReview: (deckId: string) => void;
  onClearSelection: () => void;
}

export function CardInspectorDrawer({ row, onOpenReview, onClearSelection }: CardInspectorDrawerProps) {
  const learnPalette = tonePalettes.learn;
  const setCardSuspended = useLearningStore((state) => state.setCardSuspended);
  const buryCardUntilTomorrow = useLearningStore((state) => state.buryCardUntilTomorrow);

  return (
    <GlassCard tone="learn" surface="featured" className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-foreground/62">Inspektor</p>
          <p className="mt-1 break-words text-sm text-foreground/72">
            {row ? 'Ausgewählte Karte und Metadaten' : 'Wähle eine Karte, um Details zu sehen'}
          </p>
        </div>
        {row ? (
          <button
            onClick={onClearSelection}
            className="btn-press rounded-full border border-border/70 bg-background/90 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-foreground/68"
          >
            Leeren
          </button>
        ) : null}
      </div>

      {row ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, ease: premiumEase }}
          className="space-y-4"
        >
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-foreground/62">Vorderseite</p>
            <p className="mt-2 break-words text-xl font-black tracking-[-0.05em] text-foreground">{row.front}</p>
          </div>

          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-foreground/62">Rückseite</p>
            <p className="mt-2 break-words text-sm leading-relaxed text-foreground/76">{row.back}</p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-[1rem] border border-border/70 bg-background/90 p-3">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-foreground/62">Deck</p>
              <p className="mt-1 break-words text-sm font-bold text-foreground">{row.deckName}</p>
            </div>
            <div className="rounded-[1rem] border border-border/70 bg-background/90 p-3">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-foreground/62">Status</p>
              <p className="mt-1 break-words text-sm font-bold text-foreground">{row.stateLabel}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em]', learnPalette.badge)}>
              <Layers3 size={11} />
              {row.intervalDays} Tage
            </span>
            <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em]', learnPalette.badge)}>
              <CalendarDays size={11} />
              {row.dueLabel}
            </span>
            <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em]', learnPalette.badge)}>
              <Bookmark size={11} />
              {row.tags.length} Tags
            </span>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setCardSuspended(row.cardId, !row.suspended)}
              className="btn-press inline-flex items-center justify-center gap-1.5 rounded-[1rem] border border-border/70 bg-background/90 px-3 py-2.5 text-sm font-bold text-foreground transition hover:border-primary/30"
            >
              {row.suspended ? <PlayCircle size={15} /> : <PauseCircle size={15} />}
              {row.suspended ? 'Fortsetzen' : 'Aussetzen'}
            </button>
            <button
              type="button"
              onClick={() => buryCardUntilTomorrow(row.cardId)}
              disabled={row.suspended}
              className="btn-press inline-flex items-center justify-center gap-1.5 rounded-[1rem] border border-border/70 bg-background/90 px-3 py-2.5 text-sm font-bold text-foreground transition hover:border-primary/30 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <MoonStar size={15} />
              Bis morgen
            </button>
          </div>

          <motion.button
            onClick={() => onOpenReview(row.deckId)}
            initial="rest"
            animate="rest"
            whileHover="hover"
            whileTap="tap"
            variants={ctaFollowThrough}
            className={cn('btn-press inline-flex w-full items-center justify-center gap-2 rounded-[1rem] px-4 py-3 text-sm font-bold', learnPalette.button)}
          >
            Im Learn öffnen
            <ArrowRight size={16} />
          </motion.button>
        </motion.div>
      ) : (
        <div className="rounded-[1.25rem] border border-dashed border-border/70 bg-background/70 p-4 text-sm text-foreground/66">
          Auswahl trifft hier ein. Danach zeigen wir Vorderseite, Rückseite, Tags und den nächsten Lernpfad.
        </div>
      )}
    </GlassCard>
  );
}
