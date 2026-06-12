import { normalizeLearningCard } from '@/modules/learning/browser/browserUtils';
import type { CardBrowserRow, CardBrowserRowInput, CardBrowserSortDirection, CardBrowserSortField } from './browserTypes';

function compareStrings(left: string, right: string) {
  return left.localeCompare(right, undefined, { sensitivity: 'base' });
}

function compareNumbers(left: number, right: number) {
  return left - right;
}

function compareByField(field: CardBrowserSortField, left: CardBrowserRow, right: CardBrowserRow) {
  switch (field) {
    case 'front':
      return compareStrings(left.front, right.front);
    case 'deck':
      return compareStrings(left.deckName, right.deckName);
    case 'interval':
      return compareNumbers(left.intervalDays, right.intervalDays);
    case 'state':
      return compareStrings(left.state, right.state);
    case 'due':
    default:
      return compareNumbers(left.dueAt, right.dueAt);
  }
}

export function buildCardBrowserRows(rows: CardBrowserRowInput[], now = Date.now()): CardBrowserRow[] {
  return rows.map(({ card, note, deck }) => normalizeLearningCard(card, note, deck, now));
}

export function sortCardBrowserRows(
  rows: CardBrowserRow[],
  sortBy: CardBrowserSortField,
  sortDirection: CardBrowserSortDirection,
): CardBrowserRow[] {
  const direction = sortDirection === 'desc' ? -1 : 1;
  return [...rows].sort((left, right) => {
    const primary = compareByField(sortBy, left, right);
    if (primary !== 0) {
      return primary * direction;
    }

    return compareStrings(left.cardId, right.cardId) * direction;
  });
}

export function filterCardBrowserRows(rows: CardBrowserRow[], searchText: string, deckId?: string): CardBrowserRow[] {
  const normalizedSearch = searchText.trim().toLowerCase();
  return rows.filter((row) => {
    if (deckId && row.deckId !== deckId) {
      return false;
    }

    if (!normalizedSearch) {
      return true;
    }

    const haystack = [
      row.front,
      row.back,
      row.deckName,
      row.tags.join(' '),
      row.state,
    ]
      .join(' ')
      .toLowerCase();

    return haystack.includes(normalizedSearch);
  });
}

export function getCardBrowserSummary(totalRows: number, visibleRows: number, selectedRows: number) {
  return {
    totalRows,
    visibleRows,
    selectedRows,
  };
}
