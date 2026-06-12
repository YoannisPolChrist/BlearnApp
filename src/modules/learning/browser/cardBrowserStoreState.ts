import type { LearningCardState } from '@/lib/learning';

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
  updatedAt?: number;
}

export interface CardBrowserState {
  selectedDeckId?: string;
  searchDraft: string;
  searchText: string;
  stateFilter: BrowserStateFilter;
  sortBy: BrowserSortBy;
  sortDirection: BrowserSortDirection;
  selectedCardIds: string[];
  savedSearchId?: string;
  updatedAt?: number;
}

export function createLearningBrowserState(activeDeckId?: string): CardBrowserState {
  return {
    selectedDeckId: activeDeckId,
    searchDraft: '',
    searchText: '',
    stateFilter: 'all',
    sortBy: 'due',
    sortDirection: 'asc',
    selectedCardIds: [],
    savedSearchId: undefined,
    updatedAt: Date.now(),
  };
}

export function normalizeCardBrowserState(
  state?: Partial<CardBrowserState> | null,
  activeDeckId?: string,
): CardBrowserState {
  const selectedDeckId = state?.selectedDeckId ?? activeDeckId;

  return {
    selectedDeckId,
    searchDraft: state?.searchDraft ?? state?.searchText ?? '',
    searchText: state?.searchText ?? '',
    stateFilter: state?.stateFilter === 'all' || state?.stateFilter === 'new' || state?.stateFilter === 'learning' || state?.stateFilter === 'review' || state?.stateFilter === 'relearning'
      ? state.stateFilter
      : 'all',
    sortBy: state?.sortBy === 'interval' || state?.sortBy === 'state' || state?.sortBy === 'deck' || state?.sortBy === 'front'
      ? state.sortBy
      : 'due',
    sortDirection: state?.sortDirection === 'desc' ? 'desc' : 'asc',
    selectedCardIds: Array.isArray(state?.selectedCardIds)
      ? Array.from(new Set(state.selectedCardIds.filter(Boolean)))
      : [],
    savedSearchId: state?.savedSearchId,
    updatedAt: Number.isFinite(state?.updatedAt) ? state?.updatedAt : Date.now(),
  };
}

export function normalizeBrowserSavedSearch(search: BrowserSavedSearch): BrowserSavedSearch {
  return {
    ...search,
    name: search.name.trim(),
    searchText: search.searchText.trim(),
    stateFilter: search.stateFilter || 'all',
    sortBy: search.sortBy || 'due',
    sortDirection: search.sortDirection || 'asc',
    createdAt: Number.isFinite(search.createdAt) ? search.createdAt : Date.now(),
    updatedAt: Number.isFinite(search.updatedAt) ? search.updatedAt : Date.now(),
  };
}
