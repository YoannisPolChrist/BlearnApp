import type { CardQuery } from '@/modules/learning/card-search';

export interface FilteredDeckLiteDelays {
  again: number;
  hard: number;
  good: number;
}

export interface FilteredDeckLiteDefinition {
  id: string;
  name: string;
  primaryQuery: CardQuery;
  secondaryQuery?: CardQuery;
  limit: number;
  reschedule: boolean;
  delays?: FilteredDeckLiteDelays;
  allowEmpty: boolean;
  lastRunAt?: number;
}

export interface FilteredDeckLiteRun {
  definitionId: string;
  runAt: number;
  queueCardIds: string[];
  excludedCardIds: string[];
  matchedCardIds: string[];
  reschedule: boolean;
}

export interface FilteredDeckLitePreview {
  limit: number;
  matchedCount: number;
  queueCount: number;
  excludedCount: number;
}

