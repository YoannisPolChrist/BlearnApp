import { motion } from 'framer-motion';
import { Search, SlidersHorizontal } from 'lucide-react';
import GlassCard from '@/components/GlassCard';
import { Input } from '@/components/ui/input';
import { ctaFollowThrough } from '@/lib/motion';
import { tonePalettes } from '@/lib/semanticTones';
import { cn } from '@/lib/utils';
import type { BrowserSortBy, BrowserSortDirection, BrowserStateFilter } from '@/hooks/useCardBrowser';

interface CardBrowserToolbarProps {
  activeDeckId?: string;
  deckOptions: Array<{ id: string; name: string }>;
  filters: {
    selectedDeckId?: string;
    searchText: string;
    stateFilter: BrowserStateFilter;
    sortBy: BrowserSortBy;
    sortDirection: BrowserSortDirection;
  };
  onSearchDraftChange: (value: string) => void;
  onApplySearchDraft: () => void;
  onSelectedDeckIdChange: (deckId?: string) => void;
  onStateFilterChange: (value: BrowserStateFilter) => void;
  onSortByChange: (value: BrowserSortBy) => void;
  onSortDirectionChange: (value: BrowserSortDirection) => void;
  onOpenSearchDrawer: () => void;
  resultCount: number;
  totalCount: number;
}

const stateOptions: Array<{ value: BrowserStateFilter; label: string }> = [
  { value: 'all', label: 'Alle' },
  { value: 'new', label: 'Neu' },
  { value: 'learning', label: 'Lernen' },
  { value: 'review', label: 'Review' },
  { value: 'relearning', label: 'Neu lernen' },
];

const sortOptions: Array<{ value: BrowserSortBy; label: string }> = [
  { value: 'due', label: 'Fälligkeit' },
  { value: 'interval', label: 'Intervall' },
  { value: 'state', label: 'Status' },
  { value: 'deck', label: 'Deck' },
];

export function CardBrowserToolbar({
  activeDeckId,
  deckOptions,
  filters,
  onSearchDraftChange,
  onApplySearchDraft,
  onSelectedDeckIdChange,
  onStateFilterChange,
  onSortByChange,
  onSortDirectionChange,
  onOpenSearchDrawer,
  resultCount,
  totalCount,
}: CardBrowserToolbarProps) {
  const learnPalette = tonePalettes.learn;

  return (
    <GlassCard tone="learn" surface="featured" className="space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-foreground/62">Suchen und filtern</p>
          <p className="mt-1 break-words text-sm leading-relaxed text-foreground/72">
            Freitext, Deck und Status greifen direkt ineinander.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-foreground/66">
          <span className={cn('rounded-full px-2.5 py-1', learnPalette.badge)}>Aktiv: {activeDeckId ?? 'Alle Decks'}</span>
          <span className="rounded-full border border-border/75 bg-background/90 px-2.5 py-1">
            {resultCount}/{totalCount} Karten
          </span>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-3">
          <label className="block text-[10px] font-black uppercase tracking-[0.16em] text-foreground/66">
            Freitextsuche
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground/50" size={16} />
              <Input
                value={filters.searchText}
                onChange={(event) => onSearchDraftChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    onApplySearchDraft();
                  }
                }}
                placeholder="deck:grammar tag:verben oder einfacher Text"
                className="h-11 rounded-[1rem] border-border/70 bg-background/90 pl-9 text-sm"
              />
            </div>
            <motion.button
              onClick={onApplySearchDraft}
              initial="rest"
              animate="rest"
              whileHover="hover"
              whileTap="tap"
              variants={ctaFollowThrough}
              className={cn('btn-press rounded-[1rem] px-4 py-2.5 text-sm font-bold', learnPalette.button)}
            >
              Anwenden
            </motion.button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <div className="space-y-1.5">
            <label className="block text-[10px] font-black uppercase tracking-[0.16em] text-foreground/66">Deck</label>
            <select
              value={filters.selectedDeckId ?? ''}
              onChange={(event) => onSelectedDeckIdChange(event.target.value || undefined)}
              className="h-11 w-full rounded-[1rem] border border-border/70 bg-background/90 px-3 text-sm outline-none focus:ring-2 focus:ring-ring/50"
            >
              <option value="">Alle Decks</option>
              {deckOptions.map((deck) => (
                <option key={deck.id} value={deck.id}>
                  {deck.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[10px] font-black uppercase tracking-[0.16em] text-foreground/66">Status</label>
            <select
              value={filters.stateFilter}
              onChange={(event) => onStateFilterChange(event.target.value as BrowserStateFilter)}
              className="h-11 w-full rounded-[1rem] border border-border/70 bg-background/90 px-3 text-sm outline-none focus:ring-2 focus:ring-ring/50"
            >
              {stateOptions.map((entry) => (
                <option key={entry.value} value={entry.value}>
                  {entry.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap gap-2">
          {sortOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => onSortByChange(option.value)}
              className={cn(
                'btn-press rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em]',
                filters.sortBy === option.value
                  ? 'border-[hsl(var(--mode-learn-border))] bg-[hsl(var(--mode-learn-surface)/0.96)] text-[hsl(var(--mode-learn-foreground))]'
                  : 'border-border/70 bg-background/90 text-foreground/68',
              )}
            >
              {option.label}
            </button>
          ))}
          <button
            onClick={() => onSortDirectionChange(filters.sortDirection === 'asc' ? 'desc' : 'asc')}
            className="btn-press rounded-full border border-border/70 bg-background/90 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-foreground/68"
          >
            {filters.sortDirection === 'asc' ? 'Aufsteigend' : 'Absteigend'}
          </button>
        </div>

        <motion.button
          onClick={onOpenSearchDrawer}
          initial="rest"
          animate="rest"
          whileHover="hover"
          whileTap="tap"
          variants={ctaFollowThrough}
          className={cn('btn-press inline-flex items-center justify-center gap-2 rounded-[1rem] px-4 py-2.5 text-sm font-bold', learnPalette.button)}
        >
          <SlidersHorizontal size={16} />
          Strukturierte Suche
        </motion.button>
      </div>
    </GlassCard>
  );
}
