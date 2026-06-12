
import { textToHtml } from '@/lib/ankiHtml';
import type {
  ClozeOccurrence,
  LearningCard,
  LearningNote,
  TemplatePreview,
  TemplatePreviewSource,
} from '../domain/entities';

export function getCardPrompt(card: LearningCard, note?: LearningNote): string {
  if (!note) return '';
  if (card.type === 'cloze') {
    return (note.clozeText || note.front).replace(/\{\{c\d+::(.*?)\}\}/g, '_____');
  }

  return note.front;
}

export function getCardAnswer(note?: LearningNote): string {
  if (!note) return '';
  return note.back;
}

export function getCardPromptHtml(card: LearningCard, note?: LearningNote): string {
  if (!note) return '';
  if (card.type === 'cloze' && note.frontHtml) {
    return note.frontHtml;
  }

  return note.frontHtml || textToHtml(getCardPrompt(card, note));
}

export function getCardAnswerHtml(note?: LearningNote): string {
  if (!note) return '';
  return note.backHtml || textToHtml(getCardAnswer(note));
}

export function getCardTemplateCss(note?: LearningNote): string | undefined {
  return note?.templateCss;
}

export function getCardTemplateClass(note?: LearningNote): string | undefined {
  return note?.templateCardClass;
}

function normalizePreviewText(value?: string | null): string {
  return (value || '').replace(/\r\n/g, '\n').trim();
}

function createClozePattern() {
  return /\{\{c(\d+)::(.*?)(?:::(.*?))?\}\}/gi;
}

export function extractClozeOccurrences(value: string): ClozeOccurrence[] {
  return Array.from(value.matchAll(createClozePattern())).map((match) => ({
    ordinal: Number.parseInt(match[1], 10),
    answer: normalizePreviewText(match[2]),
    hint: normalizePreviewText(match[3]) || undefined,
  }));
}

export function renderClozeValue(value: string, clozeNumber: number, mode: 'front' | 'back'): string {
  return value.replace(createClozePattern(), (_match, rawIndex, answer, hint) => {
    const index = Number.parseInt(rawIndex, 10);
    if (index !== clozeNumber) {
      return answer;
    }

    return mode === 'front' ? (hint || '_____') : answer;
  });
}

export function extractClozeAnswer(value: string, clozeNumber: number): string {
  return extractClozeOccurrences(value)
    .filter((occurrence) => occurrence.ordinal === clozeNumber)
    .map((occurrence) => occurrence.answer)
    .filter(Boolean)
    .join(' / ');
}

export function resolveNoteForPreview(
  input?: TemplatePreviewSource | null,
): Required<Pick<TemplatePreview, 'type' | 'front' | 'back'>> & Pick<TemplatePreview, 'clozeText' | 'expectedAnswer'> {
  const type = input?.type === 'cloze' ? 'cloze' : 'basic';
  const front = normalizePreviewText(input?.front);
  const back = normalizePreviewText(input?.back);
  const clozeText = normalizePreviewText(input?.clozeText);
  const expectedAnswer = normalizePreviewText(input?.expectedAnswer);

  return {
    type,
    front: front || (type === 'cloze' ? clozeText : ''),
    back,
    clozeText: type === 'cloze' ? (clozeText || front || undefined) : undefined,
    expectedAnswer: type === 'cloze' ? (expectedAnswer || back || undefined) : expectedAnswer || undefined,
  };
}

export function buildManualCardPreview(
  input?: TemplatePreviewSource | null,
  selectedClozeOrdinal = 1,
): TemplatePreview {
  const note = resolveNoteForPreview(input);
  const clozeSource = note.clozeText || note.front;
  const clozeOccurrences = note.type === 'cloze' && clozeSource ? extractClozeOccurrences(clozeSource) : [];
  const activeClozeOrdinal = clozeOccurrences.find((entry) => entry.ordinal === selectedClozeOrdinal)?.ordinal
    ?? clozeOccurrences[0]?.ordinal
    ?? selectedClozeOrdinal;
  const front = note.type === 'cloze'
    ? renderClozeValue(clozeSource || note.front, activeClozeOrdinal, 'front')
    : note.front;
  const expectedAnswer = note.type === 'cloze'
    ? note.expectedAnswer || extractClozeAnswer(clozeSource || note.front, activeClozeOrdinal) || note.back
    : note.expectedAnswer;
  const back = note.type === 'cloze'
    ? expectedAnswer || note.back
    : note.back;

  return {
    type: note.type,
    front: front || note.front,
    back: back || note.back,
    clozeText: note.clozeText,
    expectedAnswer: expectedAnswer || undefined,
    requiresTypedAnswer: note.type === 'cloze',
    clozeOccurrences,
    activeClozeOrdinal: clozeOccurrences.length > 0 ? activeClozeOrdinal : undefined,
  };
}
