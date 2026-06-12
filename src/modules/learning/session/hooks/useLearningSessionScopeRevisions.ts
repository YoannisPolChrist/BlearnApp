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
const SCOPE_REVISION_SEED = 0x811c9dc5;
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

function updateScopeRevisionHash(hash: number, token: string) {
  let nextHash = hash;
  for (let index = 0; index < token.length; index += 1) {
    nextHash ^= token.charCodeAt(index);
    nextHash = Math.imul(nextHash, 0x01000193);
  }

  nextHash ^= 0x1f;
  return Math.imul(nextHash, 0x01000193);
}

function finalizeScopeRevisionHash(hash: number) {
  return (hash >>> 0).toString(36);
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
            && cached.reviewLogsRef === (isBlockedFlow ? state.reviewLogs : null)
            && cached.deckScopeRevision === deckScopeRevision
            && cached.presetScopeRevision === presetScopeRevision
          ) {
            return cached.result;
          }

          let cardScopeHash = SCOPE_REVISION_SEED;
          const scopedCards = Object.values(state.cards).filter((card) => card.deckId === activeDeckId);
          for (const card of scopedCards) {
            cardScopeHash = updateScopeRevisionHash(cardScopeHash, card.id);
            cardScopeHash = updateScopeRevisionHash(cardScopeHash, String(getCardRevision(card)));
          }

          let reviewLogScopeRevision = EMPTY_SCOPE_REVISION;
          const scopedReviewLogs = isBlockedFlow
            ? Object.values(state.reviewLogs).filter((log) => log.deckId === activeDeckId)
            : [];

          if (scopedReviewLogs.length > 0) {
            let reviewLogScopeHash = SCOPE_REVISION_SEED;
            for (const log of scopedReviewLogs) {
              reviewLogScopeHash = updateScopeRevisionHash(reviewLogScopeHash, log.id);
              reviewLogScopeHash = updateScopeRevisionHash(reviewLogScopeHash, `${log.id}:${getReviewLogRevision(log)}`);
            }

            reviewLogScopeRevision = finalizeScopeRevisionHash(reviewLogScopeHash);
          }

          const result: ScopeRevisionState = {
            deckScopeRevision,
            presetScopeRevision,
            cardScopeRevision: scopedCards.length > 0 ? finalizeScopeRevisionHash(cardScopeHash) : EMPTY_SCOPE_REVISION,
            reviewLogScopeRevision,
          };

          scopeRevisionCacheRef.current = {
            activeDeckId,
            cardsRef: state.cards,
            reviewLogsRef: isBlockedFlow ? state.reviewLogs : null,
            deckScopeRevision,
            presetScopeRevision,
            result,
          };

          return result;
        },
        [activeDeckId, isBlockedFlow],
      ),
    ),
  );
}
