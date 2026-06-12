export type LearningMediaTransferDirection = 'upload' | 'download';
export type LearningMediaTransferStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'dead';

export interface LearningMediaTransferJob {
  id: string;
  assetId: string;
  direction: LearningMediaTransferDirection;
  status: LearningMediaTransferStatus;
  attempts: number;
  maxAttempts: number;
  priority: number;
  nextAttemptAt: number;
  createdAt: number;
  updatedAt: number;
  lastAttemptAt?: number;
  lastError?: string;
  payload?: {
    sourceUri?: string;
    remoteUrl?: string;
    checksum?: string;
  };
}

export interface LearningMediaTransferQueue {
  version: 1;
  updatedAt: number;
  jobs: LearningMediaTransferJob[];
}

export interface LearningMediaRetryPolicy {
  baseDelayMs: number;
  maxDelayMs: number;
  jitterRatio?: number;
}

export interface LearningMediaTransferJobInput extends Partial<Omit<LearningMediaTransferJob, 'id' | 'assetId' | 'direction' | 'status' | 'attempts' | 'maxAttempts' | 'priority' | 'nextAttemptAt' | 'createdAt' | 'updatedAt'>> {
  id?: string;
  assetId: string;
  direction: LearningMediaTransferDirection;
  status?: LearningMediaTransferStatus;
  attempts?: number;
  maxAttempts?: number;
  priority?: number;
  nextAttemptAt?: number;
  createdAt?: number;
  updatedAt?: number;
}

export interface ClaimMediaTransferJobResult {
  queue: LearningMediaTransferQueue;
  job?: LearningMediaTransferJob;
}

let mediaTransferJobCounter = 0;

function nowTimestamp(value?: number) {
  return Number.isFinite(value) ? Math.round(value as number) : Date.now();
}

function createTransferJobId() {
  mediaTransferJobCounter += 1;
  return `media-transfer-${Date.now().toString(36)}-${mediaTransferJobCounter.toString(36)}`;
}

function normalizeStatus(status?: string): LearningMediaTransferStatus {
  if (status === 'queued' || status === 'running' || status === 'succeeded' || status === 'failed' || status === 'dead') {
    return status;
  }

  return 'queued';
}

function normalizeDirection(direction?: string): LearningMediaTransferDirection {
  return direction === 'download' ? 'download' : 'upload';
}

function normalizeJob(input: LearningMediaTransferJobInput | LearningMediaTransferJob): LearningMediaTransferJob {
  const createdAt = nowTimestamp(input.createdAt);
  const updatedAt = Math.max(nowTimestamp(input.updatedAt), createdAt);
  const attempts = Math.max(0, Math.round(input.attempts ?? 0));
  const maxAttempts = Math.max(1, Math.round(input.maxAttempts ?? 3));

  return {
    id: input.id || createTransferJobId(),
    assetId: input.assetId.trim(),
    direction: normalizeDirection(input.direction),
    status: normalizeStatus(input.status),
    attempts,
    maxAttempts,
    priority: Number.isFinite(input.priority) ? Math.round(input.priority as number) : 0,
    nextAttemptAt: Number.isFinite(input.nextAttemptAt)
      ? Math.max(0, Math.round(input.nextAttemptAt as number))
      : updatedAt,
    createdAt,
    updatedAt,
    lastAttemptAt: Number.isFinite(input.lastAttemptAt) ? Math.round(input.lastAttemptAt as number) : undefined,
    lastError: typeof input.lastError === 'string' && input.lastError.trim() ? input.lastError.trim() : undefined,
    payload: input.payload
      ? {
          sourceUri: typeof input.payload.sourceUri === 'string' && input.payload.sourceUri.trim()
            ? input.payload.sourceUri.trim()
            : undefined,
          remoteUrl: typeof input.payload.remoteUrl === 'string' && input.payload.remoteUrl.trim()
            ? input.payload.remoteUrl.trim()
            : undefined,
          checksum: typeof input.payload.checksum === 'string' && input.payload.checksum.trim()
            ? input.payload.checksum.trim()
            : undefined,
        }
      : undefined,
  };
}

