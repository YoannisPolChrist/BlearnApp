import { useCallback, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useLearningStore } from '@/store/useLearningStore';
import { getDefaultLearningPreset } from '@/lib/learning';
import {
  getCardRevision,
  getDeckRevision,
  getPresetRevision,
  getReviewLogRevision,
} from '@/modules/learning/sync/learningSyncMappers';

const EMPTY_SCOPE_REVISION = '';
const EMPTY_SCOPE_REVISION_STATE = {
  deckScopeRevision: EMPTY_SCOPE_REVISION,
  presetScopeRevision: EMPTY_SCOPE_REVISION,
  cardScopeRevision: EMPTY_SCOPE_REVISION,
  reviewLogScopeRevision: EMPTY_SCOPE_REVISION,
} as const;

interface ScopeRevisionState {
  deckScopeRevision: string;
  presetScopeRevision: string;
  cardScopeRevision: string;
  reviewLogScopeRevision: string;
}

interface ScopeRevisionCacheEntry {
  activeDeckId: string;
  cardsRef: ReturnType<typeof useLearningStore.getState>['cards'];
  reviewLogsRef: ReturnType<typeof useLearningStore.getState>['reviewLogs'] | null;
  deckScopeRevision: string;
  presetScopeRevision: string;
  result: ScopeRevisionState;
}

export function useLearningSessionScopeRevisions(activeDeckId: string | undefined, isBlockedFlow: boolean) {
  const scopeRevisionCacheRef = useRef<ScopeRevisionCacheEntry | null>(null);

  return useLearningStore(
    useShallow(
      useCallback(
        (state) => {
          if (!activeDeckId) {
            scopeRevisionCacheRef.current = null;
            return EMPTY_SCOPE_REVISION_STATE;
          }

          const activeDeck = state.decks[activeDeckId];
          const activePreset = activeDeck
            ? state.presets[activeDeck.presetId || getDefaultLearningPreset().id] || getDefaultLearningPreset()
            : undefined;
          const deckScopeRevision = activeDeck ? `${activeDeck.id}:${getDeckRevision(activeDeck)}` : EMPTY_SCOPE_REVISION;
          const presetScopeRevision = activePreset ? `${activePreset.id}:${getPresetRevision(activePreset)}` : EMPTY_SCOPE_REVISION;

          const cached = scopeRevisionCacheRef.current;
          if (
            cached
            && cached.activeDeckId === activeDeckId
            && cached.cardsRef === state.cards
            && cached.reviewLogsRef === state.reviewLogs
            && cached.deckScopeRevision === deckScopeRevision
            && cached.presetScopeRevision === presetScopeRevision
          ) {
            return cached.result;
          }

          let scopedCardCount = 0;
          let latestCardRevision = 0;
          for (const card of Object.values(state.cards)) {
            if (card.deckId !== activeDeckId) continue;
            scopedCardCount += 1;
            latestCardRevision = Math.max(latestCardRevision, getCardRevision(card));
          }

          let scopedReviewLogCount = 0;
          let latestReviewLogRevision = 0;
          for (const log of Object.values(state.reviewLogs)) {
            if (log.deckId !== activeDeckId) continue;
            scopedReviewLogCount += 1;
            latestReviewLogRevision = Math.max(latestReviewLogRevision, getReviewLogRevision(log));
          }

          const result: ScopeRevisionState = {
            deckScopeRevision,
            presetScopeRevision,
            cardScopeRevision: scopedCardCount > 0
              ? `${scopedCardCount}:${latestCardRevision}`
              : EMPTY_SCOPE_REVISION,
            reviewLogScopeRevision: scopedReviewLogCount > 0
              ? `${scopedReviewLogCount}:${latestReviewLogRevision}`
              : EMPTY_SCOPE_REVISION,
          };

          scopeRevisionCacheRef.current = {
            activeDeckId,
            cardsRef: state.cards,
            reviewLogsRef: state.reviewLogs,
            deckScopeRevision,
            presetScopeRevision,
            result,
          };

          return result;
        },
        [activeDeckId],
      ),
    ),
  );
}
