import GlassCard from '@/components/GlassCard';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { tonePalettes } from '@/lib/semanticTones';
import { cn } from '@/lib/utils';
import type { FilteredDeckLiteDefinition } from '@/hooks/useFilteredDeckLite';

interface FilteredDeckFormProps {
  definition: FilteredDeckLiteDefinition;
  deckOptions: Array<{ id: string; name: string }>;
  onDefinitionNameChange: (value: string) => void;
  onSelectedDeckIdChange: (value?: string) => void;
  onPrimaryQueryChange: (value: string) => void;
  onSecondaryQueryChange: (value: string) => void;
  onLimitChange: (value: number) => void;
  onRescheduleChange: (value: boolean) => void;
  onAllowEmptyChange: (value: boolean) => void;
  onDelayAgainChange: (value: number) => void;
  onDelayHardChange: (value: number) => void;
  onDelayGoodChange: (value: number) => void;
  onSaveDefinition: () => void;
  onRunDefinition: () => void;
}

export function FilteredDeckForm({
  definition,
  deckOptions,
  onDefinitionNameChange,
  onSelectedDeckIdChange,
  onPrimaryQueryChange,
  onSecondaryQueryChange,
  onLimitChange,
  onRescheduleChange,
  onAllowEmptyChange,
  onDelayAgainChange,
  onDelayHardChange,
  onDelayGoodChange,
  onSaveDefinition,
  onRunDefinition,
}: FilteredDeckFormProps) {
  const learnPalette = tonePalettes.learn;

  return (
    <GlassCard tone="learn" surface="featured" className="space-y-4">
      <div className="space-y-2">
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-foreground/62">Definition</p>
        <Input
          value={definition.name}
          onChange={(event) => onDefinitionNameChange(event.target.value)}
          placeholder="Name für das Filterdeck"
          className="h-11 rounded-[1rem] border-border/70 bg-background/90 text-sm"
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <label className="block text-[10px] font-black uppercase tracking-[0.16em] text-foreground/62">Deck</label>
          <select
            value={definition.selectedDeckId ?? ''}
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

        <div className="space-y-2">
          <label className="block text-[10px] font-black uppercase tracking-[0.16em] text-foreground/62">Limit</label>
          <Input
            value={definition.limit}
            onChange={(event) => onLimitChange(Number.parseInt(event.target.value || '0', 10) || 0)}
            type="number"
            min={1}
            max={200}
            className="h-11 rounded-[1rem] border-border/70 bg-background/90 text-sm"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-[10px] font-black uppercase tracking-[0.16em] text-foreground/62">
          Filter A
        </label>
        <Textarea
          value={definition.primaryQuery}
          onChange={(event) => onPrimaryQueryChange(event.target.value)}
          placeholder="deck:english tag:food state:review"
          className="min-h-[92px] rounded-[1rem] border-border/70 bg-background/90 text-sm"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-[10px] font-black uppercase tracking-[0.16em] text-foreground/62">
          Filter B
        </label>
        <Textarea
          value={definition.secondaryQuery}
          onChange={(event) => onSecondaryQueryChange(event.target.value)}
          placeholder="optional zweite Filterspur"
          className="min-h-[92px] rounded-[1rem] border-border/70 bg-background/90 text-sm"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <label className="flex items-center justify-between gap-3 rounded-[1rem] border border-border/70 bg-background/90 px-3 py-2.5 text-sm">
          <span className="font-semibold text-foreground/80">Reschedule</span>
          <button
            onClick={() => onRescheduleChange(!definition.reschedule)}
            className={cn('btn-press rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em]', definition.reschedule ? learnPalette.button : 'border border-border/70 bg-background text-foreground/70')}
          >
            {definition.reschedule ? 'An' : 'Aus'}
          </button>
        </label>
        <label className="flex items-center justify-between gap-3 rounded-[1rem] border border-border/70 bg-background/90 px-3 py-2.5 text-sm">
          <span className="font-semibold text-foreground/80">Allow empty</span>
          <button
            onClick={() => onAllowEmptyChange(!definition.allowEmpty)}
            className={cn('btn-press rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em]', definition.allowEmpty ? learnPalette.button : 'border border-border/70 bg-background text-foreground/70')}
          >
            {definition.allowEmpty ? 'An' : 'Aus'}
          </button>
        </label>
      </div>

      {definition.reschedule ? (
        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-2">
            <label className="block text-[10px] font-black uppercase tracking-[0.16em] text-foreground/62">Again</label>
            <Input
              type="number"
              value={definition.delayAgain}
              onChange={(event) => onDelayAgainChange(Number.parseInt(event.target.value || '0', 10) || 0)}
              className="h-11 rounded-[1rem] border-border/70 bg-background/90 text-sm"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-[10px] font-black uppercase tracking-[0.16em] text-foreground/62">Hard</label>
            <Input
              type="number"
              value={definition.delayHard}
              onChange={(event) => onDelayHardChange(Number.parseInt(event.target.value || '0', 10) || 0)}
              className="h-11 rounded-[1rem] border-border/70 bg-background/90 text-sm"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-[10px] font-black uppercase tracking-[0.16em] text-foreground/62">Good</label>
            <Input
              type="number"
              value={definition.delayGood}
              onChange={(event) => onDelayGoodChange(Number.parseInt(event.target.value || '0', 10) || 0)}
              className="h-11 rounded-[1rem] border-border/70 bg-background/90 text-sm"
            />
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          onClick={onSaveDefinition}
          className="btn-press rounded-[1rem] border border-border/70 bg-background/90 px-4 py-3 text-sm font-bold text-foreground/76"
        >
          Definition speichern
        </button>
        <button
          onClick={onRunDefinition}
          className={cn('btn-press rounded-[1rem] px-4 py-3 text-sm font-bold', learnPalette.button)}
        >
          Jetzt ausfuehren
        </button>
      </div>
    </GlassCard>
  );
}
