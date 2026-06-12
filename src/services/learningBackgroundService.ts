import {
  getLearningCloudStateSignature,
  normalizeLearningCloudState,
  type LearningCloudState,
} from '@/lib/learningCloudSync';
import type { LearningNote } from '@/lib/learning';
import {
  enqueueLearningSyncJob,
  normalizeLearningSyncWorkerQueue,
  runLearningSyncWorker,
  type LearningSyncWorkerQueue,
} from '@/modules/learning/workers/learningSyncWorker';
import {
  enqueueMediaTransferJob,
  normalizeMediaTransferQueue,
  type LearningMediaTransferQueue,
} from '@/modules/learning/media/mediaTransferQueue';
import {
  normalizeMediaRegistry,
  upsertMediaAsset,
  type LearningMediaRegistry,
} from '@/modules/learning/media/mediaRegistry';
import { runLearningMediaWorker } from '@/modules/learning/workers/learningMediaWorker';
import type { LearningStoreState } from '@/modules/learning/store';

function recordValues<T>(record: Record<string, T> | T[]): T[] {
  return Array.isArray(record) ? record : Object.values(record);
}

export type LearningBackgroundRuntimeState = Pick<
  LearningStoreState,
  | 'activeDeckId'
  | 'activeDeckUpdatedAt'
  | 'decks'
  | 'notes'
  | 'cards'
  | 'reviewLogs'
  | 'presets'
  | 'assignments'
  | 'gateRule'
  | 'gateRuleUpdatedAt'
  | 'cardBrowser'
  | 'savedCardQueries'
  | 'filteredDeckLiteDefinition'
  | 'filteredDeckLiteDefinitions'
  | 'filteredDeckLiteRuns'
  | 'mediaRegistry'
  | 'mediaTransferQueue'
  | 'learningSyncWorkerQueue'
>;

export interface LearningMediaRuntimeResult {
  registry: LearningMediaRegistry;
  queue: LearningMediaTransferQueue;
  processedJobIds: string[];
  retriedJobIds: string[];
  failedJobIds: string[];
  status: 'idle' | 'completed' | 'retry' | 'failed';
  nextRunAt?: number;
  lastMessage?: string;
}

export interface LearningSyncRuntimeResult {
  queue: LearningSyncWorkerQueue;
  mergedState: LearningCloudState;
  localSignature: string;
  remoteSignature: string;
  mergedSignature: string;
  processedJobIds: string[];
  retriedJobIds: string[];
  failedJobIds: string[];
  status: 'idle' | 'merged' | 'retry' | 'failed';
  nextRunAt?: number;
  lastMessage?: string;
}

