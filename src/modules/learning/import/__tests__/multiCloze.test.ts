import { describe, expect, it } from 'vitest';
import { buildEntitiesFromRows } from '../buildEntities';
import { getCardAnswer, getCardPrompt } from '../preview';
import type { ImportableRow } from '../../domain/entities';

function buildClozeRow(clozeText: string): ImportableRow {
  return {
    deck: 'Cloze Deck',
    front: clozeText,
    back: '',
    type: 'cloze',
    tags: [],
    language: 'de',
    clozeText,
    expectedAnswer: '',
    mediaUrl: '',
  } as ImportableRow;
}

describe('Multi-Cloze (Masterplan 5.1)', () => {
  it('erzeugt eine Karte pro {{cN::…}}-Lücke, alle an derselben Note', () => {
    const { notes, cards, decks } = buildEntitiesFromRows([
      buildClozeRow('Die Hauptstadt von {{c1::Frankreich}} ist {{c2::Paris}}.'),
    ]);

    expect(notes).toHaveLength(1);
    expect(cards).toHaveLength(2);
    expect(cards.map((card) => card.clozeIndex).sort()).toEqual([1, 2]);
    expect(new Set(cards.map((card) => card.noteId)).size).toBe(1);
    expect(decks[0].cardIds).toHaveLength(2);
  });

  it('maskiert pro Karte nur die eigene Lücke und zeigt die Geschwister', () => {
    const { notes, cards } = buildEntitiesFromRows([
      buildClozeRow('Die Hauptstadt von {{c1::Frankreich}} ist {{c2::Paris}}.'),
    ]);
    const note = notes[0];
    const card1 = cards.find((card) => card.clozeIndex === 1)!;
    const card2 = cards.find((card) => card.clozeIndex === 2)!;

    expect(getCardPrompt(card1, note)).toBe('Die Hauptstadt von _____ ist Paris.');
    expect(getCardPrompt(card2, note)).toBe('Die Hauptstadt von Frankreich ist _____.');
    expect(getCardAnswer(note, card1)).toBe('Frankreich');
    expect(getCardAnswer(note, card2)).toBe('Paris');
  });

  it('verhält sich bei Einzel-Cloze und Basic-Karten wie bisher', () => {
    const single = buildEntitiesFromRows([buildClozeRow('Ich {{c1::lerne}} täglich.')]);
    expect(single.cards).toHaveLength(1);
    expect(getCardPrompt(single.cards[0], single.notes[0])).toBe('Ich _____ täglich.');

    const basic = buildEntitiesFromRows([
      {
        deck: 'Basic',
        front: 'Haus',
        back: 'house',
        type: 'basic',
        tags: [],
        language: 'de',
        clozeText: '',
        expectedAnswer: '',
        mediaUrl: '',
      } as ImportableRow,
    ]);
    expect(basic.cards).toHaveLength(1);
    expect(basic.cards[0].clozeIndex).toBeUndefined();
    expect(getCardPrompt(basic.cards[0], basic.notes[0])).toBe('Haus');
  });

  it('nutzt Cloze-Hints auf der Vorderseite', () => {
    const { notes, cards } = buildEntitiesFromRows([
      buildClozeRow('{{c1::Berlin::Stadt}} liegt an der Spree.'),
    ]);
    expect(getCardPrompt(cards[0], notes[0])).toBe('Stadt liegt an der Spree.');
  });

  it('uses the same portable IDs for a repeated Anki import', () => {
    const row = {
      deck: 'Italian', front: 'casa', back: 'Haus', type: 'basic', tags: [], language: 'it',
      clozeText: '', expectedAnswer: 'Haus', mediaUrl: '',
      anki: {
        deck: { deckId: '42', originalName: 'Italian', collectionCreatedAt: 1_700_000_000_000 },
        note: { noteId: '101', modelId: '1', tags: [], fields: [] },
        card: { cardId: '202', noteId: '101', deckId: '42', templateOrdinal: 0, queue: 0, cardType: 0, due: 0, interval: 0, factor: 2500, reps: 0, lapses: 0, leftCount: 0 },
      },
    } satisfies ImportableRow;
    const first = buildEntitiesFromRows([row], 1_700_000_000_000);
    const second = buildEntitiesFromRows([row], 1_700_000_100_000);

    expect(second.decks[0].id).toBe(first.decks[0].id);
    expect(second.notes[0].id).toBe(first.notes[0].id);
    expect(second.cards[0].id).toBe(first.cards[0].id);
  });
});
