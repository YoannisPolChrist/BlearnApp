import {
  getLearningCloudStateSignature,
  mergeLearningCloudStates,
  normalizeLearningCloudState,
  type LearningCloudState,
} from '../sync/learningCloudState';

export type LearningSyncJobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'dead';

export interface LearningSyncJob {
  id: string;
  kind: 'merge';
  status: LearningSyncJobStatus;
  attempts: number;
  maxAttempts: number;
  nextAttemptAt: number;
  createdAt: number;
  updatedAt: number;
  lastAttemptAt?: number;
  lastError?: string;
  localSignature?: string;
  remoteSignature?: string;
}

export interface LearningSyncWorkerQueue {
  version: 1;
  updatedAt: number;
  jobs: LearningSyncJob[];
}

export interface LearningSyncRetryPolicy {
  baseDelayMs: number;
  maxDelayMs: number;
}

export interface LearningSyncWorkerHandlers {
  merge?: (input: {
    localState: LearningCloudState;
    remoteState: LearningCloudState;
    now: number;
    job: LearningSyncJob;
  }) => LearningCloudState | Promise<LearningCloudState>;
}

export interface LearningSyncWorkerRunInput {
  localState?: Partial<LearningCloudState> | null;
  remoteState?: Partial<LearningCloudState> | null;
  queue?: Partial<LearningSyncWorkerQueue> | null;
  retryPolicy?: Partial<LearningSyncRetryPolicy>;
  handlers?: LearningSyncWorkerHandlers;
  now?: number;
}

export interface LearningSyncWorkerRunResult {
  localState: LearningCloudState;
  remoteState: LearningCloudState;
  mergedState: LearningCloudState;
  queue: LearningSyncWorkerQueue;
  status: 'idle' | 'merged' | 'retry' | 'failed';
  processedJobIds: string[];
  retriedJobIds: string[];
  failedJobIds: string[];
  nextRunAt?: number;
  localSignature: string;
  remoteSignature: string;
  mergedSignature: string;
  lastMessage?: string;
}

export interface LearningSyncJobInput extends Partial<Omit<LearningSyncJob, 'id' | 'kind' | 'status' | 'attempts' | 'maxAttempts' | 'nextAttemptAt' | 'createdAt' | 'updatedAt'>> {
  id?: string;
  status?: LearningSyncJobStatus;
  attempts?: number;
  maxAttempts?: number;
  nextAttemptAt?: number;
  createdAt?: number;
  updatedAt?: number;
}

let learningSyncJobCounter = 0;

function nowTimestamp(value?: number) {
  return Number.isFinite(value) ? Math.round(value as number) : Date.now();
}

function createSyncJobId() {
  learningSyncJobCounter += 1;
  return `learning-sync-${Date.now().toString(36)}-${learningSyncJobCounter.toString(36)}`;
}

function normalizeStatus(status?: string): LearningSyncJobStatus {
  if (status === 'queued' || status === 'running' || status === 'succeeded' || status === 'failed' || status === 'dead') {
    return status;
  }

  return 'queued';
}

function normalizeJob(input: LearningSyncJob | LearningSyncJobInput): LearningSyncJob {
  const createdAt = nowTimestamp(input.createdAt);
  const updatedAt = Math.max(nowTimestamp(input.updatedAt), createdAt);
  const attempts = Math.max(0, Math.round(input.attempts ?? 0));
  const maxAttempts = Math.max(1, Math.round(input.maxAttempts ?? 3));

  return {
    id: input.id || createSyncJobId(),
    kind: 'merge',
    status: normalizeStatus(input.status),
    attempts,
    maxAttempts,
    nextAttemptAt: Number.isFinite(input.nextAttemptAt) ? Math.max(0, Math.round(input.nextAttemptAt as number)) : updatedAt,
    createdAt,
    updatedAt,
    lastAttemptAt: Number.isFinite(input.lastAttemptAt) ? Math.round(input.lastAttemptAt as number) : undefined,
    lastError: typeof input.lastError === 'string' && input.lastError.trim() ? input.lastError.trim() : undefined,
    localSignature: typeof input.localSignature === 'string' && input.localSignature.trim()
      ? input.localSignature.trim()
      : undefined,
    remoteSignature: typeof input.remoteSignature === 'string' && input.remoteSignature.trim()
      ? input.remoteSignature.trim()
      : undefined,
  };
}

