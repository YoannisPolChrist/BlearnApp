import GlassCard from '@/components/GlassCard';
import { tonePalettes } from '@/lib/semanticTones';
import type { FilteredDeckLiteRun } from '@/hooks/useFilteredDeckLite';

interface FilteredDeckRunHistoryProps {
  history: FilteredDeckLiteRun[];
  onClearHistory: () => void;
}

export function FilteredDeckRunHistory({ history, onClearHistory }: FilteredDeckRunHistoryProps) {
  const learnPalette = tonePalettes.learn;

  return (
    <GlassCard tone="learn" surface="featured" className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-foreground/62">Verlauf</p>
          <p className="mt-1 text-sm text-foreground/72">Zuletzt ausgefuehrte Filter-Setups in dieser Session</p>
        </div>
        <button
          onClick={onClearHistory}
          className="btn-press rounded-full border border-border/70 bg-background/90 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-foreground/68"
        >
          Leeren
        </button>
      </div>

      <div className="space-y-2">
        {history.length > 0 ? (
          history.map((entry) => (
            <div key={entry.id} className="rounded-[1rem] border border-border/70 bg-background/90 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words text-sm font-black tracking-[-0.03em] text-foreground">{entry.name}</p>
                  <p className="mt-1 break-words text-[11px] text-foreground/64">
                    {new Date(entry.createdAt).toLocaleString('de-DE')} · {entry.queueSize} Karten
                  </p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${learnPalette.badge}`}>
                  {entry.reschedule ? 'Reschedule' : 'Preview'}
                </span>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-[1rem] border border-dashed border-border/70 bg-background/70 p-4 text-sm text-foreground/66">
            Noch keine Ausfuehrung in dieser Session.
          </div>
        )}
      </div>
    </GlassCard>
  );
}
