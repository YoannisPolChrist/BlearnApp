import { describe, expect, it } from 'vitest';
import { evaluateTypedAnswer, extractTypedAnswerDirectives, normalizeAnswer } from '../typedAnswerService';
import { isTypedAnswerCorrect } from '@/lib/learning';

describe('typed answer service', () => {
  it('normalizes accents and whitespace', () => {
    expect(normalizeAnswer('  Hëllö   Wörld ')).toBe('hello world');
  });

  it('extracts type directives from note fields', () => {
    const directives = extractTypedAnswerDirectives({
      id: 'note-1',
      deckId: 'deck-1',
      type: 'basic',
      front: '[[type: Hallo]]',
      back: 'Back',
      tags: [],
      language: 'de',
      createdAt: Date.now(),
    });

    expect(directives).toHaveLength(1);
    expect(directives[0]?.value).toBe('Hallo');
  });

  it('evaluates typed answers with a friendly response', () => {
    const result = evaluateTypedAnswer(
      {
        id: 'card-1',
        noteId: 'note-1',
        deckId: 'deck-1',
        type: 'basic',
        state: 'new',
        dueAt: Date.now(),
        intervalDays: 0,
        easeFactor: 2.5,
        reps: 0,
        lapses: 0,
        stepIndex: 0,
        memoryState: null,
        createdAt: Date.now(),
      },
      {
        id: 'note-1',
        deckId: 'deck-1',
        type: 'basic',
        front: 'Question',
        back: 'Answer',
        tags: [],
        language: 'de',
        createdAt: Date.now(),
      },
      'answer',
      {
        typedAnswerEnabled: true,
        typedAnswerMaxWords: 3,
      },
    );

    expect(result.correct).toBe(true);
    expect(result.attemptsLeft).toBeGreaterThan(0);
    expect(result.matchKind).toBe('exact');
    expect(result.message).toBe('Richtig');
  });

  it('treats the first four correct letters as almost right', () => {
    const result = evaluateTypedAnswer(
      {
        id: 'card-1',
        noteId: 'note-1',
        deckId: 'deck-1',
        type: 'basic',
        state: 'new',
        dueAt: Date.now(),
        intervalDays: 0,
        easeFactor: 2.5,
        reps: 0,
        lapses: 0,
        stepIndex: 0,
        memoryState: null,
        createdAt: Date.now(),
      },
      {
        id: 'note-1',
        deckId: 'deck-1',
        type: 'basic',
        front: 'Question',
        back: 'Haus',
        tags: [],
        language: 'de',
        createdAt: Date.now(),
      },
      'haus',
      {
        typedAnswerEnabled: true,
        typedAnswerMaxWords: 3,
      },
    );

    expect(result.correct).toBe(true);
    expect(result.matchKind).toBe('exact');

    const almostRight = evaluateTypedAnswer(
      {
        id: 'card-1',
        noteId: 'note-1',
        deckId: 'deck-1',
        type: 'basic',
        state: 'new',
        dueAt: Date.now(),
        intervalDays: 0,
        easeFactor: 2.5,
        reps: 0,
        lapses: 0,
        stepIndex: 0,
        memoryState: null,
        createdAt: Date.now(),
      },
      {
        id: 'note-1',
        deckId: 'deck-1',
        type: 'basic',
        front: 'Question',
        back: 'Haustuer',
        tags: [],
        language: 'de',
        createdAt: Date.now(),
      },
      'haus',
      {
        typedAnswerEnabled: true,
        typedAnswerMaxWords: 3,
      },
    );

    expect(almostRight.correct).toBe(true);
    expect(almostRight.matchKind).toBe('partial');
    expect(almostRight.message).toBe('Das war fast richtig.');
  });

  it('accepts a three-letter substring from anywhere in the headword', () => {
    const correct = isTypedAnswerCorrect(
      {
        id: 'card-1',
        noteId: 'note-1',
        deckId: 'deck-1',
        type: 'basic',
        state: 'new',
        dueAt: Date.now(),
        intervalDays: 0,
        easeFactor: 2.5,
        reps: 0,
        lapses: 0,
        stepIndex: 0,
        memoryState: null,
        createdAt: Date.now(),
      },
      {
        id: 'note-1',
        deckId: 'deck-1',
        type: 'basic',
        front: 'Question',
        back: 'Haus',
        tags: [],
        language: 'de',
        createdAt: Date.now(),
      },
      'aus',
    );

    expect(correct).toBe(true);
  });

  it('keeps an unrecognized answer as feedback instead of forcing an attempt limit', () => {
    const result = evaluateTypedAnswer(
      {
        id: 'card-1',
        noteId: 'note-1',
        deckId: 'deck-1',
        type: 'basic',
        state: 'new',
        dueAt: Date.now(),
        intervalDays: 0,
        easeFactor: 2.5,
        reps: 0,
        lapses: 0,
        stepIndex: 0,
        memoryState: null,
        createdAt: Date.now(),
      },
      {
        id: 'note-1',
        deckId: 'deck-1',
        type: 'basic',
        front: 'Question',
        back: 'Haus',
        tags: [],
        language: 'de',
        createdAt: Date.now(),
      },
      'Auto',
      {
        typedAnswerEnabled: true,
        typedAnswerMaxWords: 3,
      },
    );

    expect(result.correct).toBe(false);
    expect(result.matchKind).toBe('incorrect');
    expect(result.attemptsLeft).toBeGreaterThan(0);
    expect(result.autoReveal).toBe(false);
    expect(result.message).toBe('Nicht erkannt. Du kannst die Karte trotzdem selbst bewerten.');
  });

  it('accepts the first three correct letters as almost right (Tip-Modus)', () => {
    const result = evaluateTypedAnswer(
      {
        id: 'card-1',
        noteId: 'note-1',
        deckId: 'deck-1',
        type: 'basic',
        state: 'new',
        dueAt: Date.now(),
        intervalDays: 0,
        easeFactor: 2.5,
        reps: 0,
        lapses: 0,
        stepIndex: 0,
        memoryState: null,
        createdAt: Date.now(),
      },
      {
        id: 'note-1',
        deckId: 'deck-1',
        type: 'basic',
        front: 'Question',
        back: 'Wohnung',
        tags: [],
        language: 'de',
        createdAt: Date.now(),
      },
      'Woh',
      {
        typedAnswerEnabled: true,
        typedAnswerMaxWords: 3,
      },
    );

    expect(result.correct).toBe(true);
    expect(result.matchKind).toBe('partial');
  });

  it('checks only the highlighted answer-side headword, not examples or front-side markup', () => {
    const card = {
      id: 'card-1',
      noteId: 'note-1',
      deckId: 'deck-1',
      type: 'basic' as const,
      state: 'new' as const,
      dueAt: Date.now(),
      intervalDays: 0,
      easeFactor: 2.5,
      reps: 0,
      lapses: 0,
      stepIndex: 0,
      memoryState: null,
      createdAt: Date.now(),
    };
    const note = {
      id: 'note-1',
      deckId: 'deck-1',
      type: 'basic' as const,
      front: 'Question',
      back: 'front leak\nbonjour\nhello world',
      backHtml: '<strong>front leak</strong><hr id="answer"><p><strong>bonjour</strong></p><p>hello world</p>',
      tags: [],
      language: 'fr',
      createdAt: Date.now(),
    };
    const result = evaluateTypedAnswer(
      card,
      note,
      'jour',
      {
        typedAnswerEnabled: true,
        typedAnswerMaxWords: 3,
      },
    );

    expect(result.correct).toBe(true);
    expect(result.matchKind).toBe('partial');
    expect(isTypedAnswerCorrect(card, note, 'world')).toBe(false);
    expect(isTypedAnswerCorrect(card, note, 'leak')).toBe(false);
  });

  it('allows a full answer while evaluating the headword without articles or accents', () => {
    const card = {
      id: 'card-1',
      noteId: 'note-1',
      deckId: 'deck-1',
      type: 'basic' as const,
      state: 'new' as const,
      dueAt: Date.now(),
      intervalDays: 0,
      easeFactor: 2.5,
      reps: 0,
      lapses: 0,
      stepIndex: 0,
      memoryState: null,
      createdAt: Date.now(),
    };
    const note = {
      id: 'note-1',
      deckId: 'deck-1',
      type: 'basic' as const,
      front: 'coffee',
      back: 'le caf\u00e9\ncoffee',
      backHtml: '<hr id="answer"><p><strong>le caf\u00e9</strong></p><p>coffee</p>',
      tags: [],
      language: 'fr',
      createdAt: Date.now(),
    };

    expect(isTypedAnswerCorrect(card, note, 'CAF\u00c9')).toBe(true);
    expect(isTypedAnswerCorrect(card, note, 'cafe')).toBe(true);
    expect(isTypedAnswerCorrect(card, note, 'le cafe')).toBe(true);
    expect(isTypedAnswerCorrect(card, note, 'cafeteria')).toBe(true);
    expect(isTypedAnswerCorrect(card, note, 'tea')).toBe(false);
  });

  it('does not accept fewer than three characters for a longer headword', () => {
    const result = evaluateTypedAnswer(
      {
        id: 'card-1',
        noteId: 'note-1',
        deckId: 'deck-1',
        type: 'basic',
        state: 'new',
        dueAt: Date.now(),
        intervalDays: 0,
        easeFactor: 2.5,
        reps: 0,
        lapses: 0,
        stepIndex: 0,
        memoryState: null,
        createdAt: Date.now(),
      },
      {
        id: 'note-1',
        deckId: 'deck-1',
        type: 'basic',
        front: 'Question',
        back: 'Bonjour',
        tags: [],
        language: 'de',
        createdAt: Date.now(),
      },
      'bo',
      {
        typedAnswerEnabled: true,
        typedAnswerMaxWords: 3,
      },
    );

    expect(result.correct).toBe(false);
    expect(result.matchKind).toBe('incorrect');
  });
});
