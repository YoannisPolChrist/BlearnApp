import { describe, expect, it } from 'vitest';
import { getMillisecondsUntilNextLocalMidnight } from '@/modules/stats/screenTime';

describe('screen-time day boundary', () => {
  it('schedules the next refresh for the local midnight boundary', () => {
    const justBeforeMidnight = new Date(2026, 6, 13, 23, 59, 59, 500).getTime();

    expect(getMillisecondsUntilNextLocalMidnight(justBeforeMidnight)).toBe(500);
  });

  it('begins a fresh local day at 00:00 instead of carrying over the previous day', () => {
    const midnight = new Date(2026, 6, 14, 0, 0, 0, 0).getTime();

    expect(getMillisecondsUntilNextLocalMidnight(midnight)).toBe(24 * 60 * 60 * 1000);
  });
});
