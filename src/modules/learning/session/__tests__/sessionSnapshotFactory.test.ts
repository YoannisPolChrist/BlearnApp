import { describe, expect, it } from 'vitest';
import { resolveAvailableDeckId } from '../sessionSnapshotFactory';

describe('resolveAvailableDeckId', () => {
  it('skips a deck whose cards no longer have matching notes', () => {
    expect(resolveAvailableDeckId({
      preferredDeckIds: ['broken', 'healthy'],
      decks: [
        { id: 'broken' },
        { id: 'healthy' },
      ] as never,
      cards: [
        { id: 'broken-card', deckId: 'broken', noteId: 'missing-note' },
        { id: 'healthy-card', deckId: 'healthy', noteId: 'healthy-note' },
      ] as never,
      notes: [{ id: 'healthy-note', deckId: 'healthy' }] as never,
    })).toBe('healthy');
  });
});
