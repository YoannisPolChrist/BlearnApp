import type { LearningCardState } from '@/lib/learning';

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

export function createDefaultFilteredDeckLiteDefinition(activeDeckId?: string): FilteredDeckLiteDefinition {
  return {
    id: 'filtered-deck-lite-default',
    name: 'Filtered Deck Lite',
    selectedDeckId: activeDeckId,
    primaryQuery: '',
    secondaryQuery: '',
    limit: 25,
    reschedule: false,
    allowEmpty: true,
    delayAgain: 10,
    delayHard: 30,
    delayGood: 120,
    lastRunAt: undefined,
    updatedAt: Date.now(),
  };
}

export function normalizeFilteredDeckLiteDefinition(
  definition?: Partial<FilteredDeckLiteDefinition> | null,
  activeDeckId?: string,
): FilteredDeckLiteDefinition {
  const fallback = createDefaultFilteredDeckLiteDefinition(activeDeckId);
  const normalizedId = definition?.id?.trim() || fallback.id;

  return {
    ...fallback,
    ...definition,
    id: normalizedId,
    name: definition?.name?.trim() || fallback.name,
    selectedDeckId: definition?.selectedDeckId ?? activeDeckId,
    primaryQuery: definition?.primaryQuery ?? '',
    secondaryQuery: definition?.secondaryQuery ?? '',
    limit: Math.max(1, Math.round(definition?.limit ?? fallback.limit)),
    reschedule: Boolean(definition?.reschedule ?? fallback.reschedule),
    allowEmpty: Boolean(definition?.allowEmpty ?? fallback.allowEmpty),
    delayAgain: Math.max(0, Math.round(definition?.delayAgain ?? fallback.delayAgain)),
    delayHard: Math.max(0, Math.round(definition?.delayHard ?? fallback.delayHard)),
    delayGood: Math.max(0, Math.round(definition?.delayGood ?? fallback.delayGood)),
    lastRunAt: Number.isFinite(definition?.lastRunAt) ? definition?.lastRunAt : definition?.lastRunAt,
    updatedAt: Number.isFinite(definition?.updatedAt) ? definition?.updatedAt : Date.now(),
  };
}

export function normalizeFilteredDeckLiteRun(run: FilteredDeckLiteRun): FilteredDeckLiteRun {
  return {
    ...run,
    name: run.name.trim(),
    preview: Array.isArray(run.preview) ? run.preview : [],
    createdAt: Number.isFinite(run.createdAt) ? run.createdAt : Date.now(),
    updatedAt: Number.isFinite(run.updatedAt) ? run.updatedAt : run.createdAt,
  };
}
