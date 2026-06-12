import {
  DEFAULT_PASSIVE_PRESET_ID,
  getDefaultGateRule,
  getDefaultLearningPreset,
  migrateDeckAssignment,
  migrateGateRule,
  migrateLearningCard,
  migrateLearningDeck,
  migrateLearningPreset,
  migrateReviewLog,
  type DeckAssignment,
  type GateRule,
  type LearningCard,
  type LearningDeck,
  type LearningNote,
  type LearningPreset,
  type ReviewLog,
} from '@/lib/learning';
import {
  getCardRevision,
  getDeckRevision,
  getNoteRevision,
  getPresetRevision,
  getReviewLogRevision,
  mergeById,
  normalizeActiveDeckSelection,
  normalizeLearningNote,
  normalizeRevisionTimestamp,
  pickMostRecentActiveDeckSelection,
  sortById,
} from '@/modules/learning/sync/learningSyncMappers';
import type {
  BrowserSavedSearch,
  BrowserSortBy,
  BrowserSortDirection,
  BrowserStateFilter,
  CardBrowserState,
  FilteredDeckLiteDefinition,
  FilteredDeckLiteRun,
  LearningCloudState,
} from './learningCloudStateTypes';
export type {
  BrowserSavedSearch,
  BrowserSortBy,
  BrowserSortDirection,
  BrowserStateFilter,
  CardBrowserState,
  FilteredDeckLiteDefinition,
  FilteredDeckLiteRun,
  LearningCloudState,
} from './learningCloudStateTypes';

// Keep cloud snapshots lean enough for mobile Firestore syncs on large decks.
export const MAX_CLOUD_REVIEW_LOGS = 250;

function sortReviewLogs(reviewLogs: ReviewLog[]) {
  return [...reviewLogs].sort((left, right) => {
    if (right.reviewedAt !== left.reviewedAt) {
      return right.reviewedAt - left.reviewedAt;
    }

    return left.id.localeCompare(right.id);
  });
}

function toArray<T extends { id: string }>(value: T[] | Record<string, T> | undefined | null): T[] {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : Object.values(value);
}

function sortByUpdatedAtDesc<T extends { createdAt?: number; updatedAt?: number }>(items: T[]) {
  return [...items].sort((left, right) => {
    const leftValue = Math.max(left.updatedAt || 0, left.createdAt || 0);
    const rightValue = Math.max(right.updatedAt || 0, right.createdAt || 0);
    if (rightValue !== leftValue) {
      return rightValue - leftValue;
    }
    return 0;
  });
}

function createDefaultCardBrowserState(activeDeckId?: string): CardBrowserState {
  return {
    selectedDeckId: activeDeckId,
    searchDraft: '',
    searchText: '',
    stateFilter: 'all',
    sortBy: 'due',
    sortDirection: 'asc',
    selectedCardIds: [],
    savedSearchId: undefined,
    updatedAt: 0,
  };
}

function normalizeCardBrowserState(
  state?: Partial<CardBrowserState> | null,
  activeDeckId?: string,
): CardBrowserState {
  const base = createDefaultCardBrowserState(activeDeckId);
  const stateFilter: BrowserStateFilter = state?.stateFilter === 'all'
    || state?.stateFilter === 'new'
    || state?.stateFilter === 'learning'
    || state?.stateFilter === 'review'
    || state?.stateFilter === 'relearning'
      ? state.stateFilter
      : 'all';
  const sortBy: BrowserSortBy = state?.sortBy === 'interval'
    || state?.sortBy === 'state'
    || state?.sortBy === 'deck'
    || state?.sortBy === 'front'
      ? state.sortBy
      : 'due';
  const sortDirection: BrowserSortDirection = state?.sortDirection === 'desc' ? 'desc' : 'asc';

  return {
    ...base,
    ...state,
    selectedDeckId: state?.selectedDeckId ?? base.selectedDeckId,
    searchDraft: state?.searchDraft ?? state?.searchText ?? base.searchDraft,
    searchText: state?.searchText ?? base.searchText,
    stateFilter,
    sortBy,
    sortDirection,
    selectedCardIds: Array.isArray(state?.selectedCardIds)
      ? Array.from(new Set(state.selectedCardIds.filter(Boolean)))
      : [],
    updatedAt: Number.isFinite(state?.updatedAt) ? state?.updatedAt : base.updatedAt,
  };
}

function normalizeBrowserSavedSearch(search: BrowserSavedSearch): BrowserSavedSearch {
  return {
    ...search,
    name: search.name.trim(),
    searchText: search.searchText.trim(),
    createdAt: Number.isFinite(search.createdAt) ? search.createdAt : 0,
    updatedAt: Number.isFinite(search.updatedAt) ? search.updatedAt : (Number.isFinite(search.createdAt) ? search.createdAt : 0),
  };
}

