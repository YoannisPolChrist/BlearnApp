import {
  createDeckAssignmentId,
  migrateDeckAssignment,
  migrateGateRule,
  resolveSessionCreditsRequired,
  type BlockTargetType,
  type DeckAssignment,
} from '@/lib/learning';
import { normalizeTargetValue } from '@/lib/targetModes';
import type { DraftBlockingState } from '@/modules/modes/draftBlocking';
import { useLearningStore } from '@/store/useLearningStore';

type GateRuleDraft = {
  sessionCreditsRequired: number;
  unlockDurationMinutes: number;
  typedAnswerEnabled: boolean;
};

type CommitLearningStateOptions = {
  localActiveDeckId?: string;
  setLocalActiveDeckId: (deckId: string) => void;
  nextGateRule: GateRuleDraft;
  nextDraftState: DraftBlockingState;
  blockedApps: string[];
  blockedWebsites: string[];
  blockedSearchTerms: string[];
};

function resolveLearnDeckId(localActiveDeckId?: string) {
  const learningState = useLearningStore.getState();
  // Never seed fallback learning data before persisted vocab has hydrated.
  // Otherwise a save in Modes can overwrite the real learning snapshot with
  // starter defaults during app startup.
  if (!useLearningStore.persist.hasHydrated()) {
    return localActiveDeckId || learningState.activeDeckId;
  }

  const currentDecks = Object.values(learningState.decks);
  const latestDeck = currentDecks.sort((left, right) => right.updatedAt - left.updatedAt)[0];
  return localActiveDeckId || learningState.activeDeckId || latestDeck?.id;
}

function buildNextLearnAssignments(
  deckId: string,
  nextGateRule: GateRuleDraft,
  nextDraftState: DraftBlockingState,
  currentTargets: Pick<CommitLearningStateOptions, 'blockedApps' | 'blockedWebsites' | 'blockedSearchTerms'>,
) {
  const learningState = useLearningStore.getState();
  const deckCardCount = Object.values(learningState.cards).filter((card) => card.deckId === deckId).length;
  const trackedTargetKeys = new Set([
    ...currentTargets.blockedApps.map((targetId) => `app:${normalizeTargetValue('app', targetId)}`),
    ...currentTargets.blockedWebsites.map((targetId) => `website:${normalizeTargetValue('website', targetId)}`),
    ...currentTargets.blockedSearchTerms.map((targetId) => `search:${normalizeTargetValue('search', targetId)}`),
    ...nextDraftState.blockedApps.map((targetId) => `app:${normalizeTargetValue('app', targetId)}`),
    ...nextDraftState.blockedWebsites.map((targetId) => `website:${normalizeTargetValue('website', targetId)}`),
    ...nextDraftState.blockedSearchTerms.map((targetId) => `search:${normalizeTargetValue('search', targetId)}`),
  ]);
  const existingAssignmentsByKey = new Map(
    learningState.assignments.map((assignment) => [`${assignment.targetType}:${assignment.targetId}`, assignment] as const),
  );
  const updatedAssignmentsByKey = new Map<string, DeckAssignment>();
  const learnTargets: Array<{ targetId: string; targetType: BlockTargetType }> = [
    ...Object.entries(nextDraftState.blockedAppModes)
      .filter(([, mode]) => mode === 'learn')
      .map(([targetId]) => ({ targetId, targetType: 'app' as const })),
    ...Object.entries(nextDraftState.blockedWebsiteModes)
      .filter(([, mode]) => mode === 'learn')
      .map(([targetId]) => ({ targetId, targetType: 'website' as const })),
    ...Object.entries(nextDraftState.blockedSearchTermModes)
      .filter(([, mode]) => mode === 'learn')
      .map(([targetId]) => ({ targetId, targetType: 'search' as const })),
  ];

  learnTargets.forEach(({ targetId, targetType }) => {
    const key = `${targetType}:${targetId}`;
    const existing = existingAssignmentsByKey.get(key);
    const requestedSessionCreditsRequired = resolveSessionCreditsRequired(
      { sessionCreditsRequired: nextGateRule.sessionCreditsRequired },
      resolveSessionCreditsRequired(existing, learningState.gateRule.sessionCreditsRequired),
    );
    const nextSessionCreditsRequired = resolveSessionCreditsRequired(
      { sessionCreditsRequired: requestedSessionCreditsRequired },
      learningState.gateRule.sessionCreditsRequired,
    );
    const doneCredits = existing ? Math.max(0, existing.sessionCreditsRequired - existing.requiredCorrectReviews) : 0;
    const nextRequiredCorrectReviews = Math.max(0, nextSessionCreditsRequired - doneCredits);

    const rawAssignment: DeckAssignment = existing
      ? {
          ...existing,
          deckId,
          targetType,
          sessionCreditsRequired: nextSessionCreditsRequired,
          requiredCorrectReviews: nextRequiredCorrectReviews,
          unlockDurationMinutes: Math.max(1, Math.round(nextGateRule.unlockDurationMinutes)),
          enabled: true,
          updatedAt: Date.now(),
        }
      : {
          id: createDeckAssignmentId(targetType, targetId),
          targetId,
          targetType,
          deckId,
          sessionCreditsRequired: nextSessionCreditsRequired,
          requiredCorrectReviews: nextRequiredCorrectReviews,
          unlockDurationMinutes: Math.max(1, Math.round(nextGateRule.unlockDurationMinutes)),
          enabled: true,
          updatedAt: Date.now(),
        };

    updatedAssignmentsByKey.set(key, migrateDeckAssignment(rawAssignment, deckCardCount));
  });

  const nextAssignments = learningState.assignments.flatMap((assignment) => {
    const key = `${assignment.targetType}:${assignment.targetId}`;
    if (!trackedTargetKeys.has(key)) {
      return [assignment];
    }

    const nextMode =
      assignment.targetType === 'app'
        ? nextDraftState.blockedAppModes[normalizeTargetValue('app', assignment.targetId)]
        : assignment.targetType === 'website'
          ? nextDraftState.blockedWebsiteModes[normalizeTargetValue('website', assignment.targetId)]
          : nextDraftState.blockedSearchTermModes[normalizeTargetValue('search', assignment.targetId)];

    if (nextMode !== 'learn') {
      return [];
    }

    const updatedAssignment = updatedAssignmentsByKey.get(key);
    if (!updatedAssignment) {
      return [assignment];
    }

    updatedAssignmentsByKey.delete(key);
    return [updatedAssignment];
  });

  return [...updatedAssignmentsByKey.values(), ...nextAssignments];
}

