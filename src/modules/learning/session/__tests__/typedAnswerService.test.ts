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

  it('does not accept a substring from the middle of the word', () => {
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

    expect(correct).toBe(false);
  });

  it('reveals the answer immediately after a single wrong attempt (Tip-Modus)', () => {
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
    expect(result.attemptsLeft).toBe(0);
    expect(result.autoReveal).toBe(true);
    expect(result.message).toBe('Falsch. Antwort wird aufgedeckt');
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
});