function inferLearningMediaKind(mediaUrl: string) {
  const normalized = mediaUrl.trim().toLowerCase();
  const source = normalized.split(/[?#]/)[0];

  if (source.startsWith('data:image/')) return 'image' as const;
  if (source.startsWith('data:audio/')) return 'audio' as const;
  if (source.startsWith('data:video/')) return 'video' as const;
  if (source.startsWith('data:application/pdf')) return 'document' as const;

  if (source.match(/\.(png|jpg|jpeg|gif|webp|svg|bmp|avif)$/)) return 'image' as const;
  if (source.match(/\.(mp3|wav|ogg|m4a|aac|flac)$/)) return 'audio' as const;
  if (source.match(/\.(mp4|webm|mov|mkv|m4v)$/)) return 'video' as const;
  if (source.match(/\.(pdf|doc|docx|txt|rtf)$/)) return 'document' as const;

  return 'unknown' as const;
}

function buildMediaAssetId(noteId: string) {
  return `media-asset-${noteId}`;
}

function buildMediaTransferJobId(noteId: string) {
  return `media-transfer-${noteId}`;
}

function buildLearningCloudStateSnapshot(state: LearningBackgroundRuntimeState): LearningCloudState {
  return normalizeLearningCloudState({
    activeDeckId: state.activeDeckId,
    activeDeckUpdatedAt: state.activeDeckUpdatedAt,
    decks: recordValues(state.decks),
    notes: recordValues(state.notes),
    cards: recordValues(state.cards),
    reviewLogs: recordValues(state.reviewLogs),
    presets: recordValues(state.presets),
    assignments: state.assignments,
    gateRule: state.gateRule,
    gateRuleUpdatedAt: state.gateRuleUpdatedAt,
    cardBrowser: state.cardBrowser,
    savedCardQueries: state.savedCardQueries,
    filteredDeckLiteDefinition: state.filteredDeckLiteDefinition,
    filteredDeckLiteDefinitions: state.filteredDeckLiteDefinitions,
    filteredDeckLiteRuns: state.filteredDeckLiteRuns,
  });
}

function shouldQueueMediaJob(
  note: LearningNote,
  registry: LearningMediaRegistry,
  queue: LearningMediaTransferQueue,
) {
  const mediaUrl = note.mediaUrl?.trim();
  if (!mediaUrl) {
    return false;
  }

  const assetId = buildMediaAssetId(note.id);
  const existingAsset = registry.assets.find((asset) => asset.id === assetId);
  const existingJob = queue.jobs.find((job) => job.id === buildMediaTransferJobId(note.id));

  if (existingAsset && existingAsset.state === 'synced' && existingAsset.sourceUri === mediaUrl && existingAsset.remoteUrl) {
    return false;
  }

  if (
    existingAsset
    && existingAsset.state === 'synced'
    && existingAsset.sourceUri === mediaUrl
    && existingAsset.remoteUrl
    && existingJob?.status === 'succeeded'
    && existingJob.payload?.sourceUri === mediaUrl
  ) {
    return false;
  }

  if (existingJob && existingJob.status !== 'dead' && existingJob.payload?.sourceUri === mediaUrl) {
    return false;
  }

  return true;
}

export async function processLearningMediaRuntime(
  state: Pick<LearningBackgroundRuntimeState, 'notes' | 'mediaRegistry' | 'mediaTransferQueue'>,
  now = Date.now(),
): Promise<LearningMediaRuntimeResult> {
  let registry = normalizeMediaRegistry(state.mediaRegistry);
  let queue = normalizeMediaTransferQueue(state.mediaTransferQueue);

  for (const note of recordValues(state.notes)) {
    const mediaUrl = note.mediaUrl?.trim();
    if (!mediaUrl) {
      continue;
    }

    if (!shouldQueueMediaJob(note, registry, queue)) {
      continue;
    }

    const assetId = buildMediaAssetId(note.id);
    const existingAsset = registry.assets.find((asset) => asset.id === assetId);

    registry = upsertMediaAsset(registry, {
      id: assetId,
      deckId: note.deckId,
      noteId: note.id,
      kind: inferLearningMediaKind(mediaUrl),
      state: existingAsset?.state === 'synced' && existingAsset.sourceUri === mediaUrl ? existingAsset.state : 'pending',
      sourceUri: mediaUrl,
      remoteUrl: existingAsset?.sourceUri === mediaUrl ? existingAsset.remoteUrl : undefined,
      checksum: existingAsset?.checksum,
      mimeType: existingAsset?.mimeType,
      bytes: existingAsset?.bytes,
      lastError: undefined,
      metadata: existingAsset?.metadata,
      createdAt: existingAsset?.createdAt ?? now,
      updatedAt: now,
    });

    queue = enqueueMediaTransferJob(queue, {
      id: buildMediaTransferJobId(note.id),
      assetId,
      direction: 'upload',
      status: 'queued',
      priority: 0,
      nextAttemptAt: now,
      createdAt: now,
      updatedAt: now,
      payload: {
        sourceUri: mediaUrl,
      },
    });
  }

  let result = await runLearningMediaWorker({
    registry,
    queue,
    now,
  });

  const processedJobIds: string[] = [];
  const retriedJobIds: string[] = [];
  const failedJobIds: string[] = [];
  let overallStatus: LearningMediaRuntimeResult['status'] = 'idle';
  let nextRunAt = result.nextRunAt;
  let lastMessage = result.lastMessage;
  let safetyCounter = 0;

  while (safetyCounter < 5) {
    processedJobIds.push(...result.processedJobIds);
    retriedJobIds.push(...result.retriedJobIds);
    failedJobIds.push(...result.failedJobIds);
    if (result.status !== 'idle') {
      overallStatus = result.status;
    }
    nextRunAt = result.nextRunAt;
    lastMessage = result.lastMessage;

    if (result.processedJobIds.length === 0) {
      break;
    }

    safetyCounter += 1;
    registry = result.registry;
    queue = result.queue;
    result = await runLearningMediaWorker({
      registry,
      queue,
      now,
    });
  }

  return {
    registry: result.registry,
    queue: result.queue,
    processedJobIds,
    retriedJobIds,
    failedJobIds,
    status: overallStatus,
    nextRunAt,
    lastMessage,
  };
}

export async function processLearningSyncRuntime(
  state: LearningBackgroundRuntimeState,
  remoteState?: Partial<LearningCloudState> | null,
  now = Date.now(),
  options: { forceRun?: boolean } = {},
): Promise<LearningSyncRuntimeResult> {
  const localState = buildLearningCloudStateSnapshot(state);
  const normalizedRemoteState = normalizeLearningCloudState(remoteState);
  const localSignature = getLearningCloudStateSignature(localState);
  const remoteSignature = getLearningCloudStateSignature(normalizedRemoteState);
  let queue = normalizeLearningSyncWorkerQueue(state.learningSyncWorkerQueue);
  const signaturesMatch = localSignature === remoteSignature;

  if (signaturesMatch) {
    queue = normalizeLearningSyncWorkerQueue({
      ...queue,
      jobs: queue.jobs.filter((job) => job.status !== 'queued' && job.status !== 'running'),
    });

    return {
      queue,
      mergedState: localState,
      localSignature,
      remoteSignature,
      mergedSignature: localSignature,
      processedJobIds: [],
      retriedJobIds: [],
      failedJobIds: [],
      status: 'idle',
      nextRunAt: queue.jobs.find((job) => job.status === 'queued')?.nextAttemptAt,
      lastMessage: undefined,
    };
  }

  const activeJob = queue.jobs.find((job) => job.status === 'queued' || job.status === 'running');
  const shouldEnqueue = options.forceRun || !activeJob;

  if (shouldEnqueue) {
    queue = enqueueLearningSyncJob(queue, {
      id: 'learning-sync-maintenance',
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

  const result = await runLearningSyncWorker({
    localState,
    remoteState: normalizedRemoteState,
    queue,
    now,
  });

  return {
    queue: result.queue,
    mergedState: result.mergedState,
    localSignature: result.localSignature,
    remoteSignature: result.remoteSignature,
    mergedSignature: result.mergedSignature,
    processedJobIds: result.processedJobIds,
    retriedJobIds: result.retriedJobIds,
    failedJobIds: result.failedJobIds,
    status: result.status,
    nextRunAt: result.nextRunAt,
    lastMessage: result.lastMessage,
  };
}
