import type { StateCreator } from 'zustand';
import {
  buildReviewResult,
  canAttemptLearningPresetOptimization,
  createDeckAssignmentId,
  getDeckLearningStats,
  getDefaultLearningPreset,
  getDueSessionCards,
  migrateDeckAssignment,
  migrateLearningCard,
  migrateLearningPreset,
  migrateReviewLog,
  migrateUnlockGrant,
  optimizeLearningPreset,
  type ReviewLog,
} from '@/lib/learning';
import { normalizeTargetValue } from '@/lib/targetModes';
import { appendReviewToWal } from '@/modules/learning/store/reviewWriteAheadLog';
import type { LearningReviewSlice, LearningStore } from '../types';
import { buildLearningStoreIndexes } from '../helpers';

const MAX_REVIEW_LOGS = 5000;

export const createLearningReviewSlice: StateCreator<LearningStore, [], [], LearningReviewSlice> = (set, get) => ({
  upsertAssignment: (targetId, targetType, deckId, overrides) => {
    const normalizedTargetId = normalizeTargetValue(targetType, targetId);
    if (!normalizedTargetId) return;

    const current = get().assignments.find(
      (assignment) => assignment.targetId === normalizedTargetId && assignment.targetType === targetType,
    );
    const nextAssignment = migrateDeckAssignment({
      id: current?.id || createDeckAssignmentId(targetType, normalizedTargetId),
      targetId: normalizedTargetId,
      targetType,
      deckId,
      sessionCreditsRequired: overrides?.sessionCreditsRequired ?? current?.sessionCreditsRequired,
      requiredCorrectReviews: overrides?.requiredCorrectReviews ?? current?.requiredCorrectReviews,
      unlockDurationMinutes: overrides?.unlockDurationMinutes ?? current?.unlockDurationMinutes ?? get().gateRule.unlockDurationMinutes,
      presetId: overrides?.presetId ?? current?.presetId,
      enabled: overrides?.enabled ?? current?.enabled ?? true,
      updatedAt: Date.now(),
    });

    set((state) => ({
      assignments: [
        nextAssignment,
        ...state.assignments.filter(
          (assignment) => !(assignment.targetId === normalizedTargetId && assignment.targetType === targetType),
        ),
      ],
    }));
  },

  removeAssignment: (targetId, targetType) => {
    const normalizedTargetId = normalizeTargetValue(targetType, targetId);
    if (!normalizedTargetId) return;

    set((state) => ({
      assignments: state.assignments.filter(
        (assignment) => !(assignment.targetId === normalizedTargetId && assignment.targetType === targetType),
      ),
    }));
  },

  getAssignmentForTarget: (targetId, targetType) => {
    const normalizedTargetId = normalizeTargetValue(targetType, targetId);
    if (!normalizedTargetId) return undefined;

    return get().assignments.find(
      (assignment) => assignment.targetId === normalizedTargetId && assignment.targetType === targetType,
    );
  },

  getDeckById: (deckId) => {
    return get().decks[deckId];
  },

  getPresetById: (presetId) => {
    const defaultPreset = migrateLearningPreset(getDefaultLearningPreset());
    const found = presetId ? get().presets[presetId] : undefined;
    return found ? migrateLearningPreset(found) : defaultPreset;
  },

  getResolvedPresetForDeck: (deckId) => {
    const deck = get().decks[deckId];
    return get().getPresetById(deck?.presetId);
  },

  setDeckReviewMix: (deckId, reviewsBetweenNewCards) => {
    const state = get();
    const deck = state.getDeckById(deckId);
    if (!deck) {
      return;
    }

    const normalizedMix = Math.max(1, Math.round(reviewsBetweenNewCards));
    const defaultPresetId = getDefaultLearningPreset().id;
    const currentPreset = state.getResolvedPresetForDeck(deckId);
    const decksSharingPreset = Object.values(state.decks).filter(
      (deckEntry) => (deckEntry.presetId || defaultPresetId) === currentPreset.id,
    );
    const nextPresetId =
      decksSharingPreset.length > 1
        ? `${currentPreset.id}_${deckId}`
        : currentPreset.id;
    const now = Date.now();
    const nextPreset = migrateLearningPreset({
      ...currentPreset,
      id: nextPresetId,
      name:
        nextPresetId === currentPreset.id
          ? currentPreset.name
          : `${deck.name} Lernmix`,
      reviewsBetweenNewCards: normalizedMix,
      updatedAt: now,
    });

    set((state) => ({
      activeDeckUpdatedAt:
        state.activeDeckId === deckId
          ? Math.max(state.activeDeckUpdatedAt ?? 0, now)
          : state.activeDeckUpdatedAt,
      decks: {
        ...state.decks,
        [deckId]: {
          ...state.decks[deckId],
          presetId: nextPreset.id,
          updatedAt: Math.max(state.decks[deckId].updatedAt, now),
        },
      },
      presets: {
        ...state.presets,
        [nextPreset.id]: nextPreset,
      },
    }));
  },

  getDeckStats: (deckId) => {
    const state = get();
    const deck = state.decks[deckId];
    if (!deck) return null;
    const deckCards = Object.values(state.cards).filter((card) => card.deckId === deckId);
    const deckReviewLogs = Object.values(state.reviewLogs).filter((log) => log.deckId === deckId);

    return getDeckLearningStats({
      deck,
      cards: deckCards,
      reviewLogs: deckReviewLogs,
      preset: state.getResolvedPresetForDeck(deck.id),
      gateRule: state.gateRule,
    });
  },

  getNoteByCardId: (cardId) => {
    const state = get();
    const card = state.cards[cardId];
    return card ? state.notes[card.noteId] : undefined;
  },

  getDueCardsForDecks: (deckIds) => {
    const state = get();
    const cardsArray = Object.values(state.cards);
    if (!deckIds || deckIds.length === 0) {
      return getDueSessionCards(cardsArray, deckIds);
    }

    const scopedCards = cardsArray.filter((card) => deckIds.includes(card.deckId));
    return getDueSessionCards(scopedCards, deckIds);
  },

  submitReview: (cardId, rating, wasCorrect) => {
    const state = get();
    const card = state.cards[cardId];
    if (!card) return null;

    const preset = state.getResolvedPresetForDeck(card.deckId);
    const reviewResult = buildReviewResult(card, rating, wasCorrect, preset);
    const { updatedCard, log } = reviewResult;
    const defaultPresetId = getDefaultLearningPreset().id;

    // Durability contract (Masterplan 2.2): commit the review synchronously
    // to the write-ahead log BEFORE the store update schedules the large
    // asynchronous snapshot persist. A WebView kill between this point and
    // the snapshot commit costs nothing — startup replay restores the review.
    appendReviewToWal(migrateLearningCard(updatedCard), migrateReviewLog(log));

    set((state) => {
      const migratedLog = migrateReviewLog(log);
      const migratedUpdatedCard = migrateLearningCard(updatedCard);
      const reviewTimestamp = migratedLog.reviewedAt;

      const nextCards = { ...state.cards, [updatedCard.id]: migratedUpdatedCard };

      const nextDecks = { ...state.decks };
      const currentDeck = nextDecks[updatedCard.deckId];
      if (currentDeck) {
        nextDecks[updatedCard.deckId] = {
          ...currentDeck,
          updatedAt: Math.max(currentDeck.updatedAt, reviewTimestamp),
        };
      }

      const nextReviewLogs = { ...state.reviewLogs, [migratedLog.id]: migratedLog };

      let droppedReviewLog: ReviewLog | undefined = undefined;
      const logIds = Object.keys(nextReviewLogs);
      if (logIds.length > MAX_REVIEW_LOGS) {
        let oldestId: string | undefined = undefined;
        let oldestTime = Infinity;
        for (const id of logIds) {
          if (nextReviewLogs[id].reviewedAt < oldestTime) {
            oldestTime = nextReviewLogs[id].reviewedAt;
            oldestId = id;
          }
        }
        if (oldestId) {
          droppedReviewLog = nextReviewLogs[oldestId];
          delete nextReviewLogs[oldestId];
        }
      }

      let relevantDeckIds: Set<string> | null = null;
      let relevantReviewCount: number | null = null;
      let relevantLogs: ReviewLog[] | null = null;

      const getRelevantDeckIds = () => {
        if (!relevantDeckIds) {
          relevantDeckIds = new Set(
            Object.values(nextDecks)
              .filter((deck) => (deck.presetId || defaultPresetId) === preset.id)
              .map((deck) => deck.id),
          );
        }
        return relevantDeckIds;
      };

      const getRelevantReviewCount = () => {
        if (relevantReviewCount !== null) {
          return relevantReviewCount;
        }

        const deckIds = getRelevantDeckIds();
        let nextCount = droppedReviewLog && deckIds.has(droppedReviewLog.deckId) ? 0 : 1;
        
        const logsArray = Object.values(nextReviewLogs);
        for (const logItem of logsArray) {
          if (deckIds.has(logItem.deckId)) {
            nextCount++;
          }
        }

        relevantReviewCount = nextCount;
        return relevantReviewCount;
      };

      const nextPresets = { ...state.presets };
      for (const presetId of Object.keys(nextPresets)) {
        const presetEntry = nextPresets[presetId];
        if (presetEntry.id !== preset.id) continue;

        if (!canAttemptLearningPresetOptimization(presetEntry, getRelevantReviewCount(), reviewTimestamp)) {
          continue;
        }

        if (!relevantLogs) {
          const deckIds = getRelevantDeckIds();
          relevantLogs = Object.values(nextReviewLogs).filter((entry) => deckIds.has(entry.deckId));
        }

        nextPresets[presetId] = optimizeLearningPreset(presetEntry, relevantLogs, reviewTimestamp);
      }

      return {
        ...state,
        cards: nextCards,
        decks: nextDecks,
        activeDeckUpdatedAt: state.activeDeckId === updatedCard.deckId
          ? Math.max(state.activeDeckUpdatedAt ?? 0, reviewTimestamp)
          : state.activeDeckUpdatedAt,
        reviewLogs: nextReviewLogs,
        presets: nextPresets,
        indexes: buildLearningStoreIndexes({ reviewLogs: nextReviewLogs }),
      };
    });

    return reviewResult;
  },

  revertReviewLog: (cardId) => {
    set((state) => {
      const logsArray = Object.values(state.reviewLogs);
      const log = logsArray.find((l) => l.cardId === cardId);
      if (!log || !log.previousCardSnapshot) return state;

      const nextReviewLogs = { ...state.reviewLogs };
      delete nextReviewLogs[log.id];

      const nextCards = { ...state.cards };
      nextCards[log.cardId] = log.previousCardSnapshot;

      return {
        ...state,
        cards: nextCards,
        reviewLogs: nextReviewLogs,
        indexes: buildLearningStoreIndexes({ reviewLogs: nextReviewLogs }),
      };
    });
  },

  registerUnlockGrant: (targetId, targetType, sourceDeckId, sessionCreditsRequired, unlockDurationMinutes) => {
    const normalizedTargetId = normalizeTargetValue(targetType, targetId);
    if (!normalizedTargetId) {
      throw new Error('Cannot register unlock grant without a target id.');
    }

    const grantKey = `${targetType}:${normalizedTargetId}`;
    const grant = migrateUnlockGrant({
      id: `grant_${Math.random().toString(36).slice(2, 10)}`,
      targetId: normalizedTargetId,
      targetType,
      grantedAt: Date.now(),
      expiresAt: Date.now() + unlockDurationMinutes * 60 * 1000,
      sourceDeckId,
      sessionCreditsRequired,
      requiredCorrectReviews: sessionCreditsRequired,
    });

    set((state) => ({
      unlockGrants: [
        grant,
        ...state.unlockGrants.filter(
          (entry) => `${entry.targetType}:${entry.targetId}` !== grantKey && entry.expiresAt > Date.now(),
        ),
      ].slice(0, 50),
    }));

    return grant;
  },

  getUnlockGrant: (targetId, targetType) =>
    get().unlockGrants.find((entry) => {
      const normalizedTargetId = normalizeTargetValue(targetType, targetId);
      return normalizedTargetId
        && entry.targetId === normalizedTargetId
        && entry.targetType === targetType
        && entry.expiresAt > Date.now();
    }),
});
