import {
  DEFAULT_PASSIVE_PRESET_ID,
  migrateLearningCard,
  migrateLearningDeck,
  migrateLearningPreset,
  type LearningCard,
  type LearningDeck,
  type LearningNote,
  type LearningPreset,
  type ReviewLog,
} from '@/lib/learning';
import { normalizeLearningNote, getCardRevision, getDeckRevision, getNoteRevision, getPresetRevision, getReviewLogRevision, mergeById } from './learningSyncMappers';
import {
  MAX_CLOUD_REVIEW_LOGS,
  mergeLearningCloudStates,
  normalizeLearningCloudState,
  type LearningCloudState,
} from './learningCloudState';
import type { SyncMutationEntry } from './syncTypes';

function createDefaultDeck(id: string, now: number): LearningDeck {
  return migrateLearningDeck({
    id,
    name: '',
    description: '',
    language: 'de',
    tags: [],
    cardIds: [],
    presetId: DEFAULT_PASSIVE_PRESET_ID,
    createdAt: now,
    updatedAt: now,
  });
}

function createDefaultNote(id: string, deckId: string, now: number): LearningNote {
  return normalizeLearningNote({
    id,
    deckId,
    type: 'basic',
    front: '',
    back: '',
    tags: [],
    language: 'de',
    createdAt: now,
  });
}

function createDefaultCard(id: string, noteId: string, deckId: string, now: number): LearningCard {
  return migrateLearningCard({
    id,
    noteId,
    deckId,
    type: 'basic',
    state: 'new',
    dueAt: now,
    intervalDays: 0,
    easeFactor: 2.5,
    reps: 0,
    lapses: 0,
    stepIndex: 0,
    memoryState: null,
    createdAt: now,
  });
}

function createDefaultPreset(id: string): LearningPreset {
  return migrateLearningPreset({
    id,
    name: id,
  });
}

function upsertDeck(
  decks: LearningDeck[],
  patch: Partial<LearningDeck> & Pick<LearningDeck, 'id'>,
  revision: number,
  now: number,
): LearningDeck[] {
  const current = decks.find((deck) => deck.id === patch.id);
  const candidate = migrateLearningDeck({
    ...(current ?? createDefaultDeck(patch.id, now)),
    ...patch,
    id: patch.id,
    createdAt: current?.createdAt ?? patch.createdAt ?? now,
    updatedAt: Math.max(current?.updatedAt ?? 0, patch.updatedAt ?? 0, revision, now),
    presetId: patch.presetId ?? current?.presetId ?? DEFAULT_PASSIVE_PRESET_ID,
    tags: Array.isArray(patch.tags) ? Array.from(new Set(patch.tags.filter(Boolean))) : current?.tags ?? [],
    cardIds: Array.isArray(patch.cardIds)
      ? Array.from(new Set(patch.cardIds.filter(Boolean)))
      : current?.cardIds ?? [],
  });
  const resolved = current
    ? mergeById([current], [candidate], getDeckRevision)[0] ?? candidate
    : candidate;
  return current
    ? decks.map((deck) => (deck.id === patch.id ? resolved : deck))
    : [...decks, resolved];
}

function upsertNote(
  notes: LearningNote[],
  patch: Partial<LearningNote> & Pick<LearningNote, 'id'>,
  revision: number,
  now: number,
): LearningNote[] {
  const current = notes.find((note) => note.id === patch.id);
  const candidate = normalizeLearningNote({
    ...(current ?? createDefaultNote(patch.id, patch.deckId ?? current?.deckId ?? '', now)),
    ...patch,
    id: patch.id,
    deckId: patch.deckId ?? current?.deckId ?? '',
    type: patch.type ?? current?.type ?? 'basic',
    front: patch.front ?? current?.front ?? '',
    back: patch.back ?? current?.back ?? '',
    tags: Array.isArray(patch.tags) ? Array.from(new Set(patch.tags.filter(Boolean))) : current?.tags ?? [],
    language: patch.language ?? current?.language ?? 'de',
    createdAt: current?.createdAt ?? patch.createdAt ?? now,
    updatedAt: Math.max(current?.updatedAt ?? 0, patch.updatedAt ?? 0, revision, now),
  });
  const resolved = current
    ? mergeById([current], [candidate], getNoteRevision)[0] ?? candidate
    : candidate;
  return current
    ? notes.map((note) => (note.id === patch.id ? resolved : note))
    : [...notes, resolved];
}

