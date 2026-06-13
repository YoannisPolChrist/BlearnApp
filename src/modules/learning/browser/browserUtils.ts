import type { LearningCard, LearningDeck, LearningNote } from '@/lib/learning';
import type { CardBrowserRow } from './browserTypes';

const RETRIEVABILITY_FLOOR = 0.05;
const RETRIEVABILITY_CEILING = 0.98;

function getDeckName(deck?: LearningDeck) {
  return deck?.name || 'Unbenanntes Deck';
}

function getTags(note?: LearningNote) {
  return Array.isArray(note?.tags) ? Array.from(new Set(note?.tags.filter(Boolean))) : [];
}

function computeRetrievability(card: LearningCard, now = Date.now()) {
  if (card.state === 'new') {
    return RETRIEVABILITY_FLOOR;
  }

  const ageMs = Math.max(1, now - (card.lastReviewedAt || card.createdAt));
  const ageDays = ageMs / (24 * 60 * 60 * 1000);
  const interval = Math.max(1, card.intervalDays || 1);
  const ratio = Math.min(1, interval / (interval + ageDays));
  return Math.min(RETRIEVABILITY_CEILING, Math.max(RETRIEVABILITY_FLOOR, ratio));
}

export function normalizeLearningCard(
  card: LearningCard,
  note?: LearningNote,
  deck?: LearningDeck,
  now = Date.now(),
): CardBrowserRow {
  return {
    cardId: card.id,
    noteId: card.noteId,
    deckId: card.deckId,
    deckName: getDeckName(deck),
    front: note?.front || '',
    back: note?.back || '',
    tags: getTags(note),
    state: card.state,
    dueAt: card.dueAt,
    intervalDays: card.intervalDays,
    easeFactor: card.easeFactor,
    lapses: card.lapses,
    suspended: card.state === 'suspended',
    retrievability: computeRetrievability(card, now),
    createdAt: card.createdAt,
  };
}

export function getCardBrowserRowsSignature(rows: CardBrowserRow[]) {
  return rows
    .map((row) => [
      row.cardId,
      row.deckId,
      row.state,
      row.dueAt,
      row.intervalDays,
      row.front,
      row.back,
      row.tags.join('|'),
    ].join(':'))
    .join(';');
}
