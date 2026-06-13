
import type { ImportPayload, ImportableRow, LearningCard, LearningDeck, LearningNote } from '../domain/entities';
import { DEFAULT_PASSIVE_PRESET_ID } from '../domain/entities';
import { createId } from '../domain/id';
import { extractClozeOccurrences } from './preview';

export function parseCsv(content: string): ImportableRow[] {
  const lines = content.replace(/\r/g, '').split('\n').filter(Boolean);
  if (lines.length <= 1) return [];

  const rows = lines.map(parseCsvLine);
  const headers = rows[0].map((header) => header.trim());

  return rows.slice(1).map((row) => {
    const record = Object.fromEntries(headers.map((header, index) => [header, row[index] || '']));
    const tags = record.tags
      ? record.tags.split('|').map((tag) => tag.trim()).filter(Boolean)
      : [];

    return {
      deck: record.deck || 'Imported Deck',
      front: record.front || '',
      back: record.back || '',
      frontHtml: record.frontHtml || '',
      backHtml: record.backHtml || '',
      type: record.type === 'cloze' ? 'cloze' : 'basic',
      tags,
      language: record.language || 'de',
      clozeText: record.clozeText || '',
      expectedAnswer: record.expectedAnswer || '',
      mediaUrl: record.mediaUrl || '',
      templateCss: record.templateCss || '',
      templateCardClass: record.templateCardClass || '',
    };
  });
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      cells.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells;
}

export function normalizeImportPayload(payload: ImportPayload | ImportableRow[]): ImportableRow[] {
  if (Array.isArray(payload)) return payload;
  if (payload.rows) return payload.rows;
  if (payload.notes) return payload.notes;

  return (payload.decks || []).flatMap((deck) =>
    deck.notes.map((note) => ({
      deck: deck.name,
      deckDescription: deck.description,
      front: note.front,
      back: note.back,
      frontHtml: note.frontHtml || '',
      backHtml: note.backHtml || '',
      type: note.type || 'basic',
      tags: note.tags || deck.tags || [],
      language: note.language || deck.language || 'de',
      clozeText: note.clozeText || '',
      expectedAnswer: note.expectedAnswer || '',
      mediaUrl: note.mediaUrl || '',
      templateCss: note.templateCss || '',
      templateCardClass: note.templateCardClass || '',
      anki: note.anki,
      note: note.note,
      card: note.card,
    })),
  );
}

export function buildEntitiesFromRows(
  rows: ImportableRow[],
  now = Date.now(),
  deckMeta?: Pick<LearningDeck, 'sourceTemplateId' | 'sourceType'>,
): {
  decks: LearningDeck[];
  notes: LearningNote[];
  cards: LearningCard[];
} {
  const deckMap = new Map<string, LearningDeck>();
  const notes: LearningNote[] = [];
  const cards: LearningCard[] = [];

  rows.forEach((row) => {
    if (!row.front.trim() && !row.clozeText?.trim()) return;

    const deckName = row.deck.trim() || 'Imported Deck';
    const existingDeck = deckMap.get(deckName);
    const deck =
      existingDeck ||
      {
        id: createId('deck'),
        name: deckName,
        description: row.deckDescription || `Importiert aus ${row.type === 'cloze' ? 'Cloze' : 'Basic'}-Karten`,
        language: row.language || 'de',
      tags: Array.isArray(row.tags) ? row.tags : [],
      cardIds: [],
      presetId: DEFAULT_PASSIVE_PRESET_ID,
      sourceTemplateId: deckMeta?.sourceTemplateId,
      sourceType: deckMeta?.sourceType,
      anki: row.anki?.deck,
      createdAt: row.card?.createdAt ?? now,
      updatedAt: row.card?.lastReviewedAt ?? row.card?.createdAt ?? now,
    };

    deckMap.set(deckName, deck);

    const noteId = createId('note');
    const cardId = createId('card');
    const noteCreatedAt = row.note?.createdAt ?? row.card?.createdAt ?? now;
    const noteUpdatedAt =
      row.note?.updatedAt
      ?? row.note?.createdAt
      ?? row.card?.lastReviewedAt
      ?? row.card?.createdAt
      ?? noteCreatedAt;
    const note: LearningNote = {
      id: noteId,
      deckId: deck.id,
      type: row.type === 'cloze' ? 'cloze' : 'basic',
      front: row.front,
      back: row.back,
      frontHtml: row.frontHtml || undefined,
      backHtml: row.backHtml || undefined,
      clozeText: row.clozeText || '',
      expectedAnswer: row.expectedAnswer || row.back,
      tags: Array.isArray(row.tags)
        ? row.tags
        : typeof row.tags === 'string'
        ? row.tags.split('|').map((tag) => tag.trim()).filter(Boolean)
        : [],
      language: row.language || deck.language,
      mediaUrl: row.mediaUrl,
      templateCss: row.templateCss || undefined,
      templateCardClass: row.templateCardClass || undefined,
      anki: row.anki?.note,
      createdAt: noteCreatedAt,
      updatedAt: noteUpdatedAt,
    };
    // Multi-Cloze (5.1): {{c1::…}} {{c2::…}} erzeugt eine Karte pro Lücke.
    // Alle Geschwister teilen sich die Note — burySiblings greift damit korrekt.
    const clozeSource = note.type === 'cloze' ? (note.clozeText || note.front) : '';
    const clozeOrdinals = clozeSource
      ? Array.from(new Set(extractClozeOccurrences(clozeSource).map((occurrence) => occurrence.ordinal)))
          .filter((ordinal) => Number.isFinite(ordinal) && ordinal > 0)
          .sort((left, right) => left - right)
      : [];
    const cardVariants: Array<number | undefined> =
      clozeOrdinals.length > 0 ? clozeOrdinals : [undefined];

    cardVariants.forEach((clozeIndex, variantIndex) => {
      const variantCardId = variantIndex === 0 ? cardId : createId('card');
      const card: LearningCard = {
        id: variantCardId,
        noteId,
        deckId: deck.id,
        type: note.type,
        state: row.card?.state || 'new',
        dueAt: row.card?.dueAt ?? now,
        intervalDays: Math.max(0, Math.round(row.card?.intervalDays ?? row.card?.scheduledDays ?? 0)),
        easeFactor: row.card?.easeFactor ?? 2.5,
        reps: Math.max(0, Math.round(row.card?.reps || 0)),
        lapses: Math.max(0, Math.round(row.card?.lapses || 0)),
        stepIndex: Math.max(0, Math.round(row.card?.stepIndex || 0)),
        scheduledDays: Math.max(0, Math.round(row.card?.scheduledDays ?? row.card?.intervalDays ?? 0)),
        elapsedDays: Math.max(0, Math.round(row.card?.elapsedDays || 0)),
        memoryState: row.card?.memoryState || null,
        lastReviewedAt: row.card?.lastReviewedAt,
        createdAt: row.card?.createdAt ?? now,
        updatedAt:
          row.card?.updatedAt
          ?? row.card?.lastReviewedAt
          ?? row.card?.createdAt
          ?? now,
        clozeIndex,
        anki: variantIndex === 0 ? row.anki?.card : undefined,
      };

      deck.cardIds.push(variantCardId);
      cards.push(card);
    });

    deck.tags = Array.from(new Set([...deck.tags, ...note.tags]));
    deck.createdAt = Math.min(deck.createdAt, note.createdAt);
    deck.updatedAt = Math.max(deck.updatedAt, note.updatedAt ?? note.createdAt);

    notes.push(note);
  });

  return {
    decks: Array.from(deckMap.values()),
    notes,
    cards,
  };
}
