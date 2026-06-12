import type { LearningCard, LearningCardState, LearningDeck, LearningNote } from '@/lib/learning';
import type { BrowserSortBy, BrowserSortDirection, BrowserStateFilter } from './cardBrowserStoreState';

export interface BrowserFilters {
  selectedDeckId?: string;
  searchText: string;
  stateFilter: BrowserStateFilter;
  sortBy: BrowserSortBy;
  sortDirection: BrowserSortDirection;
}

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
  lastReviewedAt?: number;
  dueLabel: string;
  stateLabel: string;
  searchBlob: string;
}

function createSearchBlob(row: Omit<CardBrowserRow, 'searchBlob'>) {
  return [
    row.front,
    row.back,
    row.deckName,
    row.tags.join(' '),
    row.state,
    row.dueLabel,
    String(row.intervalDays),
  ]
    .join(' ')
    .toLowerCase();
}

function formatDueLabel(dueAt: number, now = Date.now()) {
  const diff = dueAt - now;
  if (!Number.isFinite(dueAt) || dueAt <= 0) return 'Unbekannt';
  if (diff <= 0) return 'Jetzt';

  const minutes = Math.round(diff / (60 * 1000));
  if (minutes < 60) return `in ${minutes}m`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `in ${hours}h`;

  const days = Math.round(hours / 24);
  return days === 1 ? 'morgen' : `in ${days} Tagen`;
}

function getStateLabel(state: LearningCardState) {
  switch (state) {
    case 'new':
      return 'Neu';
    case 'learning':
      return 'Lernen';
    case 'review':
      return 'Wiederholen';
    case 'relearning':
      return 'Neu lernen';
    default:
      return state;
  }
}

export function buildCardBrowserRows(
  cards: LearningCard[],
  notes: LearningNote[],
  decks: LearningDeck[],
  now = Date.now(),
): CardBrowserRow[] {
  const notesById = new Map(notes.map((note) => [note.id, note]));
  const decksById = new Map(decks.map((deck) => [deck.id, deck]));

  return cards.map((card) => {
    const note = notesById.get(card.noteId);
    const deck = decksById.get(card.deckId);
    const rowWithoutSearch: Omit<CardBrowserRow, 'searchBlob'> = {
      cardId: card.id,
      noteId: card.noteId,
      deckId: card.deckId,
      deckName: deck?.name ?? 'Unbekanntes Deck',
      front: note?.front?.trim() || 'Ohne Vorderseite',
      back: note?.back?.trim() || 'Ohne Rueckseite',
      tags: Array.from(new Set([...(note?.tags ?? []), ...(deck?.tags ?? [])])).filter(Boolean),
      state: card.state,
      dueAt: card.dueAt,
      intervalDays: card.intervalDays,
      easeFactor: card.easeFactor,
      lapses: card.lapses,
      lastReviewedAt: card.lastReviewedAt,
      dueLabel: formatDueLabel(card.dueAt, now),
      stateLabel: getStateLabel(card.state),
    };

    return {
      ...rowWithoutSearch,
      searchBlob: createSearchBlob(rowWithoutSearch),
    };
  });
}

export function filterCardBrowserRows(rows: CardBrowserRow[], filters: BrowserFilters) {
  const searchTerms = filters.searchText
    .split(/\s+/)
    .map((term) => term.trim().toLowerCase())
    .filter(Boolean);

  return rows
    .filter((row) => {
      if (filters.selectedDeckId && row.deckId !== filters.selectedDeckId) {
        return false;
      }

      if (filters.stateFilter !== 'all' && row.state !== filters.stateFilter) {
        return false;
      }

      return searchTerms.every((term) => row.searchBlob.includes(term));
    })
    .sort((left, right) => {
      const direction = filters.sortDirection === 'asc' ? 1 : -1;

      if (filters.sortBy === 'deck') {
        return direction * left.deckName.localeCompare(right.deckName);
      }

      if (filters.sortBy === 'interval') {
        return direction * (left.intervalDays - right.intervalDays);
      }

      if (filters.sortBy === 'state') {
        return direction * left.state.localeCompare(right.state);
      }

      if (filters.sortBy === 'front') {
        return direction * left.front.localeCompare(right.front);
      }

      return direction * (left.dueAt - right.dueAt);
    });
}
