import type { InstalledApp, MonitoringStatus, ScreenTimeSummary } from '@/plugins/ScreenTimePlugin';
import type { Emotion, UserInteraction } from '@/store/useAppStore';

export type TimeRange = 'day' | 'week' | 'month';
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
  status: MonitoringStatus;
  installedApps: InstalledApp[];
  currentAppId: string;
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
