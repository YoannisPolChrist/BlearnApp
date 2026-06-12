import { beforeEach, describe, expect, it } from 'vitest';
import { createDefaultStrictAddonMap } from '@/lib/targetModes';
import { useModeDraftStore } from '@/store/useModeDraftStore';

describe('useModeDraftStore', () => {
  beforeEach(() => {
    useModeDraftStore.setState(useModeDraftStore.getInitialState(), true);
  });

  it('normalizes and deduplicates snapshot data before saving', () => {
    const strictAddons = createDefaultStrictAddonMap();
    strictAddons.learn = {
      ...strictAddons.learn,
      enabled: true,
      startTime: ' 07:30 ',
      endTime: ' 12:30 ',
    };

    useModeDraftStore.getState().saveSnapshot({
      selectedMode: 'learn',
      strictAddons,
      startTime: ' 08:00 ',
      endTime: ' 17:00 ',
      breathingRounds: 2.4,
      interventionInterval: 19.6,
      activeDeckId: 'deck-1',
      sessionCreditsRequired: 5,
      unlockDurationMinutes: 15,
      interventionPatternId: ' box ',
      blocking: {
        blockedApps: [' APP ', 'app', ''],
        blockedAppModes: {
          ' APP ': 'learn',
        },
        blockedWebsites: [' Example.com ', 'example.com'],
        blockedWebsiteModes: {
          ' Example.com ': 'penalty',
        },
        blockedSearchTerms: [' Search Term ', 'search term'],
        blockedSearchTermModes: {
          ' Search Term ': 'strict',
        },
        blockSchedules: {
          ' APP ': { from: ' 08:00 ', to: ' 17:00 ' },
          ' ': { from: '09:00', to: '10:00' },
        },
      },
      penaltyReadyConfirmed: true,
    });

    const snapshot = useModeDraftStore.getState().snapshot;

    expect(snapshot).not.toBeNull();
    expect(snapshot).toMatchObject({
      startTime: '08:00',
      endTime: '17:00',
      breathingRounds: 2,
      interventionInterval: 20,
      activeDeckId: 'deck-1',
      sessionCreditsRequired: 5,
      unlockDurationMinutes: 15,
      interventionPatternId: 'box',
      strictAddons: expect.objectContaining({
        learn: expect.objectContaining({
          enabled: true,
          startTime: '07:30',
          endTime: '12:30',
        }),
      }),
      penaltyReadyConfirmed: true,
    });
    expect(snapshot?.blocking.blockedApps).toEqual(['app']);
    expect(snapshot?.blocking.blockedWebsites).toEqual(['example.com']);
    expect(snapshot?.blocking.blockedSearchTerms).toEqual(['search term']);
    expect(snapshot?.blocking.blockSchedules).toEqual({ app: { from: '08:00', to: '17:00' } });
  });
});
