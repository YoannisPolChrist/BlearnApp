import type { ImportJob, LearningCard, LearningDeck, LearningNote, ReviewLog } from '@/lib/learning';
import { migrateLearningCard, migrateLearningDeck } from '@/lib/learning';
import type { LearningStoreIndexes } from './types';
import {
  type LearningMediaRegistry,
  isInlineDataUrl,
  normalizeMediaRegistry,
  toNoteMediaRef,
  upsertMediaAsset,
} from '../media/mediaRegistry';
import {
  type LearningMediaTransferQueue,
  enqueueMediaTransferJob,
  normalizeMediaTransferQueue,
} from '../media/mediaTransferQueue';

export interface ImportedEntities {
  decks: LearningDeck[];
  notes: LearningNote[];
  cards: LearningCard[];
}

export interface LearningMediaStoreState {
  mediaRegistry: LearningMediaRegistry;
  mediaTransferQueue: LearningMediaTransferQueue;
}

export function createIndexedRecordView<T extends { id: string }>(
  items: Record<string, T> | T[],
): Record<string, T> {
  const record = Array.isArray(items)
    ? Object.fromEntries(items.map((item) => [item.id, item]))
    : { ...items };

  Object.values(record).forEach((item, index) => {
    Object.defineProperty(record, index, {
      configurable: true,
      enumerable: false,
      value: item,
      writable: true,
    });
  });

  return record;
}

type IndexedReviewLogState = {
  reviewLogs: Record<string, ReviewLog> | ReviewLog[];
};

function toReviewLogArray(reviewLogs: IndexedReviewLogState['reviewLogs']) {
  return Array.isArray(reviewLogs) ? reviewLogs : Object.values(reviewLogs || {});
}

export function createLearningStoreIndexes(): LearningStoreIndexes {
  return {
    reviewLogIndicesByDeckId: {},
  };
}

export function buildLearningStoreIndexes(state: IndexedReviewLogState): LearningStoreIndexes {
  const reviewLogIndicesByDeckId: Record<string, number[]> = {};

  toReviewLogArray(state.reviewLogs).forEach((reviewLog, index) => {
    const indices = reviewLogIndicesByDeckId[reviewLog.deckId];
    if (indices) {
      indices.push(index);
      return;
    }

    reviewLogIndicesByDeckId[reviewLog.deckId] = [index];
  });

  return {
    reviewLogIndicesByDeckId,
  };
}

export function prependLearningReviewLogIndex(
  indexes: LearningStoreIndexes,
  reviewLog: Pick<ReviewLog, 'deckId'>,
): LearningStoreIndexes {
  const shifted = Object.fromEntries(
    Object.entries(indexes.reviewLogIndicesByDeckId).map(([deckId, deckIndices]) => [
      deckId,
      deckIndices.map((index) => index + 1),
    ]),
  );

  return {
    reviewLogIndicesByDeckId: {
      ...shifted,
      [reviewLog.deckId]: [0, ...(shifted[reviewLog.deckId] || [])],
    },
  };
}

export function applyLearningStoreIndexes<TState extends IndexedReviewLogState>(
  state: TState,
): TState & { indexes: LearningStoreIndexes } {
  return {
    ...state,
    indexes: buildLearningStoreIndexes(state),
  };
}

export function createLearningMediaStoreState(): LearningMediaStoreState {
  return {
    mediaRegistry: normalizeMediaRegistry(),
    mediaTransferQueue: normalizeMediaTransferQueue(),
  };
}

