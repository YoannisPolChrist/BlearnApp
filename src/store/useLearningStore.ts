import { create } from 'zustand';
import { persist, subscribeWithSelector } from 'zustand/middleware';
import {
  createLearningBaseSlice,
  createLearningImportSlice,
  createLearningReviewSlice,
  createLearningReviewSessionSlice,
  createLearningStoreIndexes,
  createLearningMediaStoreState,
  createLearningReviewSessionState,
  normalizeLearningReviewSessionState,
  buildLearningStoreIndexes,
  type LearningStore,
  type LearningStoreState,
} from '@/modules/learning/store';
import { createIndexedRecordView } from '@/modules/learning/store/helpers';
import {
  getDefaultGateRule,
  getDefaultLearningPreset,
  getDefaultLearningPresets,
  migrateDeckAssignment,
  migrateGateRule,
  migrateLearningCard,
  migrateLearningDeck,
  migrateLearningNote,
  migrateLearningPreset,
  migrateReviewLog,
  migrateUnlockGrant,
} from '@/lib/learning';
import { createIndexedDbJsonStorage } from '@/lib/persistStorage';
import { replayReviewWal } from '@/modules/learning/store/reviewWriteAheadLog';
import type { LearningPreset, LearningDeck, LearningNote, LearningCard, ReviewLog } from '@/lib/learning';
import { normalizeMediaRegistry } from '@/modules/learning/media/mediaRegistry';
import { normalizeMediaTransferQueue } from '@/modules/learning/media/mediaTransferQueue';
import { normalizeLearningSyncWorkerQueue } from '@/modules/learning/workers/learningSyncWorker';
import {
  createLearningCloudLocalSyncState,
  normalizeLearningCloudLocalSyncState,
} from '@/lib/learningCloudLocalSyncState';
import {
  normalizeBrowserSavedSearch,
  normalizeCardBrowserState,
  type BrowserSavedSearch,
  type BrowserSortBy,
  type BrowserSortDirection,
  type BrowserStateFilter,
  type CardBrowserState,
} from '@/modules/learning/browser/cardBrowserStoreState';
import {
  normalizeFilteredDeckLiteDefinition,
  normalizeFilteredDeckLiteRun,
  type FilteredDeckLiteDefinition,
  type FilteredDeckLiteRun,
} from '@/modules/learning/filtered-deck/filteredDeckLiteStoreState';
import {
  createLearningBrowserAndFilteredDeckInitialState,
  createLearningBrowserAndFilteredDeckSlice,
  type LearningBrowserAndFilteredDeckActions,
  type LearningBrowserAndFilteredDeckState,
} from '@/modules/learning/store/slices/browserFilteredDeckSlice';

const learningStoreStorage = createIndexedDbJsonStorage('blearn-learning-storage');

export type {
  BrowserSavedSearch,
  BrowserSortBy,
  BrowserSortDirection,
  BrowserStateFilter,
  CardBrowserState,
  FilteredDeckLiteDefinition,
  FilteredDeckLiteRun,
};

type LearningStoreWithPhase3 = LearningStore & LearningBrowserAndFilteredDeckState & LearningBrowserAndFilteredDeckActions;

function createLearningInitialState(): LearningStoreState {
  return {
    activeDeckId: undefined,
    activeDeckUpdatedAt: undefined,
    decks: {},
    notes: {},
    cards: {},
    reviewLogs: {},
    presets: toRecordById(getDefaultLearningPresets(), {}),
    assignments: [],
    unlockGrants: [],
    importJobs: [],
    ...createLearningMediaStoreState(),
    learningSyncWorkerQueue: normalizeLearningSyncWorkerQueue(),
    learningCloudLocalSyncState: createLearningCloudLocalSyncState(),
    gateRule: migrateGateRule(getDefaultGateRule()),
    gateRuleUpdatedAt: undefined,
    reviewSession: createLearningReviewSessionState(),
    indexes: createLearningStoreIndexes(),
  };
}

// Persisted data in IndexedDB may still be in old array format or new dict format.
// These helpers gracefully convert to the expected shape.
function toRecordById<T extends { id: string }>(
  data: Record<string, T> | T[] | undefined | null,
  fallback: Record<string, T>,
): Record<string, T> {
  if (!data) return fallback;
  if (Array.isArray(data)) {
    const record: Record<string, T> = {};
    for (const item of data) {
      if (item && item.id) record[item.id] = item;
    }
    return Object.keys(record).length > 0 ? record : fallback;
  }
  return Object.keys(data).length > 0 ? data : fallback;
}

function recordValues<T>(record: Record<string, T> | T[]): T[] {
  return Array.isArray(record) ? record : Object.values(record);
}

function hasRecordEntries<T>(record: Record<string, T> | T[] | undefined | null): boolean {
  if (!record) return false;
  if (Array.isArray(record)) return record.length > 0;
  return Object.keys(record).length > 0;
}

