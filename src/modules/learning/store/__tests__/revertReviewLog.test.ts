import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useLearningStore } from '@/store/useLearningStore';
import { buildEntitiesFromRows } from '@/modules/learning/import/buildEntities';
import { getDefaultLearningPresets } from '@/modules/learning/domain/presets';
import {
  clearReviewWal,
  peekReviewWal,
  replayReviewWal,
} from '@/modules/learning/store/reviewWriteAheadLog';

const NOW = 1_700_000_000_000;

function seedDeckWithCard() {
  const { decks, notes, cards } = buildEntitiesFromRows(
    [{ deck: 'Undo-Testdeck', front: 'Hund', back: 'dog', type: 'basic' }],
    NOW,
  );

  useLearningStore.setState(
    {
      ...useLearningStore.getInitialState(),
      activeDeckId: decks[0].id,
      decks: Object.fromEntries(decks.map((d) => [d.id, d])),
      notes: Object.fromEntries(notes.map((n) => [n.id, n])),
      cards: Object.fromEntries(cards.map((c) => [c.id, c])),
      presets: getDefaultLearningPresets(),
    },
    true,
  );

  return { card: cards[0] };
}

// Multi-Cloze-Note (5.1): {{c1::…}} {{c2::…}} erzeugt zwei Karten, die sich
// EINE Note teilen. Mit burySiblings wird beim Bewerten der einen Karte die
// andere bis morgen begraben.
function seedDeckWithSiblingClozeCards() {
  const { decks, notes, cards } = buildEntitiesFromRows(
    [
      {
        deck: 'Cloze-Testdeck',
        front: 'Der {{c1::Hund}} jagt die {{c2::Katze}}.',
        back: 'Hund / Katze',
        type: 'cloze',
        clozeText: 'Der {{c1::Hund}} jagt die {{c2::Katze}}.',
      },
    ],
    NOW,
  );

  // Beide Geschwister sind heute fällig (Standard-Import: dueAt = createdAt).
  const reviewableCards = cards.map((card) => ({ ...card, dueAt: NOW }));

  useLearningStore.setState(
    {
      ...useLearningStore.getInitialState(),
      activeDeckId: decks[0].id,
      decks: Object.fromEntries(decks.map((d) => [d.id, d])),
      notes: Object.fromEntries(notes.map((n) => [n.id, n])),
      cards: Object.fromEntries(reviewableCards.map((c) => [c.id, c])),
      presets: getDefaultLearningPresets(),
    },
    true,
  );

  return { gradedCard: reviewableCards[0], sibling: reviewableCards[1] };
}

describe('revertReviewLog (Masterplan 4.1)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clearReviewWal();
    window.localStorage.clear();
    useLearningStore.setState(useLearningStore.getInitialState(), true);
  });

  it('reverts the LATEST review, not the oldest, for multi-review cards', () => {
    const { card } = seedDeckWithCard();

    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    useLearningStore.getState().submitReview(card.id, 'good', true);
    const afterFirst = useLearningStore.getState().cards[card.id];

    vi.spyOn(Date, 'now').mockReturnValue(NOW + 60_000);
    useLearningStore.getState().submitReview(card.id, 'good', true);

    const logsAfterSecond = Object.values(useLearningStore.getState().reviewLogs).filter(
      (log) => log.cardId === card.id,
    );
    expect(logsAfterSecond).toHaveLength(2);

    useLearningStore.getState().revertReviewLog(card.id);

    const state = useLearningStore.getState();
    const remainingLogs = Object.values(state.reviewLogs).filter(
      (log) => log.cardId === card.id,
    );
    expect(remainingLogs).toHaveLength(1);
    // The remaining log must be the EARLIER one (the latest was undone).
    expect(remainingLogs[0].reviewedAt).toBe(NOW);
    // The card returns to its state after the first review, FSRS memory
    // state included.
    expect(state.cards[card.id]).toEqual(afterFirst);
  });

  it('restores buried sibling cards when a multi-cloze review is undone', () => {
    const { gradedCard, sibling } = seedDeckWithSiblingClozeCards();
    expect(gradedCard.noteId).toBe(sibling.noteId);
    const siblingDueBefore = useLearningStore.getState().cards[sibling.id].dueAt;

    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    useLearningStore.getState().submitReview(gradedCard.id, 'good', true);

    // Sanity: das Geschwister wurde tatsächlich bis morgen begraben.
    const siblingDueAfter = useLearningStore.getState().cards[sibling.id].dueAt;
    expect(siblingDueAfter).toBeGreaterThan(siblingDueBefore);

    useLearningStore.getState().revertReviewLog(gradedCard.id);

    // Nach dem Undo MUSS das Geschwister wieder fällig sein — sonst bleibt die
    // begrabene Lücke trotz rückgängig gemachter Bewertung bis morgen versteckt.
    const siblingDueReverted = useLearningStore.getState().cards[sibling.id].dueAt;
    expect(siblingDueReverted).toBe(siblingDueBefore);
  });

  it('removes the undone review from the WAL so a replay cannot resurrect it', () => {
    const { card } = seedDeckWithCard();

    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    useLearningStore.getState().submitReview(card.id, 'good', true);

    const walBefore = peekReviewWal();
    expect(walBefore).toHaveLength(1);
    const undoneLogId = walBefore[0].logId;

    useLearningStore.getState().revertReviewLog(card.id);

    expect(peekReviewWal().some((entry) => entry.logId === undoneLogId)).toBe(false);

    replayReviewWal(useLearningStore);
    expect(useLearningStore.getState().reviewLogs[undoneLogId]).toBeUndefined();
  });
});