function getBrowserSavedSearchRevision(search: BrowserSavedSearch) {
  return Math.max(normalizeRevisionTimestamp(search.updatedAt), normalizeRevisionTimestamp(search.createdAt));
}

function createDefaultFilteredDeckLiteDefinition(activeDeckId?: string): FilteredDeckLiteDefinition {
  return {
    id: 'filtered-deck-lite-default',
    name: 'Filtered Deck Lite',
    selectedDeckId: activeDeckId,
    primaryQuery: '',
    secondaryQuery: '',
    limit: 25,
    reschedule: false,
    allowEmpty: true,
    delayAgain: 10,
    delayHard: 30,
    delayGood: 120,
    updatedAt: 0,
  };
}

function normalizeFilteredDeckLiteDefinition(
  definition?: Partial<FilteredDeckLiteDefinition> | null,
  activeDeckId?: string,
): FilteredDeckLiteDefinition {
  const base = createDefaultFilteredDeckLiteDefinition(activeDeckId);
  return {
    ...base,
    ...definition,
    id: definition?.id?.trim() || base.id,
    name: definition?.name?.trim() || base.name,
    selectedDeckId: definition?.selectedDeckId ?? base.selectedDeckId,
    primaryQuery: definition?.primaryQuery ?? base.primaryQuery,
    secondaryQuery: definition?.secondaryQuery ?? base.secondaryQuery,
    limit: Math.max(1, Math.round(definition?.limit ?? base.limit)),
    reschedule: Boolean(definition?.reschedule ?? base.reschedule),
    allowEmpty: Boolean(definition?.allowEmpty ?? base.allowEmpty),
    delayAgain: Math.max(0, Math.round(definition?.delayAgain ?? base.delayAgain)),
    delayHard: Math.max(0, Math.round(definition?.delayHard ?? base.delayHard)),
    delayGood: Math.max(0, Math.round(definition?.delayGood ?? base.delayGood)),
    lastRunAt: Number.isFinite(definition?.lastRunAt) ? definition?.lastRunAt : definition?.lastRunAt,
    updatedAt: Number.isFinite(definition?.updatedAt) ? definition?.updatedAt : base.updatedAt,
  };
}

function getFilteredDeckLiteDefinitionRevision(definition: FilteredDeckLiteDefinition) {
  return Math.max(
    normalizeRevisionTimestamp(definition.updatedAt),
    normalizeRevisionTimestamp(definition.lastRunAt),
  );
}

function normalizeFilteredDeckLiteRun(run: FilteredDeckLiteRun): FilteredDeckLiteRun {
  const createdAt = Number.isFinite(run.createdAt) ? run.createdAt : 0;
  return {
    ...run,
    name: run.name.trim(),
    preview: Array.isArray(run.preview) ? run.preview : [],
    createdAt,
    updatedAt: Number.isFinite(run.updatedAt) ? run.updatedAt : createdAt,
  };
}

function getFilteredDeckLiteRunRevision(run: FilteredDeckLiteRun) {
  return Math.max(
    normalizeRevisionTimestamp(run.updatedAt),
    normalizeRevisionTimestamp(run.createdAt),
  );
}

function sortDecks(decks: LearningDeck[]) {
  return [...decks].sort((left, right) => left.id.localeCompare(right.id));
}

function sortNotes(notes: LearningNote[]) {
  return [...notes].sort((left, right) => left.id.localeCompare(right.id));
}

function sortCards(cards: LearningCard[]) {
  return [...cards].sort((left, right) => left.id.localeCompare(right.id));
}

function sortPresets(presets: LearningPreset[]) {
  return [...presets].sort((left, right) => left.id.localeCompare(right.id));
}

function createDefaultGateRuleState(): GateRule {
  return migrateGateRule(getDefaultGateRule());
}

function pickMostRecentBrowserState(
  localState: Partial<CardBrowserState> | undefined,
  remoteState: Partial<CardBrowserState> | undefined,
  activeDeckId?: string,
) {
  const local = normalizeCardBrowserState(localState, activeDeckId);
  const remote = normalizeCardBrowserState(remoteState, activeDeckId);

  return (remote.updatedAt || 0) > (local.updatedAt || 0) ? remote : local;
}

function pickMostRecentFilteredDeckDefinition(
  localState: Partial<FilteredDeckLiteDefinition> | undefined,
  remoteState: Partial<FilteredDeckLiteDefinition> | undefined,
  activeDeckId?: string,
) {
  const local = normalizeFilteredDeckLiteDefinition(localState, activeDeckId);
  const remote = normalizeFilteredDeckLiteDefinition(remoteState, activeDeckId);

  return (remote.updatedAt || 0) > (local.updatedAt || 0) ? remote : local;
}