function mergePersistedLearningState(
  persistedState: Partial<LearningStoreWithPhase3> | undefined,
  currentState: LearningStoreWithPhase3,
): LearningStoreWithPhase3 {
  const persisted = persistedState ?? {};

  // Presets: convert to array for migration, then back to dict
  const rawPresets = hasRecordEntries(persisted.presets)
    ? recordValues(persisted.presets as Record<string, unknown>)
    : recordValues(getDefaultLearningPresets() as unknown as Record<string, unknown>);
  const mergedPresetsArray = (rawPresets as unknown[]).map((preset: unknown) => migrateLearningPreset(preset as Partial<LearningPreset>));
  const defaultPreset = migrateLearningPreset(getDefaultLearningPreset());
  const presetIds = new Set(mergedPresetsArray.map((preset) => preset.id));

  if (!presetIds.has(defaultPreset.id)) {
    mergedPresetsArray.unshift(defaultPreset);
  }

  const mergedPresets: Record<string, LearningPreset> = createIndexedRecordView(mergedPresetsArray);

  // Core entities: convert persisted data (may be array or dict) to dicts
  const sourceDecks = toRecordById(persisted.decks as Record<string, LearningDeck> | LearningDeck[] | undefined, currentState.decks);
  const sourceNotes = toRecordById(persisted.notes as Record<string, LearningNote> | LearningNote[] | undefined, currentState.notes);
  const sourceCards = toRecordById(persisted.cards as Record<string, LearningCard> | LearningCard[] | undefined, currentState.cards);
  const sourceReviewLogs = toRecordById(persisted.reviewLogs as Record<string, ReviewLog> | ReviewLog[] | undefined, currentState.reviewLogs);

  const sourceAssignments = hasRecordEntries(persisted.assignments)
    ? recordValues(persisted.assignments as Record<string, unknown>)
    : currentState.assignments;
  const sourceUnlockGrants = persisted.unlockGrants?.length ? persisted.unlockGrants : currentState.unlockGrants;
  const sourceMediaRegistry = persisted.mediaRegistry ?? currentState.mediaRegistry;
  const sourceMediaTransferQueue = persisted.mediaTransferQueue ?? currentState.mediaTransferQueue;
  const sourceLearningSyncWorkerQueue = persisted.learningSyncWorkerQueue ?? currentState.learningSyncWorkerQueue;
  const sourceLearningCloudLocalSyncState =
    persisted.learningCloudLocalSyncState ?? currentState.learningCloudLocalSyncState;
  const sourceCardBrowser = persisted.cardBrowser ?? currentState.cardBrowser;
  const sourceSavedCardQueries = persisted.savedCardQueries ?? currentState.savedCardQueries;
  const sourceFilteredDeckLiteDefinition =
    persisted.filteredDeckLiteDefinition ?? currentState.filteredDeckLiteDefinition;
  const sourceFilteredDeckLiteDefinitions =
    persisted.filteredDeckLiteDefinitions ?? currentState.filteredDeckLiteDefinitions;
  const sourceFilteredDeckLiteRuns = persisted.filteredDeckLiteRuns ?? currentState.filteredDeckLiteRuns;

  // Migrate all entities (dict→dict)
  const normalizedNotes: Record<string, LearningNote> = {};
  for (const note of recordValues(sourceNotes)) {
    const migrated = migrateLearningNote(note as Partial<LearningNote>);
    normalizedNotes[migrated.id] = migrated;
  }

  const normalizedCards: Record<string, LearningCard> = {};
  for (const card of recordValues(sourceCards)) {
    const migrated = migrateLearningCard(card as Partial<LearningCard>);
    normalizedCards[migrated.id] = migrated;
  }

  const normalizedReviewLogs: Record<string, ReviewLog> = {};
  for (const log of recordValues(sourceReviewLogs)) {
    const migrated = migrateReviewLog(log as Partial<ReviewLog>);
    normalizedReviewLogs[migrated.id] = migrated;
  }

  const mergedReviewSession = normalizeLearningReviewSessionState(
    currentState.reviewSession,
    persisted.activeDeckUpdatedAt ?? currentState.activeDeckUpdatedAt,
  );

  const mergedDecks = createIndexedRecordView(
    recordValues(sourceDecks).map((deck) => {
      const migratedDeck = migrateLearningDeck(deck);
      return migratedDeck.presetId && presetIds.has(migratedDeck.presetId)
        ? migratedDeck
        : { ...migratedDeck, presetId: defaultPreset.id };
    }),
  );

  return {
    ...currentState,
    ...persisted,
    activeDeckUpdatedAt: persisted.activeDeckUpdatedAt ?? currentState.activeDeckUpdatedAt,
    presets: mergedPresets,
    decks: mergedDecks,
    notes: createIndexedRecordView(Object.values(normalizedNotes)),
    cards: createIndexedRecordView(Object.values(normalizedCards)),
    reviewLogs: createIndexedRecordView(Object.values(normalizedReviewLogs)),
    assignments: sourceAssignments.map((assignment: unknown) =>
      migrateDeckAssignment(
        assignment,
        Object.values(normalizedCards).filter(
          (card: LearningCard) => card.deckId === (assignment as { deckId?: string })?.deckId,
        ).length,
      ),
    ),
    unlockGrants: sourceUnlockGrants.map((grant) => migrateUnlockGrant(grant)),
    mediaRegistry: normalizeMediaRegistry(sourceMediaRegistry),
    mediaTransferQueue: normalizeMediaTransferQueue(sourceMediaTransferQueue),
    learningSyncWorkerQueue: normalizeLearningSyncWorkerQueue(sourceLearningSyncWorkerQueue),
    learningCloudLocalSyncState: normalizeLearningCloudLocalSyncState(sourceLearningCloudLocalSyncState),
    gateRule: migrateGateRule(persisted.gateRule ?? currentState.gateRule),
    gateRuleUpdatedAt: Number.isFinite(persisted.gateRuleUpdatedAt)
      ? persisted.gateRuleUpdatedAt
      : currentState.gateRuleUpdatedAt,
    reviewSession: mergedReviewSession,
    indexes: buildLearningStoreIndexes({
      reviewLogs: normalizedReviewLogs,
    }),
    cardBrowser: normalizeCardBrowserState(sourceCardBrowser, persisted.activeDeckId ?? currentState.activeDeckId),
    savedCardQueries: sourceSavedCardQueries.map((savedSearch) => normalizeBrowserSavedSearch(savedSearch)),
    filteredDeckLiteDefinition: normalizeFilteredDeckLiteDefinition(
      sourceFilteredDeckLiteDefinition,
      persisted.activeDeckId ?? currentState.activeDeckId,
    ),
    filteredDeckLiteDefinitions: sourceFilteredDeckLiteDefinitions.map((definition) =>
      normalizeFilteredDeckLiteDefinition(definition, persisted.activeDeckId ?? currentState.activeDeckId),
    ),
    filteredDeckLiteRuns: sourceFilteredDeckLiteRuns.map((run) => normalizeFilteredDeckLiteRun(run)),
  };
}


