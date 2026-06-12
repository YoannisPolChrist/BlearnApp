import GlassCard from '@/components/GlassCard';
import { tonePalettes } from '@/lib/semanticTones';
import { cn } from '@/lib/utils';
import { useLearningStore } from '@/store/useLearningStore';

interface LearnReviewEmptyStateProps {
  isBlockedFlow: boolean;
  onRecoverBlockedFlow: () => void;
  onOpenLearnHub: () => void;
  activeDeckId?: string;
}

export function LearnReviewEmptyState({
  isBlockedFlow,
  onRecoverBlockedFlow,
  onOpenLearnHub,
  activeDeckId,
}: LearnReviewEmptyStateProps) {
  const learnPalette = tonePalettes.learn;

  const allCards = useLearningStore((state) => state.cards);
  const deckCardsCount = Object.values(allCards).filter((c) => c.deckId === activeDeckId).length;

  return (
    <GlassCard elevation="hero" surface="hero" tone="learn" className="py-10 text-center sm:py-12">
      <p className="text-lg font-semibold text-foreground">
        {isBlockedFlow 
          ? 'Learn-Freischaltung nicht bereit' 
          : deckCardsCount > 0 
            ? 'Keine Karten für heute fällig' 
            : 'Keine Karten verfügbar'}
      </p>
      <p className="mt-2 text-sm text-foreground/74">
        {isBlockedFlow
          ? 'Dieses blockierte Ziel hat auf diesem Gerät gerade kein brauchbares Deck. Blearn wechselt stattdessen in den Reflexions-Flow, damit die Sperre nicht ins Leere läuft.'
          : deckCardsCount > 0
            ? 'Du hast alle fälligen Vokabeln für heute gelernt. Komm morgen wieder, oder importiere ein neues Deck.'
            : 'Importiere ein Deck oder ordne einem blockierten Ziel ein Deck zu.'}
      </p>
      <div className="mt-4 p-4 bg-black/10 rounded text-xs text-left overflow-auto max-h-32 text-foreground/50">
        <p>Debug Info:</p>
        <p>Active Deck ID: {activeDeckId || 'None'}</p>
        <p>Total Cards in Deck: {deckCardsCount}</p>
        <p>Total Cards in Store: {Object.keys(allCards).length}</p>
        <p>Store Keys: {Object.keys(allCards).slice(0, 3).join(', ')}</p>
        <p>Deck First Card: {Object.values(allCards).find(c => c.deckId === activeDeckId)?.front || 'N/A'}</p>
        <p>Deck First Card State: {Object.values(allCards).find(c => c.deckId === activeDeckId)?.state || 'N/A'}</p>
        <p>Deck First Card DueAt: {Object.values(allCards).find(c => c.deckId === activeDeckId)?.dueAt || 'N/A'} (Now: {Date.now()})</p>
      </div>
      {isBlockedFlow ? (
        <div className="mt-6 flex w-full flex-col items-center gap-3">
          <button
            onClick={onRecoverBlockedFlow}
            className={cn('btn-press w-full rounded-2xl px-5 py-3 text-sm font-bold sm:w-auto', learnPalette.button)}
          >
            Mit Check-in fortfahren
          </button>
          <button
            onClick={onOpenLearnHub}
            className="btn-press mt-2 text-sm text-foreground/60 underline decoration-border underline-offset-4 hover:text-foreground"
          >
            Decks verwalten
          </button>
        </div>
      ) : (
        <button
          onClick={onOpenLearnHub}
          className={cn('btn-press mt-5 w-full rounded-2xl px-5 py-3 text-sm font-bold sm:w-auto', learnPalette.button)}
        >
          Zum Learn Hub
        </button>
      )}
    </GlassCard>
  );
}