export function normalizeLearningCloudState(
  state?: Partial<LearningCloudState> | null,
): LearningCloudState {
  const normalizedPresets = sortPresets(
    toArray(state?.presets as LearningPreset[] | Record<string, LearningPreset>).map((preset) => migrateLearningPreset(preset)),
  );
  const defaultPreset = migrateLearningPreset(getDefaultLearningPreset());
  const presetIds = new Set(normalizedPresets.map((preset) => preset.id));
  const presets = presetIds.has(defaultPreset.id)
    ? normalizedPresets
    : sortPresets([defaultPreset, ...normalizedPresets]);

  const decks = sortDecks(
    toArray(state?.decks as LearningDeck[] | Record<string, LearningDeck>).map((deck) => {
      const migratedDeck = migrateLearningDeck(deck);
      return {
        ...migratedDeck,
        presetId: migratedDeck.presetId && presetIds.has(migratedDeck.presetId)
          ? migratedDeck.presetId
          : DEFAULT_PASSIVE_PRESET_ID,
        tags: Array.isArray(migratedDeck.tags)
          ? Array.from(new Set(migratedDeck.tags.filter(Boolean)))
          : [],
        cardIds: Array.isArray(migratedDeck.cardIds)
          ? Array.from(new Set(migratedDeck.cardIds.filter(Boolean)))
          : [],
      };
    }),
  );
  const activeDeckSelection = normalizeActiveDeckSelection(
    state?.activeDeckId,
    state?.activeDeckUpdatedAt,
    decks,
  );
  const browser = normalizeCardBrowserState(state?.cardBrowser, activeDeckSelection.activeDeckId);
  const savedCardQueries = sortByUpdatedAtDesc(
    toArray(state?.savedCardQueries as BrowserSavedSearch[] | Record<string, BrowserSavedSearch>).map((search) => normalizeBrowserSavedSearch(search)),
  );
  const filteredDeckLiteDefinition = normalizeFilteredDeckLiteDefinition(
    state?.filteredDeckLiteDefinition,
    activeDeckSelection.activeDeckId,
  );
  const filteredDeckLiteDefinitions = sortByUpdatedAtDesc(
    toArray(state?.filteredDeckLiteDefinitions as FilteredDeckLiteDefinition[] | Record<string, FilteredDeckLiteDefinition>).map((definition) =>
      normalizeFilteredDeckLiteDefinition(definition, activeDeckSelection.activeDeckId),
    ),
  );
  const filteredDeckLiteRuns = sortByUpdatedAtDesc(
    toArray(state?.filteredDeckLiteRuns as FilteredDeckLiteRun[] | Record<string, FilteredDeckLiteRun>).map((run) => normalizeFilteredDeckLiteRun(run)),
  );
  const notes = sortNotes(
    toArray(state?.notes as LearningNote[] | Record<string, LearningNote>).map((note) => normalizeLearningNote(note)),
  );
  const cards = sortCards(
    toArray(state?.cards as LearningCard[] | Record<string, LearningCard>).map((card) => migrateLearningCard(card)),
  );
  const reviewLogs = sortReviewLogs(
    toArray(state?.reviewLogs as ReviewLog[] | Record<string, ReviewLog>)
      .map((log) => migrateReviewLog(log)),
  ).slice(0, MAX_CLOUD_REVIEW_LOGS);
  const cardCountByDeck = new Map<string, number>();
  for (const card of cards) {
    cardCountByDeck.set(card.deckId, (cardCountByDeck.get(card.deckId) || 0) + 1);
  }
  const assignments = sortById(
    toArray(state?.assignments as DeckAssignment[] | Record<string, DeckAssignment>)
      .map((assignment) => migrateDeckAssignment(assignment, cardCountByDeck.get(assignment.deckId) || 0)),
  );
  const gateRule = migrateGateRule(state?.gateRule ?? createDefaultGateRuleState());
  const gateRuleUpdatedAt = normalizeRevisionTimestamp(state?.gateRuleUpdatedAt) || undefined;

  return {
    activeDeckId: activeDeckSelection.activeDeckId,
    activeDeckUpdatedAt: activeDeckSelection.activeDeckUpdatedAt,
    decks,
    notes,
    cards,
    reviewLogs,
    presets,
    assignments,
    gateRule,
    gateRuleUpdatedAt,
    cardBrowser: browser,
    savedCardQueries,
    filteredDeckLiteDefinition,
    filteredDeckLiteDefinitions,
    filteredDeckLiteRuns,
  };
}