function inferLearningMediaKind(mediaUrl: string) {
  const normalized = mediaUrl.trim().toLowerCase();
  const source = normalized.split(/[?#]/)[0];

  if (source.startsWith('data:image/')) return 'image';
  if (source.startsWith('data:audio/')) return 'audio';
  if (source.startsWith('data:video/')) return 'video';
  if (source.startsWith('data:application/pdf')) return 'document';

  if (source.match(/\.(png|jpg|jpeg|gif|webp|svg|bmp|avif)$/)) return 'image';
  if (source.match(/\.(mp3|wav|ogg|m4a|aac|flac)$/)) return 'audio';
  if (source.match(/\.(mp4|webm|mov|mkv|m4v)$/)) return 'video';
  if (source.match(/\.(pdf|doc|docx|txt|rtf)$/)) return 'document';

  return 'unknown';
}

export function registerLearningMediaArtifacts(
  state: LearningMediaStoreState,
  notes: LearningNote[],
  source: ImportJob['source'] | 'starter',
  now = Date.now(),
): LearningMediaStoreState {
  let mediaRegistry = state.mediaRegistry;
  let mediaTransferQueue = state.mediaTransferQueue;

  for (const note of notes) {
    const mediaUrl = note.mediaUrl?.trim();
    if (!mediaUrl) {
      continue;
    }

    const assetId = `media-asset-${note.id}`;
    // data:-Blobs bleiben einzig in der Note; Registry/Queue halten nur die Referenz.
    const persistableUri = isInlineDataUrl(mediaUrl) ? toNoteMediaRef(note.id) : mediaUrl;
    mediaRegistry = upsertMediaAsset(mediaRegistry, {
      id: assetId,
      deckId: note.deckId,
      noteId: note.id,
      kind: inferLearningMediaKind(mediaUrl),
      state: 'pending',
      sourceUri: persistableUri,
      metadata: {
        source,
        noteType: note.type,
        language: note.language,
      },
      createdAt: now,
      updatedAt: now,
    });

    mediaTransferQueue = enqueueMediaTransferJob(mediaTransferQueue, {
      id: `media-transfer-${note.id}`,
      assetId,
      direction: 'upload',
      status: 'queued',
      priority: 0,
      nextAttemptAt: now,
      createdAt: now,
      updatedAt: now,
      payload: {
        sourceUri: persistableUri,
      },
    });
  }

  return {
    mediaRegistry,
    mediaTransferQueue,
  };
}

export function createLearningImportJob(
  filename: string,
  source: ImportJob['source'],
  importedDeckIds: string[],
  importedCardCount: number,
  error?: string,
): ImportJob {
  return {
    id: `import_${Math.random().toString(36).slice(2, 10)}`,
    filename,
    source,
    status: error ? 'failed' : 'completed',
    importedDeckIds,
    importedCardCount,
    createdAt: Date.now(),
    error,
  };
}

export function appendLearningImportJob(importJobs: ImportJob[], importJob: ImportJob): ImportJob[] {
  return [importJob, ...importJobs].slice(0, 25);
}

export function mergeLearningImportedEntities(
  state: Pick<
    {
      activeDeckId?: string;
      activeDeckUpdatedAt?: number;
      decks: Record<string, LearningDeck>;
      notes: Record<string, LearningNote>;
      cards: Record<string, LearningCard>;
      importJobs: ImportJob[];
      mediaRegistry: LearningMediaRegistry;
      mediaTransferQueue: LearningMediaTransferQueue;
    },
    'activeDeckId' | 'activeDeckUpdatedAt' | 'decks' | 'notes' | 'cards' | 'importJobs' | 'mediaRegistry' | 'mediaTransferQueue'
  >,
  entities: ImportedEntities,
  importJob: ImportJob,
) {
  const nextActiveDeckId = state.activeDeckId ?? entities.decks[0]?.id;
  const activeDeckChanged = state.activeDeckId !== nextActiveDeckId;

  const nextDecks = { ...state.decks };
  for (const deck of entities.decks) {
    nextDecks[deck.id] = migrateLearningDeck(deck);
  }

  const nextNotes = { ...state.notes };
  for (const note of entities.notes) {
    nextNotes[note.id] = note;
  }

  const nextCards = { ...state.cards };
  for (const card of entities.cards) {
    nextCards[card.id] = migrateLearningCard(card);
  }

  return {
    activeDeckId: nextActiveDeckId,
    activeDeckUpdatedAt: activeDeckChanged ? entities.decks[0]?.updatedAt : state.activeDeckUpdatedAt,
    decks: nextDecks,
    notes: nextNotes,
    cards: nextCards,
    importJobs: appendLearningImportJob(state.importJobs, importJob),
    ...registerLearningMediaArtifacts(
      {
        mediaRegistry: state.mediaRegistry,
        mediaTransferQueue: state.mediaTransferQueue,
      },
      entities.notes,
      importJob.source,
    ),
  };
}
