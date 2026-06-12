import type {
  DeckAssignment,
  GateRule,
  LearningCard,
  LearningCardState,
  LearningDeck,
  LearningNote,
  LearningPreset,
  ReviewLog,
} from '@/lib/learning';

export type BrowserStateFilter = 'all' | LearningCardState;
export type BrowserSortBy = 'due' | 'interval' | 'state' | 'deck' | 'front';
export type BrowserSortDirection = 'asc' | 'desc';

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

export interface FilteredDeckLiteDefinition {
  id: string;
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
  preview: Array<{
    cardId: string;
    noteId: string;
    deckId: string;
    deckName: string;
    front: string;
    back: string;
    tags: string[];
    state: LearningCardState;
    dueAt: number;
    intervalDays: number;
    easeFactor: number;
    lapses: number;
    lastReviewedAt?: number;
    dueLabel: string;
    stateLabel: string;
    searchBlob: string;
  }>;
  updatedAt?: number;
}

export interface LearningCloudState {
  activeDeckId?: string;
  activeDeckUpdatedAt?: number;
  decks: LearningDeck[];
  notes: LearningNote[];
  cards: LearningCard[];
  reviewLogs: ReviewLog[];
  presets: LearningPreset[];
  assignments: DeckAssignment[];
  gateRule: GateRule;
  gateRuleUpdatedAt?: number;
  cardBrowser: CardBrowserState;
  savedCardQueries: BrowserSavedSearch[];
  filteredDeckLiteDefinition: FilteredDeckLiteDefinition;
  filteredDeckLiteDefinitions: FilteredDeckLiteDefinition[];
  filteredDeckLiteRuns: FilteredDeckLiteRun[];
}
