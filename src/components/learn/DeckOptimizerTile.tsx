import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { runWeightOptimizationInWorker } from '@/modules/learning/workers/learningOptimizerWorker';
import type { WeightOptimizationResult } from '@/modules/learning/stats/weightOptimizer';
import { useLearningStore } from '@/store/useLearningStore';
import { cn } from '@/lib/utils';

/**
 * Optimizer-Kachel (Masterplan 4.3): startet die FSRS-Gewichtsoptimierung im
 * Worker und zeigt das Ergebnis als Vorschlag. Übernommen wird nur nach
 * explizitem Tap — nie stillschweigend.
 */
export function DeckOptimizerTile({
  deckId,
  optimizerStatus,
}: {
  deckId: string;
  optimizerStatus: 'collecting' | 'ready' | 'scheduled';
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [result, setResult] = useState<WeightOptimizationResult | null>(null);
  const applyOptimizedPresetWeights = useLearningStore((state) => state.applyOptimizedPresetWeights);

  const runOptimization = async () => {
    setBusy(true);
    setError(false);
    try {
      const state = useLearningStore.getState();
      const deckLogs = Object.values(state.reviewLogs).filter((log) => log.deckId === deckId);
      const preset = state.getResolvedPresetForDeck(deckId);
      setResult(await runWeightOptimizationInWorker(deckLogs, preset));
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  const applyProposal = () => {
    if (!result?.improved) return;
    const state = useLearningStore.getState();
    const reviewCount = Object.values(state.reviewLogs).filter((log) => log.deckId === deckId).length;
    applyOptimizedPresetWeights(deckId, result.proposedParams, reviewCount);
    setResult(null);
  };

  const statusLabel =
    optimizerStatus === 'ready' ? 'Bereit' : optimizerStatus === 'scheduled' ? 'Geplant' : 'Sammelt';
  const improvementPercent = result?.improved
    ? Math.round((1 - result.optimizedHoldoutLogLoss / result.baselineHoldoutLogLoss) * 100)
    : 0;

  return (
    <div className="rounded-[1.3rem] border border-border/70 bg-background/60 px-4 py-3">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">Optimizer</p>
      {busy ? (
        <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-black text-foreground">
          <Loader2 size={13} className="animate-spin" aria-hidden />
          Berechnet …
        </p>
      ) : result ? (
        result.improved ? (
          <div className="mt-2 space-y-2">
            <p className="text-sm font-black tracking-[-0.03em] text-success">
              Vorschlag: {improvementPercent > 0 ? `${improvementPercent} % besser` : 'besser'}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={applyProposal}
                className="rounded-xl bg-primary px-3 py-1.5 text-xs font-black text-primary-foreground"
              >
                Übernehmen
              </button>
              <button
                type="button"
                onClick={() => setResult(null)}
                className="rounded-xl border border-border/70 px-3 py-1.5 text-xs font-bold text-foreground"
              >
                Verwerfen
              </button>
            </div>
          </div>
        ) : (
          <p className="mt-2 text-sm font-black tracking-[-0.03em] text-foreground">Schon optimal</p>
        )
      ) : (
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className={cn('text-sm font-black tracking-[-0.03em]', error ? 'text-destructive' : 'text-foreground')}>
            {error ? 'Fehlgeschlagen' : statusLabel}
          </p>
          {optimizerStatus === 'ready' || error ? (
            <button
              type="button"
              onClick={() => void runOptimization()}
              className="rounded-xl border border-border/70 px-3 py-1.5 text-xs font-black text-foreground hover:border-primary/30"
            >
              {error ? 'Erneut' : 'Optimieren'}
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
