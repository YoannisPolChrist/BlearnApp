import { useEffect, useMemo } from 'react';
import { useLearningStore } from '@/store/useLearningStore';
import {
  buildCardBrowserRows,
  filterCardBrowserRows,
  type CardBrowserRow,
} from '@/modules/learning/browser/cardBrowserRows';
import {
  useFilteredDeckLiteActions,
  useFilteredDeckLiteSummary,
} from '@/store/selectors';

export interface FilteredDeckLiteDefinition {
  id?: string;
  name: string;
  selectedDeckId?: string;
  primaryQuery: string;
  secondaryQuery: string;
  limit: number;
  reschedule: boolean;
  allowEmpty: boolean;
  delayAgain: number;
  delayHard: number;
  delayGood: number;
  lastRunAt?: number;
  updatedAt?: number;
}

export interface FilteredDeckLiteRun {
  id: string;
  name: string;
  createdAt: number;
  deckId?: string;
  queueSize: number;
  reschedule: boolean;
  allowEmpty: boolean;
  preview: CardBrowserRow[];
}

export interface UseFilteredDeckLiteResult {
  activeDeckId?: string;
  decks: Array<{ id: string; name: string; cardIds: string[] }>;
  rows: CardBrowserRow[];
  previewRows: CardBrowserRow[];
  runHistory: FilteredDeckLiteRun[];
  definition: FilteredDeckLiteDefinition;
  totalCount: number;
  previewCount: number;
  setDefinitionName: (value: string) => void;
  setSelectedDeckId: (value?: string) => void;
  setPrimaryQuery: (value: string) => void;
  setSecondaryQuery: (value: string) => void;
  setLimit: (value: number) => void;
  setReschedule: (value: boolean) => void;
  setAllowEmpty: (value: boolean) => void;
  setDelayAgain: (value: number) => void;
  setDelayHard: (value: number) => void;
  setDelayGood: (value: number) => void;
  saveDefinition: () => void;
  runDefinition: () => void;
  clearHistory: () => void;
}

function createRunPreview(
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

export function useFilteredDeckLite(): UseFilteredDeckLiteResult {
  const {
    activeDeckId,
    decks,
    cards,
    notes,
    filteredDeckLiteDefinition: definition,
    filteredDeckLiteRuns: runHistory,
  } = useFilteredDeckLiteSummary();
  const {
    setFilteredDeckLiteDefinition,
    saveFilteredDeckLiteDefinition,
    runFilteredDeckLiteDefinition,
    clearFilteredDeckLiteRuns,
  } = useFilteredDeckLiteActions();
  const seedStarterDeck = useLearningStore((state) => state.seedStarterDeck);



  useEffect(() => {
    if (!definition.selectedDeckId && activeDeckId) {
      setFilteredDeckLiteDefinition({ selectedDeckId: activeDeckId });
    }
  }, [activeDeckId, definition.selectedDeckId, setFilteredDeckLiteDefinition]);

  const rows = useMemo(() => buildCardBrowserRows(cards, notes, decks), [cards, decks, notes]);
  const previewRows = useMemo(() => createRunPreview(rows, definition), [definition, rows]);
  const previewCount = previewRows.length;

  const saveDefinition = () => {
    saveFilteredDeckLiteDefinition();
  };

  const runDefinition = () => {
    runFilteredDeckLiteDefinition();
  };

  return {
    activeDeckId,
    decks,
    rows,
    previewRows,
    runHistory,
    definition,
    totalCount: rows.length,
    previewCount,
    setDefinitionName: (value) => setFilteredDeckLiteDefinition({ name: value }),
    setSelectedDeckId: (value) => setFilteredDeckLiteDefinition({ selectedDeckId: value }),
    setPrimaryQuery: (value) => setFilteredDeckLiteDefinition({ primaryQuery: value }),
    setSecondaryQuery: (value) => setFilteredDeckLiteDefinition({ secondaryQuery: value }),
    setLimit: (value) => setFilteredDeckLiteDefinition({ limit: value }),
    setReschedule: (value) => setFilteredDeckLiteDefinition({ reschedule: value }),
    setAllowEmpty: (value) => setFilteredDeckLiteDefinition({ allowEmpty: value }),
    setDelayAgain: (value) => setFilteredDeckLiteDefinition({ delayAgain: value }),
    setDelayHard: (value) => setFilteredDeckLiteDefinition({ delayHard: value }),
    setDelayGood: (value) => setFilteredDeckLiteDefinition({ delayGood: value }),
    saveDefinition,
    runDefinition,
    clearHistory: clearFilteredDeckLiteRuns,
  };
}
