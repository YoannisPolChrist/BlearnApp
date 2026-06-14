import { describe, expect, it } from 'vitest';
import {
  isOutsideScheduleWindow,
  msUntilWindowEnd,
  resolveScheduleWindow,
} from '@/lib/scheduleWindow';

const HOUR = 60 * 60 * 1000;

describe('scheduleWindow', () => {
  describe('same-day windows', () => {
    it('treats a daytime window inclusively at the start and exclusively at the end', () => {
      const noon = new Date(2024, 0, 1, 12, 0, 0).getTime();
      expect(isOutsideScheduleWindow('08:00', '17:00', noon)).toBe(false);

      const beforeStart = new Date(2024, 0, 1, 7, 59, 0).getTime();
      expect(isOutsideScheduleWindow('08:00', '17:00', beforeStart)).toBe(true);

      const afterEnd = new Date(2024, 0, 1, 18, 0, 0).getTime();
      expect(isOutsideScheduleWindow('08:00', '17:00', afterEnd)).toBe(true);
    });
  });

  describe('overnight windows (22:00 -> 06:00)', () => {
    it('stays inside the window after midnight (regression: lock escaped at ~00:00)', () => {
      // 02:00 the next morning is squarely inside a 22:00 -> 06:00 lock.
      const afterMidnight = new Date(2024, 0, 2, 2, 0, 0).getTime();
      expect(isOutsideScheduleWindow('22:00', '06:00', afterMidnight)).toBe(false);
    });

    it('stays inside the evening portion of the window', () => {
      const lateEvening = new Date(2024, 0, 1, 23, 0, 0).getTime();
      expect(isOutsideScheduleWindow('22:00', '06:00', lateEvening)).toBe(false);
    });

    it('is outside the window once the morning end is reached', () => {
      const atEnd = new Date(2024, 0, 2, 6, 0, 0).getTime();
      expect(isOutsideScheduleWindow('22:00', '06:00', atEnd)).toBe(true);

      const midday = new Date(2024, 0, 2, 12, 0, 0).getTime();
      expect(isOutsideScheduleWindow('22:00', '06:00', midday)).toBe(true);
    });

    it('is outside the window just before the evening start', () => {
      const beforeStart = new Date(2024, 0, 1, 21, 59, 0).getTime();
      expect(isOutsideScheduleWindow('22:00', '06:00', beforeStart)).toBe(true);
    });

    it('reports the correct remaining time after midnight (regression: 28h instead of 4h)', () => {
      const afterMidnight = new Date(2024, 0, 2, 2, 0, 0).getTime();
      expect(msUntilWindowEnd('22:00', '06:00', afterMidnight)).toBe(4 * HOUR);
    });

    it('reports the correct remaining time in the evening', () => {
      const lateEvening = new Date(2024, 0, 1, 23, 0, 0).getTime();
      expect(msUntilWindowEnd('22:00', '06:00', lateEvening)).toBe(7 * HOUR);
    });

    it('resolves the window that started yesterday when now is after midnight', () => {
      const afterMidnight = new Date(2024, 0, 2, 2, 0, 0).getTime();
      const { start, end, isOvernight } = resolveScheduleWindow('22:00', '06:00', afterMidnight);
      expect(isOvernight).toBe(true);
      expect(start).toBe(new Date(2024, 0, 1, 22, 0, 0).getTime());
      expect(end).toBe(new Date(2024, 0, 2, 6, 0, 0).getTime());
    });
  });
});