function upsertCard(
  cards: LearningCard[],
  patch: Partial<LearningCard> & Pick<LearningCard, 'id'>,
  revision: number,
  now: number,
): LearningCard[] {
  const current = cards.find((card) => card.id === patch.id);
  const candidate = migrateLearningCard({
    ...(current ?? createDefaultCard(patch.id, patch.noteId ?? current?.noteId ?? '', patch.deckId ?? current?.deckId ?? '', now)),
    ...patch,
    id: patch.id,
    noteId: patch.noteId ?? current?.noteId ?? '',
    deckId: patch.deckId ?? current?.deckId ?? '',
    type: patch.type ?? current?.type ?? 'basic',
    state: patch.state ?? current?.state ?? 'new',
    dueAt: patch.dueAt ?? current?.dueAt ?? now,
    intervalDays: patch.intervalDays ?? current?.intervalDays ?? 0,
    easeFactor: patch.easeFactor ?? current?.easeFactor ?? 2.5,
    reps: patch.reps ?? current?.reps ?? 0,
    lapses: patch.lapses ?? current?.lapses ?? 0,
    stepIndex: patch.stepIndex ?? current?.stepIndex ?? 0,
    scheduledDays: patch.scheduledDays ?? current?.scheduledDays ?? 0,
    elapsedDays: patch.elapsedDays ?? current?.elapsedDays ?? 0,
    memoryState: patch.memoryState ?? current?.memoryState ?? null,
    lastReviewedAt: patch.lastReviewedAt ?? current?.lastReviewedAt,
    createdAt: current?.createdAt ?? patch.createdAt ?? now,
    updatedAt: Math.max(current?.updatedAt ?? 0, patch.updatedAt ?? 0, revision, now),
  });
  const resolved = current
    ? mergeById([current], [candidate], getCardRevision)[0] ?? candidate
    : candidate;
  return current
    ? cards.map((card) => (card.id === patch.id ? resolved : card))
    : [...cards, resolved];
}

function upsertPreset(
  presets: LearningPreset[],
  patch: Partial<LearningPreset> & Pick<LearningPreset, 'id'>,
  revision: number,
): LearningPreset[] {
  const current = presets.find((preset) => preset.id === patch.id);
  const candidate = migrateLearningPreset({
    ...(current ?? createDefaultPreset(patch.id)),
    ...patch,
    id: patch.id,
    updatedAt: Math.max(current?.updatedAt ?? 0, patch.updatedAt ?? 0, revision, Date.now()),
  });
  const resolved = current
    ? mergeById([current], [candidate], getPresetRevision)[0] ?? candidate
    : candidate;
  if (current && getPresetRevision(candidate) < Math.max(getPresetRevision(current), revision)) {
    return presets;
  }
  return current
    ? presets.map((preset) => (preset.id === patch.id ? resolved : preset))
    : [...presets, resolved];
}

export function mergeAppendOnlyReviewLogs(
  localLogs: ReviewLog[],
  remoteLogs: ReviewLog[],
): ReviewLog[] {
  return mergeById(localLogs, remoteLogs, getReviewLogRevision)
    .slice(0, MAX_CLOUD_REVIEW_LOGS)
    .sort((left, right) => {
      if (right.reviewedAt !== left.reviewedAt) {
        return right.reviewedAt - left.reviewedAt;
      }

      return left.id.localeCompare(right.id);
    });
}

