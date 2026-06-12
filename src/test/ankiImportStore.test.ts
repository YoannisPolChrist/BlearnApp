import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/ankiImport', () => ({
  parseAnkiPackage: vi.fn(async () => ({
    rows: [
      {
        deck: 'Jean Paul',
        deckDescription: 'Importiert aus Anki',
        front: 'die Hecke',
        back: 'la haie',
        type: 'basic',
        tags: ['anki', 'fr'],
        language: 'fr',
        anki: {
          deck: {
            deckId: '42',
            originalName: 'Jean Paul',
          },
          note: {
            noteId: '9001',
            modelId: '12',
            tags: ['anki', 'fr'],
            fields: [
              { name: 'Front', value: 'die Hecke' },
              { name: 'Back', value: 'la haie' },
            ],
          },
          card: {
            cardId: '7001',
            noteId: '9001',
            deckId: '42',
            templateOrdinal: 0,
            queue: 2,
            cardType: 2,
            due: 1800000000,
            interval: 21,
            factor: 2350,
            reps: 9,
            lapses: 1,
            leftCount: 0,
            lastReviewAt: 1_799_000_000_000,
          },
        },
        card: {
          state: 'review',
          dueAt: 1_800_000_000_000,
          intervalDays: 21,
          scheduledDays: 21,
          easeFactor: 2.35,
          reps: 9,
          lapses: 1,
          lastReviewedAt: 1_799_000_000_000,
          createdAt: 1_700_000_000_000,
        },
      },
    ],
    reviewLogs: [
      {
        sourceCardId: '7001',
        reviewedAt: 1_799_000_000_000,
        rating: 'good',
        previousState: 'review',
        newState: 'review',
        scheduledDays: 21,
        elapsedDays: 20,
        wasCorrect: true,
        memoryStateBefore: null,
        memoryStateAfter: null,
        anki: {
          reviewId: '5555',
          sourceCardId: '7001',
          ease: 3,
          interval: 21,
          lastInterval: 20,
          factor: 2350,
        },
      },
    ],
  })),
}));

import { useLearningStore } from '@/store/useLearningStore';

describe('anki import store flow', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useLearningStore.setState(useLearningStore.getInitialState(), true);
    vi.restoreAllMocks();
  });

  it('imports Anki rows as regular learn decks with preserved scheduler data', async () => {
    const result = await useLearningStore.getState().importFromAnkiPackage('jean-paul.apkg', new ArrayBuffer(16));
    const state = useLearningStore.getState();

    expect(result.error).toBeUndefined();
    expect(result.source).toBe('anki');
    const allDecks = Object.values(state.decks);
    const allCards = Object.values(state.cards);
    const allNotes = Object.values(state.notes);
    const allReviewLogs = Object.values(state.reviewLogs);
    expect(allDecks).toHaveLength(1);
    expect(allDecks[0].sourceType).toBe('anki');
    expect(allDecks[0].anki?.deckId).toBe('42');
    expect(allCards[0].state).toBe('review');
    expect(allCards[0].dueAt).toBe(1_800_000_000_000);
    expect(allCards[0].reps).toBe(9);
    expect(allCards[0].anki?.cardId).toBe('7001');
    expect(allNotes[0].front).toBe('die Hecke');
    expect(allNotes[0].anki?.noteId).toBe('9001');
    expect(allReviewLogs[0]?.anki?.reviewId).toBe('5555');
  });
});
