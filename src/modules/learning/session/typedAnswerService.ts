import {
  MAX_TYPED_ANSWER_ATTEMPTS,
  getTypedAnswerMatchKind,
  getAnswerWordCount,
  shouldRequireTypedAnswer,
  type TypedAnswerMatchKind,
} from '@/lib/learning';
import type { LearningCard, LearningNote } from '@/lib/learning';

const TYPE_DIRECTIVE_PATTERN = /\[\[type:([^\]]+?)\]\]/gi;

export interface TypedAnswerDirective {
  field: 'front' | 'back' | 'clozeText' | 'expectedAnswer';
  value: string;
}

export interface TypedAnswerEvaluation {
  correct: boolean;
  attemptsLeft: number;
  attemptCount: number;
  autoReveal: boolean;
  hasDirective: boolean;
  matchKind: TypedAnswerMatchKind;
  message: string | null;
}

export interface TypedAnswerEvaluationOptions {
  maxAttempts?: number;
  typedAnswerEnabled?: boolean;
  typedAnswerMaxWords?: number;
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

export function normalizeAnswer(value: string) {
  return normalizeWhitespace(value)
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
}

export function extractTypedAnswerDirectives(note: LearningNote | undefined): TypedAnswerDirective[] {
  if (!note) {
    return [];
  }

  const entries: Array<[TypedAnswerDirective['field'], string | undefined]> = [
    ['front', note.front],
    ['back', note.back],
    ['clozeText', note.clozeText],
    ['expectedAnswer', note.expectedAnswer],
  ];
  const directives: TypedAnswerDirective[] = [];

  for (const [field, value] of entries) {
    if (!value) {
      continue;
    }

    const matches = value.matchAll(TYPE_DIRECTIVE_PATTERN);
    for (const match of matches) {
      if (match[1]) {
        directives.push({
          field,
          value: normalizeWhitespace(match[1]),
        });
      }
    }
  }

  return directives;
}

export function hasTypedAnswerDirective(note: LearningNote | undefined): boolean {
  return extractTypedAnswerDirectives(note).length > 0;
}

export function evaluateTypedAnswer(
  card: LearningCard,
  note: LearningNote | undefined,
  answer: string,
  options: TypedAnswerEvaluationOptions = {},
): TypedAnswerEvaluation {
  const maxAttempts = Math.max(1, options.maxAttempts ?? MAX_TYPED_ANSWER_ATTEMPTS);
  const typedAnswerEnabled = options.typedAnswerEnabled ?? true;
  const typedAnswerMaxWords = options.typedAnswerMaxWords ?? 3;
  const hasDirective = hasTypedAnswerDirective(note);
  const requiresTypedAnswer =
    hasDirective || shouldRequireTypedAnswer(card, note, typedAnswerMaxWords, typedAnswerEnabled);
  const matchKind = requiresTypedAnswer ? getTypedAnswerMatchKind(card, note, answer) : 'exact';
  const correct = matchKind !== 'incorrect';
  const attemptCount = correct ? 0 : 1;
  const attemptsLeft = Math.max(0, maxAttempts - attemptCount);

  return {
    correct,
    attemptsLeft,
    attemptCount,
    autoReveal: requiresTypedAnswer && !correct && attemptsLeft === 0,
    hasDirective,
    matchKind,
    message:
      matchKind === 'exact'
        ? 'Richtig'
        : matchKind === 'partial'
          ? 'Das war fast richtig.'
          : attemptsLeft > 0
            ? `Falsch. ${attemptsLeft} Versuch${attemptsLeft === 1 ? '' : 'e'} uebrig`
            : 'Falsch. Antwort wird aufgedeckt',
  };
}

export function getTypedAnswerWordCount(note: LearningNote | undefined) {
  return getAnswerWordCount(note);
}
