import type { LearningCardState } from '@/lib/learning';

export type CardQueryJoiner = 'and' | 'or';

export interface CardQueryFilter {
  field: 'deck' | 'tag' | 'state' | 'flag' | 'due';
  op: 'is' | 'isNot' | 'contains' | 'notContains' | 'gte' | 'lte' | 'gt' | 'lt';
  value: string | number;
}

export interface CardQuery {
  text: string;
  filters: CardQueryFilter[];
  joiner: CardQueryJoiner;
}

export interface SavedCardQuery {
  id: string;
  name: string;
  query: CardQuery;
  createdAt: number;
  updatedAt: number;
}

export interface CardQueryParseResult {
  query: CardQuery;
  tokens: string[];
}

export interface CardQueryMatchContext {
  now?: number;
}

export interface CardQueryCardShape {
  cardId: string;
  deckId: string;
  deckName: string;
  front: string;
  back: string;
  tags: string[];
  state: LearningCardState;
  dueAt: number;
  intervalDays: number;
  suspended: boolean;
}

