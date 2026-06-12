import type { LearningCard, LearningCardState, LearningDeck, LearningNote } from '@/lib/learning';

export type CardBrowserSortField = 'due' | 'interval' | 'state' | 'front' | 'deck';
export type CardBrowserSortDirection = 'asc' | 'desc';

export interface CardBrowserRow {
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
  suspended: boolean;
  retrievability: number;
  createdAt: number;
}

export interface CardBrowserState {
  selectedDeckId?: string;
  searchText: string;
  sortBy: CardBrowserSortField;
  sortDirection: CardBrowserSortDirection;
  selectedCardIds: string[];
  savedSearchId?: string;
}

export interface CardBrowserRowInput {
  card: LearningCard;
  note?: LearningNote;
  deck?: LearningDeck;
}

export interface CardBrowserQuerySummary {
  totalRows: number;
  visibleRows: number;
  selectedRows: number;
}
