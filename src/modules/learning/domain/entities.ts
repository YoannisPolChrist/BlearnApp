export type CardTemplateType = 'basic' | 'cloze';
export type LearningCardState = 'new' | 'learning' | 'review' | 'relearning' | 'suspended';
export type ReviewRating = 'again' | 'hard' | 'good' | 'easy';
export type BlockTargetType = 'app' | 'website' | 'search';
export type LearningReviewSortOrder = 'ascendingRetrievability';

export interface FsrsMemoryState {
  stability: number;
  difficulty: number;
}

export interface AnkiDeckMetadata {
  deckId: string;
  originalName: string;
  descriptionHtml?: string;
  descriptionText?: string;
  collectionCreatedAt?: number;
}

export interface AnkiFieldMetadata {
  name: string;
  value: string;
}

export interface AnkiNoteMetadata {
  noteId: string;
  modelId: string;
  modelName?: string;
  sortField?: string;
  tags: string[];
  fields: AnkiFieldMetadata[];
  noteModifiedAt?: number;
}

export interface AnkiCardMetadata {
  cardId: string;
  noteId: string;
  deckId: string;
  templateOrdinal: number;
  templateName?: string;
  queue: number;
  cardType: number;
  due: number;
  interval: number;
  factor: number;
  reps: number;
  lapses: number;
  leftCount: number;
  cardModifiedAt?: number;
  lastReviewAt?: number;
}

export interface AnkiReviewMetadata {
  reviewId: string;
  sourceCardId: string;
  ease?: number;
  interval?: number;
  lastInterval?: number;
  factor?: number;
  timeMs?: number;
  reviewType?: number;
  usn?: number;
}

export interface AnkiImportMetadata {
  deck?: AnkiDeckMetadata;
  note?: AnkiNoteMetadata;
  card?: AnkiCardMetadata;
}

export interface LearningDeck {
  id: string;
  name: string;
  description: string;
  language: string;
  tags: string[];
  cardIds: string[];
  presetId?: string;
  sourceTemplateId?: string;
  sourceType?: 'csv' | 'json' | 'manual' | 'template' | 'starter' | 'anki';
  anki?: AnkiDeckMetadata;
  createdAt: number;
  updatedAt: number;
}

export interface LearningNote {
  id: string;
  deckId: string;
  type: CardTemplateType;
  front: string;
  back: string;
  frontHtml?: string;
  backHtml?: string;
  clozeText?: string;
  expectedAnswer?: string;
  tags: string[];
  language: string;
  mediaUrl?: string;
  templateCss?: string;
  templateCardClass?: string;
  anki?: AnkiNoteMetadata;
  createdAt: number;
  updatedAt?: number;
}

export interface LearningCard {
  id: string;
  noteId: string;
  deckId: string;
  type: CardTemplateType;
  state: LearningCardState;
  dueAt: number;
  intervalDays: number;
  easeFactor: number;
  reps: number;
  lapses: number;
  stepIndex: number;
  scheduledDays?: number;
  elapsedDays?: number;
  memoryState: FsrsMemoryState | null;
  lastReviewedAt?: number;
  createdAt: number;
  updatedAt?: number;
  /** Multi-Cloze (5.1): welche {{cN::…}}-Lücke diese Karte abfragt. */
  clozeIndex?: number;
  anki?: AnkiCardMetadata;
}

export interface ReviewLog {
  id: string;
  deckId: string;
  cardId: string;
  reviewedAt: number;
  rating: ReviewRating;
  previousState: LearningCardState;
  newState: LearningCardState;
  scheduledDays: number;
  elapsedDays: number;
  wasCorrect: boolean;
  memoryStateBefore: FsrsMemoryState | null;
  memoryStateAfter: FsrsMemoryState | null;
  previousCardSnapshot?: LearningCard;
  anki?: AnkiReviewMetadata;
}

export interface LearningPreset {
  id: string;
  name: string;
  desiredRetention: number;
  fsrsParams: number[];
  newCardsPerDay: number;
  maxReviewsPerDay: number;
  reviewsBetweenNewCards: number;
  learningStepsMinutes: number[];
  relearningStepsMinutes: number[];
  reviewSortOrder: LearningReviewSortOrder;
  burySiblings: boolean;
  leechThreshold?: number;
  leechAction?: 'suspend' | 'tag';
  updatedAt?: number;
  lastOptimizerRunAt?: number;
  lastOptimizerReviewCount?: number;
}

export interface UnlockGateRule {
  sessionCreditsRequired: number;
  requiredCorrectReviews?: number;
  unlockDurationMinutes: number;
  typedAnswerMaxWords: number;
  typedAnswerEnabled: boolean;
  reviewAheadHours: number;
}

export type GateRule = UnlockGateRule;

export interface DeckAssignment {
  id: string;
  targetId: string;
  targetType: BlockTargetType;
  deckId: string;
  sessionCreditsRequired?: number;
  requiredCorrectReviews?: number;
  unlockDurationMinutes: number;
  presetId?: string;
  enabled: boolean;
  updatedAt: number;
}

