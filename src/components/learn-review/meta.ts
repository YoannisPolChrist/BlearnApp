import { type LearningCardState, type ReviewRating } from '@/lib/learning';
import { tonePalettes } from '@/lib/semanticTones';

export const ratingMeta: Record<
  ReviewRating,
  {
    label: string;
    accent: string;
    stripe: string;
  }
> = {
  again: {
    label: 'Again',
    accent: tonePalettes.destructive.badge,
    stripe: 'bg-destructive',
  },
  hard: {
    label: 'Hard',
    accent: tonePalettes.warning.badge,
    stripe: 'bg-[hsl(var(--warning))]',
  },
  good: {
    label: 'Good',
    accent: tonePalettes.success.badge,
    stripe: 'bg-success',
  },
  easy: {
    label: 'Easy',
    accent: tonePalettes.primary.badge,
    stripe: 'bg-primary',
  },
};

export const stateMeta: Record<LearningCardState, { label: string; tone: string }> = {
  new: {
    label: 'Neu',
    tone: tonePalettes.learn.badge,
  },
  learning: {
    label: 'Im Aufbau',
    tone: tonePalettes.learn.badge,
  },
  review: {
    label: 'Wiederholung',
    tone: tonePalettes.destructive.badge,
  },
  relearning: {
    label: 'Zurück im Fokus',
    tone: tonePalettes.warning.badge,
  },
};
