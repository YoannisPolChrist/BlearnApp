import type { InstalledApp, ScreenTimeSummary } from '@/plugins/ScreenTimePlugin';
import type { Emotion, UserInteraction } from '@/store/useAppStore';

export type TimeRange = 'day' | 'week' | 'month' | 'total';
export type StatsSection = 'usage' | 'emotions' | 'vocab';
export type EmotionCountEntry = [string, number];
export type TopEmotion = Emotion & { count: number };

export type MoodEntry = {
  id: string;
  timestamp: number;
  emotions: string[];
  reflection?: string;
  source: 'checkin' | Exclude<UserInteraction['type'], 'checkin'>;
};

export type ScreenSnapshot = {
  usage: ScreenTimeSummary;
  installedApps: InstalledApp[];
  loadedAt: number;
};

export type VocabDeckComparisonDatum = {
  label: string;
  series: Array<{
    key: string;
    label: string;
    value: number;
    color: string;
  }>;
};
