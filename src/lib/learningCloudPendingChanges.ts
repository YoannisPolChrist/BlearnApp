import {
  getLearningCloudStateSignature,
  isLearningCloudStateEmpty,
  type LearningCloudState,
} from '@/lib/learningCloudSync';
import type { LearningCloudLocalSyncState } from '@/lib/learningCloudLocalSyncState';
import {
  getCardRevision,
  getDeckRevision,
  getNoteRevision,
  getPresetRevision,
  getReviewLogRevision,
} from '@/modules/learning/sync/learningSyncMappers';

export function hasPendingLearningCloudChanges(
  state: LearningCloudState,
  localSyncState: LearningCloudLocalSyncState | null | undefined,
) {
  const lastSuccessfulStateSignature = typeof localSyncState?.lastSuccessfulStateSignature === 'string'
    ? localSyncState.lastSuccessfulStateSignature.trim()
    : '';
  if (lastSuccessfulStateSignature) {
    return getLearningCloudStateSignature(state) !== lastSuccessfulStateSignature;
  }

  const syncedAt = Number.isFinite(localSyncState?.lastSuccessfulSyncAt)
    ? Math.max(0, Math.round(localSyncState?.lastSuccessfulSyncAt as number))
    : null;

  if (syncedAt === null) {
    return !isLearningCloudStateEmpty(state);
  }

  return Boolean(
    (state.activeDeckUpdatedAt || 0) > syncedAt
    || (state.cardBrowser?.updatedAt || 0) > syncedAt
    || state.savedCardQueries.some((search) => Math.max(search.updatedAt || 0, search.createdAt || 0) > syncedAt)
    || Math.max(state.filteredDeckLiteDefinition?.updatedAt || 0, state.filteredDeckLiteDefinition?.lastRunAt || 0) > syncedAt
    || state.filteredDeckLiteDefinitions.some((definition) => Math.max(definition.updatedAt || 0, definition.lastRunAt || 0) > syncedAt)
    || state.filteredDeckLiteRuns.some((run) => Math.max(run.updatedAt || 0, run.createdAt || 0) > syncedAt)
    || state.assignments.some((assignment) => (assignment.updatedAt || 0) > syncedAt)
    || (state.gateRuleUpdatedAt || 0) > syncedAt
    || state.decks.some((deck) => getDeckRevision(deck) > syncedAt)
    || state.notes.some((note) => getNoteRevision(note) > syncedAt)
    || state.cards.some((card) => getCardRevision(card) > syncedAt)
    || state.reviewLogs.some((log) => getReviewLogRevision(log) > syncedAt)
    || state.presets.some((preset) => getPresetRevision(preset) > syncedAt)
    || (localSyncState?.deletedDecks || []).some((entry) => entry.deletedAt > syncedAt)
    || (localSyncState?.deletedNotes || []).some((entry) => entry.deletedAt > syncedAt)
    || (localSyncState?.deletedCards || []).some((entry) => entry.deletedAt > syncedAt)
    || (localSyncState?.deletedReviewLogs || []).some((entry) => entry.deletedAt > syncedAt)
    || (localSyncState?.deletedPresets || []).some((entry) => entry.deletedAt > syncedAt)
  );
}
