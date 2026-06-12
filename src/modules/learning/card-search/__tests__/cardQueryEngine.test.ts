import { describe, expect, it } from 'vitest';
import { matchesCardQuery, runCardQueryIds, parseCardQuery } from '../index';

const card = {
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
};

describe('card query engine', () => {
  it('matches structured search terms', () => {
    const { query } = parseCardQuery('deck:"French Top 5000" tag:grammar hello');
    expect(matchesCardQuery(card, query)).toBe(true);
  });

  it('returns ids for matching cards', () => {
    const { query } = parseCardQuery('state:review');
    expect(runCardQueryIds([card], query)).toEqual(['card-1']);
  });
});
