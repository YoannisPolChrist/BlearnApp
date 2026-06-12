import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import {
  useBlockingTargets,
  useLearningGateActions,
  useModeActions,
  useModeSettings,
  usePenaltyStatus,
} from '@/store/selectors';
import { useAppStore } from '@/store/useAppStore';
import { useLearningStore } from '@/store/useLearningStore';

export function useModesPageStoreState() {
  const modeSettings = useModeSettings();
  const modeActions = useModeActions();
  const blockingTargets = useBlockingTargets();
  const penaltyStatus = usePenaltyStatus();
  const learningState = useLearningStore(
    useShallow((state) => ({
      gateRule: state.gateRule,
      activeDeckId: state.activeDeckId,
      deckMap: state.decks,
      cardMap: state.cards,
      reviewLogMap: state.reviewLogs,
      presetMap: state.presets,
      assignments: state.assignments,
      getDueCardsForDecks: state.getDueCardsForDecks,
      getResolvedPresetForDeck: state.getResolvedPresetForDeck,
    })),
  );
  const learningActions = useLearningGateActions();
  const nativeRuntimeIssues = useAppStore((state) => state.nativeRuntimeIssues);
  const unlockedTargets = useAppStore((state) => state.unlockedTargets);

  const learningLists = useMemo(
    () => ({
      decks: Object.values(learningState.deckMap),
      cards: Object.values(learningState.cardMap),
      reviewLogs: Object.values(learningState.reviewLogMap),
      presets: Object.values(learningState.presetMap),
    }),
    [learningState.cardMap, learningState.deckMap, learningState.presetMap, learningState.reviewLogMap],
  );

  return {
    ...modeSettings,
    ...modeActions,
    ...blockingTargets,
    ...penaltyStatus,
    ...learningState,
    ...learningActions,
    ...learningLists,
    nativeRuntimeIssues,
    unlockedTargets,
  };
}
