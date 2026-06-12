import { describe, expect, it } from 'vitest';
import type { LearningCard } from '@/modules/learning/domain/entities';
import { getDueSessionCards } from '@/modules/learning/review/queues';

function buildCard(id: string, overrides: Partial<LearningCard> = {}): LearningCard {
  return {
    id,
    noteId: `note_${id}`,
    deckId: 'deck_1',
    type: 'basic',
    state: 'review',
    dueAt: 1_000,
    intervalDays: 3,
    easeFactor: 2.5,
    reps: 4,
    lapses: 0,
    stepIndex: 0,
    memoryState: null,
    createdAt: 0,
    ...overrides,
  } as LearningCard;
}

describe('getDueSessionCards — suspended cards (Masterplan 4.2)', () => {
  const NOW = 10_000;

  it('never includes suspended cards, even when their dueAt has passed', () => {
    const cards = [
      buildCard('due_review', { state: 'review', dueAt: 1_000 }),
      buildCard('due_suspended', { state: 'suspended', dueAt: 1_000 }),
      buildCard('due_relearning', { state: 'relearning', dueAt: 2_000 }),
    ];

    const due = getDueSessionCards(cards, undefined, NOW);
    const dueIds = due.map((card) => card.id);

    expect(dueIds).toContain('due_review');
    expect(dueIds).toContain('due_relearning');
    // Acceptance criterion: suspended cards appear in no queue and therefore
    // in no blocking learn flow.
    expect(dueIds).not.toContain('due_suspended');
  });

  it('still excludes suspended cards when a deck filter is applied', () => {
    const cards = [
      buildCard('a', { state: 'suspended', dueAt: 0, deckId: 'deck_1' }),
      buildCard('b', { state: 'review', dueAt: 0, deckId: 'deck_1' }),
    ];

    const due = getDueSessionCards(cards, ['deck_1'], NOW);
    expect(due.map((card) => card.id)).toEqual(['b']);
  });
});
