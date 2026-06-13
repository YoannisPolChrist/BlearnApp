
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

function tokenizeAnswer(value: string): string[] {
  return normalizeAnswer(value).split(' ').filter(Boolean);
}

export type TypedAnswerMatchKind = 'exact' | 'partial' | 'incorrect';

export function getAnswerWordCount(note: LearningNote | undefined): number {
  if (!note) return 0;
  return tokenizeAnswer(note.expectedAnswer || note.back).length;
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

  const answerWordCount = getAnswerWordCount(note);
  return answerWordCount > 0 && answerWordCount <= typedAnswerMaxWords;
}

export function getTypedAnswerMatchKind(
  card: LearningCard,
  note: LearningNote | undefined,
  answer: string,
): TypedAnswerMatchKind {
  if (!note) return 'incorrect';
  const expected = card.type === 'cloze' ? note.expectedAnswer || note.back : note.back;
  const normalizedExpected = normalizeAnswer(expected);
  const normalizedAnswer = normalizeAnswer(answer);

  if (!normalizedAnswer) return 'incorrect';
  if (normalizedAnswer === normalizedExpected) return 'exact';

  const expectedTokens = tokenizeAnswer(expected);
  const answerTokens = tokenizeAnswer(answer);

  if (expectedTokens.length === 0 || expectedTokens.length !== answerTokens.length) {
    return 'incorrect';
  }

  const matchesByPrefix = answerTokens.every((token, index) => {
    const expectedToken = expectedTokens[index];
    if (!expectedToken) {
      return false;
    }

    if (token === expectedToken) {
      return true;
    }

    // Tip-Modus: mind. 3 korrekte Anfangsbuchstaben gelten als richtig
    // (bei kürzeren Wörtern entsprechend die volle Länge).
    const requiredPrefixLength = Math.min(3, expectedToken.length);
    return token.length >= requiredPrefixLength && expectedToken.startsWith(token);
  });

  if (!matchesByPrefix) {
    return 'incorrect';
  }

  const usedShortenedToken = answerTokens.some((token, index) => token !== expectedTokens[index]);
  return usedShortenedToken ? 'partial' : 'exact';
}

export function isTypedAnswerCorrect(card: LearningCard, note: LearningNote | undefined, answer: string): boolean {
  return getTypedAnswerMatchKind(card, note, answer) !== 'incorrect';
}
