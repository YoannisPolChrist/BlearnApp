import { describe, expect, it } from 'vitest';
import {
  claimNextMediaTransferJob,
  computeMediaTransferRetryDelayMs,
  enqueueMediaTransferJob,
  failMediaTransferJob,
  normalizeMediaTransferQueue,
} from '../mediaTransferQueue';

describe('mediaTransferQueue', () => {
  it('claims due jobs and schedules retries with exponential backoff', () => {
    const queue = normalizeMediaTransferQueue({
      jobs: [
        {
          id: 'job-1',
          assetId: 'asset-1',
          direction: 'upload',
          status: 'queued',
          attempts: 0,
          maxAttempts: 3,
          priority: 1,
          nextAttemptAt: 100,
          createdAt: 100,
          updatedAt: 100,
        },
      ],
    });

    const claimed = claimNextMediaTransferJob(queue, 100);
    expect(claimed.job?.status).toBe('running');
    expect(claimed.job?.attempts).toBe(1);

    const retried = failMediaTransferJob(claimed.queue, 'job-1', 'temporary network issue', 1000, {
      baseDelayMs: 500,
      maxDelayMs: 4000,
    });

    expect(retried.jobs[0].status).toBe('queued');
    expect(retried.jobs[0].nextAttemptAt).toBe(1500);
    expect(computeMediaTransferRetryDelayMs(3, { baseDelayMs: 500, maxDelayMs: 4000 })).toBe(2000);
  });

  it('enqueues new jobs without duplicating ids', () => {
    const queue = enqueueMediaTransferJob(undefined, {
      id: 'job-2',
      assetId: 'asset-2',
      direction: 'download',
      nextAttemptAt: 10,
      createdAt: 10,
      updatedAt: 10,
    });

    const nextQueue = enqueueMediaTransferJob(queue, {
      id: 'job-2',
      assetId: 'asset-2',
      direction: 'download',
      status: 'queued',
      priority: 4,
      nextAttemptAt: 20,
      createdAt: 10,
      updatedAt: 20,
    });

    expect(nextQueue.jobs).toHaveLength(1);
    expect(nextQueue.jobs[0].priority).toBe(4);
    expect(nextQueue.jobs[0].nextAttemptAt).toBe(20);
  });
});