export function commitLearningState({
  localActiveDeckId,
  setLocalActiveDeckId,
  nextGateRule,
  nextDraftState,
  blockedApps,
  blockedWebsites,
  blockedSearchTerms,
}: CommitLearningStateOptions) {
  const deckId = resolveLearnDeckId(localActiveDeckId);
  if (deckId && localActiveDeckId !== deckId) {
    setLocalActiveDeckId(deckId);
  }

  const learningState = useLearningStore.getState();
  const nextDeckId = deckId ?? learningState.activeDeckId;
  const nextAssignments = nextDeckId
    ? buildNextLearnAssignments(nextDeckId, nextGateRule, nextDraftState, {
        blockedApps,
        blockedWebsites,
        blockedSearchTerms,
      })
    : learningState.assignments;
  const nextGateRuleState = migrateGateRule({
    ...learningState.gateRule,
    sessionCreditsRequired: nextGateRule.sessionCreditsRequired,
    unlockDurationMinutes: nextGateRule.unlockDurationMinutes,
    typedAnswerEnabled: nextGateRule.typedAnswerEnabled,
  }, learningState.gateRule);
  const learningUpdates: Partial<ReturnType<typeof useLearningStore.getState>> = {};

  if (nextDeckId && nextDeckId !== learningState.activeDeckId) {
    learningUpdates.activeDeckId = nextDeckId;
    learningUpdates.activeDeckUpdatedAt = Date.now();
  }

  const gateRuleChanged =
    learningState.gateRule.sessionCreditsRequired !== nextGateRuleState.sessionCreditsRequired
    || learningState.gateRule.unlockDurationMinutes !== nextGateRuleState.unlockDurationMinutes
    || learningState.gateRule.typedAnswerEnabled !== nextGateRuleState.typedAnswerEnabled;
  if (gateRuleChanged) {
    learningUpdates.gateRule = nextGateRuleState;
    learningUpdates.gateRuleUpdatedAt = Date.now();
  }

  const assignmentsChanged =
    learningState.assignments.length !== nextAssignments.length
    || learningState.assignments.some((assignment, index) => nextAssignments[index] !== assignment);
  if (assignmentsChanged) {
    learningUpdates.assignments = nextAssignments;
  }

  if (Object.keys(learningUpdates).length > 0) {
    useLearningStore.setState(learningUpdates);
  }
}
