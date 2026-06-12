import type { LearningStore } from '../types';
import {
  buildCardBrowserRows,
  filterCardBrowserRows,
  type CardBrowserRow,
} from '../../browser/cardBrowserRows';
import {
  createLearningBrowserState,
  normalizeBrowserSavedSearch,
  normalizeCardBrowserState,
  type BrowserSavedSearch,
  type CardBrowserState,
} from '../../browser/cardBrowserStoreState';
import {
  createDefaultFilteredDeckLiteDefinition,
  normalizeFilteredDeckLiteDefinition,
  type FilteredDeckLiteDefinition,
  type FilteredDeckLiteRun,
} from '../../filtered-deck/filteredDeckLiteStoreState';

export interface LearningBrowserAndFilteredDeckState {
  cardBrowser: CardBrowserState;
  savedCardQueries: BrowserSavedSearch[];
  filteredDeckLiteDefinition: FilteredDeckLiteDefinition;
  filteredDeckLiteDefinitions: FilteredDeckLiteDefinition[];
  filteredDeckLiteRuns: FilteredDeckLiteRun[];
}

export interface LearningBrowserAndFilteredDeckActions {
  setCardBrowserState: (patch: Partial<CardBrowserState>) => void;
  setCardBrowserSearchDraft: (searchDraft: string) => void;
  applyCardBrowserSearchDraft: () => void;
  selectCardBrowserCard: (cardId: string) => void;
  toggleCardBrowserCardSelection: (cardId: string) => void;
  clearCardBrowserSelection: () => void;
  upsertSavedCardQuery: (
    savedSearch: Omit<BrowserSavedSearch, 'id' | 'createdAt' | 'updatedAt'> &
      Partial<Pick<BrowserSavedSearch, 'id' | 'createdAt' | 'updatedAt'>>,
  ) => BrowserSavedSearch;
  applySavedCardQuery: (savedSearchId: string) => void;
  deleteSavedCardQuery: (savedSearchId: string) => void;
  setFilteredDeckLiteDefinition: (patch: Partial<FilteredDeckLiteDefinition>) => void;
  saveFilteredDeckLiteDefinition: () => FilteredDeckLiteDefinition;
  runFilteredDeckLiteDefinition: () => FilteredDeckLiteRun | null;
  clearFilteredDeckLiteRuns: () => void;
}

type BrowserFilteredDeckStore =
  LearningStore &
  LearningBrowserAndFilteredDeckState &
  LearningBrowserAndFilteredDeckActions;

type StoreSet = (
  partial:
    | Partial<BrowserFilteredDeckStore>
    | ((state: BrowserFilteredDeckStore) => Partial<BrowserFilteredDeckStore> | BrowserFilteredDeckStore),
) => void;

function createFilteredDeckRunPreview(
  rows: CardBrowserRow[],
  definition: FilteredDeckLiteDefinition,
): CardBrowserRow[] {
  const primaryRows = filterCardBrowserRows(rows, {
    selectedDeckId: definition.selectedDeckId,
    searchText: definition.primaryQuery,
    stateFilter: 'all',
    sortBy: 'due',
    sortDirection: 'asc',
  });
  const secondaryRows = definition.secondaryQuery.trim()
    ? filterCardBrowserRows(rows, {
        selectedDeckId: definition.selectedDeckId,
        searchText: definition.secondaryQuery,
        stateFilter: 'all',
        sortBy: 'due',
        sortDirection: 'asc',
      })
    : [];
  const combined = secondaryRows.length > 0
    ? primaryRows.filter((row) => secondaryRows.some((entry) => entry.cardId === row.cardId))
    : primaryRows;

  return combined.slice(0, definition.limit);
}

export function createLearningBrowserAndFilteredDeckInitialState(
  activeDeckId?: string,
): LearningBrowserAndFilteredDeckState {
  return {
    cardBrowser: createLearningBrowserState(activeDeckId),
    savedCardQueries: [],
    filteredDeckLiteDefinition: createDefaultFilteredDeckLiteDefinition(activeDeckId),
    filteredDeckLiteDefinitions: [],
    filteredDeckLiteRuns: [],
  };
}

