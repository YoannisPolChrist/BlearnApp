
import type {
  BlockTargetType,
  DeckAssignment,
  GateRule,
  LearningCard,
  LearningDeck,
  LearningNote,
  LearningPreset,
  ReviewLog,
  UnlockGateRule,
  UnlockGrant,
} from './entities';
import { DEFAULT_PASSIVE_PRESET_ID, createDeckAssignmentId } from './entities';
import {
  DEFAULT_LEARNING_STEPS_MINUTES,
  DEFAULT_RELEARNING_STEPS_MINUTES,
  buildLegacyEaseFactor,
  getCardMemoryState,
  getDefaultFsrsWeights,
  inferElapsedDays,
  sanitizeFsrsParams,
} from './fsrs';
import { clampNumber, roundTo } from './numbers';

function normalizeLearningTargetId(_targetType: BlockTargetType, targetId: string): string {
  return targetId.trim().toLowerCase();
}

export function clampSessionCreditsRequired(sessionCreditsRequired: number, _availableCardCount: number): number {
  const normalizedCredits = Number.isFinite(sessionCreditsRequired)
    ? Math.max(1, Math.round(sessionCreditsRequired))
    : 1;
  return normalizedCredits;
}

export function clampRequiredCorrectReviews(requiredCorrectReviews: number, availableCardCount: number): number {
  return clampSessionCreditsRequired(requiredCorrectReviews, availableCardCount);
}

export function getDefaultLearningPreset(): LearningPreset {
  return {
    id: DEFAULT_PASSIVE_PRESET_ID,
    name: 'Passive Fokus-Freischaltung',
    desiredRetention: 0.9,
    fsrsParams: getDefaultFsrsWeights(),
    newCardsPerDay: 3,
    maxReviewsPerDay: 25,
    reviewsBetweenNewCards: 15,
    learningStepsMinutes: [...DEFAULT_LEARNING_STEPS_MINUTES],
    relearningStepsMinutes: [...DEFAULT_RELEARNING_STEPS_MINUTES],
    reviewSortOrder: 'ascendingRetrievability',
    burySiblings: true,
    leechThreshold: 8,
    leechAction: 'suspend',
    updatedAt: 0,
  };
}

export function getDefaultLearningPresets(): LearningPreset[] {
  return [getDefaultLearningPreset()];
}

export function migrateLearningPreset(preset?: Partial<LearningPreset> | null): LearningPreset {
  const fallback = getDefaultLearningPreset();
  return {
    ...fallback,
    ...preset,
    id: preset?.id || fallback.id,
    name: preset?.name || fallback.name,
    desiredRetention: roundTo(clampNumber(preset?.desiredRetention ?? fallback.desiredRetention, 0.75, 0.99), 2),
    fsrsParams: sanitizeFsrsParams(preset?.fsrsParams),
    newCardsPerDay: Math.max(0, Math.round(preset?.newCardsPerDay ?? fallback.newCardsPerDay)),
    maxReviewsPerDay: Math.max(1, Math.round(preset?.maxReviewsPerDay ?? fallback.maxReviewsPerDay)),
    reviewsBetweenNewCards: Math.max(
      1,
      Math.round(preset?.reviewsBetweenNewCards ?? fallback.reviewsBetweenNewCards),
    ),
    learningStepsMinutes: (preset?.learningStepsMinutes?.length ? preset.learningStepsMinutes : fallback.learningStepsMinutes).map((step) => Math.max(1, Math.round(step))),
    relearningStepsMinutes: (preset?.relearningStepsMinutes?.length ? preset.relearningStepsMinutes : fallback.relearningStepsMinutes).map((step) => Math.max(1, Math.round(step))),
    reviewSortOrder: preset?.reviewSortOrder || fallback.reviewSortOrder,
    burySiblings: preset?.burySiblings ?? fallback.burySiblings,
    leechThreshold: preset?.leechThreshold ?? fallback.leechThreshold,
    leechAction: preset?.leechAction ?? fallback.leechAction,
    updatedAt: Number.isFinite(preset?.updatedAt) ? preset?.updatedAt : fallback.updatedAt,
    lastOptimizerRunAt: preset?.lastOptimizerRunAt,
    lastOptimizerReviewCount: preset?.lastOptimizerReviewCount,
  };
}

export function migrateLearningDeck(deck: LearningDeck): LearningDeck {
  return {
    ...deck,
    presetId: deck.presetId || DEFAULT_PASSIVE_PRESET_ID,
    anki: deck.anki
      ? {
          ...deck.anki,
          deckId: String(deck.anki.deckId),
          originalName: deck.anki.originalName || deck.name,
        }
      : undefined,
  };
}

