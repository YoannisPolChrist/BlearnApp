import { useMemo } from 'react';
import type { LearningCard } from '@/lib/learning';
import { useLearningStore } from '@/store/useLearningStore';

export function useActiveLearningDeckData({
  activeDeckDataRevision,
  activeDeckId,
  getResolvedPresetForDeck,
  isBlockedFlow,
}: {
  activeDeckDataRevision: string;
  activeDeckId?: string;
  getResolvedPresetForDeck: (deckId: string) => ReturnType<typeof useLearningStore.getState>['presets'][string] | undefined;
  isBlockedFlow: boolean;
}) {
  return useMemo(() => {
    void activeDeckDataRevision;

    if (!activeDeckId) {
      return {
        activeDeck: undefined,
        activePreset: undefined,
        activeDeckCards: [],
        activeDeckReviewLogs: [],
        activeDeckCardById: {},
        activeDeckCardStateById: {},
      };
    }

    const state = useLearningStore.getState();
    const nextActiveDeck = state.decks[activeDeckId];
    const nextActivePreset = nextActiveDeck ? getResolvedPresetForDeck(activeDeckId) : undefined;
    // A card without its note cannot render a prompt or answer. Import and sync
    // repairs can temporarily leave such orphaned cards behind; never let one
    // occupy the first slot of a learning or blocking-unlock queue.
    const knownNoteIds = new Set(Object.keys(state.notes));
    const nextScopedDeckCards = Object.values(state.cards).filter(
      (card) => card.deckId === activeDeckId && knownNoteIds.has(card.noteId),
    );
    const nextActiveDeckReviewLogs = Object.values(state.reviewLogs).filter((log) => log.deckId === activeDeckId);
    const nextActiveDeckCardById: Record<string, LearningCard> = {};
    const nextActiveDeckCardStateById: Record<string, LearningCard['state']> = {};

    for (const card of nextScopedDeckCards) {
      nextActiveDeckCardById[card.id] = card;
      nextActiveDeckCardStateById[card.id] = card.state;
    }

    return {
      activeDeck: nextActiveDeck,
      activePreset: nextActivePreset,
      activeDeckCards: nextScopedDeckCards,
      activeDeckReviewLogs: nextActiveDeckReviewLogs,
      activeDeckCardById: nextActiveDeckCardById,
      activeDeckCardStateById: nextActiveDeckCardStateById,
    };
  }, [
    activeDeckDataRevision,
    activeDeckId,
    getResolvedPresetForDeck,
  ]);
}
