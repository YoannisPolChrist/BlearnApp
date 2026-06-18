import { describe, expect, it } from 'vitest';
import type { LearningCard, LearningPreset, ReviewLog } from '@/modules/learning/domain/entities';
import { getDefaultLearningPreset } from '@/modules/learning/domain/presets';
import {
  buildNextNewCardLabel,
  buildNextNewCardStatus,
} from '@/modules/learning/session/nextNewCardStatus';

const NOW = new Date('2026-06-15T10:00:00.000Z').getTime();
const DECK_ID = 'deck-next-new';

function makeCard(id: string, overrides: Partial<LearningCard> = {}): LearningCard {
  return {
    id,
    noteId: `note-${id}`,
    deckId: DECK_ID,
    type: 'basic',
    state: 'review',
    dueAt: NOW - 60_000,
    intervalDays: 1,
    easeFactor: 2.5,
    reps: 1,
    lapses: 0,
    stepIndex: 0,
    memoryState: null,
    createdAt: NOW - 7 * 24 * 60 * 60 * 1000,
    updatedAt: NOW - 60_000,
    ...overrides,
  };
}

function makeReviewLog(index: number, overrides: Partial<ReviewLog> = {}): ReviewLog {
  return {
    id: `log-${index}`,
    deckId: DECK_ID,
    cardId: `review-${index}`,
    reviewedAt: NOW - (20 - index) * 60_000,
    rating: 'good',
    previousState: 'review',
    newState: 'review',
    scheduledDays: 1,
    elapsedDays: 1,
    wasCorrect: true,
    memoryStateBefore: null,
    memoryStateAfter: null,
    ...overrides,
  };
}

function makePreset(overrides: Partial<LearningPreset> = {}): LearningPreset {
  return {
    ...getDefaultLearningPreset(),
    reviewsBetweenNewCards: 5,
    newCardsPerDay: 2,
    ...overrides,
  };
}

describe('buildNextNewCardLabel', () => {
  it('shows the offset when a new vocabulary is already in the remaining queue', () => {
    const reviewCard = makeCard('review-1');
    const newCard = makeCard('new-1', { state: 'new', dueAt: NOW - 60_000 });

    expect(
      buildNextNewCardLabel({
        cards: [reviewCard, newCard],
        deckId: DECK_ID,
        preset: makePreset(),
        reviewLogs: [],
        remainingCandidateIds: [reviewCard.id, newCard.id],
        cardStateById: {
          [reviewCard.id]: reviewCard.state,
          [newCard.id]: newCard.state,
        },
        now: NOW,
      }),
    ).toBe('Nächste neue Vokabel in 1 Karte');
  });

  it('builds progress for a new vocabulary already queued in the current session', () => {
    const firstReview = makeCard('review-1');
    const secondReview = makeCard('review-2');
    const newCard = makeCard('new-1', { state: 'new', dueAt: NOW - 60_000 });

    const status = buildNextNewCardStatus({
      cards: [firstReview, secondReview, newCard],
      deckId: DECK_ID,
      preset: makePreset(),
      reviewLogs: [],
      remainingCandidateIds: [firstReview.id, secondReview.id, newCard.id],
      cardStateById: {
        [firstReview.id]: firstReview.state,
        [secondReview.id]: secondReview.state,
        [newCard.id]: newCard.state,
      },
      now: NOW,
    });

    expect(status).toMatchObject({
      label: 'Nächste neue Vokabel in 2 Karten',
      detail: 'Kommt in dieser Session.',
      valueNow: 1,
      valueMax: 3,
      available: true,
    });
    expect(status.progressPercent).toBeCloseTo(33.33333333333333);
  });

  it('does not announce another new vocabulary after the daily new-card limit is reached', () => {
    const newCard = makeCard('new-1', { state: 'new', dueAt: NOW - 60_000 });
    const reviewLogs = [
      makeReviewLog(1, { cardId: 'introduced-1', previousState: 'new' }),
      makeReviewLog(2, { cardId: 'introduced-2', previousState: 'new' }),
      ...Array.from({ length: 10 }, (_value, index) => makeReviewLog(index + 3)),
    ];

    expect(
      buildNextNewCardLabel({
        cards: [newCard],
        deckId: DECK_ID,
        preset: makePreset({ newCardsPerDay: 2 }),
        reviewLogs,
        remainingCandidateIds: [],
        cardStateById: { [newCard.id]: newCard.state },
        now: NOW,
      }),
    ).toBe('Heute keine neue Vokabel mehr');
  });

  it('tracks how many reviews are still needed before the next new vocabulary', () => {
    const newCard = makeCard('new-1', { state: 'new', dueAt: NOW - 60_000 });
    const reviewLogs = Array.from({ length: 3 }, (_value, index) => makeReviewLog(index + 1));

    expect(
      buildNextNewCardLabel({
        cards: [newCard],
        deckId: DECK_ID,
        preset: makePreset({ reviewsBetweenNewCards: 5 }),
        reviewLogs,
        remainingCandidateIds: [],
        cardStateById: { [newCard.id]: newCard.state },
        now: NOW,
      }),
    ).toBe('Neue Vokabel: 3/5');
  });

  it('builds pacing progress from reviews since the last new vocabulary', () => {
    const newCard = makeCard('new-1', { state: 'new', dueAt: NOW - 60_000 });
    const reviewLogs = Array.from({ length: 3 }, (_value, index) => makeReviewLog(index + 1));

    expect(
      buildNextNewCardStatus({
        cards: [newCard],
        deckId: DECK_ID,
        preset: makePreset({ reviewsBetweenNewCards: 5 }),
        reviewLogs,
        remainingCandidateIds: [],
        cardStateById: { [newCard.id]: newCard.state },
        now: NOW,
      }),
    ).toMatchObject({
      label: 'Neue Vokabel: 3/5',
      detail: '3/5 Wiederholungen geschafft',
      progressPercent: 60,
      valueNow: 3,
      valueMax: 5,
      available: true,
    });
  });
});
