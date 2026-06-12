import { describe, expect, it } from 'vitest';
import { normalizeMediaRegistry } from '../../media/mediaRegistry';
import { enqueueMediaTransferJob } from '../../media/mediaTransferQueue';
import { runLearningMediaWorker } from '../learningMediaWorker';

describe('learningMediaWorker', () => {
  it('uploads a ready asset and completes the queued job', async () => {
    const registry = normalizeMediaRegistry({
      assets: [
        {
          id: 'asset-1',
          deckId: 'deck-1',
          kind: 'image',
          state: 'pending',
          sourceUri: 'file:///tmp/asset.png',
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    });
    const queue = enqueueMediaTransferJob(undefined, {
      id: 'job-1',
      assetId: 'asset-1',
      direction: 'upload',
      nextAttemptAt: 1,
      createdAt: 1,
      updatedAt: 1,
    });

    const result = await runLearningMediaWorker({ registry, queue, now: 1 });

    expect(result.status).toBe('completed');
    expect(result.queue.jobs[0].status).toBe('succeeded');
    expect(result.registry.assets[0].state).toBe('synced');
    expect(result.registry.assets[0].remoteUrl).toBe('file:///tmp/asset.png');
  });

  it('retries when the asset is missing', async () => {
    const queue = enqueueMediaTransferJob(undefined, {
      id: 'job-2',
      assetId: 'missing-asset',
      direction: 'upload',
      nextAttemptAt: 1,
      createdAt: 1,
      updatedAt: 1,
    });

    const result = await runLearningMediaWorker({ registry: undefined, queue, now: 1 });

    expect(result.status).toBe('failed');
    expect(result.failedJobIds).toEqual(['job-2']);
    expect(result.lastMessage).toContain('missing media asset');
  });
});
