import { EMOTION_CATEGORIES } from '@/store/useAppStore';
import type { LearningCardState } from '@/lib/learning';

export const ALL_EMOTIONS = EMOTION_CATEGORIES.flatMap((category) => category.emotions);
export const MS_DAY = 86_400_000;

export const TIME_LABEL_FORMATTER = new Intl.DateTimeFormat('de-DE', {
  hour: '2-digit',
  minute: '2-digit',
});

export const REVIEW_TREND_LABEL_FORMATTER = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
});

export const VOCAB_STATE_ORDER: LearningCardState[] = ['new', 'learning', 'review', 'relearning'];

export const VOCAB_STATE_COLORS: Record<LearningCardState, string> = {
  new: 'hsl(var(--primary))',
  learning: 'hsl(var(--mode-learn))',
  review: 'hsl(var(--accent))',
  relearning: 'hsl(var(--warning))',
};

export const POSITIVE_EMOTION_IDS = new Set(
  EMOTION_CATEGORIES.find((category) => category.id === 'positiv')?.emotions.map((emotion) => emotion.id) ?? [],
);

export const NEGATIVE_EMOTION_IDS = new Set(
  EMOTION_CATEGORIES.find((category) => category.id === 'negativ')?.emotions.map((emotion) => emotion.id) ?? [],
);

export const RANGE_LABELS = {
  day: 'Heute',
  week: 'Woche',
  month: 'Monat',
} as const;

export const STATS_SECTION_LABELS = {
  usage: 'App-Nutzung',
  emotions: 'Stimmung',
  vocab: 'Lernen',
} as const;
