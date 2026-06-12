import {
  completeMediaTransferJob,
  claimNextMediaTransferJob,
  failMediaTransferJob,
  normalizeMediaTransferQueue,
  type LearningMediaRetryPolicy,
  type LearningMediaTransferJob,
  type LearningMediaTransferQueue,
} from '../media/mediaTransferQueue';
import {
  getMediaAssetById,
  normalizeMediaRegistry,
  upsertMediaAsset,
  type LearningMediaAsset,
  type LearningMediaRegistry,
} from '../media/mediaRegistry';

export type LearningMediaWorkerOutcome =
  | {
      status: 'success';
      message?: string;
      assetPatch?: Partial<LearningMediaAsset>;
    }
  | {
      status: 'retry';
      message: string;
    }
  | {
      status: 'failed';
      message: string;
    };

export interface LearningMediaWorkerHandlers {
  transfer?: (input: {
    job: LearningMediaTransferJob;
    asset: LearningMediaAsset;
    now: number;
  }) => LearningMediaWorkerOutcome | Promise<LearningMediaWorkerOutcome>;
}

export interface LearningMediaWorkerRunInput {
  registry?: Partial<LearningMediaRegistry> | null;
  queue?: Partial<LearningMediaTransferQueue> | null;
  retryPolicy?: Partial<LearningMediaRetryPolicy>;
  handlers?: LearningMediaWorkerHandlers;
  now?: number;
}

export interface LearningMediaWorkerRunResult {
  registry: LearningMediaRegistry;
  queue: LearningMediaTransferQueue;
  status: 'idle' | 'completed' | 'retry' | 'failed';
  processedJobIds: string[];
  retriedJobIds: string[];
  failedJobIds: string[];
  nextRunAt?: number;
  lastMessage?: string;
}

function nowTimestamp(value?: number) {
  return Number.isFinite(value) ? Math.round(value as number) : Date.now();
}

function buildDefaultOutcome(job: LearningMediaTransferJob, asset: LearningMediaAsset): LearningMediaWorkerOutcome {
  if (job.direction === 'upload') {
    if (!asset.sourceUri && !asset.remoteUrl) {
      return { status: 'retry', message: 'media asset has no sourceUri to upload' };
    }

    return {
      status: 'success',
      message: 'asset uploaded',
      assetPatch: {
        state: 'synced',
        remoteUrl: asset.remoteUrl || asset.sourceUri,
        lastError: undefined,
      },
    };
  }

  if (!asset.remoteUrl) {
    return { status: 'retry', message: 'media asset has no remoteUrl to download' };
  }

  return {
    status: 'success',
    message: 'asset downloaded',
    assetPatch: {
      state: 'ready',
      sourceUri: asset.sourceUri || asset.remoteUrl,
      lastError: undefined,
    },
  };
}

export async function runLearningMediaWorker(
  input: LearningMediaWorkerRunInput = {},
): Promise<LearningMediaWorkerRunResult> {
  const now = nowTimestamp(input.now);
  const registry = normalizeMediaRegistry(input.registry);
  const queue = normalizeMediaTransferQueue(input.queue);
  const claimed = claimNextMediaTransferJob(queue, now);

  if (!claimed.job) {
    return {
      registry,
      queue: claimed.queue,
      status: 'idle',
      processedJobIds: [],
      retriedJobIds: [],
      failedJobIds: [],
      nextRunAt: claimed.queue.jobs.find((job) => job.status === 'queued')?.nextAttemptAt,
    };
  }

  const asset = getMediaAssetById(registry, claimed.job.assetId);
  if (!asset) {
    const nextQueue = failMediaTransferJob(claimed.queue, claimed.job.id, `missing media asset ${claimed.job.assetId}`, now, input.retryPolicy);
    return {
      registry,
      queue: nextQueue,
      status: 'failed',
      processedJobIds: [claimed.job.id],
      retriedJobIds: [],
      failedJobIds: [claimed.job.id],
      nextRunAt: nextQueue.jobs.find((job) => job.status === 'queued')?.nextAttemptAt,
      lastMessage: `missing media asset ${claimed.job.assetId}`,
    };
  }

  let outcome: LearningMediaWorkerOutcome;
  try {
    outcome = input.handlers?.transfer
      ? await Promise.resolve(input.handlers.transfer({ job: claimed.job, asset, now }))
      : buildDefaultOutcome(claimed.job, asset);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'media transfer failed';
    const nextQueue = failMediaTransferJob(claimed.queue, claimed.job.id, message, now, input.retryPolicy);

    return {
      registry,
      queue: nextQueue,
      status: 'retry',
      processedJobIds: [claimed.job.id],
      retriedJobIds: [claimed.job.id],
      failedJobIds: [],
      nextRunAt: nextQueue.jobs.find((job) => job.status === 'queued')?.nextAttemptAt,
      lastMessage: message,
    };
  }

  if (outcome.status === 'success') {
    const nextRegistry = upsertMediaAsset(registry, {
      ...asset,
      ...outcome.assetPatch,
      id: asset.id,
      updatedAt: now,
    });
    const nextQueue = completeMediaTransferJob(claimed.queue, claimed.job.id, now);

    return {
      registry: nextRegistry,
      queue: nextQueue,
      status: 'completed',
      processedJobIds: [claimed.job.id],
      retriedJobIds: [],
      failedJobIds: [],
      nextRunAt: nextQueue.jobs.find((job) => job.status === 'queued')?.nextAttemptAt,
      lastMessage: outcome.message,
    };
  }

  const nextQueue = failMediaTransferJob(claimed.queue, claimed.job.id, outcome.message, now, input.retryPolicy);
  const isTerminal = nextQueue.jobs.find((job) => job.id === claimed.job.id)?.status === 'dead';

  return {
    registry: upsertMediaAsset(registry, {
      ...asset,
      state: isTerminal ? 'failed' : asset.state,
      lastError: outcome.message,
      id: asset.id,
      updatedAt: now,
    }),
    queue: nextQueue,
    status: isTerminal ? 'failed' : 'retry',
    processedJobIds: [claimed.job.id],
    retriedJobIds: isTerminal ? [] : [claimed.job.id],
    failedJobIds: isTerminal ? [claimed.job.id] : [],
    nextRunAt: nextQueue.jobs.find((job) => job.status === 'queued')?.nextAttemptAt,
    lastMessage: outcome.message,
  };
}
