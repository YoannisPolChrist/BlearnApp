import {
  getDefaultGateRule,
  migrateGateRule,
} from '@/lib/learning';
import {
  getCardRevision,
  getDeckRevision,
  getNoteRevision,
  getPresetRevision,
  getReviewLogRevision,
  normalizeRevisionTimestamp,
} from '@/modules/learning/sync/learningSyncMappers';
import { normalizeLearningCloudState } from './learningCloudStateContract';
import type {
  CardBrowserState,
  FilteredDeckLiteDefinition,
  FilteredDeckLiteRun,
  LearningCloudState,
} from './learningCloudStateTypes';

function createDefaultGateRuleState() {
  return migrateGateRule(getDefaultGateRule());
}

function getFastArraySignature<T>(items: T[] | undefined, getRevision: (item: T) => number): string {
  if (!items || items.length === 0) return '0:0:0';
  let hash = 0;
  let max = 0;
  for (const item of items) {
    const rev = getRevision(item);
    hash ^= (rev & 0xFFFFFFFF);
    if (rev > max) max = rev;
  }
  return `${items.length}:${max}:${hash >>> 0}`;
}

function hasMeaningfulBrowserState(browser: CardBrowserState) {
  return Boolean(
    browser.searchDraft.trim()
    || browser.searchText.trim()
    || browser.selectedDeckId
    || browser.selectedCardIds.length > 0
    || browser.savedSearchId
    || browser.stateFilter !== 'all'
    || browser.sortBy !== 'due'
    || browser.sortDirection !== 'asc',
  );
}

function hasMeaningfulFilteredDeckState(
  definition: FilteredDeckLiteDefinition,
  definitions: FilteredDeckLiteDefinition[],
  runs: FilteredDeckLiteRun[],
) {
  return Boolean(
    definition.id !== 'filtered-deck-lite-default'
    || definition.name !== 'Filtered Deck Lite'
    || definition.selectedDeckId
    || definition.primaryQuery.trim()
    || definition.secondaryQuery.trim()
    || definition.limit !== 25
    || definition.reschedule
    || !definition.allowEmpty
    || definition.delayAgain !== 10
    || definition.delayHard !== 30
    || definition.delayGood !== 120
    || definitions.length > 0
    || runs.length > 0,
  );
}

export function getLearningCloudStateSignature(
  state?: Partial<LearningCloudState> | null,
): string {
  if (!state) {
    return 'empty';
  }

  const decksSig = getFastArraySignature(state.decks, getDeckRevision);
  const notesSig = getFastArraySignature(state.notes, getNoteRevision);
  const cardsSig = getFastArraySignature(state.cards, getCardRevision);
  const reviewLogsSig = getFastArraySignature(state.reviewLogs, getReviewLogRevision);
  const presetsSig = getFastArraySignature(state.presets, getPresetRevision);
  const assignmentsSig = getFastArraySignature(
    state.assignments,
    (assignment) => normalizeRevisionTimestamp(assignment.updatedAt),
  );
  const gateRule = migrateGateRule(state.gateRule ?? createDefaultGateRuleState());
  const gateRuleSig = JSON.stringify(gateRule);
  const gateRuleUpdatedAt = normalizeRevisionTimestamp(state.gateRuleUpdatedAt);
  const savedQueriesRev = state.savedCardQueries?.length ? Math.max(...state.savedCardQueries.map(q => Math.max(q.updatedAt || 0, q.createdAt || 0))) : 0;
  const defsRev = state.filteredDeckLiteDefinitions?.length ? Math.max(...state.filteredDeckLiteDefinitions.map(d => Math.max(d.updatedAt || 0, d.lastRunAt || 0))) : 0;
  const runsRev = state.filteredDeckLiteRuns?.length ? Math.max(...state.filteredDeckLiteRuns.map(r => Math.max(r.updatedAt || 0, r.createdAt || 0))) : 0;

  const activeDeckRev = state.activeDeckUpdatedAt || 0;
  const browserRev = state.cardBrowser?.updatedAt || 0;
  const defRev = Math.max(state.filteredDeckLiteDefinition?.updatedAt || 0, state.filteredDeckLiteDefinition?.lastRunAt || 0);

  return `${decksSig}|${notesSig}|${cardsSig}|${reviewLogsSig}|${presetsSig}|${assignmentsSig}|${gateRuleSig}|${gateRuleUpdatedAt}|${state.savedCardQueries?.length || 0}:${savedQueriesRev}|${state.filteredDeckLiteDefinitions?.length || 0}:${defsRev}|${state.filteredDeckLiteRuns?.length || 0}:${runsRev}|${activeDeckRev}|${browserRev}|${defRev}`;
}

export function isLearningCloudStateEmpty(
  state?: Partial<LearningCloudState> | null,
): boolean {
  const defaultGateRule = createDefaultGateRuleState();
  const normalizedState = normalizeLearningCloudState(state);
  return (
    normalizedState.decks.length === 0
    && normalizedState.notes.length === 0
    && normalizedState.cards.length === 0
    && normalizedState.reviewLogs.length === 0
    && normalizedState.assignments.length === 0
    && JSON.stringify(normalizedState.gateRule) === JSON.stringify(defaultGateRule)
    && normalizedState.savedCardQueries.length === 0
    && normalizedState.filteredDeckLiteDefinitions.length === 0
    && normalizedState.filteredDeckLiteRuns.length === 0
    && !hasMeaningfulBrowserState(normalizedState.cardBrowser)
    && !hasMeaningfulFilteredDeckState(
      normalizedState.filteredDeckLiteDefinition,
      normalizedState.filteredDeckLiteDefinitions,
      normalizedState.filteredDeckLiteRuns,
    )
  );
}
