import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import GlassCard from '@/components/GlassCard';
import { Input } from '@/components/ui/input';
import { premiumEase } from '@/lib/motion';
import { tonePalettes } from '@/lib/semanticTones';
import { cn } from '@/lib/utils';
import { SavedSearchForm } from './SavedSearchForm';
import { SavedSearchList } from './SavedSearchList';
import type { BrowserSavedSearch } from '@/hooks/useCardBrowser';

interface StructuredSearchDrawerProps {
  open: boolean;
  onToggleOpen: () => void;
  searchText: string;
  onSearchTextChange: (value: string) => void;
  savedSearches: BrowserSavedSearch[];
  onSaveSearch: (name: string) => void;
  onApplySavedSearch: (searchId: string) => void;
  onDeleteSavedSearch: (searchId: string) => void;
}

export function StructuredSearchDrawer({
  open,
  onToggleOpen,
  searchText,
  onSearchTextChange,
  savedSearches,
  onSaveSearch,
  onApplySavedSearch,
  onDeleteSavedSearch,
}: StructuredSearchDrawerProps) {
  const learnPalette = tonePalettes.learn;
  const [draftName, setDraftName] = useState('');

  return (
    <GlassCard tone="learn" surface="featured" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-foreground/62">Strukturierte Suche</p>
          <p className="mt-1 text-sm text-foreground/72">Hier sammeln wir Filterfenster, gespeicherte Suchen und Query-Notizen.</p>
        </div>
        <motion.button
          onClick={onToggleOpen}
          initial="rest"
          animate="rest"
          whileHover="hover"
          whileTap="tap"
          variants={{
            rest: { scale: 1 },
            hover: { scale: 1.02 },
            tap: { scale: 0.98 },
          }}
          className={cn('btn-press inline-flex items-center gap-2 rounded-[1rem] px-3.5 py-2 text-sm font-bold', learnPalette.button)}
        >
          <Plus size={16} />
          {open ? 'Schließen' : 'Öffnen'}
        </motion.button>
      </div>

      {open ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: premiumEase }}
          className="space-y-4"
        >
          <div className="grid gap-3 lg:grid-cols-[1.3fr_.9fr]">
            <div className="space-y-2.5">
              <label className="block text-[10px] font-black uppercase tracking-[0.16em] text-foreground/62">
                Query Notiz
              </label>
              <Input
                value={searchText}
                onChange={(event) => onSearchTextChange(event.target.value)}
                placeholder="deck:spanisch tag:grammatik state:review"
                className="h-11 rounded-[1rem] border-border/70 bg-background/90 text-sm"
              />
              <div className="rounded-[1rem] border border-dashed border-border/70 bg-background/70 p-3 text-xs leading-relaxed text-foreground/66">
                später wird dies zum DSL Builder. Heute dient es als klare Zwischenstufe für Suche, Deck-Filter und Saved Searches.
              </div>
            </div>

            <div className="space-y-2.5">
              <label className="block text-[10px] font-black uppercase tracking-[0.16em] text-foreground/62">
                Speichern
              </label>
              <SavedSearchForm
                draftName={draftName}
                onDraftNameChange={setDraftName}
                onSave={() => {
                  onSaveSearch(draftName);
                  setDraftName('');
                }}
                disabled={!draftName.trim() && !searchText.trim()}
              />
            </div>
          </div>

          <SavedSearchList
            searches={savedSearches}
            onApplySearch={onApplySavedSearch}
            onDeleteSearch={onDeleteSavedSearch}
          />
        </motion.div>
      ) : (
        <div className="rounded-[1rem] border border-dashed border-border/70 bg-background/70 p-4 text-sm text-foreground/66">
          Der Drawer ist eingeklappt. Sobald die Router-Integration steht, können wir hier die eigentliche Query-Logik andocken.
        </div>
      )}
    </GlassCard>
  );
}
