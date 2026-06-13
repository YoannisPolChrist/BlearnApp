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
});
