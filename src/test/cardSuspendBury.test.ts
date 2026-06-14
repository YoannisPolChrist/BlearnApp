import { beforeEach, describe, expect, it } from 'vitest';
import { buildUnlockSessionQueue } from '@/lib/learning';
import { useLearningStore } from '@/store/useLearningStore';

function seedCard(overrides: Partial<ReturnType<typeof buildCard>> = {}) {
  const card = { ...buildCard(), ...overrides };
  useLearningStore.setState((state) => ({
    decks: {
      ...state.decks,
      'deck-sb': {
        id: 'deck-sb',
        name: 'Suspend Bury Deck',
        description: '',
        language: 'de',
        tags: [],
        cardIds: [card.id],
        createdAt: 1,
        updatedAt: 1,
      },
    },
    cards: { ...state.cards, [card.id]: card },
  }));
  return card;
}

function buildCard() {
  return {
    id: 'card-sb-1',
    noteId: 'note-sb-1',
    deckId: 'deck-sb',
    type: 'basic' as const,
    state: 'review' as const,
    dueAt: Date.now() - 1000,
    intervalDays: 3,
    easeFactor: 2.5,
    reps: 5,
    lapses: 0,
    stepIndex: 0,
    memoryState: { stability: 3, difficulty: 5 },
    createdAt: 1,
  };
}

describe('Suspend & Bury (Masterplan 4.2/5.3)', () => {
  beforeEach(() => {
    useLearningStore.setState({ cards: {}, decks: {} });
  });

  it('setCardSuspended setzt und hebt den suspended-Zustand korrekt auf', () => {
    const card = seedCard();
    useLearningStore.getState().setCardSuspended(card.id, true);
    expect(useLearningStore.getState().cards[card.id].state).toBe('suspended');

    useLearningStore.getState().setCardSuspended(card.id, false);
    // Karte mit Memory-State/Reps kehrt in 'review' zurück.
    expect(useLearningStore.getState().cards[card.id].state).toBe('review');
  });

  it('unsuspend einer nie gelernten Karte ergibt wieder "new"', () => {
    const card = seedCard({ state: 'new', reps: 0, memoryState: null });
    useLearningStore.getState().setCardSuspended(card.id, true);
    useLearningStore.getState().setCardSuspended(card.id, false);
    expect(useLearningStore.getState().cards[card.id].state).toBe('new');
  });

  it('begrabene Karten erscheinen heute in keiner Unlock-Queue mehr', () => {
    const card = seedCard();
    useLearningStore.getState().buryCardUntilTomorrow(card.id);

    const buried = useLearningStore.getState().cards[card.id];
    expect(buried.dueAt).toBeGreaterThan(Date.now());

    const queue = buildUnlockSessionQueue({
      cards: Object.values(useLearningStore.getState().cards),
      deckId: 'deck-sb',
      sessionCreditsRequired: 5,
      ignoreNewCardsLimit: true,
      includeReviewAhead: false,
      now: Date.now(),
    });
    expect(queue).not.toContain(card.id);
  });

  it('begrabene neue Karten werden heute nicht mehr eingemischt', () => {
    const card = seedCard({ state: 'new', reps: 0, memoryState: null, dueAt: Date.now() - 1000 });
    useLearningStore.getState().buryCardUntilTomorrow(card.id);

    const queue = buildUnlockSessionQueue({
      cards: Object.values(useLearningStore.getState().cards),
      deckId: 'deck-sb',
      sessionCreditsRequired: 5,
      ignoreNewCardsLimit: true,
      includeReviewAhead: false,
      now: Date.now(),
    });
    expect(queue).not.toContain(card.id);
  });

  it('begräbt Geschwister (Multi-Cloze) beim Review bis morgen', () => {
    // Zwei Cloze-Karten derselben Note, beide faellig.
    const sibling1 = { ...buildCard(), id: 'cloze-1', noteId: 'note-cloze', type: 'cloze' as const, clozeIndex: 1 };
    const sibling2 = { ...buildCard(), id: 'cloze-2', noteId: 'note-cloze', type: 'cloze' as const, clozeIndex: 2 };
    useLearningStore.setState((state) => ({
      decks: {
        ...state.decks,
        'deck-sb': {
          id: 'deck-sb', name: 'Deck', description: '', language: 'de', tags: [],
          cardIds: [sibling1.id, sibling2.id], createdAt: 1, updatedAt: 1,
        },
      },
      cards: { ...state.cards, [sibling1.id]: sibling1, [sibling2.id]: sibling2 },
    }));

    const todayMidnight = new Date();
    todayMidnight.setHours(24, 0, 0, 0);

    useLearningStore.getState().submitReview(sibling1.id, 'good', true);

    // Das Geschwister ist jetzt bis (mind.) morgen begraben → heute nicht faellig.
    expect(useLearningStore.getState().cards[sibling2.id].dueAt).toBeGreaterThanOrEqual(
      todayMidnight.getTime(),
    );

    const queue = buildUnlockSessionQueue({
      cards: Object.values(useLearningStore.getState().cards),
      deckId: 'deck-sb',
      sessionCreditsRequired: 5,
      ignoreNewCardsLimit: true,
      includeReviewAhead: false,
      now: Date.now(),
    });
    expect(queue).not.toContain(sibling2.id);
  });
});
