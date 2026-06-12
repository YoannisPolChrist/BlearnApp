
import type { ImportPayload, LearningCard, LearningDeck, LearningNote } from '../domain/entities';
import { DEFAULT_PASSIVE_PRESET_ID } from '../domain/entities';


export function mergeDecks(existingDecks: LearningDeck[], incomingDecks: LearningDeck[]): LearningDeck[] {
  const merged = new Map<string, LearningDeck>();

  [...existingDecks, ...incomingDecks].forEach((deck) => {
    const current = merged.get(deck.id);
    if (!current) {
      merged.set(deck.id, {
        ...deck,
        presetId: deck.presetId || DEFAULT_PASSIVE_PRESET_ID,
        tags: Array.from(new Set(deck.tags || [])),
        cardIds: Array.from(new Set(deck.cardIds || [])),
      });
      return;
    }

    merged.set(deck.id, {
      ...current,
      ...deck,
      presetId: deck.presetId || current.presetId || DEFAULT_PASSIVE_PRESET_ID,
      tags: Array.from(new Set([...(current.tags || []), ...(deck.tags || [])])),
      cardIds: Array.from(new Set([...(current.cardIds || []), ...(deck.cardIds || [])])),
      createdAt: Math.min(current.createdAt || deck.createdAt, deck.createdAt || current.createdAt),
      updatedAt: Math.max(current.updatedAt || 0, deck.updatedAt || 0),
    });
  });

  return Array.from(merged.values()).sort((left, right) => left.id.localeCompare(right.id));
}

export function buildDeckExportPayload(
  deck: LearningDeck | undefined,
  notes: LearningNote[],
  cards: LearningCard[] = [],
): ImportPayload | null {
  if (!deck) {
    return null;
  }

  return {
    decks: [
      {
        name: deck.name,
        description: deck.description,
        language: deck.language,
        tags: deck.tags,
        notes: notes.map((note) => {
          const card = cards.find((entry) => entry.noteId === note.id);
          return {
            front: note.front,
            back: note.back,
            frontHtml: note.frontHtml,
            backHtml: note.backHtml,
            type: note.type,
            tags: note.tags,
            language: note.language,
            clozeText: note.clozeText,
            expectedAnswer: note.expectedAnswer,
            mediaUrl: note.mediaUrl,
            templateCss: note.templateCss,
            templateCardClass: note.templateCardClass,
            anki: {
              deck: deck.anki,
              note: note.anki,
              card: card?.anki,
            },
            note: {
              createdAt: note.createdAt,
              updatedAt: note.updatedAt,
            },
            card: card
              ? {
                  state: card.state,
                  dueAt: card.dueAt,
                  intervalDays: card.intervalDays,
                  easeFactor: card.easeFactor,
                  reps: card.reps,
                  lapses: card.lapses,
                  stepIndex: card.stepIndex,
                  scheduledDays: card.scheduledDays,
                  elapsedDays: card.elapsedDays,
                  memoryState: card.memoryState,
                  lastReviewedAt: card.lastReviewedAt,
                  createdAt: card.createdAt,
                  updatedAt: card.updatedAt,
                }
              : undefined,
          };
        }),
      },
    ],
  };
}
