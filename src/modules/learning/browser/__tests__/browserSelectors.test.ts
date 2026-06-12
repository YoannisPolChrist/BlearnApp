import { describe, expect, it } from 'vitest';
import type { LearningCard, LearningDeck, LearningNote } from '@/lib/learning';
import { buildCardBrowserRows, filterCardBrowserRows, sortCardBrowserRows } from '../index';

const deck: LearningDeck = {
  id: 'deck-1',
  name: 'French Top 5000',
  description: '',
  language: 'fr',
  tags: [],
  cardIds: ['card-1', 'card-2'],
  createdAt: 1,
  updatedAt: 1,
};

const note: LearningNote = {
  id: 'note-1',
  deckId: 'deck-1',
  type: 'basic',
  front: 'bonjour',
  back: 'hello',
  tags: ['greeting'],
  language: 'fr',
  createdAt: 1,
};

const card: LearningCard = {
  id: 'card-1',
  noteId: 'note-1',
  deckId: 'deck-1',
  type: 'basic',
  state: 'review',
  dueAt: 200,
  intervalDays: 7,
  easeFactor: 2.5,
  reps: 3,
  lapses: 0,
  stepIndex: 0,
  memoryState: null,
  createdAt: 1,
  lastReviewedAt: 100,
};

describe('card browser selectors', () => {
  it('builds rows from cards and notes', () => {
    const rows = buildCardBrowserRows([{ card, note, deck }]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.deckName).toBe('French Top 5000');
    expect(rows[0]?.front).toBe('bonjour');
  });

  it('filters by search text and deck', () => {
    const rows = buildCardBrowserRows([{ card, note, deck }]);
    expect(filterCardBrowserRows(rows, 'hello')).toHaveLength(1);
    expect(filterCardBrowserRows(rows, 'hello', 'deck-2')).toHaveLength(0);
  });

  it('sorts by due date', () => {
    const rows = buildCardBrowserRows([{ card, note, deck }]);
    expect(sortCardBrowserRows(rows, 'due', 'asc')[0]?.cardId).toBe('card-1');
  });
});