export const useLearningStore = create<LearningStoreWithPhase3>()(
  subscribeWithSelector(
    persist(
      (set, get, api) => ({
        ...createLearningInitialState(),
        ...createLearningBrowserAndFilteredDeckInitialState(),
        ...createLearningBaseSlice(set as never, get as never, api as never),
        ...createLearningImportSlice(set as never, get as never, api as never),
        ...createLearningReviewSlice(set as never, get as never, api as never),
        ...createLearningReviewSessionSlice(set as never, get as never, api as never),
        ...createLearningBrowserAndFilteredDeckSlice(set as never),
      }),
      {
        name: 'blearn-learning-storage',
        storage: learningStoreStorage,
        merge: mergePersistedLearningState,
        partialize: (state) => ({
          activeDeckId: state.activeDeckId,
          activeDeckUpdatedAt: state.activeDeckUpdatedAt,
          decks: state.decks,
          notes: state.notes,
          cards: state.cards,
          reviewLogs: state.reviewLogs,
          presets: state.presets,
          assignments: state.assignments,
          unlockGrants: state.unlockGrants,
          importJobs: state.importJobs,
          mediaRegistry: state.mediaRegistry,
          mediaTransferQueue: state.mediaTransferQueue,
          learningSyncWorkerQueue: state.learningSyncWorkerQueue,
          learningCloudLocalSyncState: state.learningCloudLocalSyncState,
          gateRule: state.gateRule,
          gateRuleUpdatedAt: state.gateRuleUpdatedAt,
          cardBrowser: state.cardBrowser,
          savedCardQueries: state.savedCardQueries,
          filteredDeckLiteDefinition: state.filteredDeckLiteDefinition,
          filteredDeckLiteDefinitions: state.filteredDeckLiteDefinitions,
          filteredDeckLiteRuns: state.filteredDeckLiteRuns,
        }),
      },
    ),
  ),
);

// Replay the review write-ahead log once the persisted snapshot is hydrated
// (Masterplan 2.2): reviews whose async snapshot write was killed mid-flight
// are restored from the synchronous WAL. Replay also runs when hydration has
// already finished by the time this module evaluates.
const replayWalAfterHydration = () => {
  try {
    replayReviewWal(useLearningStore);
  } catch (error) {
    console.warn('Review-WAL replay failed:', error);
  }
};

if (useLearningStore.persist.hasHydrated()) {
  replayWalAfterHydration();
} else {
  useLearningStore.persist.onFinishHydration(replayWalAfterHydration);
}
