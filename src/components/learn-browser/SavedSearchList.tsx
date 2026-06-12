import { motion } from 'framer-motion';
import { Clock4, ListChecks, Trash2 } from 'lucide-react';
import GlassCard from '@/components/GlassCard';
import { premiumEase } from '@/lib/motion';
import { tonePalettes } from '@/lib/semanticTones';
import { cn } from '@/lib/utils';
import type { BrowserSavedSearch } from '@/hooks/useCardBrowser';

interface SavedSearchListProps {
  searches: BrowserSavedSearch[];
  onApplySearch: (searchId: string) => void;
  onDeleteSearch: (searchId: string) => void;
}

export function SavedSearchList({ searches, onApplySearch, onDeleteSearch }: SavedSearchListProps) {
  const learnPalette = tonePalettes.learn;

  return (
    <GlassCard tone="learn" surface="featured" className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-foreground/62">Gespeichert</p>
          <p className="mt-1 text-sm text-foreground/72">Session-Liste für wiederkehrende Browser-Muster</p>
        </div>
        <span className={cn('rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em]', learnPalette.badge)}>
          {searches.length}
        </span>
      </div>

      <div className="space-y-2">
        {searches.length > 0 ? (
          searches.map((search, index) => (
            <motion.div
              key={search.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: index * 0.02, ease: premiumEase }}
              className="rounded-[1rem] border border-border/70 bg-background/88 p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <button onClick={() => onApplySearch(search.id)} className="min-w-0 text-left">
                  <p className="break-words text-sm font-black tracking-[-0.03em] text-foreground">{search.name}</p>
                  <p className="mt-1 break-words text-[11px] leading-relaxed text-foreground/66">
                    {search.searchText || 'Keine freie Suche'} · {search.selectedDeckId ?? 'Alle Decks'} · {search.stateFilter}
                  </p>
                </button>
                <button
                  onClick={() => onDeleteSearch(search.id)}
                  className="btn-press inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/70 bg-background/90 text-foreground/64"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-foreground/60">
                <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/90 px-2 py-1">
                  <ListChecks size={11} />
                  {search.sortBy}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/90 px-2 py-1">
                  <Clock4 size={11} />
                  {new Date(search.createdAt).toLocaleDateString('de-DE')}
                </span>
              </div>
            </motion.div>
          ))
        ) : (
          <div className="rounded-[1rem] border border-dashed border-border/70 bg-background/70 p-3 text-sm text-foreground/66">
            Noch keine gespeicherte Suche. Benutze den Browser und speichere eine Kombination für später.
          </div>
        )}
      </div>
    </GlassCard>
  );
}
