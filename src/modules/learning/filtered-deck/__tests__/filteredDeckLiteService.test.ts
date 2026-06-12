import { describe, expect, it } from 'vitest';
import { parseCardQuery } from '@/modules/learning/card-search';
import { previewFilteredDeckLite, runFilteredDeckLite } from '../index';

const cards = [
  {
    cardId: 'card-1',
    deckId: 'deck-1',
    deckName: 'French Top 5000',
    front: 'bonjour',
    back: 'hello',
    tags: ['grammar'],
    state: 'review' as const,
    dueAt: 10,
    intervalDays: 7,
    suspended: false,
  },
  {
    cardId: 'card-2',
    deckId: 'deck-1',
    deckName: 'French Top 5000',
    front: 'merci',
    back: 'thanks',
    tags: ['daily'],
    state: 'new' as const,
    dueAt: 0,
    intervalDays: 0,
    suspended: false,
  },
];

describe('filtered deck lite service', () => {
  it('previews queue counts', () => {
    const definition = {
      id: 'fd-1',
      name: 'Grammar Deck',
      primaryQuery: parseCardQuery('tag:grammar').query,
      limit: 5,
      reschedule: true,
      allowEmpty: true,
    };
    expect(previewFilteredDeckLite(definition, cards).matchedCount).toBe(1);
  });

  it('runs a filtered deck and caps results', () => {
    const definition = {
      id: 'fd-1',
      name: 'Grammar Deck',
      primaryQuery: parseCardQuery('deck:"French Top 5000"').query,
      secondaryQuery: parseCardQuery('tag:daily').query,
      limit: 1,
      reschedule: false,
      allowEmpty: true,
    };
    const run = runFilteredDeckLite(definition, cards, 123);
    expect(run.queueCardIds).toHaveLength(1);
    expect(run.runAt).toBe(123);
  });
});