function sortJobs(jobs: LearningMediaTransferJob[]) {
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

    if (right.priority !== left.priority) {
      return right.priority - left.priority;
    }

    if (left.createdAt !== right.createdAt) {
      return left.createdAt - right.createdAt;
    }

    return left.id.localeCompare(right.id);
  });
}

export function normalizeMediaTransferQueue(
  input?: Partial<LearningMediaTransferQueue> | null,
): LearningMediaTransferQueue {
  const jobs = new Map<string, LearningMediaTransferJob>();

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
      priority: normalized.priority ?? existing.priority,
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

export function enqueueMediaTransferJob(
  queue: Partial<LearningMediaTransferQueue> | null | undefined,
  input: LearningMediaTransferJobInput,
): LearningMediaTransferQueue {
  const normalizedQueue = normalizeMediaTransferQueue(queue);
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

  return normalizeMediaTransferQueue({
    ...normalizedQueue,
    jobs: nextJobs,
    updatedAt: Math.max(normalizedQueue.updatedAt, normalizedJob.updatedAt),
  });
}

export function claimNextMediaTransferJob(
  queue: Partial<LearningMediaTransferQueue> | null | undefined,
  now = Date.now(),
): ClaimMediaTransferJobResult {
  const normalizedQueue = normalizeMediaTransferQueue(queue);
  const nextJob = normalizedQueue.jobs.find((job) => job.status === 'queued' && job.nextAttemptAt <= now);

  if (!nextJob) {
    return { queue: normalizedQueue };
  }

  const claimedJob: LearningMediaTransferJob = {
    ...nextJob,
    status: 'running',
    attempts: nextJob.attempts + 1,
    lastAttemptAt: now,
    updatedAt: now,
  };

  return {
    job: claimedJob,
    queue: normalizeMediaTransferQueue({
      ...normalizedQueue,
      jobs: normalizedQueue.jobs.map((job) => (job.id === nextJob.id ? claimedJob : job)),
      updatedAt: now,
    }),
  };
}

export function completeMediaTransferJob(
  queue: Partial<LearningMediaTransferQueue> | null | undefined,
  jobId: string,
  now = Date.now(),
): LearningMediaTransferQueue {
  const normalizedQueue = normalizeMediaTransferQueue(queue);

  return normalizeMediaTransferQueue({
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

export function failMediaTransferJob(
  queue: Partial<LearningMediaTransferQueue> | null | undefined,
  jobId: string,
  error: string,
  now = Date.now(),
  policy: Partial<LearningMediaRetryPolicy> = {},
): LearningMediaTransferQueue {
  const normalizedQueue = normalizeMediaTransferQueue(queue);
  const job = normalizedQueue.jobs.find((candidate) => candidate.id === jobId);

  if (!job) {
    return normalizedQueue;
  }

  const attempts = job.attempts;
  const maxAttempts = Math.max(1, Math.round(job.maxAttempts || 3));
  const nextAttemptAt = now + computeMediaTransferRetryDelayMs(attempts, policy);
  const isTerminal = attempts >= maxAttempts;

  return normalizeMediaTransferQueue({
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

export function computeMediaTransferRetryDelayMs(
  attempt: number,
  policy: Partial<LearningMediaRetryPolicy> = {},
) {
  const baseDelayMs = Math.max(0, Math.round(policy.baseDelayMs ?? 1_000));
  const maxDelayMs = Math.max(baseDelayMs, Math.round(policy.maxDelayMs ?? 60_000));
  const safeAttempt = Math.max(1, Math.round(attempt));
  const rawDelay = baseDelayMs * (2 ** (safeAttempt - 1));

  return Math.min(maxDelayMs, rawDelay);
}

export function getNextMediaTransferJob(
  queue: Partial<LearningMediaTransferQueue> | null | undefined,
  now = Date.now(),
): LearningMediaTransferJob | undefined {
  return normalizeMediaTransferQueue(queue).jobs.find((job) => job.status === 'queued' && job.nextAttemptAt <= now);
}

export function getMediaTransferQueueSignature(
  queue?: Partial<LearningMediaTransferQueue> | null,
): string {
  return JSON.stringify(normalizeMediaTransferQueue(queue));
}
