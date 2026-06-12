import { describe, expect, it, vi } from 'vitest';
import {
  deriveProgressState,
  getProgressCloudStateSignature,
  mergeProgressCloudStates,
  normalizeProgressCloudState,
} from '@/lib/progressCloudSync';

describe('progressCloudSync', () => {
  it('keeps legacy progress events stable across devices and deduplicates them by identity', () => {
    const timestamp = 1_700_000_000_000;
    const legacyState = normalizeProgressCloudState({
      checkins: [
        {
          timestamp,
          emotions: ['focused', 'calm'],
          reflection: '  Ich bleibe ruhig.  ',
          chatHistory: [],
          breathingCompleted: true,
          targetApp: 'com.youtube',
        } as never,
      ],
      interactions: [
        {
          timestamp,
          type: 'checkin',
          emotions: ['focused', 'calm'],
          completed: true,
        } as never,
        {
          timestamp,
          type: 'breathing',
          emotions: [],
          completed: true,
          durationMinutes: 6,
        } as never,
      ],
    });

    const merged = mergeProgressCloudStates(legacyState, {
      checkins: [{ ...legacyState.checkins[0] }],
      interactions: [{ ...legacyState.interactions[0] }],
    });

    expect(legacyState.checkins[0]?.id).toBeTruthy();
    expect(legacyState.interactions[0]?.id).toBeTruthy();
    expect(legacyState.interactions[1]?.id).toBeTruthy();
    expect(getProgressCloudStateSignature(legacyState)).toBe(getProgressCloudStateSignature(merged));
    expect(merged.checkins).toHaveLength(1);
    expect(merged.interactions).toHaveLength(2);

    const derived = deriveProgressState(merged);
    expect(derived.dailyStats.breathingSessions).toBe(1);
    expect(derived.dailyStats.totalBreathingMinutes).toBe(6);
    expect(derived.dailyStats.checkinsCompleted).toBe(1);
    expect(derived.userProfile.commonEmotions).toMatchObject({
      calm: 1,
      focused: 1,
    });
    expect(derived.streak).toBe(1);
    expect(derived.lastCheckinDate).toBe('2023-11-14');
  });

  it('derives streak dates from the local timezone instead of UTC day boundaries', () => {
    const timezoneSpy = vi.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValue(-60);
    const timestamp = Date.parse('2023-11-14T23:30:00Z');

    const derived = deriveProgressState({
      checkins: [
        {
          id: 'checkin-local-midnight',
          timestamp,
          emotions: ['calm'],
          reflection: 'still counts for today',
          chatHistory: [],
          breathingCompleted: true,
        } as never,
      ],
      interactions: [
        {
          id: 'interaction-local-midnight',
          timestamp,
          type: 'checkin',
          emotions: ['calm'],
          completed: true,
        } as never,
      ],
    });

    expect(derived.lastCheckinDate).toBe('2023-11-15');
    expect(derived.streak).toBe(1);

    timezoneSpy.mockRestore();
  });
});
