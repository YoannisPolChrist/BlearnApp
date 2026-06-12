import { describe, expect, it } from 'vitest';
import { buildEntitiesFromRows, getDefaultGateRule, getDefaultLearningPresets } from '@/lib/learning';
import {
  MAX_CLOUD_REVIEW_LOGS,
  isLearningCloudStateEmpty,
  getLearningCloudStateSignature,
  mergeLearningCloudStates,
  normalizeLearningCloudState,
} from '@/lib/learningCloudSync';

describe('learningCloudSync', () => {
  it('normalizes presets and active deck selection', () => {
    const now = 1_700_000_000_000;
    const { decks, notes, cards } = buildEntitiesFromRows(
      [{ deck: 'Spanish', front: 'hola', back: 'hello', type: 'basic' }],
      now,
    );

    const normalized = normalizeLearningCloudState({
      activeDeckId: 'missing-deck',
      decks: [{ ...decks[0], presetId: undefined }],
      notes,
      cards,
      presets: [],
    });

    expect(normalized.presets).toHaveLength(1);
    expect(normalized.decks[0]?.presetId).toBe(normalized.presets[0]?.id);
    expect(normalized.activeDeckId).toBe(decks[0].id);
    expect(normalized.activeDeckUpdatedAt).toBe(decks[0].updatedAt);
  });

  it('normalizes legacy record-shaped snapshots including assignments and gate rule', () => {
    const now = 1_700_000_000_000;
    const { decks, notes, cards } = buildEntitiesFromRows(
      [{ deck: 'Spanish', front: 'hola', back: 'hello', type: 'basic' }],
      now,
    );
    const assignment = {
      id: 'assignment_spanish',
      targetId: 'app-spanish',
      targetType: 'app' as const,
      deckId: decks[0].id,
      unlockDurationMinutes: 30,
      enabled: true,
      updatedAt: now + 4_000,
    };

    const normalized = normalizeLearningCloudState({
      activeDeckId: 'missing-deck',
      decks: Object.fromEntries(decks.map((deck) => [deck.id, deck])),
      notes: Object.fromEntries(notes.map((note) => [note.id, note])),
      cards: Object.fromEntries(cards.map((card) => [card.id, card])),
      reviewLogs: {},
      presets: {},
      assignments: {
        [assignment.id]: assignment,
      },
      gateRule: {
        ...getDefaultGateRule(),
        reviewAheadHours: 12,
      },
      gateRuleUpdatedAt: now + 2_000,
    });

    expect(normalized.assignments).toHaveLength(1);
    expect(normalized.assignments[0]?.deckId).toBe(decks[0].id);
    expect(normalized.gateRule.reviewAheadHours).toBe(12);
    expect(normalized.gateRuleUpdatedAt).toBe(now + 2_000);
    expect(normalized.activeDeckId).toBe(decks[0].id);
  });

  it('merges local review progress with remote vocab additions', () => {
    const now = 1_700_000_000_000;
    const localEntities = buildEntitiesFromRows(
      [{ deck: 'Spanish', front: 'hola', back: 'hello', type: 'basic' }],
      now,
    );
    const remoteEntities = buildEntitiesFromRows(
      [{ deck: 'French', front: 'bonjour', back: 'hello', type: 'basic' }],
      now + 5_000,
    );

    const reviewedCard = {
      ...localEntities.cards[0],
      reps: 3,
      lapses: 1,
      dueAt: now + 60_000,
      lastReviewedAt: now + 30_000,
    };
    const olderRemoteCopy = {
      ...localEntities.cards[0],
      reps: 1,
      dueAt: now + 10_000,
      lastReviewedAt: now + 5_000,
    };
    const reviewLog = {
      id: 'review_1',
      deckId: localEntities.decks[0].id,
      cardId: reviewedCard.id,
      reviewedAt: now + 30_000,
      rating: 'good' as const,
      previousState: 'learning' as const,
      newState: 'review' as const,
      scheduledDays: 1,
      elapsedDays: 0,
      wasCorrect: true,
      memoryStateBefore: null,
      memoryStateAfter: null,
    };

    const merged = mergeLearningCloudStates(
      {
        activeDeckId: localEntities.decks[0].id,
        activeDeckUpdatedAt: now + 30_000,
        decks: localEntities.decks,
        notes: localEntities.notes,
        cards: [reviewedCard],
        reviewLogs: [reviewLog],
        presets: getDefaultLearningPresets(),
      },
      {
        activeDeckId: remoteEntities.decks[0].id,
        activeDeckUpdatedAt: now + 5_000,
        decks: remoteEntities.decks,
        notes: remoteEntities.notes,
        cards: [olderRemoteCopy, ...remoteEntities.cards],
        reviewLogs: [reviewLog],
        presets: getDefaultLearningPresets(),
      },
    );

    expect(merged.decks.map((deck) => deck.name).sort()).toEqual(['French', 'Spanish']);
    expect(merged.cards).toHaveLength(2);
    expect(merged.cards.find((card) => card.id === reviewedCard.id)?.reps).toBe(3);
    expect(merged.reviewLogs).toHaveLength(1);
    expect(merged.activeDeckId).toBe(localEntities.decks[0].id);
    expect(merged.activeDeckUpdatedAt).toBe(now + 30_000);
  });

  it('prefers the most recently selected active deck across devices', () => {
    const now = 1_700_000_000_000;
    const localEntities = buildEntitiesFromRows(
      [{ deck: 'Spanish', front: 'hola', back: 'hello', type: 'basic' }],
      now,
    );
    const remoteEntities = buildEntitiesFromRows(
      [{ deck: 'French', front: 'bonjour', back: 'hello', type: 'basic' }],
      now + 5_000,
    );

    const merged = mergeLearningCloudStates(
      {
        activeDeckId: localEntities.decks[0].id,
        activeDeckUpdatedAt: now + 1_000,
        decks: localEntities.decks,
        notes: localEntities.notes,
        cards: localEntities.cards,
        reviewLogs: [],
        presets: getDefaultLearningPresets(),
      },
      {
        activeDeckId: remoteEntities.decks[0].id,
        activeDeckUpdatedAt: now + 9_000,
        decks: remoteEntities.decks,
        notes: remoteEntities.notes,
        cards: remoteEntities.cards,
        reviewLogs: [],
        presets: getDefaultLearningPresets(),
      },
    );

    expect(merged.activeDeckId).toBe(remoteEntities.decks[0].id);
    expect(merged.activeDeckUpdatedAt).toBe(now + 9_000);
  });

  it('prefers newer assignments and gate rule updates during merge', () => {
    const now = 1_700_000_000_000;
    const { decks, notes, cards } = buildEntitiesFromRows(
      [{ deck: 'Spanish', front: 'hola', back: 'hello', type: 'basic' }],
      now,
    );
    const localAssignment = {
      id: 'assignment_spanish',
      targetId: 'app-spanish',
      targetType: 'app' as const,
      deckId: decks[0].id,
      unlockDurationMinutes: 15,
      enabled: true,
      updatedAt: now + 1_000,
    };
    const remoteAssignment = {
      ...localAssignment,
      deckId: decks[0].id,
      unlockDurationMinutes: 45,
      updatedAt: now + 8_000,
    };

    const merged = mergeLearningCloudStates(
      {
        activeDeckId: decks[0].id,
        activeDeckUpdatedAt: now + 1_000,
        decks,
        notes,
        cards,
        reviewLogs: [],
        presets: getDefaultLearningPresets(),
        assignments: [localAssignment],
        gateRule: {
          ...getDefaultGateRule(),
          reviewAheadHours: 6,
        },
        gateRuleUpdatedAt: now + 1_000,
      },
      {
        activeDeckId: decks[0].id,
        activeDeckUpdatedAt: now + 1_000,
        decks,
        notes,
        cards,
        reviewLogs: [],
        presets: getDefaultLearningPresets(),
        assignments: [remoteAssignment],
        gateRule: {
          ...getDefaultGateRule(),
          reviewAheadHours: 18,
        },
        gateRuleUpdatedAt: now + 8_000,
      },
    );

    expect(merged.assignments).toHaveLength(1);
    expect(merged.assignments[0]?.unlockDurationMinutes).toBe(45);
    expect(merged.gateRule.reviewAheadHours).toBe(18);
    expect(merged.gateRuleUpdatedAt).toBe(now + 8_000);
  });

  it('prefers newer note content based on note updatedAt during merge', () => {
    const now = 1_700_000_000_000;
    const entities = buildEntitiesFromRows(
      [{ deck: 'Spanish', front: 'hola', back: 'hello', type: 'basic' }],
      now,
    );
    const sharedDeck = entities.decks[0];
    const sharedCard = entities.cards[0];
    const sharedNote = entities.notes[0];

    const localNote = {
      ...sharedNote,
      back: 'hello there',
      updatedAt: now + 20_000,
    };
    const remoteNote = {
      ...sharedNote,
      back: 'hello',
      updatedAt: now + 5_000,
    };

    const merged = mergeLearningCloudStates(
      {
        activeDeckId: sharedDeck.id,
        activeDeckUpdatedAt: now + 20_000,
        decks: [sharedDeck],
        notes: [localNote],
        cards: [sharedCard],
        reviewLogs: [],
        presets: getDefaultLearningPresets(),
      },
      {
        activeDeckId: sharedDeck.id,
        activeDeckUpdatedAt: now + 5_000,
        decks: [sharedDeck],
        notes: [remoteNote],
        cards: [sharedCard],
        reviewLogs: [],
        presets: getDefaultLearningPresets(),
      },
    );

    expect(merged.notes).toHaveLength(1);
    expect(merged.notes[0]?.back).toBe('hello there');
    expect(merged.notes[0]?.updatedAt).toBe(now + 20_000);
  });

  it('caps synced review logs to the mobile-safe cloud limit', () => {
    const now = 1_700_000_000_000;
    const { decks, notes, cards } = buildEntitiesFromRows(
      [{ deck: 'Spanish', front: 'hola', back: 'hello', type: 'basic' }],
      now,
    );
    const reviewLogs = Array.from({ length: MAX_CLOUD_REVIEW_LOGS + 25 }, (_value, index) => ({
      id: `review_${index}`,
      deckId: decks[0].id,
      cardId: cards[0].id,
      reviewedAt: now + index,
      rating: 'good' as const,
      previousState: 'learning' as const,
      newState: 'review' as const,
      scheduledDays: 1,
      elapsedDays: 0,
      wasCorrect: true,
      memoryStateBefore: null,
      memoryStateAfter: null,
    }));

    const normalized = normalizeLearningCloudState({
      activeDeckId: decks[0].id,
      activeDeckUpdatedAt: decks[0].updatedAt,
      decks,
      notes,
      cards,
      reviewLogs,
      presets: getDefaultLearningPresets(),
    });

    expect(normalized.reviewLogs).toHaveLength(MAX_CLOUD_REVIEW_LOGS);
    expect(normalized.reviewLogs[0]?.reviewedAt).toBe(now + MAX_CLOUD_REVIEW_LOGS + 24);
    expect(normalized.reviewLogs.at(-1)?.reviewedAt).toBe(now + 25);
  });

  it('keeps newest review logs when merged local and remote history exceeds the cloud cap', () => {
    const now = 1_700_000_000_000;
    const { decks, notes, cards } = buildEntitiesFromRows(
      [{ deck: 'Spanish', front: 'hola', back: 'hello', type: 'basic' }],
      now,
    );
    const makeReviewLog = (index: number) => ({
      id: `review_${index}`,
      deckId: decks[0].id,
      cardId: cards[0].id,
      reviewedAt: now + index,
      rating: 'good' as const,
      previousState: 'learning' as const,
      newState: 'review' as const,
      scheduledDays: 1,
      elapsedDays: 0,
      wasCorrect: true,
      memoryStateBefore: null,
      memoryStateAfter: null,
    });
    const localReviewLogs = Array.from({ length: MAX_CLOUD_REVIEW_LOGS }, (_value, index) =>
      makeReviewLog(index),
    );
    const remoteReviewLogs = Array.from({ length: 40 }, (_value, index) =>
      makeReviewLog(MAX_CLOUD_REVIEW_LOGS + index),
    );

    const merged = mergeLearningCloudStates(
      {
        activeDeckId: decks[0].id,
        activeDeckUpdatedAt: decks[0].updatedAt,
        decks,
        notes,
        cards,
        reviewLogs: localReviewLogs,
        presets: getDefaultLearningPresets(),
      },
      {
        activeDeckId: decks[0].id,
        activeDeckUpdatedAt: decks[0].updatedAt,
        decks,
        notes,
        cards,
        reviewLogs: remoteReviewLogs,
        presets: getDefaultLearningPresets(),
      },
    );

    expect(merged.reviewLogs).toHaveLength(MAX_CLOUD_REVIEW_LOGS);
    expect(merged.reviewLogs[0]?.reviewedAt).toBe(now + MAX_CLOUD_REVIEW_LOGS + 39);
    expect(merged.reviewLogs.at(-1)?.reviewedAt).toBe(now + 40);
  });

  it('produces a stable signature for equivalent states', () => {
    const now = 1_700_000_000_000;
    const { decks, notes, cards } = buildEntitiesFromRows(
      [{ deck: 'Italian', front: 'ciao', back: 'hello', type: 'basic' }],
      now,
    );

    const left = {
      activeDeckId: decks[0].id,
      activeDeckUpdatedAt: now + 1_000,
      decks,
      notes,
      cards,
      reviewLogs: [],
      presets: getDefaultLearningPresets(),
    };
    const right = {
      presets: [...getDefaultLearningPresets()].reverse(),
      reviewLogs: [],
      cards: [...cards].reverse(),
      notes: [...notes].reverse(),
      decks: [...decks].reverse(),
      activeDeckId: decks[0].id,
      activeDeckUpdatedAt: now + 1_000,
    };

    expect(getLearningCloudStateSignature(left)).toBe(getLearningCloudStateSignature(right));
  });

  it('treats a newer active deck timestamp as part of the cloud state signature', () => {
    const now = 1_700_000_000_000;
    const { decks, notes, cards } = buildEntitiesFromRows(
      [{ deck: 'Italian', front: 'ciao', back: 'hello', type: 'basic' }],
      now,
    );

    expect(
      getLearningCloudStateSignature({
        activeDeckId: decks[0].id,
        activeDeckUpdatedAt: now + 1_000,
        decks,
        notes,
        cards,
        reviewLogs: [],
        presets: getDefaultLearningPresets(),
      }),
    ).not.toBe(
      getLearningCloudStateSignature({
        activeDeckId: decks[0].id,
        activeDeckUpdatedAt: now + 2_000,
        decks,
        notes,
        cards,
        reviewLogs: [],
        presets: getDefaultLearningPresets(),
      }),
    );
  });

  it('changes the signature when normalized browser state changes', () => {
    const now = 1_700_000_000_000;
    const { decks, notes, cards } = buildEntitiesFromRows(
      [{ deck: 'Italian', front: 'ciao', back: 'hello', type: 'basic' }],
      now,
    );

    const base = normalizeLearningCloudState({
      activeDeckId: decks[0].id,
      activeDeckUpdatedAt: now + 1_000,
      decks,
      notes,
      cards,
      reviewLogs: [],
      presets: getDefaultLearningPresets(),
    });
    const changed = {
      ...base,
      cardBrowser: {
        ...base.cardBrowser,
        searchText: 'ciao',
        updatedAt: now + 500, // Explicitly bump updatedAt so the revision hash changes
      },
    };

    expect(getLearningCloudStateSignature(base)).not.toBe(getLearningCloudStateSignature(changed));
  });

  it('preserves browser and filtered-deck state in normalization and merge', () => {
    const now = 1_700_000_000_000;
    const localEntities = buildEntitiesFromRows(
      [{ deck: 'Spanish', front: 'hola', back: 'hello', type: 'basic' }],
      now,
    );
    const remoteEntities = buildEntitiesFromRows(
      [{ deck: 'French', front: 'bonjour', back: 'hello', type: 'basic' }],
      now + 10_000,
    );

    const local = normalizeLearningCloudState({
      activeDeckId: localEntities.decks[0].id,
      activeDeckUpdatedAt: now + 1_000,
      decks: localEntities.decks,
      notes: localEntities.notes,
      cards: localEntities.cards,
      reviewLogs: [],
      presets: getDefaultLearningPresets(),
      cardBrowser: {
        selectedDeckId: localEntities.decks[0].id,
        searchDraft: 'hola',
        searchText: 'hola',
        stateFilter: 'review',
        sortBy: 'front',
        sortDirection: 'desc',
        selectedCardIds: [localEntities.cards[0].id],
        savedSearchId: 'saved-local',
        updatedAt: now + 2_000,
      },
      savedCardQueries: [
        {
          id: 'saved-local',
          name: 'Spanish review',
          searchText: 'hola',
          selectedDeckId: localEntities.decks[0].id,
          stateFilter: 'review',
          sortBy: 'front',
          sortDirection: 'desc',
          createdAt: now,
          updatedAt: now + 2_000,
        },
      ],
      filteredDeckLiteDefinition: {
        id: 'filtered-local',
        name: 'Local filter',
        selectedDeckId: localEntities.decks[0].id,
        primaryQuery: 'deck:spanish',
        secondaryQuery: 'tag:starter',
        limit: 12,
        reschedule: true,
        allowEmpty: false,
        delayAgain: 15,
        delayHard: 30,
        delayGood: 45,
        lastRunAt: now + 1_500,
        updatedAt: now + 2_000,
      },
      filteredDeckLiteDefinitions: [
        {
          id: 'filtered-local',
          name: 'Local filter',
          selectedDeckId: localEntities.decks[0].id,
          primaryQuery: 'deck:spanish',
          secondaryQuery: 'tag:starter',
          limit: 12,
          reschedule: true,
          allowEmpty: false,
          delayAgain: 15,
          delayHard: 30,
          delayGood: 45,
          lastRunAt: now + 1_500,
          updatedAt: now + 2_000,
        },
      ],
      filteredDeckLiteRuns: [
        {
          id: 'run-local',
          name: 'Local filter',
          createdAt: now + 2_000,
          deckId: localEntities.decks[0].id,
          queueSize: 1,
          reschedule: true,
          allowEmpty: false,
          preview: [],
          updatedAt: now + 2_000,
        },
      ],
    });

    const remote = normalizeLearningCloudState({
      activeDeckId: remoteEntities.decks[0].id,
      activeDeckUpdatedAt: now + 9_000,
      decks: remoteEntities.decks,
      notes: remoteEntities.notes,
      cards: remoteEntities.cards,
      reviewLogs: [],
      presets: getDefaultLearningPresets(),
      cardBrowser: {
        selectedDeckId: remoteEntities.decks[0].id,
        searchDraft: 'bonjour',
        searchText: 'bonjour',
        stateFilter: 'learning',
        sortBy: 'deck',
        sortDirection: 'asc',
        selectedCardIds: [],
        updatedAt: now + 9_000,
      },
      savedCardQueries: [
        {
          id: 'saved-remote',
          name: 'French learning',
          searchText: 'bonjour',
          selectedDeckId: remoteEntities.decks[0].id,
          stateFilter: 'learning',
          sortBy: 'deck',
          sortDirection: 'asc',
          createdAt: now + 9_000,
          updatedAt: now + 9_000,
        },
      ],
      filteredDeckLiteDefinition: {
        id: 'filtered-remote',
        name: 'Remote filter',
        selectedDeckId: remoteEntities.decks[0].id,
        primaryQuery: 'deck:french',
        secondaryQuery: '',
        limit: 7,
        reschedule: false,
        allowEmpty: true,
        delayAgain: 5,
        delayHard: 10,
        delayGood: 20,
        lastRunAt: now + 9_000,
        updatedAt: now + 9_000,
      },
      filteredDeckLiteDefinitions: [
        {
          id: 'filtered-remote',
          name: 'Remote filter',
          selectedDeckId: remoteEntities.decks[0].id,
          primaryQuery: 'deck:french',
          secondaryQuery: '',
          limit: 7,
          reschedule: false,
          allowEmpty: true,
          delayAgain: 5,
          delayHard: 10,
          delayGood: 20,
          lastRunAt: now + 9_000,
          updatedAt: now + 9_000,
        },
      ],
      filteredDeckLiteRuns: [
        {
          id: 'run-remote',
          name: 'Remote filter',
          createdAt: now + 9_000,
          deckId: remoteEntities.decks[0].id,
          queueSize: 1,
          reschedule: false,
          allowEmpty: true,
          preview: [],
          updatedAt: now + 9_000,
        },
      ],
    });

    const merged = mergeLearningCloudStates(local, remote);

    expect(merged.cardBrowser.searchText).toBe('bonjour');
    expect(merged.cardBrowser.selectedDeckId).toBe(remoteEntities.decks[0].id);
    expect(merged.savedCardQueries).toHaveLength(2);
    expect(merged.filteredDeckLiteDefinitions).toHaveLength(2);
    expect(merged.filteredDeckLiteRuns).toHaveLength(2);
    expect(isLearningCloudStateEmpty(merged)).toBe(false);
    expect(getLearningCloudStateSignature(local)).not.toBe(getLearningCloudStateSignature(remote));
  });
});