export function createLearningBrowserAndFilteredDeckSlice(
  set: StoreSet,
): LearningBrowserAndFilteredDeckActions {
  return {
    setCardBrowserState: (patch) =>
      set((state) => ({
        cardBrowser: normalizeCardBrowserState(
          {
            ...state.cardBrowser,
            ...patch,
            updatedAt: Date.now(),
          },
          state.activeDeckId,
        ),
      })),
    setCardBrowserSearchDraft: (searchDraft) =>
      set((state) => ({
        cardBrowser: normalizeCardBrowserState(
          {
            ...state.cardBrowser,
            searchDraft,
            updatedAt: Date.now(),
          },
          state.activeDeckId,
        ),
      })),
    applyCardBrowserSearchDraft: () =>
      set((state) => ({
        cardBrowser: normalizeCardBrowserState(
          {
            ...state.cardBrowser,
            searchText: state.cardBrowser.searchDraft,
            updatedAt: Date.now(),
          },
          state.activeDeckId,
        ),
      })),
    selectCardBrowserCard: (cardId) =>
      set((state) => ({
        cardBrowser: normalizeCardBrowserState(
          {
            ...state.cardBrowser,
            selectedCardIds: [cardId],
            updatedAt: Date.now(),
          },
          state.activeDeckId,
        ),
      })),
    toggleCardBrowserCardSelection: (cardId) =>
      set((state) => {
        const nextSelected = state.cardBrowser.selectedCardIds.includes(cardId)
          ? state.cardBrowser.selectedCardIds.filter((entry) => entry !== cardId)
          : [...state.cardBrowser.selectedCardIds, cardId];

        return {
          cardBrowser: normalizeCardBrowserState(
            {
              ...state.cardBrowser,
              selectedCardIds: nextSelected,
              updatedAt: Date.now(),
            },
            state.activeDeckId,
          ),
        };
      }),
    clearCardBrowserSelection: () =>
      set((state) => ({
        cardBrowser: normalizeCardBrowserState(
          {
            ...state.cardBrowser,
            selectedCardIds: [],
            updatedAt: Date.now(),
          },
          state.activeDeckId,
        ),
      })),
    upsertSavedCardQuery: (savedSearch) => {
      const normalized = normalizeBrowserSavedSearch({
        ...savedSearch,
        id: savedSearch.id || `saved-search_${Math.random().toString(36).slice(2, 9)}`,
        createdAt: savedSearch.createdAt || Date.now(),
        updatedAt: savedSearch.updatedAt || Date.now(),
      });

      set((state) => ({
        savedCardQueries: [
          normalized,
          ...state.savedCardQueries.filter((entry) => entry.id !== normalized.id),
        ]
          .sort((left, right) => right.updatedAt! - left.updatedAt!)
          .slice(0, 50),
      }));

      return normalized;
    },
    applySavedCardQuery: (savedSearchId) =>
      set((state) => {
        const savedSearch = state.savedCardQueries.find((entry) => entry.id === savedSearchId);
        if (!savedSearch) {
          return state;
        }

        return {
          cardBrowser: normalizeCardBrowserState(
            {
              ...state.cardBrowser,
              selectedDeckId: savedSearch.selectedDeckId,
              searchDraft: savedSearch.searchText,
              searchText: savedSearch.searchText,
              stateFilter: savedSearch.stateFilter,
              sortBy: savedSearch.sortBy,
              sortDirection: savedSearch.sortDirection,
              savedSearchId: savedSearch.id,
              selectedCardIds: [],
              updatedAt: Date.now(),
            },
            state.activeDeckId,
          ),
        };
      }),
    deleteSavedCardQuery: (savedSearchId) =>
      set((state) => ({
        savedCardQueries: state.savedCardQueries.filter((entry) => entry.id !== savedSearchId),
      })),
    setFilteredDeckLiteDefinition: (patch) =>
      set((state) => ({
        filteredDeckLiteDefinition: normalizeFilteredDeckLiteDefinition(
          {
            ...state.filteredDeckLiteDefinition,
            ...patch,
            updatedAt: Date.now(),
          },
          state.activeDeckId,
        ),
      })),
    saveFilteredDeckLiteDefinition: () =>
      set((state) => {
        const normalized = normalizeFilteredDeckLiteDefinition(
          {
            ...state.filteredDeckLiteDefinition,
            id: state.filteredDeckLiteDefinition.id || `filtered-deck_${Math.random().toString(36).slice(2, 9)}`,
            updatedAt: Date.now(),
          } as FilteredDeckLiteDefinition,
          state.activeDeckId,
        );

        return {
          filteredDeckLiteDefinition: normalized,
          filteredDeckLiteDefinitions: [
            normalized,
            ...state.filteredDeckLiteDefinitions.filter((entry) => entry.id !== normalized.id),
          ]
            .sort((left, right) => (right.updatedAt ?? 0) - (left.updatedAt ?? 0))
            .slice(0, 25),
        };
      }) as unknown as FilteredDeckLiteDefinition,
    runFilteredDeckLiteDefinition: () =>
      set((state) => {
        const now = Date.now();
        const normalized = normalizeFilteredDeckLiteDefinition(
          {
            ...state.filteredDeckLiteDefinition,
            id: state.filteredDeckLiteDefinition.id || `filtered-deck_${Math.random().toString(36).slice(2, 9)}`,
            lastRunAt: now,
            updatedAt: now,
          } as FilteredDeckLiteDefinition,
          state.activeDeckId,
        );
        const rows = buildCardBrowserRows(
          Object.values(state.cards),
          Object.values(state.notes),
          Object.values(state.decks),
          now,
        );
        const preview = createFilteredDeckRunPreview(rows, normalized);

        return {
          filteredDeckLiteDefinition: normalized,
          filteredDeckLiteDefinitions: [
            normalized,
            ...state.filteredDeckLiteDefinitions.filter((entry) => entry.id !== normalized.id),
          ]
            .sort((left, right) => (right.updatedAt ?? 0) - (left.updatedAt ?? 0))
            .slice(0, 25),
          filteredDeckLiteRuns: [
            {
              id: `filtered-run_${Math.random().toString(36).slice(2, 9)}`,
              name: normalized.name,
              createdAt: now,
              deckId: normalized.selectedDeckId,
              queueSize: preview.length,
              reschedule: normalized.reschedule,
              allowEmpty: normalized.allowEmpty,
              preview,
              updatedAt: now,
            },
            ...state.filteredDeckLiteRuns,
          ].slice(0, 25),
        };
      }) as unknown as FilteredDeckLiteRun | null,
    clearFilteredDeckLiteRuns: () =>
      set(() => ({
        filteredDeckLiteRuns: [],
      })),
  };
}
