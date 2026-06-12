import { describe, expect, it } from 'vitest';
import { parseCardQuery, stringifyCardQuery } from '../index';

describe('card query parser', () => {
  it('parses structured tokens', () => {
    const { query } = parseCardQuery('deck:"French Top 5000" tag:grammar state:review hello');
    expect(query.filters).toHaveLength(3);
    expect(query.text).toBe('hello');
    expect(stringifyCardQuery(query)).toContain('deck:French Top 5000');
  });

  it('parses due filters and negation', () => {
    const { query } = parseCardQuery('-tag:skip due:>=7');
    expect(query.filters).toHaveLength(2);
  });
});