function sortJobs(jobs: LearningSyncJob[]) {
  return [...jobs].sort((left, right) => {
    if (left.status === 'running' && right.status !== 'running') {
      return -1;
    }

    if (right.status === 'running' && left.status !== 'running') {
      return 1;
    }

    if (left.nextAttemptAt !== right.nextAttemptAt) {
      return left.nextAttemptAt - right.nextAttemptAt;
    }

    if (left.createdAt !== right.createdAt) {
      return left.createdAt - right.createdAt;
    }

    return left.id.localeCompare(right.id);
  });
}

export function normalizeLearningSyncWorkerQueue(
  input?: Partial<LearningSyncWorkerQueue> | null,
): LearningSyncWorkerQueue {
  const jobs = new Map<string, LearningSyncJob>();

  for (const job of input?.jobs || []) {
    const normalized = normalizeJob(job);
    const existing = jobs.get(normalized.id);

    if (!existing) {
      jobs.set(normalized.id, normalized);
      continue;
    }

    jobs.set(normalized.id, {
      ...existing,
      ...normalized,
      attempts: Math.max(existing.attempts, normalized.attempts),
      maxAttempts: Math.max(existing.maxAttempts, normalized.maxAttempts),
      createdAt: Math.min(existing.createdAt, normalized.createdAt),
      updatedAt: Math.max(existing.updatedAt, normalized.updatedAt),
    });
  }

  return {
    version: 1,
    updatedAt: Math.max(
      nowTimestamp(input?.updatedAt),
      ...Array.from(jobs.values()).map((job) => job.updatedAt),
    ),
    jobs: sortJobs(Array.from(jobs.values())),
  };
}

export function enqueueLearningSyncJob(
  queue: Partial<LearningSyncWorkerQueue> | null | undefined,
  input: LearningSyncJobInput,
): LearningSyncWorkerQueue {
  const normalizedQueue = normalizeLearningSyncWorkerQueue(queue);
  const normalizedJob = normalizeJob({
    ...input,
    status: input.status ?? 'queued',
  });
  const nextJobs = normalizedQueue.jobs.some((job) => job.id === normalizedJob.id)
    ? normalizedQueue.jobs.map((job) => (job.id === normalizedJob.id
      ? {
          ...job,
          ...normalizedJob,
          createdAt: Math.min(job.createdAt, normalizedJob.createdAt),
          updatedAt: Math.max(job.updatedAt, normalizedJob.updatedAt),
        }
      : job))
    : [...normalizedQueue.jobs, normalizedJob];

  return normalizeLearningSyncWorkerQueue({
    ...normalizedQueue,
    jobs: nextJobs,
    updatedAt: Math.max(normalizedQueue.updatedAt, normalizedJob.updatedAt),
  });
}

export function claimNextLearningSyncJob(
  queue: Partial<LearningSyncWorkerQueue> | null | undefined,
  now = Date.now(),
) {
  const normalizedQueue = normalizeLearningSyncWorkerQueue(queue);
  const nextJob = normalizedQueue.jobs.find((job) => job.status === 'queued' && job.nextAttemptAt <= now);

  if (!nextJob) {
    return { queue: normalizedQueue };
  }

  const claimedJob: LearningSyncJob = {
    ...nextJob,
    status: 'running',
    attempts: nextJob.attempts + 1,
    lastAttemptAt: now,
    updatedAt: now,
  };

  return {
    job: claimedJob,
    queue: normalizeLearningSyncWorkerQueue({
      ...normalizedQueue,
      jobs: normalizedQueue.jobs.map((job) => (job.id === nextJob.id ? claimedJob : job)),
      updatedAt: now,
    }),
  };
}

export function completeLearningSyncJob(
  queue: Partial<LearningSyncWorkerQueue> | null | undefined,
  jobId: string,
  now = Date.now(),
): LearningSyncWorkerQueue {
  const normalizedQueue = normalizeLearningSyncWorkerQueue(queue);

  return normalizeLearningSyncWorkerQueue({
    ...normalizedQueue,
    jobs: normalizedQueue.jobs.map((job) => (job.id === jobId
      ? {
          ...job,
          status: 'succeeded',
          nextAttemptAt: now,
          updatedAt: now,
        }
      : job)),
    updatedAt: now,
  });
}