export function mergeLearningCloudStates(
  localState?: Partial<LearningCloudState> | null,
  remoteState?: Partial<LearningCloudState> | null,
): LearningCloudState {
  const normalizedLocal = normalizeLearningCloudState(localState);
  const normalizedRemote = normalizeLearningCloudState(remoteState);

  const presets = sortPresets(
    mergeById(normalizedLocal.presets, normalizedRemote.presets, getPresetRevision),
  );
  const presetIds = new Set(presets.map((preset) => preset.id));
  const decks = sortDecks(
    mergeById(normalizedLocal.decks, normalizedRemote.decks, getDeckRevision).map((deck) => ({
      ...deck,
      presetId: deck.presetId && presetIds.has(deck.presetId)
        ? deck.presetId
        : DEFAULT_PASSIVE_PRESET_ID,
    })),
  );
  const activeDeckSelection = pickMostRecentActiveDeckSelection(
    normalizeActiveDeckSelection(
      normalizedLocal.activeDeckId,
      normalizedLocal.activeDeckUpdatedAt,
      decks,
    ),
    normalizeActiveDeckSelection(
      normalizedRemote.activeDeckId,
      normalizedRemote.activeDeckUpdatedAt,
      decks,
    ),
  );

  const cardBrowser = pickMostRecentBrowserState(
    normalizedLocal.cardBrowser,
    normalizedRemote.cardBrowser,
    activeDeckSelection.activeDeckId,
  );
  const savedCardQueries = sortByUpdatedAtDesc(
    mergeById(normalizedLocal.savedCardQueries, normalizedRemote.savedCardQueries, getBrowserSavedSearchRevision),
  );
  const filteredDeckLiteDefinition = pickMostRecentFilteredDeckDefinition(
    normalizedLocal.filteredDeckLiteDefinition,
    normalizedRemote.filteredDeckLiteDefinition,
    activeDeckSelection.activeDeckId,
  );
  const filteredDeckLiteDefinitions = sortByUpdatedAtDesc(
    mergeById(
      normalizedLocal.filteredDeckLiteDefinitions,
      normalizedRemote.filteredDeckLiteDefinitions,
      getFilteredDeckLiteDefinitionRevision,
    ),
  );
  const filteredDeckLiteRuns = sortByUpdatedAtDesc(
    mergeById(
      normalizedLocal.filteredDeckLiteRuns,
      normalizedRemote.filteredDeckLiteRuns,
      getFilteredDeckLiteRunRevision,
    ),
  );
  const cards = sortById(
    mergeById(normalizedLocal.cards, normalizedRemote.cards, getCardRevision),
  );
  const cardCountByDeck = new Map<string, number>();
  for (const card of cards) {
    cardCountByDeck.set(card.deckId, (cardCountByDeck.get(card.deckId) || 0) + 1);
  }
  const assignments = sortById(
    mergeById(
      normalizedLocal.assignments,
      normalizedRemote.assignments,
      (assignment) => normalizeRevisionTimestamp(assignment.updatedAt),
    ).map((assignment) =>
      migrateDeckAssignment(
        assignment,
        cardCountByDeck.get(assignment.deckId) || 0,
      ),
    ),
  );
  const localGateRuleRevision = normalizeRevisionTimestamp(normalizedLocal.gateRuleUpdatedAt);
  const remoteGateRuleRevision = normalizeRevisionTimestamp(normalizedRemote.gateRuleUpdatedAt);
  const gateRuleUpdatedAt = Math.max(localGateRuleRevision, remoteGateRuleRevision);
  const gateRule = gateRuleUpdatedAt === remoteGateRuleRevision
    ? migrateGateRule(normalizedRemote.gateRule)
    : migrateGateRule(normalizedLocal.gateRule);

  return normalizeLearningCloudState({
    activeDeckId: activeDeckSelection.activeDeckId,
    activeDeckUpdatedAt: activeDeckSelection.activeDeckUpdatedAt,
    decks,
    notes: sortById(
      mergeById(normalizedLocal.notes, normalizedRemote.notes, getNoteRevision),
    ),
    cards,
    reviewLogs: sortReviewLogs(
      mergeById(normalizedLocal.reviewLogs, normalizedRemote.reviewLogs, getReviewLogRevision),
    ).slice(0, MAX_CLOUD_REVIEW_LOGS),
    presets,
    assignments,
    gateRule,
    gateRuleUpdatedAt: gateRuleUpdatedAt || undefined,
    cardBrowser,
    savedCardQueries,
    filteredDeckLiteDefinition,
    filteredDeckLiteDefinitions,
    filteredDeckLiteRuns,
  });
}
