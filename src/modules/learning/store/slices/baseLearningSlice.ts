import type { StateCreator } from 'zustand';
import { migrateGateRule } from '@/lib/learning';
import {
  appendLearningCloudTombstones,
  normalizeLearningCloudLocalSyncState,
  pruneLearningCloudTombstones,
} from '@/lib/learningCloudLocalSyncState';
import { applyLearningStoreIndexes } from '../helpers';
import type { LearningBaseSlice, LearningStore } from '../types';

export const createLearningBaseSlice: StateCreator<LearningStore, [], [], LearningBaseSlice> = (set, get) => ({
  hydrateLearningState: (state) =>
    set((current) =>
      applyLearningStoreIndexes({
        ...current,
        ...state,
        learningCloudLocalSyncState: state.learningCloudLocalSyncState
          ? normalizeLearningCloudLocalSyncState(state.learningCloudLocalSyncState)
          : current.learningCloudLocalSyncState,
      }),
    ),

  setActiveDeck: (deckId) =>
    set((state) => {
      if (state.activeDeckId === deckId) {
        return state;
      }

      return {
        activeDeckId: deckId,
        activeDeckUpdatedAt: deckId ? Date.now() : state.activeDeckUpdatedAt,
      };
    }),

  setGateRule: (rule) =>
    set((state) => ({
      gateRule: migrateGateRule({
        ...state.gateRule,
        ...rule,
      }, state.gateRule),
      gateRuleUpdatedAt: Date.now(),
    })),

  markLearningCloudSyncCompleted: (syncedAt = Date.now(), cursor = null, stateSignature) =>
    set((state) => ({
      learningCloudLocalSyncState: {
        ...state.learningCloudLocalSyncState,
        lastSuccessfulSyncAt: syncedAt,
        lastRemoteCursor: cursor,
        lastSuccessfulStateSignature:
          typeof stateSignature === 'string' && stateSignature.trim()
            ? stateSignature.trim()
            : state.learningCloudLocalSyncState.lastSuccessfulStateSignature,
        deletedDecks: pruneLearningCloudTombstones(state.learningCloudLocalSyncState.deletedDecks, syncedAt),
        deletedNotes: pruneLearningCloudTombstones(state.learningCloudLocalSyncState.deletedNotes, syncedAt),
        deletedCards: pruneLearningCloudTombstones(state.learningCloudLocalSyncState.deletedCards, syncedAt),
        deletedReviewLogs: pruneLearningCloudTombstones(state.learningCloudLocalSyncState.deletedReviewLogs, syncedAt),
        deletedPresets: pruneLearningCloudTombstones(state.learningCloudLocalSyncState.deletedPresets, syncedAt),
      },
    })),

  recordLearningCloudEntityDeletions: ({ deckIds, noteIds, cardIds, reviewLogIds, presetIds, deletedAt }) =>
    set((state) => ({
      learningCloudLocalSyncState: {
        ...state.learningCloudLocalSyncState,
        deletedDecks: appendLearningCloudTombstones(
          state.learningCloudLocalSyncState.deletedDecks,
          deckIds || [],
          deletedAt,
        ),
        deletedNotes: appendLearningCloudTombstones(
          state.learningCloudLocalSyncState.deletedNotes,
          noteIds || [],
          deletedAt,
        ),
        deletedCards: appendLearningCloudTombstones(
          state.learningCloudLocalSyncState.deletedCards,
          cardIds || [],
          deletedAt,
        ),
        deletedReviewLogs: appendLearningCloudTombstones(
          state.learningCloudLocalSyncState.deletedReviewLogs,
          reviewLogIds || [],
          deletedAt,
        ),
        deletedPresets: appendLearningCloudTombstones(
          state.learningCloudLocalSyncState.deletedPresets,
          presetIds || [],
          deletedAt,
        ),
      },
    })),
});
