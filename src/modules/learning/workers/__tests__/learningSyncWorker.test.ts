import { describe, expect, it } from 'vitest';
import { runLearningSyncWorker } from '../learningSyncWorker';

describe('learningSyncWorker', () => {
  it('merges local and remote state and completes a merge job', async () => {
    const result = await runLearningSyncWorker({
      now: 10,
      localState: {
        decks: [
          {
            id: 'deck-1',
            name: 'Local deck',
            description: 'local',
            language: 'de',
            tags: [],
            cardIds: [],
            createdAt: 1,
            updatedAt: 10,
          },
        ],
      },
      remoteState: {
        decks: [
          {
            id: 'deck-1',
            name: 'Remote deck',
            description: 'remote',
            language: 'de',
            tags: [],
            cardIds: [],
            createdAt: 1,
            updatedAt: 20,
          },
        ],
      },
    });

    expect(result.status).toBe('merged');
    expect(result.mergedState.decks[0].name).toBe('Remote deck');
    expect(result.queue.jobs[0].status).toBe('succeeded');
  });

  it('retries when a custom merge handler fails', async () => {
    const result = await runLearningSyncWorker({
      now: 10,
      localState: {
        decks: [
          {
            id: 'deck-1',
            name: 'Local deck',
            description: 'local',
            language: 'de',
            tags: [],
            cardIds: [],
            createdAt: 1,
            updatedAt: 10,
          },
        ],
      },
      remoteState: {
        decks: [
          {
            id: 'deck-1',
            name: 'Remote deck',
            description: 'remote',
            language: 'de',
            tags: [],
            cardIds: [],
            createdAt: 1,
            updatedAt: 20,
          },
        ],
      },
      handlers: {
        merge: () => {
          throw new Error('temporary sync failure');
        },
      },
    });

    expect(result.status).toBe('retry');
    expect(result.lastMessage).toBe('temporary sync failure');
  });
});
