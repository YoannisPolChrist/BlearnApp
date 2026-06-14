import { useMemo } from 'react';
import type { CheckinEntry, UserInteraction, UserProfile } from '@/store/useAppStore';
import { ALL_EMOTIONS, MS_DAY, NEGATIVE_EMOTION_IDS, POSITIVE_EMOTION_IDS } from './constants';
import type { EmotionCountEntry, MoodEntry, TimeRange, TopEmotion } from './types';

export function buildMoodEntries(checkins: CheckinEntry[], interactions: UserInteraction[]): MoodEntry[] {
  const getMoodEntryKey = (timestamp: number, emotions: string[], reflection?: string) =>
    `${timestamp}::${[...emotions].sort().join('|')}::${reflection?.trim() ?? ''}`;
  const moodEntries: MoodEntry[] = checkins.map((checkin) => ({
    id: checkin.id,
    timestamp: checkin.timestamp,
    emotions: checkin.emotions ?? [],
    reflection: checkin.reflection,
    source: 'checkin' as const,
  }));
  const moodEntriesByKey = new Map(
    moodEntries.map((entry) => [getMoodEntryKey(entry.timestamp, entry.emotions, entry.reflection), entry]),
  );

  interactions
    .filter((interaction) => interaction.type !== 'checkin' && (interaction.emotions?.length ?? 0) > 0)
    .forEach((interaction, index) => {
      const interactionEmotions = interaction.emotions ?? [];
      const interactionReflection = interaction.intention;
      const key = getMoodEntryKey(interaction.timestamp, interactionEmotions, interactionReflection);
      const existingEntry = moodEntriesByKey.get(key);

      if (existingEntry) {
        existingEntry.source = interaction.type;
        if (!existingEntry.reflection && interactionReflection) {
          existingEntry.reflection = interactionReflection;
        }
        return;
      }

      const moodEntry: MoodEntry = {
        id: `interaction-${interaction.type}-${interaction.timestamp}-${index}`,
        timestamp: interaction.timestamp,
        emotions: interactionEmotions,
        reflection: interactionReflection,
        source: interaction.type,
      };
      moodEntries.push(moodEntry);
      moodEntriesByKey.set(key, moodEntry);
    });

  return moodEntries.sort((left, right) => right.timestamp - left.timestamp);
}

function buildEmotionCounts(entries: MoodEntry[]) {
  return entries.reduce<Record<string, number>>((counts, entry) => {
    entry.emotions.forEach((emotionId) => {
      counts[emotionId] = (counts[emotionId] ?? 0) + 1;
    });
    return counts;
  }, {});
}

export function getMoodEntrySourceLabel(source: MoodEntry['source']) {
  if (source === 'learning') {
    return 'Lernsession';
  }

  if (source === 'challenge') {
    return 'Challenge';
  }

  if (source === 'breathing') {
    return 'Atmung';
  }

  if (source === 'pause') {
    return 'Pause';
  }

  return 'Check-in';
}

