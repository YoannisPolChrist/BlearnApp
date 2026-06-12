
import {
  type Card as FsrsCard,
  Rating,
  State,
  checkParameters,
  createEmptyCard,
  default_w,
  fsrs,
  generatorParameters,
} from 'ts-fsrs';
import type { FsrsMemoryState, LearningCard, LearningCardState, LearningPreset, ReviewRating } from './entities';
import { clampNumber, roundTo } from './numbers';

export const DEFAULT_LEARNING_STEPS_MINUTES = [1, 10];
export const DEFAULT_RELEARNING_STEPS_MINUTES = [10];
const DEFAULT_OPTIMIZER_MIN_REVIEWS = 300;
const DEFAULT_OPTIMIZER_MIN_ACTIVE_DAYS = 14;
const DEFAULT_OPTIMIZER_INTERVAL_DAYS = 30;
const DEFAULT_OPTIMIZER_NEW_REVIEWS = 500;
const schedulerCache = new Map<string, ReturnType<typeof fsrs>>();
const featuredDeckTemplateRowsCache = new Map<string, Promise<ImportableRow[]>>();
let unlockSessionScopeCache:
  | {
      cardsRef: LearningCard[];
      reviewLogsRef: ReviewLog[];
      deckId?: string;
      normalizedCards: LearningCard[];
      resolvedDeckId?: string;
      scopedCards: LearningCard[];
      scopedReviewLogs: ReviewLog[];
      scopedNewCards: LearningCard[];
    }
  | null = null;
const FEATURED_DECK_TEMPLATES: FeaturedDeckTemplate[] = [
  {
    id: 'arabic-top-5000',
    title: 'Arabic Top 5000',
    description: 'Frequenzsortierter Kernwortschatz für modernes Arabisch mit RTL-freundlichem Deck.',
    language: 'ar',
    cardCount: 5281,
    deckNames: ['Arabic Top 5000'],
    assetPath: 'learn-templates/arabic-top-5000.json',
    category: 'Frequenzliste',
    highlights: ['5.281 Karten', 'RTL-Deck', 'Top-5000 Reihenfolge'],
    accent: 'arabic',
    rtl: true,
  },
  {
    id: 'spanish-top-5000',
    title: 'Spanish Top 5000',
    description: 'Alltagsnaher Spanisch-Wortschatz für Reise, Medien und tägliche Konversation.',
    language: 'es',
    cardCount: 5000,
    deckNames: ['Spanish Top 5000'],
    assetPath: 'learn-templates/spanish-top-5000.json',
    category: 'Alltag + Reise',
    highlights: ['5.000 Karten', 'hohe Abdeckung', 'schneller Reise-Start'],
    accent: 'spanish',
  },
  {
    id: 'italian-top-5000',
    title: 'Italian Top 5000',
    description: 'Häufigste italienische Wörter für Lesen, Reisen und natürliche Gespräche.',
    language: 'it',
    cardCount: 4998,
    deckNames: ['Italian Top 5000'],
    assetPath: 'learn-templates/italian-top-5000.json',
    category: 'Lesen + Gespräch',
    highlights: ['4.998 Karten', 'häufige Begriffe', 'kompakter Import'],
    accent: 'italian',
  },
  {
    id: 'french-top-5000',
    title: 'French Top 5000',
    description: 'Französisch-Deutsch Kernvokabeln aus einer grammatiknahen 5000er-Quelle.',
    language: 'fr',
    cardCount: 5000,
    deckNames: ['French Top 5000'],
    assetPath: 'learn-templates/french-top-5000.json',
    category: 'Wortschatz + Grammatik',
    highlights: ['5.000 Karten', 'DE Bedeutungen', 'leichtes Standard-Deck'],
    accent: 'french',
  },
  {
    id: 'jean-paul',
    title: 'Jean Paul 2.0',
    description: 'Aktueller Jean-Paul-Stand aus der neuen APKG inklusive echter Review-Timestamps.',
    language: 'fr',
    cardCount: 3251,
    deckNames: ['Jean Paul', 'Jean-Paul'],
    assetPath: 'learn-templates/jean-paul.json',
    category: 'Persoenliches Deck',
    highlights: ['3.251 Karten', 'Jean Paul 2.0', 'Review-Historie enthalten'],
    accent: 'french',
    replaceExistingOnImport: true,
  },
];