export function migrateLearningNote(note: LearningNote): LearningNote {
  const createdAt = Number.isFinite(note.createdAt) ? note.createdAt : Date.now();
  const updatedAt = Number.isFinite(note.updatedAt)
    ? Math.max(note.updatedAt as number, createdAt)
    : createdAt;

  return {
    ...note,
    type: note.type === 'cloze' ? 'cloze' : 'basic',
    front: note.front || '',
    back: note.back || '',
    frontHtml: note.frontHtml || undefined,
    backHtml: note.backHtml || undefined,
    tags: Array.isArray(note.tags) ? Array.from(new Set(note.tags.filter(Boolean))) : [],
    language: note.language || 'de',
    mediaUrl: note.mediaUrl || undefined,
    templateCss: note.templateCss || undefined,
    templateCardClass: note.templateCardClass || undefined,
    anki: note.anki
      ? {
          ...note.anki,
          noteId: String(note.anki.noteId),
          modelId: String(note.anki.modelId),
          tags: Array.isArray(note.anki.tags) ? Array.from(new Set(note.anki.tags.filter(Boolean))) : [],
          fields: Array.isArray(note.anki.fields)
            ? note.anki.fields
                .filter((field) => field && typeof field.name === 'string')
                .map((field) => ({
                  name: field.name,
                  value: field.value || '',
                }))
            : [],
        }
      : undefined,
    createdAt,
    updatedAt,
  };
}

export function migrateLearningCard(card: LearningCard): LearningCard {
  const memoryState = getCardMemoryState(card);
  const createdAt = Number.isFinite(card.createdAt) ? card.createdAt : Date.now();
  const updatedAt = Number.isFinite(card.updatedAt)
    ? Math.max(card.updatedAt as number, createdAt)
    : Math.max(card.lastReviewedAt || 0, card.dueAt || 0, createdAt);
  return {
    ...card,
    dueAt: Number.isFinite(card.dueAt) ? card.dueAt : Date.now(),
    intervalDays: Math.max(0, Math.round(card.intervalDays || card.scheduledDays || 0)),
    easeFactor: buildLegacyEaseFactor(memoryState),
    reps: Math.max(0, Math.round(card.reps || 0)),
    lapses: Math.max(0, Math.round(card.lapses || 0)),
    stepIndex: Math.max(0, Math.round(card.stepIndex || 0)),
    scheduledDays: Math.max(0, Math.round(card.scheduledDays ?? card.intervalDays ?? 0)),
    elapsedDays: inferElapsedDays(card),
    memoryState,
    createdAt,
    updatedAt,
    anki: card.anki
      ? {
          ...card.anki,
          cardId: String(card.anki.cardId),
          noteId: String(card.anki.noteId),
          deckId: String(card.anki.deckId),
          templateOrdinal: Math.max(0, Math.round(card.anki.templateOrdinal || 0)),
          queue: Math.round(card.anki.queue || 0),
          cardType: Math.round(card.anki.cardType || 0),
          due: Math.round(card.anki.due || 0),
          interval: Math.round(card.anki.interval || 0),
          factor: Math.round(card.anki.factor || 0),
          reps: Math.max(0, Math.round(card.anki.reps || 0)),
          lapses: Math.max(0, Math.round(card.anki.lapses || 0)),
          leftCount: Math.max(0, Math.round(card.anki.leftCount || 0)),
        }
      : undefined,
  };
}

export function resolveSessionCreditsRequired(
  value?: Pick<UnlockGateRule, 'sessionCreditsRequired' | 'requiredCorrectReviews'> | Pick<DeckAssignment, 'sessionCreditsRequired' | 'requiredCorrectReviews'> | null,
  fallback = 3,
): number {
  const sessionCreditsRequired = value?.sessionCreditsRequired ?? value?.requiredCorrectReviews ?? fallback;
  return Math.max(1, Math.round(sessionCreditsRequired));
}

export function migrateGateRule(rule?: Partial<GateRule> | null, previousRuleFallback?: Partial<GateRule> | null): GateRule {
  const fallback = getDefaultGateRule();
  const sessionCreditsRequired = resolveSessionCreditsRequired(rule, fallback.sessionCreditsRequired);

  const previousRule = previousRuleFallback || rule;
  const previousSessionCredits = previousRule?.sessionCreditsRequired ?? fallback.sessionCreditsRequired;
  const previousRequired = previousRule?.requiredCorrectReviews ?? previousSessionCredits;
  const doneCredits = Math.max(0, previousSessionCredits - previousRequired);
  const requiredCorrectReviews = Math.max(0, sessionCreditsRequired - doneCredits);

  return {
    ...fallback,
    ...rule,
    sessionCreditsRequired,
    requiredCorrectReviews,
    unlockDurationMinutes: Math.max(1, Math.round(rule?.unlockDurationMinutes ?? fallback.unlockDurationMinutes)),
    typedAnswerMaxWords: Math.max(1, Math.round(rule?.typedAnswerMaxWords ?? fallback.typedAnswerMaxWords)),
    typedAnswerEnabled: rule?.typedAnswerEnabled ?? fallback.typedAnswerEnabled,
    reviewAheadHours: Math.max(1, Math.round(rule?.reviewAheadHours ?? fallback.reviewAheadHours)),
  };
}