export function failLearningSyncJob(
  queue: Partial<LearningSyncWorkerQueue> | null | undefined,
  jobId: string,
  error: string,
  now = Date.now(),
  policy: Partial<LearningSyncRetryPolicy> = {},
): LearningSyncWorkerQueue {
  const normalizedQueue = normalizeLearningSyncWorkerQueue(queue);
  const job = normalizedQueue.jobs.find((candidate) => candidate.id === jobId);

  if (!job) {
    return normalizedQueue;
  }

  const attempts = job.attempts;
  const maxAttempts = Math.max(1, Math.round(job.maxAttempts || 3));
  const nextAttemptAt = now + computeLearningSyncRetryDelayMs(attempts, policy);
  const isTerminal = attempts >= maxAttempts;

  return normalizeLearningSyncWorkerQueue({
    ...normalizedQueue,
    jobs: normalizedQueue.jobs.map((candidate) => (candidate.id === jobId
      ? {
          ...candidate,
          status: isTerminal ? 'dead' : 'queued',
          lastError: error,
          nextAttemptAt: isTerminal ? now : nextAttemptAt,
          updatedAt: now,
        }
      : candidate)),
    updatedAt: now,
  });
}

export function computeLearningSyncRetryDelayMs(
  attempt: number,
  policy: Partial<LearningSyncRetryPolicy> = {},
) {
  const baseDelayMs = Math.max(0, Math.round(policy.baseDelayMs ?? 2_000));
  const maxDelayMs = Math.max(baseDelayMs, Math.round(policy.maxDelayMs ?? 120_000));
  const safeAttempt = Math.max(1, Math.round(attempt));
  const rawDelay = baseDelayMs * (2 ** (safeAttempt - 1));

  return Math.min(maxDelayMs, rawDelay);
}

export async function runLearningSyncWorker(
  input: LearningSyncWorkerRunInput = {},
): Promise<LearningSyncWorkerRunResult> {
  const now = nowTimestamp(input.now);
  const localState = normalizeLearningCloudState(input.localState);
  const remoteState = normalizeLearningCloudState(input.remoteState);
  const localSignature = getLearningCloudStateSignature(localState);
  const remoteSignature = getLearningCloudStateSignature(remoteState);
  const baselineMergedState = mergeLearningCloudStates(localState, remoteState);
  const mergedSignature = getLearningCloudStateSignature(baselineMergedState);

  let queue = normalizeLearningSyncWorkerQueue(input.queue);

  if (queue.jobs.length === 0 && localSignature !== remoteSignature) {
    queue = enqueueLearningSyncJob(queue, {
      kind: 'merge',
      status: 'queued',
      attempts: 0,
      maxAttempts: 3,
      nextAttemptAt: now,
      localSignature,
      remoteSignature,
      createdAt: now,
      updatedAt: now,
    });
  }

  const claimed = claimNextLearningSyncJob(queue, now);
  if (!claimed.job) {
    return {
      localState,
      remoteState,
      mergedState: baselineMergedState,
      queue: claimed.queue,
      status: localSignature === remoteSignature ? 'idle' : 'merged',
      processedJobIds: [],
      retriedJobIds: [],
      failedJobIds: [],
      nextRunAt: claimed.queue.jobs.find((job) => job.status === 'queued')?.nextAttemptAt,
      localSignature,
      remoteSignature,
      mergedSignature,
    };
  }

  try {
    const mergedState = input.handlers?.merge
      ? await Promise.resolve(input.handlers.merge({
          localState,
          remoteState,
          now,
          job: claimed.job,
        }))
      : baselineMergedState;

    const nextQueue = completeLearningSyncJob(claimed.queue, claimed.job.id, now);

    return {
      localState,
      remoteState,
      mergedState,
      queue: nextQueue,
      status: 'merged',
      processedJobIds: [claimed.job.id],
      retriedJobIds: [],
      failedJobIds: [],
      nextRunAt: nextQueue.jobs.find((job) => job.status === 'queued')?.nextAttemptAt,
      localSignature,
      remoteSignature,
      mergedSignature: getLearningCloudStateSignature(mergedState),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'learning sync failed';
    const nextQueue = failLearningSyncJob(claimed.queue, claimed.job.id, message, now, input.retryPolicy);
    const isTerminal = nextQueue.jobs.find((job) => job.id === claimed.job.id)?.status === 'dead';

    return {
      localState,
      remoteState,
      mergedState: baselineMergedState,
      queue: nextQueue,
      status: isTerminal ? 'failed' : 'retry',
      processedJobIds: [claimed.job.id],
      retriedJobIds: isTerminal ? [] : [claimed.job.id],
      failedJobIds: isTerminal ? [claimed.job.id] : [],
      nextRunAt: nextQueue.jobs.find((job) => job.status === 'queued')?.nextAttemptAt,
      localSignature,
      remoteSignature,
      mergedSignature,
      lastMessage: message,
    };
  }
}
