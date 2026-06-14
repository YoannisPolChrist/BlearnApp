import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useEmotionStatsData } from '@/modules/stats/emotions';
import type { CheckinEntry, UserProfile } from '@/store/useAppStore';

// Verankert die Tages-Grenzen der Stimmungs-Charts. Der Bug: Bei Wochen-/Monats-
// Reichweite startete der erste Bucket bei `now - buckets * bucketMs`, wodurch
// die heutigen Check-ins komplett aus dem Diagramm fielen und alle uebrigen
// Eintraege gegenueber ihren Labels um einen Tag verschoben wurden.

const MS_DAY = 86_400_000;

function makeCheckin(id: string, timestamp: number, emotions: string[]): CheckinEntry {
  return {
    id,
    timestamp,
    emotions,
    reflection: '',
    chatHistory: [],
    breathingCompleted: false,
  };
}

function makeUserProfile(): UserProfile {
  return {
    commonEmotions: {},
    triggerTimes: [],
    recentInteractions: [],
    totalSessions: 0,
    totalChallengesCompleted: 0,
    consecutiveDays: 0,
    completedChallenges: [],
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useEmotionStatsData bucketing (day boundaries)', () => {
  it('keeps a check-in from today in the last bucket of the week range', () => {
    // Fixe Uhrzeit mitten am Tag, damit "heute" eindeutig im letzten Bucket landet.
    const now = new Date('2026-06-14T12:00:00Z').getTime();
    vi.spyOn(Date, 'now').mockReturnValue(now);

    const checkins = [makeCheckin('today', now, ['relieved'])];

    const { result } = renderHook(() => useEmotionStatsData('week', checkins, makeUserProfile()));

    // 7 Tages-Buckets, letztes Label = heute.
    expect(result.current.activityData).toHaveLength(7);
    const todayActivity = result.current.activityData[6].series.find((s) => s.key === 'activity');
    const todayCheckins = result.current.activityData[6].series.find((s) => s.key === 'checkins');
    expect(todayActivity?.value).toBe(1);
    expect(todayCheckins?.value).toBe(1);

    // Kein anderer Bucket darf den heutigen Eintrag enthalten.
    const totalActivity = result.current.activityData.reduce(
      (sum, day) => sum + (day.series.find((s) => s.key === 'activity')?.value ?? 0),
      0,
    );
    expect(totalActivity).toBe(1);

    // Positive Stimmung von heute muss ebenfalls im letzten Bucket sichtbar sein.
    const todayPositive = result.current.moodData[6].series.find((s) => s.key === 'positive');
    expect(todayPositive?.value).toBe(1);
  });

  it('places a six-day-old check-in in the first bucket of the week range', () => {
    const now = new Date('2026-06-14T12:00:00Z').getTime();
    vi.spyOn(Date, 'now').mockReturnValue(now);

    const sixDaysAgo = now - 6 * MS_DAY;
    const checkins = [makeCheckin('oldest', sixDaysAgo, ['stressed'])];

    const { result } = renderHook(() => useEmotionStatsData('week', checkins, makeUserProfile()));

    const firstActivity = result.current.activityData[0].series.find((s) => s.key === 'activity');
    expect(firstActivity?.value).toBe(1);

    const totalActivity = result.current.activityData.reduce(
      (sum, day) => sum + (day.series.find((s) => s.key === 'activity')?.value ?? 0),
      0,
    );
    expect(totalActivity).toBe(1);
  });

  it('keeps a check-in from today in the last bucket of the month range', () => {
    const now = new Date('2026-06-14T12:00:00Z').getTime();
    vi.spyOn(Date, 'now').mockReturnValue(now);

    const checkins = [makeCheckin('today', now, ['relieved'])];

    const { result } = renderHook(() => useEmotionStatsData('month', checkins, makeUserProfile()));

    expect(result.current.activityData).toHaveLength(30);
    const todayActivity = result.current.activityData[29].series.find((s) => s.key === 'activity');
    expect(todayActivity?.value).toBe(1);

    const totalActivity = result.current.activityData.reduce(
      (sum, day) => sum + (day.series.find((s) => s.key === 'activity')?.value ?? 0),
      0,
    );
    expect(totalActivity).toBe(1);
  });
});
