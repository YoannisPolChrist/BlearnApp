
import type { LearningCard, LearningNote } from './entities';

const MISENCODED_GERMAN_FORMS = {
  ae: '\u00C3\u00A4',
  oe: '\u00C3\u00B6',
  ue: '\u00C3\u00BC',
  ss: '\u00C3\u0178',
} as const;

function normalizeAnswer(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(new RegExp(`ä|${MISENCODED_GERMAN_FORMS.ae}|ae`, 'g'), 'a')
    .replace(new RegExp(`ö|${MISENCODED_GERMAN_FORMS.oe}|oe`, 'g'), 'o')
    .replace(new RegExp(`ü|${MISENCODED_GERMAN_FORMS.ue}|ue`, 'g'), 'u')
    .replace(new RegExp(`ß|${MISENCODED_GERMAN_FORMS.ss}`, 'g'), 'ss')
    .replace(/[.,/#!$%^&*;:{}=\-_`~()?"'[\]\\]/g, ' ')
    .replace(/\s+/g, ' ');
}

function normalizeForSubstring(value: string): string {
  return normalizeAnswer(value).replace(/[^\p{L}\p{N}]+/gu, '');
}

function tokenizeAnswer(value: string): string[] {
  return normalizeAnswer(value).split(' ').filter(Boolean);
}

const LEADING_ARTICLES = new Set([
  'a', 'an', 'the',
  'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einen', 'einem', 'einer',
  'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de',
  'el', 'los', 'las', 'un', 'una', 'unos', 'unas',
  'il', 'lo', 'gli', 'le', 'un', 'una', 'i',
  'o', 'os', 'as', 'um', 'uma',
]);

/**
 * Articles are useful context on a card back, but they are not the word a
 * learner should have to recall. Keep the original spelling of the headword;
 * normalization happens only when comparing an answer.
 */
function stripLeadingArticle(value: string): string {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (words.length < 2 || !LEADING_ARTICLES.has(normalizeForSubstring(words[0] || ''))) {
    return value.trim();
  }

  return words.slice(1).join(' ');
}

export type TypedAnswerMatchKind = 'exact' | 'partial' | 'incorrect';

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function htmlToText(value: string): string {
  return decodeHtmlEntities(
    value
      .replace(/<\s*br\s*\/?>/gi, '\n')
      .replace(/<\/(?:p|div|li|h[1-6]|tr|section|article)\s*>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/[\t\r ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .trim();
}

function getAnswerSideHtml(backHtml: string): string {
  const answerBoundary = /<hr\b[^>]*\bid\s*=\s*(["'])?answer\1[^>]*>/i.exec(backHtml);
  return answerBoundary?.index === undefined
    ? backHtml
    : backHtml.slice(answerBoundary.index + answerBoundary[0].length);
}

function getFirstHighlightedText(backHtml: string): string | undefined {
  const answerSideHtml = getAnswerSideHtml(backHtml);
  const highlighted = /<(?:strong|b)\b[^>]*>([\s\S]*?)<\/(?:strong|b)>/i.exec(answerSideHtml)?.[1];
  const text = highlighted ? htmlToText(highlighted) : '';
  return text || undefined;
}

function getFirstTextLine(value: string): string | undefined {
  const line = htmlToText(value)
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean);

  // A common unformatted import is "mot — explanation". Preserve multi-word
  // headwords, but stop before an explanation delimiter when one is present.
  return line?.split(/\s*(?:[-–—:]\s+|\()/, 1)[0]?.trim() || undefined;
}

/**
 * Basic cards may show explanations, examples, and translations on their back.
 * The typed gate intentionally checks only the visible headword, never the
 * complete back side. Imported Anki cards usually mark that headword bold.
 */
export function getTypedAnswerTarget(card: LearningCard, note: LearningNote | undefined): string | undefined {
  if (!note) return undefined;

  if (card.type === 'cloze') {
    return note.expectedAnswer || note.back || undefined;
  }

  const highlightedHeadword = note.backHtml ? getFirstHighlightedText(note.backHtml) : undefined;
  if (highlightedHeadword) {
    return stripLeadingArticle(highlightedHeadword);
  }

  // A separately authored expected answer is a useful manual-card escape hatch.
  // Importers commonly populate it with the full back side, so never prefer it
  // when it normalizes to the same text as the back.
  if (
    note.expectedAnswer
    && normalizeForSubstring(note.expectedAnswer) !== normalizeForSubstring(note.back)
  ) {
    return stripLeadingArticle(note.expectedAnswer);
  }

  const fallback = getFirstTextLine(note.backHtml ? getAnswerSideHtml(note.backHtml) : note.back);
  return fallback ? stripLeadingArticle(fallback) : undefined;
}

export function getAnswerWordCount(note: LearningNote | undefined, card?: LearningCard): number {
  if (!note) return 0;
  const target = card ? getTypedAnswerTarget(card, note) : note.expectedAnswer || note.back;
  return tokenizeAnswer(target || '').length;
}

export function shouldRequireTypedAnswer(
  card: LearningCard,
  note: LearningNote | undefined,
  typedAnswerMaxWords: number,
  typedAnswerEnabled = true,
): boolean {
  if (!typedAnswerEnabled || !note || card.type !== 'basic') {
    return false;
  }

  const answerWordCount = getAnswerWordCount(note, card);
  return answerWordCount > 0 && answerWordCount <= typedAnswerMaxWords;
}

export function getTypedAnswerMatchKind(
  card: LearningCard,
  note: LearningNote | undefined,
  answer: string,
): TypedAnswerMatchKind {
  const expected = getTypedAnswerTarget(card, note);
  const normalizedExpected = normalizeForSubstring(expected || '');
  const normalizedAnswer = normalizeForSubstring(
    card.type === 'basic' ? stripLeadingArticle(answer) : answer,
  );

  if (!normalizedExpected || !normalizedAnswer) return 'incorrect';
  if (normalizedAnswer === normalizedExpected) return 'exact';

  const expectedLength = Array.from(normalizedExpected).length;
  const answerLength = Array.from(normalizedAnswer).length;
  const minimumLength = Math.min(3, expectedLength);

  if (answerLength < minimumLength) {
    return 'incorrect';
  }

  // The input is deliberately not capped. A full, normalized headword is an
  // exact answer; otherwise any contiguous three-character part is enough to
  // show a real recall attempt, even when the learner keeps typing.
  const answerCharacters = Array.from(normalizedAnswer);
  const hasMatchingSequence = answerCharacters.some((_, index) => {
    const sequence = answerCharacters.slice(index, index + minimumLength).join('');
    return sequence.length === minimumLength && normalizedExpected.includes(sequence);
  });

  if (hasMatchingSequence) {
    return 'partial';
  }

  return 'incorrect';
}

export function isTypedAnswerCorrect(card: LearningCard, note: LearningNote | undefined, answer: string): boolean {
  return getTypedAnswerMatchKind(card, note, answer) !== 'incorrect';
}