function normalizeLearningTargetId(targetType: BlockTargetType, targetId: string): string {
  return targetId.trim().toLowerCase();
}

function getStableTargetHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function createDeckAssignmentId(targetType: BlockTargetType, targetId: string): string {
  const normalizedTargetId = normalizeLearningTargetId(targetType, targetId);
  const readableTargetId = normalizedTargetId
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64) || 'target';

  return `assignment_${targetType}_${readableTargetId}_${getStableTargetHash(`${targetType}:${normalizedTargetId}`)}`;
}

export interface UnlockGrant {
  id: string;
  targetId: string;
  targetType: BlockTargetType;
  grantedAt: number;
  expiresAt: number;
  sourceDeckId: string;
  sessionCreditsRequired: number;
  requiredCorrectReviews?: number;
}

export interface ImportJob {
  id: string;
  source: 'csv' | 'json' | 'manual' | 'template' | 'anki';
  filename: string;
  status: 'pending' | 'completed' | 'failed';
  importedDeckIds: string[];
  importedCardCount: number;
  createdAt: number;
  error?: string;
}

export interface TemplateImportResult {
  status: 'imported' | 'already-existed' | 'failed';
  job: ImportJob | null;
  error?: string;
}

export interface ImportableRow {
  deck: string;
  deckDescription?: string;
  front: string;
  back: string;
  frontHtml?: string;
  backHtml?: string;
  type?: CardTemplateType;
  tags?: string[] | string;
  language?: string;
  clozeText?: string;
  expectedAnswer?: string;
  mediaUrl?: string;
  templateCss?: string;
  templateCardClass?: string;
  anki?: AnkiImportMetadata;
  note?: Partial<Pick<LearningNote, 'createdAt' | 'updatedAt'>>;
  card?: Partial<Pick<
    LearningCard,
    | 'state'
    | 'dueAt'
    | 'intervalDays'
    | 'easeFactor'
    | 'reps'
    | 'lapses'
    | 'stepIndex'
    | 'scheduledDays'
    | 'elapsedDays'
    | 'memoryState'
    | 'lastReviewedAt'
    | 'createdAt'
    | 'updatedAt'
  >>;
}

export interface ImportPayload {
  decks?: Array<{
    name: string;
    description?: string;
    language?: string;
    tags?: string[];
    notes: Array<Omit<ImportableRow, 'deck' | 'deckDescription'>>;
  }>;
  notes?: ImportableRow[];
  rows?: ImportableRow[];
}

export interface ReviewResult {
  updatedCard: LearningCard;
  log: ReviewLog;
  wasCorrect: boolean;
  countedReviews: number;
}

export interface LearningOptimizerStatus {
  status: 'collecting' | 'scheduled' | 'ready';
  totalReviews: number;
  activeDays: number;
  reviewsUntilEligible: number;
  activeDaysUntilEligible: number;
  reviewsUntilScheduled: number;
  nextRunAt?: number;
}

export interface LearningDeckStats {
  totalCards: number;
  dueNowCount: number;
  dueCount: number;
  overdueCount: number;
  reviewAheadCount: number;
  newLeftToday: number;
  reviewsLeftToday: number;
  desiredRetention: number;
  nextOptimizerRunAt?: number;
  optimizerStatus: LearningOptimizerStatus['status'];
}

export interface BuildUnlockSessionQueueOptions {
  cards: LearningCard[];
  deckId?: string;
  reviewLogs?: ReviewLog[];
  preset?: LearningPreset;
  gateRule?: Partial<GateRule>;
  sessionCreditsRequired?: number;
  ignoreNewCardsLimit?: boolean;
  includeReviewAhead?: boolean;
  excludeCardIds?: Set<string>;
  now?: number;
}

export interface FeaturedDeckTemplate {
  id: string;
  title: string;
  description: string;
  language: string;
  cardCount: number;
  deckNames: string[];
  assetPath: string;
  category: string;
  highlights: string[];
  accent: 'arabic' | 'spanish' | 'italian' | 'french';
  rtl?: boolean;
  replaceExistingOnImport?: boolean;
}

export interface ClozeOccurrence {
  ordinal: number;
  answer: string;
  hint?: string;
}

export interface TemplatePreviewSource {
  type?: CardTemplateType;
  front?: string;
  back?: string;
  clozeText?: string;
  expectedAnswer?: string;
}

export interface TemplatePreview {
  type: CardTemplateType;
  front: string;
  back: string;
  clozeText?: string;
  expectedAnswer?: string;
  requiresTypedAnswer: boolean;
  clozeOccurrences: ClozeOccurrence[];
  activeClozeOrdinal?: number;
}

// Tip-Modus: ein Fehlversuch deckt die Antwort sofort auf (danach nur Nochmal/Schwer).
export const MAX_TYPED_ANSWER_ATTEMPTS = 1;
export const DEFAULT_PASSIVE_PRESET_ID = 'preset_passive';
