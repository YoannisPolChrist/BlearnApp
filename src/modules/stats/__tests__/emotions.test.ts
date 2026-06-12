import { describe, expect, it } from 'vitest';
import { buildMoodEntries } from '@/modules/stats/emotions';
import type { CheckinEntry, UserInteraction } from '@/store/useAppStore';

function buildCheckin(overrides: Partial<CheckinEntry> = {}): CheckinEntry {
  return {
    id: '1000',
    timestamp: 1000,
    emotions: ['stressed', 'bored'],
    reflection: 'Kurz durchatmen',
    chatHistory: [],
    breathingCompleted: false,
    ...overrides,
  } as CheckinEntry;
}

function buildInteraction(overrides: Partial<UserInteraction> = {}): UserInteraction {
  return {
    timestamp: 2000,
    type: 'breathing',
    emotions: ['calm'],
    completed: true,
    ...overrides,
  } as UserInteraction;
}

describe('buildMoodEntries (Emotionstracking)', () => {
  it('includes check-ins and emotion-carrying interactions, newest first', () => {
    const entries = buildMoodEntries(
      [buildCheckin({ id: 'a', timestamp: 1000 })],
      [buildInteraction({ timestamp: 3000 })],
    );

    expect(entries).toHaveLength(2);
    expect(entries[0].timestamp).toBe(3000);
    expect(entries[0].source).toBe('breathing');
    expect(entries[1].source).toBe('checkin');
  });

  it('deduplicates a check-in mirrored as an interaction (same time, emotions, reflection)', () => {
    const checkin = buildCheckin({
      id: 'c1',
      timestamp: 5000,
      emotions: ['stressed'],
      reflection: 'Pause machen',
    });
    // Checkin.tsx writes BOTH addCheckin and addInteraction for one event;
    // the learning interaction below shares the identical key.
    const mirroredInteraction = buildInteraction({
      type: 'learning',
      timestamp: 5000,
      emotions: ['stressed'],
      intention: 'Pause machen',
    });

    const entries = buildMoodEntries([checkin], [mirroredInteraction]);

    expect(entries).toHaveLength(1);
    // The richer interaction source wins the label.
    expect(entries[0].source).toBe('learning');
    expect(entries[0].reflection).toBe('Pause machen');
  });

  it('ignores interactions without emotions and explicit checkin-type interactions', () => {
    const entries = buildMoodEntries(
      [],
      [
        buildInteraction({ type: 'breathing', emotions: [] }),
        buildInteraction({ type: 'checkin', emotions: ['happy'], timestamp: 9000 }),
      ],
    );

    // checkin-type interactions are mirrored by addCheckin and must not be
    // double-counted from the interaction stream.
    expect(entries).toHaveLength(0);
  });

  it('keeps distinct events at the same timestamp when emotions differ', () => {
    const entries = buildMoodEntries(
      [buildCheckin({ id: 'a', timestamp: 7000, emotions: ['bored'] })],
      [buildInteraction({ timestamp: 7000, emotions: ['calm'] })],
    );

    expect(entries).toHaveLength(2);
  });
});
