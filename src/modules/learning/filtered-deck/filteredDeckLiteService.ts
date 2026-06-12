import type { CardQueryCardShape } from '@/modules/learning/card-search';
import { runCardQueryIds } from '@/modules/learning/card-search';
import type { FilteredDeckLiteDefinition, FilteredDeckLitePreview, FilteredDeckLiteRun } from './filteredDeckLiteTypes';

function unique(values: string[]) {
  return Array.from(new Set(values));
}

export function previewFilteredDeckLite(
  definition: FilteredDeckLiteDefinition,
  cards: CardQueryCardShape[],
): FilteredDeckLitePreview {
  const primaryMatches = runCardQueryIds(cards, definition.primaryQuery);
  const secondaryMatches = definition.secondaryQuery ? runCardQueryIds(cards, definition.secondaryQuery) : [];
  const matchedIds = unique([...primaryMatches, ...secondaryMatches]);
  const queueCount = Math.min(definition.limit, matchedIds.length);

  return {
    limit: definition.limit,
    matchedCount: matchedIds.length,
    queueCount,
    excludedCount: Math.max(0, cards.length - matchedIds.length),
  };
}

export function runFilteredDeckLite(
  definition: FilteredDeckLiteDefinition,
  cards: CardQueryCardShape[],
  now = Date.now(),
): FilteredDeckLiteRun {
  const primaryMatches = runCardQueryIds(cards, definition.primaryQuery);
  const secondaryMatches = definition.secondaryQuery ? runCardQueryIds(cards, definition.secondaryQuery) : [];
  const matchedIds = unique([...primaryMatches, ...secondaryMatches]);

  if (!definition.allowEmpty && matchedIds.length === 0) {
    throw new Error(`Filtered deck "${definition.name}" produced no cards.`);
  }

  return {
    definitionId: definition.id,
    runAt: now,
    queueCardIds: matchedIds.slice(0, Math.max(0, definition.limit)),
    excludedCardIds: cards
      .filter((card) => !matchedIds.includes(card.cardId))
      .map((card) => card.cardId),
    matchedCardIds: matchedIds,
    reschedule: definition.reschedule,
  };
}

export function hydrateFilteredDeckLiteDefinition(
  definition: FilteredDeckLiteDefinition,
  now = Date.now(),
): FilteredDeckLiteDefinition {
  return {
    ...definition,
    limit: Math.max(1, Math.round(definition.limit)),
    lastRunAt: now,
  };
}
