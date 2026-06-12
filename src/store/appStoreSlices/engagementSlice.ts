import { shiftDateKey } from '@/lib/localDate';
import { createProgressInteractionId } from '@/lib/progressCloudSync';
import type { AppState, UserInteraction, UserProfile } from '@/store/appStore.types';
import {
  type AppStoreSlice,
  defaultProfile,
  getToday,
} from '@/store/appStore.shared';

const MAX_RECENT_INTERACTIONS = 20;

function recordUserInteraction(profile: UserProfile, interaction: UserInteraction): UserProfile {
  const nextInteraction: UserInteraction = {
    ...interaction,
    id: interaction.id?.trim() || createProgressInteractionId(),
  };
  const nextProfile = { ...profile };
  nextProfile.recentInteractions = [nextInteraction, ...nextProfile.recentInteractions].slice(0, MAX_RECENT_INTERACTIONS);

  if (nextInteraction.emotions?.length) {
    nextInteraction.emotions.forEach((emotion) => {
      nextProfile.commonEmotions = {
        ...nextProfile.commonEmotions,
        [emotion]: (nextProfile.commonEmotions[emotion] || 0) + 1,
      };
    });
  }

  const hour = new Date(nextInteraction.timestamp).getHours();
  if (!nextProfile.triggerTimes.includes(hour)) {
    nextProfile.triggerTimes = [...nextProfile.triggerTimes, hour];
  }

  if (nextInteraction.type === 'checkin') {
    nextProfile.totalSessions += 1;
  }

  if (nextInteraction.type === 'challenge' && nextInteraction.completed) {
    nextProfile.totalChallengesCompleted += 1;
    if (nextInteraction.challenge) {
      nextProfile.completedChallenges = [...nextProfile.completedChallenges, nextInteraction.challenge];
    }
  }

  return nextProfile;
}

export const createEngagementSlice: AppStoreSlice<Partial<AppState>> = (set, get) => ({
  dailyStats: {
    breathingSessions: 0,
    totalBreathingMinutes: 0,
    checkinsCompleted: 0,
    challengesCompleted: 0,
    pausesTaken: 0,
  },
  incrementBreathingSessions: (minutes) =>
    set((state) => {
      const timestamp = Date.now();
      const breathingInteraction: UserInteraction = {
        timestamp,
        type: 'breathing',
        completed: true,
        durationMinutes: minutes,
      };

      return {
        dailyStats: {
          ...state.dailyStats,
          breathingSessions: state.dailyStats.breathingSessions + 1,
          totalBreathingMinutes: state.dailyStats.totalBreathingMinutes + minutes,
        },
        userProfile: recordUserInteraction(state.userProfile, breathingInteraction),
      };
    }),
  incrementCheckins: () =>
    set((state) => ({
      dailyStats: { ...state.dailyStats, checkinsCompleted: state.dailyStats.checkinsCompleted + 1 },
    })),
  incrementChallenges: () =>
    set((state) => ({
      dailyStats: { ...state.dailyStats, challengesCompleted: state.dailyStats.challengesCompleted + 1 },
    })),
  incrementPauses: () =>
    set((state) => ({
      dailyStats: { ...state.dailyStats, pausesTaken: state.dailyStats.pausesTaken + 1 },
    })),

  userProfile: defaultProfile,
  addInteraction: (interaction) => {
    set((state) => {
      return { userProfile: recordUserInteraction(state.userProfile, interaction) };
    });
  },
  resetProfile: () => set({ userProfile: defaultProfile }),

  checkins: [],
  addCheckin: (entry) => set((state) => ({ checkins: [entry, ...state.checkins].slice(0, 100) })),

  selectedPattern: 'box',
  setSelectedPattern: (id) => set({ selectedPattern: id }),

  streak: 0,
  lastCheckinDate: null,
  updateStreak: () => {
    const today = getToday();
    const { lastCheckinDate, streak } = get();
    if (lastCheckinDate === today) return;
    const yesterdayStr = shiftDateKey(today, -1);
    const newStreak = lastCheckinDate === yesterdayStr ? streak + 1 : 1;
    set({ streak: newStreak, lastCheckinDate: today });
  },
});
