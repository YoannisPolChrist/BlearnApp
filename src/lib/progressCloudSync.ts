import type { CheckinEntry, DailyStats, UserInteraction, UserProfile } from '@/store/appStore.types';
import { getLocalDateKey, shiftDateKey } from '@/lib/localDate';

export interface ProgressCloudState {
  checkins: CheckinEntry[];
  interactions: UserInteraction[];
}

export interface DerivedProgressState {
  checkins: CheckinEntry[];
  userProfile: UserProfile;
  dailyStats: DailyStats;
  streak: number;
  lastCheckinDate: string | null;
}

interface MoodEntry {
  timestamp: number;
  emotions: string[];
  reflection?: string;
}

function createProgressEntryId(prefix: string) {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeText(value?: string | null) {
  return typeof value === 'string' ? value.trim() : '';
}

function buildLegacyEntryId(prefix: string, parts: Array<string | number | boolean | undefined>) {
  const normalizedParts = parts
    .map((part) => (typeof part === 'boolean' ? (part ? '1' : '0') : `${part ?? ''}`.trim()))
    .filter((part) => part.length > 0)
    .join('|');

  return `${prefix}-${normalizedParts || 'legacy'}`;
}

function createDefaultUserProfile(): UserProfile {
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

function createDefaultDailyStats(): DailyStats {
  return {
    breathingSessions: 0,
    totalBreathingMinutes: 0,
    checkinsCompleted: 0,
    challengesCompleted: 0,
    pausesTaken: 0,
  };
}

function normalizeTimestamp(value: number | undefined) {
  return Number.isFinite(value) ? Math.max(0, Math.round(value as number)) : 0;
}

function normalizeStringArray(value?: string[] | null) {
  return Array.isArray(value) ? value.filter((entry) => typeof entry === 'string' && entry.length > 0) : [];
}

function normalizeCheckin(checkin: CheckinEntry): CheckinEntry {
  const id = normalizeText(checkin.id) || buildLegacyEntryId('checkin', [
    checkin.timestamp,
    ...normalizeStringArray(checkin.emotions).sort(),
    checkin.reflection,
    checkin.targetApp,
    checkin.breathingCompleted,
  ]);

  return {
    ...checkin,
    id,
    emotions: normalizeStringArray(checkin.emotions),
    reflection: checkin.reflection?.trim() || '',
    chatHistory: Array.isArray(checkin.chatHistory)
      ? checkin.chatHistory.map((message) => ({ ...message }))
      : [],
    timestamp: normalizeTimestamp(checkin.timestamp),
  };
}

function normalizeInteraction(interaction: UserInteraction): UserInteraction {
  const id = normalizeText(interaction.id) || buildLegacyEntryId('interaction', [
    interaction.timestamp,
    interaction.type,
    interaction.completed,
    ...(normalizeStringArray(interaction.emotions).sort()),
    interaction.intention,
    interaction.targetApp,
    interaction.challenge,
    interaction.durationMinutes,
  ]);

  return {
    ...interaction,
    id,
    emotions: normalizeStringArray(interaction.emotions),
    intention: interaction.intention?.trim() || undefined,
    targetApp: interaction.targetApp?.trim() || undefined,
    challenge: interaction.challenge?.trim() || undefined,
    durationMinutes: Number.isFinite(interaction.durationMinutes)
      ? Math.max(0, Math.round(interaction.durationMinutes as number))
      : undefined,
    timestamp: normalizeTimestamp(interaction.timestamp),
  };
}

function sortByTimestampDesc<T extends { timestamp: number; id: string }>(items: T[]) {
  return [...items].sort((left, right) => {
    if (right.timestamp !== left.timestamp) {
      return right.timestamp - left.timestamp;
    }

    return left.id.localeCompare(right.id);
  });
}

function mergeById<T extends { id: string; timestamp: number }>(left: T[], right: T[]) {
  const byId = new Map<string, T>();

  for (const item of [...left, ...right]) {
    const existing = byId.get(item.id);
    if (!existing || item.timestamp > existing.timestamp) {
      byId.set(item.id, item);
    }
  }

  return sortByTimestampDesc(Array.from(byId.values()));
}

function getMoodEntryKey(timestamp: number, emotions: string[], reflection?: string) {
  return `${timestamp}::${[...emotions].sort().join('|')}::${reflection?.trim() ?? ''}`;
}

function buildMoodEntries(checkins: CheckinEntry[], interactions: UserInteraction[]): MoodEntry[] {
  const moodEntries: MoodEntry[] = checkins.map((checkin) => ({
    timestamp: checkin.timestamp,
    emotions: [...checkin.emotions],
    reflection: checkin.reflection,
  }));

  const moodEntriesByKey = new Map(
    moodEntries.map((entry) => [getMoodEntryKey(entry.timestamp, entry.emotions, entry.reflection), entry]),
  );

  interactions
    .filter((interaction) => interaction.type !== 'checkin' && (interaction.emotions?.length ?? 0) > 0)
    .forEach((interaction) => {
      const interactionEmotions = [...(interaction.emotions ?? [])];
      const interactionReflection = interaction.intention;
      const key = getMoodEntryKey(interaction.timestamp, interactionEmotions, interactionReflection);
      const existingEntry = moodEntriesByKey.get(key);

      if (existingEntry) {
        if (!existingEntry.reflection && interactionReflection) {
          existingEntry.reflection = interactionReflection;
        }
        return;
      }

      const moodEntry: MoodEntry = {
        timestamp: interaction.timestamp,
        emotions: interactionEmotions,
        reflection: interactionReflection,
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

function getDateKey(timestamp: number) {
  return getLocalDateKey(timestamp);
}

function deriveStreak(checkins: CheckinEntry[]) {
  const dateSet = new Set(checkins.map((entry) => getDateKey(entry.timestamp)));
  if (dateSet.size === 0) {
    return { streak: 0, lastCheckinDate: null as string | null };
  }

  const sortedDates = [...dateSet].sort((left, right) => right.localeCompare(left));
  const lastCheckinDate = sortedDates[0] ?? null;
  if (!lastCheckinDate) {
    return { streak: 0, lastCheckinDate: null };
  }

  let currentDateKey = lastCheckinDate;
  let streak = 0;

  while (true) {
    const dateKey = currentDateKey;
    if (!dateSet.has(dateKey)) {
      break;
    }

    streak += 1;
    currentDateKey = shiftDateKey(currentDateKey, -1);
  }

  return { streak, lastCheckinDate };
}

function sumBreathingMinutes(interactions: UserInteraction[]) {
  return interactions.reduce((total, interaction) => (
    interaction.type === 'breathing' && Number.isFinite(interaction.durationMinutes)
      ? total + Math.max(0, Math.round(interaction.durationMinutes as number))
      : total
  ), 0);
}

function uniqueChallengeIds(interactions: UserInteraction[]) {
  const ids = new Set<string>();
  const ordered: string[] = [];

  [...interactions].reverse().forEach((interaction) => {
    if (interaction.type !== 'challenge' || !interaction.completed || !interaction.challenge) {
      return;
    }

    if (!ids.has(interaction.challenge)) {
      ids.add(interaction.challenge);
      ordered.push(interaction.challenge);
    }
  });

  return ordered;
}

export function normalizeProgressCloudState(input?: Partial<ProgressCloudState> | null): ProgressCloudState {
  const checkins = Array.isArray(input?.checkins)
    ? input.checkins.map((entry) => normalizeCheckin(entry as CheckinEntry))
    : [];
  const interactions = Array.isArray(input?.interactions)
    ? input.interactions.map((entry) => normalizeInteraction(entry as UserInteraction))
    : [];

  return {
    checkins: mergeById(checkins, []),
    interactions: mergeById(interactions, []),
  };
}

export function mergeProgressCloudStates(
  localState?: Partial<ProgressCloudState> | null,
  remoteState?: Partial<ProgressCloudState> | null,
): ProgressCloudState {
  const local = normalizeProgressCloudState(localState);
  const remote = normalizeProgressCloudState(remoteState);

  return {
    checkins: mergeById(local.checkins, remote.checkins),
    interactions: mergeById(local.interactions, remote.interactions),
  };
}

export function isProgressCloudStateEmpty(state?: Partial<ProgressCloudState> | null) {
  const normalized = normalizeProgressCloudState(state);
  return normalized.checkins.length === 0 && normalized.interactions.length === 0;
}

export function getProgressCloudStateSignature(state?: Partial<ProgressCloudState> | null) {
  const normalized = normalizeProgressCloudState(state);

  return JSON.stringify({
    checkins: normalized.checkins.map((entry) => ({
      id: entry.id,
      timestamp: entry.timestamp,
      emotions: entry.emotions,
      reflection: entry.reflection,
      targetApp: entry.targetApp,
      breathingCompleted: entry.breathingCompleted,
    })),
    interactions: normalized.interactions.map((entry) => ({
      id: entry.id,
      timestamp: entry.timestamp,
      type: entry.type,
      emotions: entry.emotions,
      intention: entry.intention,
      completed: entry.completed,
      targetApp: entry.targetApp,
      challenge: entry.challenge,
      durationMinutes: entry.durationMinutes,
    })),
  });
}

export function deriveProgressState(state?: Partial<ProgressCloudState> | null): DerivedProgressState {
  const normalized = normalizeProgressCloudState(state);
  const sortedCheckins = sortByTimestampDesc(normalized.checkins);
  const sortedInteractions = sortByTimestampDesc(normalized.interactions);
  const moodEntries = buildMoodEntries(sortedCheckins, sortedInteractions);
  const commonEmotions = buildEmotionCounts(moodEntries);
  const triggerTimes = Array.from(
    new Set(sortedInteractions.map((interaction) => new Date(interaction.timestamp).getHours())),
  ).sort((left, right) => left - right);
  const totalSessions = sortedInteractions.filter((interaction) => interaction.type === 'checkin').length;
  const totalChallengesCompleted = sortedInteractions.filter(
    (interaction) => interaction.type === 'challenge' && interaction.completed,
  ).length;
  const completedChallenges = uniqueChallengeIds(sortedInteractions);
  const { streak, lastCheckinDate } = deriveStreak(sortedCheckins);

  return {
    checkins: sortedCheckins,
    dailyStats: {
      breathingSessions: sortedInteractions.filter((interaction) => interaction.type === 'breathing').length,
      totalBreathingMinutes: sumBreathingMinutes(sortedInteractions),
      checkinsCompleted: totalSessions,
      challengesCompleted: totalChallengesCompleted,
      pausesTaken: sortedInteractions.filter((interaction) => interaction.type === 'pause').length,
    },
    streak,
    lastCheckinDate,
    userProfile: {
      commonEmotions,
      triggerTimes,
      recentInteractions: sortedInteractions.slice(0, 20),
      totalSessions,
      totalChallengesCompleted,
      consecutiveDays: streak,
      completedChallenges,
    },
  };
}

export function createProgressInteractionId() {
  return createProgressEntryId('interaction');
}
