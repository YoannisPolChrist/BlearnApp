import { useDeferredValue, useEffect, useMemo } from 'react';
import type { LearningCardState, LearningDeck } from '@/lib/learning';
import { useLearningStore } from '@/store/useLearningStore';
import {
  useCardBrowserActions,
  useCardBrowserSummary,
} from '@/store/selectors';
import {
  buildCardBrowserRows,
  filterCardBrowserRows,
  type BrowserFilters,
  type CardBrowserRow,
} from '@/modules/learning/browser/cardBrowserRows';

export type BrowserSortBy = 'due' | 'interval' | 'state' | 'deck' | 'front';
export type BrowserSortDirection = 'asc' | 'desc';
export type BrowserStateFilter = 'all' | LearningCardState;

export interface BrowserSavedSearch {
  id: string;
  name: string;
  searchText: string;
  selectedDeckId?: string;
  stateFilter: BrowserStateFilter;
  sortBy: BrowserSortBy;
  sortDirection: BrowserSortDirection;
  createdAt: number;
}

export type { BrowserFilters, CardBrowserRow };

export interface UseCardBrowserResult {
  activeDeckId?: string;
  decks: LearningDeck[];
  rows: CardBrowserRow[];
  visibleRows: CardBrowserRow[];
  selectedRow?: CardBrowserRow;
  selectedCardIds: string[];
  savedSearches: BrowserSavedSearch[];
  filters: BrowserFilters;
  searchDraft: string;
  totalCount: number;
  visibleCount: number;
  deckOptions: Array<Pick<LearningDeck, 'id' | 'name' | 'cardIds'>>;
  deckNameById: Map<string, string>;
  setSearchDraft: (value: string) => void;
  applySearchDraft: () => void;
  setSelectedDeckId: (deckId?: string) => void;
  setStateFilter: (value: BrowserStateFilter) => void;
  setSortBy: (value: BrowserSortBy) => void;
  setSortDirection: (value: BrowserSortDirection) => void;
  selectRow: (cardId: string) => void;
  toggleRowSelection: (cardId: string) => void;
  clearSelection: () => void;
  saveSearch: (name: string) => void;
  applySavedSearch: (searchId: string) => void;
  deleteSavedSearch: (searchId: string) => void;
}

export function useCardBrowser(): UseCardBrowserResult {
  const { activeDeckId, decks, cards, notes, cardBrowser, savedCardQueries } = useCardBrowserSummary();
  const {
    setCardBrowserState,
    setCardBrowserSearchDraft,
    applyCardBrowserSearchDraft,
    selectCardBrowserCard,
    toggleCardBrowserCardSelection,
    clearCardBrowserSelection,
    upsertSavedCardQuery,
    applySavedCardQuery,
    deleteSavedCardQuery,
  } = useCardBrowserActions();

  const searchDraft = cardBrowser.searchDraft;
  const deferredSearchDraft = useDeferredValue(searchDraft);

  useEffect(() => {
    if (!cardBrowser.selectedDeckId && activeDeckId) {
      setCardBrowserState({ selectedDeckId: activeDeckId });
    }
  }, [activeDeckId, cardBrowser.selectedDeckId, setCardBrowserState]);

  const rows = useMemo(() => buildCardBrowserRows(cards, notes, decks), [cards, decks, notes]);
  const visibleRows = useMemo(
    () =>
      filterCardBrowserRows(rows, {
        selectedDeckId: cardBrowser.selectedDeckId,
        searchText: deferredSearchDraft,
        stateFilter: cardBrowser.stateFilter,
        sortBy: cardBrowser.sortBy,
        sortDirection: cardBrowser.sortDirection,
      }),
    [cardBrowser.selectedDeckId, cardBrowser.sortBy, cardBrowser.sortDirection, cardBrowser.stateFilter, deferredSearchDraft, rows],
  );
  const selectedRow =
    visibleRows.find((row) => row.cardId === cardBrowser.selectedCardIds[0])
    ?? rows.find((row) => row.cardId === cardBrowser.selectedCardIds[0]);
  const deckNameById = useMemo(() => new Map(decks.map((deck) => [deck.id, deck.name])), [decks]);
  const deckOptions = useMemo(() => decks.filter((deck) => deck.cardIds.length > 0), [decks]);

  const saveSearch = (name: string) => {
    const normalizedName = name.trim();
    if (!normalizedName) return;

    upsertSavedCardQuery({
      name: normalizedName,
      searchText: searchDraft.trim(),
      selectedDeckId: cardBrowser.selectedDeckId,
      stateFilter: cardBrowser.stateFilter,
      sortBy: cardBrowser.sortBy,
      sortDirection: cardBrowser.sortDirection,
    });
  };

  const applySavedSearch = (searchId: string) => {
    applySavedCardQuery(searchId);
  };

  const deleteSavedSearch = (searchId: string) => {
    deleteSavedCardQuery(searchId);
  };

  return {
    activeDeckId,
    decks,
    rows,
    visibleRows,
    selectedRow,
    selectedCardIds: cardBrowser.selectedCardIds,
    savedSearches: savedCardQueries,
    filters: {
      selectedDeckId: cardBrowser.selectedDeckId,
      searchText: cardBrowser.searchText,
      stateFilter: cardBrowser.stateFilter,
      sortBy: cardBrowser.sortBy,
      sortDirection: cardBrowser.sortDirection,
    },
    searchDraft,
    totalCount: rows.length,
    visibleCount: visibleRows.length,
    deckOptions,
    deckNameById,
    setSearchDraft: setCardBrowserSearchDraft,
    applySearchDraft: applyCardBrowserSearchDraft,
    setSelectedDeckId: (deckId) => setCardBrowserState({ selectedDeckId: deckId }),
    setStateFilter: (value) => setCardBrowserState({ stateFilter: value }),
    setSortBy: (value) => setCardBrowserState({ sortBy: value }),
    setSortDirection: (value) => setCardBrowserState({ sortDirection: value }),
    selectRow: selectCardBrowserCard,
    toggleRowSelection: toggleCardBrowserCardSelection,
    clearSelection: clearCardBrowserSelection,
    saveSearch,
    applySavedSearch,
    deleteSavedSearch,
  };
}