export function migrateDeckAssignment(
  assignment: DeckAssignment,
  availableCardCount = 0,
  previousAssignmentFallback?: DeckAssignment | null,
): DeckAssignment {
  const sessionCreditsRequired = clampSessionCreditsRequired(
    resolveSessionCreditsRequired(assignment, getDefaultGateRule().sessionCreditsRequired),
    availableCardCount,
  );

  const previousAssignment = previousAssignmentFallback || assignment;
  const previousSessionCredits = previousAssignment.sessionCreditsRequired ?? getDefaultGateRule().sessionCreditsRequired;
  const previousRequired = previousAssignment.requiredCorrectReviews ?? previousSessionCredits;
  const doneCredits = Math.max(0, previousSessionCredits - previousRequired);
  const requiredCorrectReviews = Math.max(0, sessionCreditsRequired - doneCredits);

  return {
    ...assignment,
    id: assignment.id || createDeckAssignmentId(assignment.targetType, assignment.targetId),
    targetId: normalizeLearningTargetId(assignment.targetType, assignment.targetId),
    sessionCreditsRequired,
    requiredCorrectReviews,
    unlockDurationMinutes: Math.max(1, Math.round(assignment.unlockDurationMinutes || getDefaultGateRule().unlockDurationMinutes)),
    presetId: assignment.presetId,
    enabled: assignment.enabled ?? true,
  };
}

export function migrateUnlockGrant(grant: UnlockGrant, previousGrantFallback?: UnlockGrant | null): UnlockGrant {
  const sessionCreditsRequired = resolveSessionCreditsRequired(grant, getDefaultGateRule().sessionCreditsRequired);

  const previousGrant = previousGrantFallback || grant;
  const previousSessionCredits = previousGrant.sessionCreditsRequired ?? sessionCreditsRequired;
  const previousRequired = previousGrant.requiredCorrectReviews ?? previousSessionCredits;
  const doneCredits = Math.max(0, previousSessionCredits - previousRequired);
  const requiredCorrectReviews = Math.max(0, sessionCreditsRequired - doneCredits);

  return {
    ...grant,
    targetId: normalizeLearningTargetId(grant.targetType, grant.targetId),
    sessionCreditsRequired,
    requiredCorrectReviews,
  };
}

export function migrateReviewLog(log: ReviewLog): ReviewLog {
  return {
    ...log,
    scheduledDays: Math.max(0, Math.round(log.scheduledDays || 0)),
    elapsedDays: Math.max(0, Math.round(log.elapsedDays || 0)),
    memoryStateBefore: log.memoryStateBefore ? {
      stability: roundTo(Math.max(0.1, log.memoryStateBefore.stability)),
      difficulty: roundTo(clampNumber(log.memoryStateBefore.difficulty, 1, 10)),
    } : null,
    memoryStateAfter: log.memoryStateAfter ? {
      stability: roundTo(Math.max(0.1, log.memoryStateAfter.stability)),
      difficulty: roundTo(clampNumber(log.memoryStateAfter.difficulty, 1, 10)),
    } : null,
    anki: log.anki
      ? {
          ...log.anki,
          reviewId: String(log.anki.reviewId),
          sourceCardId: String(log.anki.sourceCardId),
          ease: Number.isFinite(log.anki.ease) ? Math.round(log.anki.ease as number) : undefined,
          interval: Number.isFinite(log.anki.interval) ? Math.round(log.anki.interval as number) : undefined,
          lastInterval: Number.isFinite(log.anki.lastInterval) ? Math.round(log.anki.lastInterval as number) : undefined,
          factor: Number.isFinite(log.anki.factor) ? Math.round(log.anki.factor as number) : undefined,
          timeMs: Number.isFinite(log.anki.timeMs) ? Math.round(log.anki.timeMs as number) : undefined,
          reviewType: Number.isFinite(log.anki.reviewType) ? Math.round(log.anki.reviewType as number) : undefined,
          usn: Number.isFinite(log.anki.usn) ? Math.round(log.anki.usn as number) : undefined,
        }
      : undefined,
  };
}

export function getDefaultGateRule(): GateRule {
  return {
    sessionCreditsRequired: 1,
    requiredCorrectReviews: 1,
    unlockDurationMinutes: 15,
    typedAnswerMaxWords: 3,
    typedAnswerEnabled: false,
    reviewAheadHours: 24,
  };
}