export function mergeLatestWriteWinsCloudStates(
  localState?: Partial<LearningCloudState> | null,
  remoteState?: Partial<LearningCloudState> | null,
): LearningCloudState {
  return mergeLearningCloudStates(localState, remoteState);
}

export function applyMutationToCloudState(
  state?: Partial<LearningCloudState> | null,
  mutation?: SyncMutationEntry | null,
  now = Date.now(),
): LearningCloudState {
  const normalizedState = normalizeLearningCloudState(state);
  if (!mutation) {
    return normalizedState;
  }

  switch (mutation.entityType) {
    case 'activeDeck': {
      if (mutation.kind === 'delete') {
        return normalizeLearningCloudState({
          ...normalizedState,
          activeDeckId: undefined,
          activeDeckUpdatedAt: Math.max(normalizedState.activeDeckUpdatedAt ?? 0, mutation.createdAt, now) || undefined,
        });
      }

      const payload = mutation.payload;
      return normalizeLearningCloudState({
        ...normalizedState,
        activeDeckId: payload.activeDeckId ?? normalizedState.activeDeckId,
        activeDeckUpdatedAt: Math.max(
          normalizedState.activeDeckUpdatedAt ?? 0,
          payload.activeDeckUpdatedAt ?? 0,
          mutation.createdAt,
          now,
        ) || undefined,
      });
    }
    case 'deck': {
      if (mutation.kind === 'delete') {
        return normalizeLearningCloudState({
          ...normalizedState,
          decks: normalizedState.decks.filter((deck) => deck.id !== mutation.entityId),
        });
      }

      const payload = mutation.payload;
      return normalizeLearningCloudState({
        ...normalizedState,
        decks: upsertDeck(normalizedState.decks, payload, mutation.baseRevision ?? mutation.createdAt, now),
      });
    }
    case 'note': {
      if (mutation.kind === 'delete') {
        return normalizeLearningCloudState({
          ...normalizedState,
          notes: normalizedState.notes.filter((note) => note.id !== mutation.entityId),
        });
      }

      return normalizeLearningCloudState({
        ...normalizedState,
        notes: upsertNote(
          normalizedState.notes,
          mutation.payload,
          mutation.baseRevision ?? mutation.createdAt,
          now,
        ),
      });
    }
    case 'card': {
      if (mutation.kind === 'delete') {
        return normalizeLearningCloudState({
          ...normalizedState,
          cards: normalizedState.cards.filter((card) => card.id !== mutation.entityId),
        });
      }

      return normalizeLearningCloudState({
        ...normalizedState,
        cards: upsertCard(
          normalizedState.cards,
          mutation.payload,
          mutation.baseRevision ?? mutation.createdAt,
          now,
        ),
      });
    }
    case 'preset': {
      if (mutation.kind === 'delete') {
        return normalizeLearningCloudState({
          ...normalizedState,
          presets: normalizedState.presets.filter((preset) => preset.id !== mutation.entityId),
        });
      }

      return normalizeLearningCloudState({
        ...normalizedState,
        presets: upsertPreset(
          normalizedState.presets,
          mutation.payload,
          mutation.baseRevision ?? mutation.createdAt,
        ),
      });
    }
    case 'reviewLog': {
      if (mutation.kind === 'delete') {
        return normalizedState;
      }

      const incoming = mutation.payload;
      const nextLogs = mergeAppendOnlyReviewLogs(normalizedState.reviewLogs, [incoming]);
      return normalizeLearningCloudState({
        ...normalizedState,
        reviewLogs: nextLogs,
      });
    }
    default:
      return normalizedState;
  }
}

export function resolveCloudStateConflicts(
  localState?: Partial<LearningCloudState> | null,
  remoteState?: Partial<LearningCloudState> | null,
  mutations: SyncMutationEntry[] = [],
): LearningCloudState {
  return mutations.reduce(
    (state, mutation) => applyMutationToCloudState(state, mutation),
    mergeLatestWriteWinsCloudStates(localState, remoteState),
  );
}