function useChartData(
  range: TimeRange,
  checkins: CheckinEntry[],
  interactions: UserInteraction[],
  emotionCounts: Record<string, number>,
) {
  return useMemo(() => {
    const now = Date.now();

    let labels: string[] = [];
    let buckets: number;
    let bucketMs: number;

    if (range === 'day') {
      buckets = 24;
      bucketMs = 3_600_000;
      labels = Array.from({ length: 24 }, (_, index) => `${index.toString().padStart(2, '0')}:00`);
    } else if (range === 'week') {
      buckets = 7;
      bucketMs = MS_DAY;
      const days = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
      labels = Array.from({ length: 7 }, (_, index) => {
        const date = new Date(now - (6 - index) * MS_DAY);
        return days[date.getDay()];
      });
    } else {
      buckets = 30;
      bucketMs = MS_DAY;
      labels = Array.from({ length: 30 }, (_, index) => {
        const date = new Date(now - (29 - index) * MS_DAY);
        return `${date.getDate()}.${date.getMonth() + 1}`;
      });
    }

    // Wochen-/Monats-Buckets sind tagesweise an die Labels gebunden: Label[0] =
    // (buckets - 1) Tage zurueck, letztes Label = heute. Der Startpunkt muss daher
    // `now - (buckets - 1) * bucketMs` sein – andernfalls fallen die heutigen
    // Eintraege in einen nicht existierenden Bucket (Index === buckets) und alle
    // uebrigen Eintraege landen einen Tag neben ihrem Label.
    const startTime =
      range === 'day'
        ? new Date().setHours(0, 0, 0, 0)
        : now - (buckets - 1) * bucketMs;
    const checkinCounts = new Array<number>(buckets).fill(0);
    const interactionCounts = new Array<number>(buckets).fill(0);
    const positiveMoodCounts = new Array<number>(buckets).fill(0);
    const negativeMoodCounts = new Array<number>(buckets).fill(0);

    for (const entry of checkins) {
      const bucketIndex = Math.floor((entry.timestamp - startTime) / bucketMs);
      if (bucketIndex < 0 || bucketIndex >= buckets) {
        continue;
      }

      checkinCounts[bucketIndex] += 1;
      for (const emotionId of entry.emotions ?? []) {
        if (POSITIVE_EMOTION_IDS.has(emotionId)) {
          positiveMoodCounts[bucketIndex] += 1;
        }
        if (NEGATIVE_EMOTION_IDS.has(emotionId)) {
          negativeMoodCounts[bucketIndex] += 1;
        }
      }
    }

    for (const interaction of interactions) {
      const bucketIndex = Math.floor((interaction.timestamp - startTime) / bucketMs);
      if (bucketIndex < 0 || bucketIndex >= buckets) {
        continue;
      }

      interactionCounts[bucketIndex] += 1;

      if (interaction.type === 'checkin') {
        continue;
      }

      for (const emotionId of interaction.emotions ?? []) {
        if (POSITIVE_EMOTION_IDS.has(emotionId)) {
          positiveMoodCounts[bucketIndex] += 1;
        }
        if (NEGATIVE_EMOTION_IDS.has(emotionId)) {
          negativeMoodCounts[bucketIndex] += 1;
        }
      }
    }

    const activityData = labels.map((label, index) => {
      const checkinCount = checkinCounts[index] ?? 0;
      const interactionCount = interactionCounts[index] ?? 0;

      return {
        label,
        series: [
          { key: 'activity', label: 'Aktivität', value: checkinCount + interactionCount, color: 'hsl(183 58% 46%)' },
          { key: 'checkins', label: 'Check-ins', value: checkinCount, color: 'hsl(40 78% 52%)' },
        ] as const,
      };
    });

    const emotionRadar = (Object.entries(emotionCounts) as EmotionCountEntry[])
      .sort(([, left], [, right]) => right - left)
      .slice(0, 8)
      .map(([id, count]) => {
        const emotion = ALL_EMOTIONS.find((entry) => entry.id === id);
        return { label: emotion?.label || id, value: count };
      });

    const moodData = labels.map((label, index) => {
      return {
        label,
        series: [
          {
            key: 'positive',
            label: 'Positiv',
            value: positiveMoodCounts[index] ?? 0,
            color: 'hsl(165 42% 42%)',
          },
          {
            key: 'negative',
            label: 'Negativ',
            value: negativeMoodCounts[index] ?? 0,
            color: 'hsl(6 55% 50%)',
          },
        ] as const,
      };
    });

    return { activityData, emotionRadar, moodData };
  }, [checkins, emotionCounts, interactions, range]);
}

export function useEmotionStatsData(range: TimeRange, checkins: CheckinEntry[], userProfile: UserProfile) {
  const recentInteractions = userProfile.recentInteractions ?? [];
  const moodEntries = useMemo(
    () => buildMoodEntries(checkins, recentInteractions),
    [checkins, recentInteractions],
  );
  const derivedEmotionCounts = useMemo(() => buildEmotionCounts(moodEntries), [moodEntries]);
  const emotionCounts = useMemo(() => {
    const counts = { ...(userProfile.commonEmotions ?? {}) };

    Object.entries(derivedEmotionCounts).forEach(([emotionId, count]) => {
      counts[emotionId] = Math.max(counts[emotionId] ?? 0, count);
    });

    return counts;
  }, [derivedEmotionCounts, userProfile.commonEmotions]);
  const chartData = useChartData(range, checkins, recentInteractions, emotionCounts);

  const topEmotions = useMemo(() => {
    return (Object.entries(emotionCounts) as EmotionCountEntry[])
      .sort(([, left], [, right]) => right - left)
      .slice(0, 4)
      .map<TopEmotion>(([id, count]) => {
        const emotion = ALL_EMOTIONS.find((entry) => entry.id === id);
        return emotion ? { ...emotion, count } : { id, emoji: '*', label: id, count };
      });
  }, [emotionCounts]);

  return {
    ...chartData,
    maxCount: topEmotions.length > 0 ? topEmotions[0].count : 1,
    recentMoodEntries: moodEntries.slice(0, 3),
    topEmotions,
  };
}
