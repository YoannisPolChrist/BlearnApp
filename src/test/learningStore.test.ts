import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildEntitiesFromRows,
  getDefaultGateRule,
  getDefaultLearningPresets,
} from '@/lib/learning';
import { buildLearningStoreIndexes } from '@/modules/learning/store';
import { waitForPersistStorageIdle } from '@/lib/persistStorage';
import { useLearningStore } from '@/store/useLearningStore';

const LEARNING_STORAGE_KEY = 'blearn-learning-storage';
const PERSIST_DB_NAME = 'blearn-persist';

async function deletePersistDatabase() {
  if (typeof indexedDB === 'undefined') {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(PERSIST_DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error('Failed to delete persist database'));
    request.onblocked = () => resolve();
  });
}


function toRecordById<T extends { id: string }>(data: Record<string, T> | T[] | undefined | null) {
  if (!data) return {};
  if (Array.isArray(data)) {
    const record: Record<string, T> = {};
    for (const item of data) {
      if (item && item.id) record[item.id] = item;
    }
    return record;
  }
  return data;
}
describe('learning store timing', () => {
  beforeEach(async () => {
    await deletePersistDatabase();
    window.localStorage.clear();
    useLearningStore.setState(useLearningStore.getInitialState(), true);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await waitForPersistStorageIdle(LEARNING_STORAGE_KEY).catch(() => undefined);
    await deletePersistDatabase();
    window.localStorage.clear();
    useLearningStore.setState(useLearningStore.getInitialState(), true);
  });

  it('rehydrates reviewed cards and shows them again once dueAt has passed', async () => {
    const now = 1_700_000_000_000;
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(now);
    const { decks, notes, cards } = buildEntitiesFromRows(
      [{ deck: 'Deck', front: 'house', back: 'Haus', type: 'basic' }],
      now,
    );

    useLearningStore.setState(
      {
        ...useLearningStore.getInitialState(),
        activeDeckId: decks[0].id,
        decks: Object.fromEntries(decks.map(d => [d.id, d])),
        notes: Object.fromEntries(notes.map(n => [n.id, n])),
        cards: Object.fromEntries(cards.map(c => [c.id, c])),
        presets: getDefaultLearningPresets(),
        gateRule: getDefaultGateRule(),
      },
      true,
    );

    const reviewResult = useLearningStore.getState().submitReview(cards[0].id, 'good', true);
    expect(reviewResult).not.toBeNull();
    expect(reviewResult?.updatedCard.state).toBe('learning');
    expect(reviewResult?.updatedCard.dueAt).toBeGreaterThan(now);

    await waitForPersistStorageIdle(LEARNING_STORAGE_KEY);
    const storage = useLearningStore.persist.getOptions().storage;
    const snapshot = storage
      ? await storage.getItem(LEARNING_STORAGE_KEY)
      : null;
    expect(snapshot).toBeTruthy();

    useLearningStore.setState(useLearningStore.getInitialState(), true);
    if (storage && snapshot) {
      await storage.setItem(LEARNING_STORAGE_KEY, snapshot);
    }
    nowSpy.mockReturnValue((reviewResult?.updatedCard.dueAt ?? now) + 1);

    await useLearningStore.persist.rehydrate();

    const rehydratedDueCards = useLearningStore.getState().getDueCardsForDecks([decks[0].id]);
    const stats = useLearningStore.getState().getDeckStats(decks[0].id);

    expect(rehydratedDueCards.map((card) => card.id)).toContain(cards[0].id);
    expect(stats?.dueNowCount).toBe(1);
    expect(stats?.dueNowCount).toBe(rehydratedDueCards.length);
  });

  it('stores the updated schedule after each review rating', () => {
    const now = 1_700_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const ratings = ['again', 'hard', 'good', 'easy'] as const;

    for (const rating of ratings) {
      const { decks, notes, cards } = buildEntitiesFromRows(
        [{ deck: `Deck ${rating}`, front: `front ${rating}`, back: `back ${rating}`, type: 'basic' }],
        now,
      );

      useLearningStore.setState(
        {
          ...useLearningStore.getInitialState(),
          activeDeckId: decks[0].id,
          decks: toRecordById(decks),
          notes: toRecordById(notes),
          cards: toRecordById(cards),
          presets: getDefaultLearningPresets(),
          gateRule: getDefaultGateRule(),
        },
        true,
      );

      const result = useLearningStore.getState().submitReview(cards[0].id, rating, rating !== 'again');
      expect(result).not.toBeNull();

      const storedCard = useLearningStore.getState().cards[cards[0].id];
      const storedLog = Object.values(useLearningStore.getState().reviewLogs)[0];

      expect(storedCard).toMatchObject({
        dueAt: result!.updatedCard.dueAt,
        intervalDays: result!.updatedCard.intervalDays,
        scheduledDays: result!.updatedCard.scheduledDays,
        lastReviewedAt: now,
        updatedAt: now,
        reps: result!.updatedCard.reps,
        lapses: result!.updatedCard.lapses,
        state: result!.updatedCard.state,
      });
      expect(storedCard.dueAt).toBeGreaterThanOrEqual(now);
      expect(storedLog).toMatchObject({
        cardId: cards[0].id,
        reviewedAt: now,
        rating,
        scheduledDays: result!.log.scheduledDays,
        wasCorrect: rating !== 'again',
      });
    }
  });

  it('creates a deck-specific preset when the review mix is customized on a shared default preset', () => {
    const now = 1_700_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const { decks } = buildEntitiesFromRows(
      [
        { deck: 'Deck A', front: 'house', back: 'Haus', type: 'basic' },
        { deck: 'Deck B', front: 'tree', back: 'Baum', type: 'basic' },
      ],
      now,
    );

    useLearningStore.setState(
      {
        ...useLearningStore.getInitialState(),
        activeDeckId: decks[0].id,
        decks: Object.fromEntries(decks.map(d => [d.id, d])),
        presets: getDefaultLearningPresets(),
        gateRule: getDefaultGateRule(),
      },
      true,
    );

    useLearningStore.getState().setDeckReviewMix(decks[0].id, 10);

    const nextState = useLearningStore.getState();

    expect(nextState.getResolvedPresetForDeck(decks[0].id).reviewsBetweenNewCards).toBe(10);
    expect(nextState.getResolvedPresetForDeck(decks[1].id).reviewsBetweenNewCards).toBe(15);
    expect(Object.values(nextState.decks)[0]?.presetId).not.toBe(Object.values(nextState.decks)[1]?.presetId);
    expect(nextState.activeDeckUpdatedAt).toBe(now);
  });

  it('updates deck and active selection timestamps when a review is submitted', () => {
    const now = 1_700_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const { decks, notes, cards } = buildEntitiesFromRows(
      [{ deck: 'Deck', front: 'house', back: 'Haus', type: 'basic' }],
      now - 10_000,
    );

    useLearningStore.setState(
      {
        ...useLearningStore.getInitialState(),
        activeDeckId: decks[0].id,
        activeDeckUpdatedAt: now - 5_000,
        decks: Object.fromEntries(decks.map(d => [d.id, d])),
        notes: Object.fromEntries(notes.map(n => [n.id, n])),
        cards: Object.fromEntries(cards.map(c => [c.id, c])),
        presets: getDefaultLearningPresets(),
        gateRule: getDefaultGateRule(),
      },
      true,
    );

    const reviewResult = useLearningStore.getState().submitReview(cards[0].id, 'good', true);
    expect(reviewResult).not.toBeNull();

    const nextState = useLearningStore.getState();
    expect(Object.values(nextState.decks)[0]?.updatedAt).toBe(now);
    expect(nextState.activeDeckUpdatedAt).toBe(now);
  });

  it('keeps review-log deck indexes correct when a capped log buffer prepends a new review', () => {
    const now = 1_700_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const { decks, notes, cards } = buildEntitiesFromRows(
      [
        { deck: 'Deck A', front: 'house', back: 'Haus', type: 'basic' },
        { deck: 'Deck B', front: 'tree', back: 'Baum', type: 'basic' },
      ],
      now - 10_000,
    );
    const presets = getDefaultLearningPresets().map((preset) => ({
      ...preset,
      lastOptimizerRunAt: now,
      lastOptimizerReviewCount: 5_000,
    }));
    const reviewLogs = [
      ...Array.from({ length: 4_999 }, (_, index) => ({
        id: `log-a-${index}`,
        deckId: decks[0].id,
        cardId: cards[0].id,
        reviewedAt: now - index - 1,
        rating: 'good' as const,
        previousState: 'review' as const,
        newState: 'review' as const,
        scheduledDays: 1,
        elapsedDays: 1,
        wasCorrect: true,
        memoryStateBefore: null,
        memoryStateAfter: null,
      })),
      {
        id: 'log-b-tail',
        deckId: decks[1].id,
        cardId: cards[1].id,
        reviewedAt: now - 5_000,
        rating: 'good' as const,
        previousState: 'review' as const,
        newState: 'review' as const,
        scheduledDays: 1,
        elapsedDays: 1,
        wasCorrect: true,
        memoryStateBefore: null,
        memoryStateAfter: null,
      },
    ];
    const seededState = {
      ...useLearningStore.getInitialState(),
      activeDeckId: decks[0].id,
      decks: Object.fromEntries(decks.map(d => [d.id, d])),
      notes: Object.fromEntries(notes.map(n => [n.id, n])),
      cards: Object.fromEntries(cards.map(c => [c.id, c])),
      reviewLogs: Object.fromEntries(reviewLogs.map(l => [l.id, l])),
      presets: presets,
      gateRule: getDefaultGateRule(),
    };

    useLearningStore.setState(
      {
        ...seededState,
        indexes: buildLearningStoreIndexes(seededState),
      },
      true,
    );

    const reviewResult = useLearningStore.getState().submitReview(cards[0].id, 'good', true);
    expect(reviewResult).not.toBeNull();

    const nextState = useLearningStore.getState();
    const deckAReviewIndices = nextState.indexes.reviewLogIndicesByDeckId[decks[0].id];

    expect(Object.values(nextState.reviewLogs)).toHaveLength(5_000);
    expect(Object.values(nextState.reviewLogs)[0]?.deckId).toBe(decks[0].id);
    expect(Object.values(nextState.reviewLogs).at(-1)?.deckId).toBe(decks[0].id);
    expect(deckAReviewIndices).toHaveLength(5_000);
    expect(deckAReviewIndices?.[0]).toBe(0);
    expect(deckAReviewIndices?.at(-1)).toBe(4_999);
    expect(nextState.indexes.reviewLogIndicesByDeckId[decks[1].id]).toBeUndefined();
  });

  it('persists and rehydrates browser and filtered-deck state', async () => {
    const now = 1_700_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const { decks, notes, cards } = buildEntitiesFromRows(
      [{ deck: 'Deck', front: 'house', back: 'Haus', type: 'basic' }],
      now,
    );

    useLearningStore.setState(
      {
        ...useLearningStore.getInitialState(),
        activeDeckId: decks[0].id,
        decks: Object.fromEntries(decks.map(d => [d.id, d])),
        notes: Object.fromEntries(notes.map(n => [n.id, n])),
        cards: Object.fromEntries(cards.map(c => [c.id, c])),
        presets: getDefaultLearningPresets(),
      },
      true,
    );

    useLearningStore.getState().setCardBrowserState({
      selectedDeckId: decks[0].id,
      searchDraft: 'haus',
      searchText: 'haus',
      stateFilter: 'review',
      sortBy: 'front',
      sortDirection: 'desc',
    });
    const savedSearch = useLearningStore.getState().upsertSavedCardQuery({
      name: 'Haus suchen',
      searchText: 'haus',
      selectedDeckId: decks[0].id,
      stateFilter: 'review',
      sortBy: 'front',
      sortDirection: 'desc',
    });
    useLearningStore.getState().setFilteredDeckLiteDefinition({
      id: 'filtered-deck-custom',
      name: 'Custom Filter',
      selectedDeckId: decks[0].id,
      primaryQuery: 'house',
      secondaryQuery: '',
      limit: 8,
      reschedule: true,
      allowEmpty: false,
      delayAgain: 12,
      delayHard: 24,
      delayGood: 36,
    });
    useLearningStore.getState().saveFilteredDeckLiteDefinition();
    useLearningStore.getState().runFilteredDeckLiteDefinition();

    await waitForPersistStorageIdle(LEARNING_STORAGE_KEY);
    const storage = useLearningStore.persist.getOptions().storage;
    const snapshot = storage
      ? await storage.getItem(LEARNING_STORAGE_KEY)
      : null;
    expect(snapshot).toBeTruthy();

    useLearningStore.setState(useLearningStore.getInitialState(), true);
    if (storage && snapshot) {
      await storage.setItem(LEARNING_STORAGE_KEY, snapshot);
    }

    await useLearningStore.persist.rehydrate();

    const rehydrated = useLearningStore.getState();

    expect(rehydrated.cardBrowser.searchText).toBe('haus');
    expect(rehydrated.cardBrowser.sortBy).toBe('front');
    expect(rehydrated.savedCardQueries).toHaveLength(1);
    expect(rehydrated.savedCardQueries[0]?.id).toBe(savedSearch.id);
    expect(rehydrated.filteredDeckLiteDefinition.id).toBe('filtered-deck-custom');
    expect(rehydrated.filteredDeckLiteDefinitions).toHaveLength(1);
    expect(rehydrated.filteredDeckLiteRuns).toHaveLength(1);
    expect(rehydrated.filteredDeckLiteRuns[0]?.deckId).toBe(decks[0].id);
    expect(rehydrated.filteredDeckLiteRuns[0]?.queueSize).toBeGreaterThan(0);
  });

  it('does not rehydrate transient review session runtime state', async () => {
    const now = 1_700_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const { decks, notes, cards } = buildEntitiesFromRows(
      [{ deck: 'Deck', front: 'house', back: 'Haus', type: 'basic' }],
      now,
    );

    useLearningStore.setState(
      {
        ...useLearningStore.getInitialState(),
        activeDeckId: decks[0].id,
        decks: Object.fromEntries(decks.map(d => [d.id, d])),
        notes: Object.fromEntries(notes.map(n => [n.id, n])),
        cards: Object.fromEntries(cards.map(c => [c.id, c])),
        presets: getDefaultLearningPresets(),
        gateRule: getDefaultGateRule(),
      },
      true,
    );

    useLearningStore.getState().startReviewSession(
      {
        kind: 'review',
        status: 'active',
        deckId: decks[0].id,
        currentCardId: cards[0].id,
        sessionCreditsRequired: 1,
        queue: [cards[0].id],
        candidateIds: [cards[0].id],
        candidateCursor: 1,
        typedAnswer: 'haus',
        typedCorrect: true,
        revealed: true,
        attemptCount: 1,
        attemptMessage: 'Gut',
        countedReviews: 1,
        startedAt: now,
        updatedAt: now,
        history: [],
        timer: {
          isRunning: false,
          isPaused: false,
          elapsedMs: 0,
        },
      },
      { timerVisible: false, deckUpdatedAt: now },
    );

    await waitForPersistStorageIdle(LEARNING_STORAGE_KEY);
    const storage = useLearningStore.persist.getOptions().storage;
    const snapshot = storage ? await storage.getItem(LEARNING_STORAGE_KEY) : null;
    expect(snapshot).toBeTruthy();

    useLearningStore.setState(useLearningStore.getInitialState(), true);
    if (storage && snapshot) {
      await storage.setItem(LEARNING_STORAGE_KEY, snapshot);
    }

    await useLearningStore.persist.rehydrate();

    expect(useLearningStore.getState().reviewSession).toEqual(useLearningStore.getInitialState().reviewSession);
    expect(Object.values(useLearningStore.getState().cards)[0]?.id).toBe(cards[0].id);
  });

  it('registers media assets and transfer jobs for manual cards with mediaUrl', () => {
    const now = 1_700_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const { decks } = buildEntitiesFromRows(
      [{ deck: 'Deck', front: 'house', back: 'Haus', type: 'basic' }],
      now,
    );

    useLearningStore.setState(
      {
        ...useLearningStore.getInitialState(),
        activeDeckId: decks[0].id,
        decks: Object.fromEntries(decks.map(d => [d.id, d])),
      },
      true,
    );

    const job = useLearningStore.getState().createManualCard({
      deckId: decks[0].id,
      deckName: decks[0].name,
      front: 'sun',
      back: 'Sonne',
      type: 'basic',
      mediaUrl: 'https://cdn.example.com/media/sun.png',
    });

    expect(job).not.toBeNull();

    const state = useLearningStore.getState();
    expect(state.mediaRegistry.assets).toHaveLength(1);
    expect(state.mediaRegistry.assets[0]?.deckId).toBe(decks[0].id);
    expect(state.mediaRegistry.assets[0]?.noteId).toBeDefined();
    expect(state.mediaRegistry.assets[0]?.sourceUri).toBe('https://cdn.example.com/media/sun.png');
    expect(state.mediaTransferQueue.jobs).toHaveLength(1);
    expect(state.mediaTransferQueue.jobs[0]?.assetId).toBe(state.mediaRegistry.assets[0]?.id);
    expect(state.mediaTransferQueue.jobs[0]?.payload?.sourceUri).toBe('https://cdn.example.com/media/sun.png');
  });

  it('registers media assets for imported payloads with mediaUrl', () => {
    const now = 1_700_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(now);

    const importJob = useLearningStore.getState().importFromJson('media.json', {
      notes: [
        {
          deck: 'Birds',
          type: 'basic',
          front: 'bird',
          back: 'Vogel',
          tags: [],
          mediaUrl: 'https://cdn.example.com/media/bird.jpg',
        },
      ],
    });

    expect(importJob.importedCardCount).toBe(1);

    const state = useLearningStore.getState();
    expect(state.mediaRegistry.assets).toHaveLength(1);
    expect(state.mediaRegistry.assets[0]?.kind).toBe('image');
    expect(state.mediaRegistry.assets[0]?.sourceUri).toBe('https://cdn.example.com/media/bird.jpg');
    expect(state.mediaRegistry.assets[0]?.metadata?.source).toBe('json');
    expect(state.mediaTransferQueue.jobs).toHaveLength(1);
  });

  it('persists and rehydrates media registry and transfer queue', async () => {
    const now = 1_700_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const { decks } = buildEntitiesFromRows(
      [{ deck: 'Deck', front: 'house', back: 'Haus', type: 'basic' }],
      now,
    );

    useLearningStore.setState(
      {
        ...useLearningStore.getInitialState(),
        activeDeckId: decks[0].id,
        decks: Object.fromEntries(decks.map(d => [d.id, d])),
      },
      true,
    );

    useLearningStore.getState().createManualCard({
      deckId: decks[0].id,
      deckName: decks[0].name,
      front: 'sun',
      back: 'Sonne',
      type: 'basic',
      mediaUrl: 'https://cdn.example.com/media/sun.png',
    });

    await waitForPersistStorageIdle(LEARNING_STORAGE_KEY);
    const storage = useLearningStore.persist.getOptions().storage;
    const snapshot = storage ? await storage.getItem(LEARNING_STORAGE_KEY) : null;
    expect(snapshot).toBeTruthy();

    useLearningStore.setState(useLearningStore.getInitialState(), true);
    if (storage && snapshot) {
      await storage.setItem(LEARNING_STORAGE_KEY, snapshot);
    }

    await useLearningStore.persist.rehydrate();

    const rehydrated = useLearningStore.getState();
    expect(rehydrated.mediaRegistry.assets).toHaveLength(1);
    expect(rehydrated.mediaRegistry.assets[0]?.sourceUri).toBe('https://cdn.example.com/media/sun.png');
    expect(rehydrated.mediaTransferQueue.jobs).toHaveLength(1);
    expect(rehydrated.mediaTransferQueue.jobs[0]?.status).toBe('queued');
  });
});