function createId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function toStepUnits(minutes: number[]): Array<`${number}m`> {
  return minutes.map((value) => `${Math.max(1, Math.round(value))}m`);
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundTo(value: number, digits = 3): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function toFsrsState(state: LearningCardState): State {
  switch (state) {
    case 'learning':
      return State.Learning;
    case 'review':
      return State.Review;
    case 'relearning':
      return State.Relearning;
    case 'suspended':
      return State.New;
    default:
      return State.New;
  }
}

function fromFsrsState(state: State): LearningCardState {
  switch (state) {
    case State.Learning:
      return 'learning';
    case State.Review:
      return 'review';
    case State.Relearning:
      return 'relearning';
    default:
      return 'new';
  }
}

export function toFsrsRating(rating: ReviewRating): Rating {
  switch (rating) {
    case 'again':
      return Rating.Again;
    case 'hard':
      return Rating.Hard;
    case 'easy':
      return Rating.Easy;
    default:
      return Rating.Good;
  }
}

export function sanitizeFsrsParams(params?: number[]): number[] {
  const fallback = Array.from(default_w);
  const candidate = params && params.length > 0 ? params : fallback;

  try {
    return Array.from(checkParameters(candidate));
  } catch {
    return fallback;
  }
}

function buildSchedulerKey(preset: LearningPreset): string {
  return JSON.stringify({
    desiredRetention: preset.desiredRetention,
    fsrsParams: preset.fsrsParams,
    learningStepsMinutes: preset.learningStepsMinutes,
    relearningStepsMinutes: preset.relearningStepsMinutes,
  });
}

export function getFsrsScheduler(preset: LearningPreset) {
  const key = buildSchedulerKey(preset);
  const cached = schedulerCache.get(key);
  if (cached) {
    return cached;
  }

  const scheduler = fsrs(generatorParameters({
    request_retention: clampNumber(preset.desiredRetention, 0.75, 0.99),
    w: sanitizeFsrsParams(preset.fsrsParams),
    enable_fuzz: true,
    enable_short_term: true,
    learning_steps: toStepUnits(preset.learningStepsMinutes),
    relearning_steps: toStepUnits(preset.relearningStepsMinutes),
  }));

  schedulerCache.set(key, scheduler);
  return scheduler;
}

export function getCardMemoryState(card: LearningCard): FsrsMemoryState | null {
  if (card.memoryState) {
    return {
      stability: roundTo(Math.max(0.1, card.memoryState.stability)),
      difficulty: roundTo(clampNumber(card.memoryState.difficulty, 1, 10)),
    };
  }

  if (card.state === 'new') {
    return null;
  }

  const stability = Math.max(0.1, card.intervalDays || card.scheduledDays || 0.1);
  const legacyEase = Number.isFinite(card.easeFactor) ? card.easeFactor : 2.5;
  const difficulty = clampNumber(11 - legacyEase * 2.5, 1, 10);
  return {
    stability: roundTo(stability),
    difficulty: roundTo(difficulty),
  };
}

export function buildLegacyEaseFactor(memoryState: FsrsMemoryState | null): number {
  if (!memoryState) {
    return 2.5;
  }

  return roundTo(clampNumber(3.6 - memoryState.difficulty * 0.18, 1.3, 3.0), 2);
}

export function inferElapsedDays(card: LearningCard, now = Date.now()): number {
  if (typeof card.elapsedDays === 'number' && Number.isFinite(card.elapsedDays)) {
    return Math.max(0, Math.round(card.elapsedDays));
  }

  if (!card.lastReviewedAt) {
    return 0;
  }

  return Math.max(0, Math.round((now - card.lastReviewedAt) / (24 * 60 * 60 * 1000)));
}

export function toFsrsCard(card: LearningCard, now = Date.now()): FsrsCard {
  const empty = createEmptyCard(card.lastReviewedAt || card.createdAt || now);
  const memoryState = getCardMemoryState(card);

  return {
    ...empty,
    due: new Date(card.dueAt || now),
    stability: memoryState?.stability ?? empty.stability,
    difficulty: memoryState?.difficulty ?? empty.difficulty,
    elapsed_days: inferElapsedDays(card, now),
    scheduled_days: Math.max(0, Math.round(card.scheduledDays ?? card.intervalDays ?? 0)),
    learning_steps: Math.max(0, Math.round(card.stepIndex || 0)),
    reps: Math.max(0, Math.round(card.reps || 0)),
    lapses: Math.max(0, Math.round(card.lapses || 0)),
    state: toFsrsState(card.state),
    last_review: card.lastReviewedAt ? new Date(card.lastReviewedAt) : empty.last_review,
  };
}

export function fromFsrsCard(card: LearningCard, nextCard: FsrsCard): LearningCard {
  const memoryState =
    nextCard.state === State.New
      ? null
      : {
          stability: roundTo(Math.max(0.1, nextCard.stability)),
          difficulty: roundTo(clampNumber(nextCard.difficulty, 1, 10)),
        };

  return {
    ...card,
    state: fromFsrsState(nextCard.state),
    dueAt: nextCard.due.getTime(),
    intervalDays: Math.max(0, Math.round(nextCard.scheduled_days)),
    easeFactor: buildLegacyEaseFactor(memoryState),
    reps: nextCard.reps,
    lapses: nextCard.lapses,
    stepIndex: nextCard.learning_steps,
    scheduledDays: Math.max(0, Math.round(nextCard.scheduled_days)),
    elapsedDays: Math.max(0, Math.round(nextCard.elapsed_days)),
    memoryState,
    lastReviewedAt: nextCard.last_review?.getTime(),
    updatedAt: nextCard.last_review?.getTime() || card.updatedAt || card.lastReviewedAt || card.createdAt,
  };
}

export function getDefaultFsrsWeights(): number[] {
  return Array.from(default_w);
}
