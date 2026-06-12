import { act, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildEntitiesFromRows, getDefaultLearningPresets } from '@/lib/learning';
import { getLearningCloudStateSignature } from '@/lib/learningCloudSync';

const loadLearningCloudStateMock = vi.fn();
const loadLearningCloudSyncCursorMock = vi.fn();
const pullLearningCloudMutationsMock = vi.fn();
const applyLearningCloudMutationsMock = vi.fn();
const saveLearningCloudStateMock = vi.fn();
const getLearningSyncDeviceIdMock = vi.fn(() => 'device-test');
const showSuccessFeedbackMock = vi.fn();
const withTimeoutMock = vi.fn();
const waitForPersistStorageIdleMock = vi.fn();
const areLearningCloudSyncCursorsEqualMock = vi.fn();
const cacheLearningCloudSyncBaselineMock = vi.fn();
const getCachedLearningCloudSyncBaselineMock = vi.fn();

describe('useManualLearningCloudSync', () => {
  beforeEach(() => {
    vi.resetModules();
    loadLearningCloudStateMock.mockReset();
    loadLearningCloudSyncCursorMock.mockReset();
    pullLearningCloudMutationsMock.mockReset();
    applyLearningCloudMutationsMock.mockReset();
    saveLearningCloudStateMock.mockReset();
    getLearningSyncDeviceIdMock.mockClear();
    showSuccessFeedbackMock.mockClear();
    withTimeoutMock.mockReset();
    waitForPersistStorageIdleMock.mockReset();
    areLearningCloudSyncCursorsEqualMock.mockReset();
    cacheLearningCloudSyncBaselineMock.mockReset();
    getCachedLearningCloudSyncBaselineMock.mockReset();
    waitForPersistStorageIdleMock.mockResolvedValue(undefined);
    areLearningCloudSyncCursorsEqualMock.mockReturnValue(false);
    getCachedLearningCloudSyncBaselineMock.mockReturnValue(null);
    pullLearningCloudMutationsMock.mockResolvedValue({ cursor: null, mutations: [] });
    applyLearningCloudMutationsMock.mockImplementation((state) => state);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('clears the busy state and surfaces a timeout error when sync hangs', async () => {
    vi.doMock('@/hooks/useI18n', () => ({
      useI18n: () => ({ locale: 'de' }),
    }));
    vi.doMock('@/services/firebaseLearningSyncService', () => ({
      applyLearningCloudMutations: applyLearningCloudMutationsMock,
      getLearningSyncDeviceId: getLearningSyncDeviceIdMock,
      loadLearningCloudState: loadLearningCloudStateMock,
      loadLearningCloudSyncCursor: loadLearningCloudSyncCursorMock,
      pullLearningCloudMutations: pullLearningCloudMutationsMock,
      saveLearningCloudState: saveLearningCloudStateMock,
    }));
    vi.doMock('@/lib/learningCloudSyncBaseline', () => ({
      areLearningCloudSyncCursorsEqual: areLearningCloudSyncCursorsEqualMock,
      cacheLearningCloudSyncBaseline: cacheLearningCloudSyncBaselineMock,
      getCachedLearningCloudSyncBaseline: getCachedLearningCloudSyncBaselineMock,
    }));
    vi.doMock('@/lib/successFeedback', () => ({
      showSuccessFeedback: showSuccessFeedbackMock,
    }));
    vi.doMock('@/lib/promiseTimeout', () => ({
      withTimeout: withTimeoutMock,
    }));
    vi.doMock('@/lib/persistStorage', async () => {
      const actual = await vi.importActual<typeof import('@/lib/persistStorage')>('@/lib/persistStorage');
      return {
        ...actual,
        waitForPersistStorageIdle: waitForPersistStorageIdleMock,
      };
    });

    const [{ useManualLearningCloudSync }, { useAuthStore }, { useLearningStore }] = await Promise.all([
      import('@/hooks/useManualLearningCloudSync'),
      import('@/store/useAuthStore'),
      import('@/store/useLearningStore'),
    ]);

    vi.spyOn(useLearningStore.persist, 'rehydrate').mockResolvedValue(undefined as never);
    useAuthStore.setState({
      status: 'authenticated',
      authReady: true,
      user: {
        uid: 'user-sync',
        email: 'user-sync@example.com',
      },
    });
    useLearningStore.setState(useLearningStore.getInitialState(), true);
    loadLearningCloudStateMock.mockResolvedValue(null);
    loadLearningCloudSyncCursorMock.mockResolvedValue(null);
    withTimeoutMock.mockImplementation(async (promise: Promise<unknown>, _timeoutMs: number, label: string) => {
      if (/learning cloud state load/i.test(label)) {
        throw new Error(`${label} timed out after 12000ms`);
      }
      return promise;
    });

    let latestHook: ReturnType<typeof useManualLearningCloudSync> | null = null;

    function Harness() {
      latestHook = useManualLearningCloudSync();
      return null;
    }

    render(<Harness />);

    expect(latestHook?.canSync).toBe(true);

    let syncPromise: Promise<boolean> | null = null;
    await act(async () => {
      syncPromise = latestHook?.syncLearningCloud() ?? null;
      await Promise.resolve();
    });

    await expect(syncPromise).resolves.toBe(false);

    await waitFor(() => {
      expect(latestHook?.syncing).toBe(false);
      expect(latestHook?.syncError).toMatch(/zu lange gedauert/i);
    });
    expect(showSuccessFeedbackMock).not.toHaveBeenCalled();
  });

  it('skips redundant rehydrate work when the learning store is already hydrated', async () => {
    vi.doMock('@/hooks/useI18n', () => ({
      useI18n: () => ({ locale: 'de' }),
    }));
    vi.doMock('@/services/firebaseLearningSyncService', () => ({
      applyLearningCloudMutations: applyLearningCloudMutationsMock,
      getLearningSyncDeviceId: getLearningSyncDeviceIdMock,
      loadLearningCloudState: loadLearningCloudStateMock,
      loadLearningCloudSyncCursor: loadLearningCloudSyncCursorMock,
      pullLearningCloudMutations: pullLearningCloudMutationsMock,
      saveLearningCloudState: saveLearningCloudStateMock,
    }));
    vi.doMock('@/lib/learningCloudSyncBaseline', () => ({
      areLearningCloudSyncCursorsEqual: areLearningCloudSyncCursorsEqualMock,
      cacheLearningCloudSyncBaseline: cacheLearningCloudSyncBaselineMock,
      getCachedLearningCloudSyncBaseline: getCachedLearningCloudSyncBaselineMock,
    }));
    vi.doMock('@/lib/successFeedback', () => ({
      showSuccessFeedback: showSuccessFeedbackMock,
    }));
    vi.doMock('@/lib/promiseTimeout', () => ({
      withTimeout: withTimeoutMock,
    }));
    vi.doMock('@/lib/persistStorage', async () => {
      const actual = await vi.importActual<typeof import('@/lib/persistStorage')>('@/lib/persistStorage');
      return {
        ...actual,
        waitForPersistStorageIdle: waitForPersistStorageIdleMock,
      };
    });

    const [{ useManualLearningCloudSync }, { useAuthStore }, { useLearningStore }] = await Promise.all([
      import('@/hooks/useManualLearningCloudSync'),
      import('@/store/useAuthStore'),
      import('@/store/useLearningStore'),
    ]);

    const rehydrateSpy = vi.spyOn(useLearningStore.persist, 'rehydrate').mockResolvedValue(undefined as never);
    vi.spyOn(useLearningStore.persist, 'hasHydrated').mockReturnValue(true);
    waitForPersistStorageIdleMock.mockResolvedValue(undefined);
    withTimeoutMock.mockImplementation(async (promise: Promise<unknown>) => promise);
    loadLearningCloudStateMock.mockResolvedValue(null);
    loadLearningCloudSyncCursorMock.mockResolvedValue(null);

    useAuthStore.setState({
      status: 'authenticated',
      authReady: true,
      user: {
        uid: 'user-sync',
        email: 'user-sync@example.com',
      },
    });
    useLearningStore.setState(useLearningStore.getInitialState(), true);

    let latestHook: ReturnType<typeof useManualLearningCloudSync> | null = null;

    function Harness() {
      latestHook = useManualLearningCloudSync();
      return null;
    }

    render(<Harness />);

    let syncPromise: Promise<boolean> | null = null;
    await act(async () => {
      syncPromise = latestHook?.syncLearningCloud() ?? null;
      await Promise.resolve();
    });

    await expect(syncPromise).resolves.toBe(true);

    expect(rehydrateSpy).not.toHaveBeenCalled();
    expect(waitForPersistStorageIdleMock).toHaveBeenCalledWith('blearn-learning-storage', 4000);
    expect(showSuccessFeedbackMock).toHaveBeenCalled();
  });

  it('pulls remote vocabulary into the local learning store when the cloud has newer data', async () => {
    vi.doMock('@/hooks/useI18n', () => ({
      useI18n: () => ({ locale: 'de' }),
    }));
    vi.doMock('@/services/firebaseLearningSyncService', () => ({
      applyLearningCloudMutations: applyLearningCloudMutationsMock,
      getLearningSyncDeviceId: getLearningSyncDeviceIdMock,
      loadLearningCloudState: loadLearningCloudStateMock,
      loadLearningCloudSyncCursor: loadLearningCloudSyncCursorMock,
      pullLearningCloudMutations: pullLearningCloudMutationsMock,
      saveLearningCloudState: saveLearningCloudStateMock,
    }));
    vi.doMock('@/lib/learningCloudSyncBaseline', () => ({
      areLearningCloudSyncCursorsEqual: areLearningCloudSyncCursorsEqualMock,
      cacheLearningCloudSyncBaseline: cacheLearningCloudSyncBaselineMock,
      getCachedLearningCloudSyncBaseline: getCachedLearningCloudSyncBaselineMock,
    }));
    vi.doMock('@/lib/successFeedback', () => ({
      showSuccessFeedback: showSuccessFeedbackMock,
    }));
    vi.doMock('@/lib/promiseTimeout', () => ({
      withTimeout: withTimeoutMock,
    }));
    vi.doMock('@/lib/persistStorage', async () => {
      const actual = await vi.importActual<typeof import('@/lib/persistStorage')>('@/lib/persistStorage');
      return {
        ...actual,
        waitForPersistStorageIdle: waitForPersistStorageIdleMock,
      };
    });

    const [{ useManualLearningCloudSync }, { useAuthStore }, { useLearningStore }] = await Promise.all([
      import('@/hooks/useManualLearningCloudSync'),
      import('@/store/useAuthStore'),
      import('@/store/useLearningStore'),
    ]);

    const now = 1_700_000_000_000;
    const remoteEntities = buildEntitiesFromRows(
      [{ deck: 'Spanish', front: 'hola', back: 'hello', type: 'basic' }],
      now,
    );

    vi.spyOn(useLearningStore.persist, 'rehydrate').mockResolvedValue(undefined as never);
    vi.spyOn(useLearningStore.persist, 'hasHydrated').mockReturnValue(true);
    waitForPersistStorageIdleMock.mockResolvedValue(undefined);
    withTimeoutMock.mockImplementation(async (promise: Promise<unknown>) => promise);
    loadLearningCloudSyncCursorMock.mockResolvedValue(null);
    loadLearningCloudStateMock.mockResolvedValue({
      activeDeckId: remoteEntities.decks[0].id,
      activeDeckUpdatedAt: remoteEntities.decks[0].updatedAt,
      decks: remoteEntities.decks,
      notes: remoteEntities.notes,
      cards: remoteEntities.cards,
      reviewLogs: [],
      presets: getDefaultLearningPresets(),
      cardBrowser: {
        selectedDeckId: remoteEntities.decks[0].id,
        searchDraft: '',
        searchText: '',
        stateFilter: 'all' as const,
        sortBy: 'due' as const,
        sortDirection: 'asc' as const,
        selectedCardIds: [],
        updatedAt: now,
      },
      savedCardQueries: [],
      filteredDeckLiteDefinition: {
        id: 'filtered-deck-lite-default',
        name: 'Filtered Deck Lite',
        selectedDeckId: remoteEntities.decks[0].id,
        primaryQuery: '',
        secondaryQuery: '',
        limit: 25,
        reschedule: false,
        allowEmpty: true,
        delayAgain: 10,
        delayHard: 30,
        delayGood: 120,
        updatedAt: now,
      },
      filteredDeckLiteDefinitions: [],
      filteredDeckLiteRuns: [],
    });

    useAuthStore.setState({
      status: 'authenticated',
      authReady: true,
      user: {
        uid: 'user-sync',
        email: 'user-sync@example.com',
      },
    });
    useLearningStore.setState(useLearningStore.getInitialState(), true);

    let latestHook: ReturnType<typeof useManualLearningCloudSync> | null = null;

    function Harness() {
      latestHook = useManualLearningCloudSync();
      return null;
    }

    render(<Harness />);

    let syncPromise: Promise<boolean> | null = null;
    await act(async () => {
      syncPromise = latestHook?.syncLearningCloud() ?? null;
      await Promise.resolve();
    });

    await expect(syncPromise).resolves.toBe(true);

    await waitFor(() => {
      expect(Object.values(useLearningStore.getState().decks).map((deck) => deck.name)).toEqual(['Spanish']);
    });
    expect(Object.values(useLearningStore.getState().notes)).toHaveLength(1);
    expect(Object.values(useLearningStore.getState().cards)).toHaveLength(1);
    expect(saveLearningCloudStateMock).toHaveBeenCalledTimes(1);
    expect(saveLearningCloudStateMock).toHaveBeenCalledWith(
      'user-sync',
      expect.objectContaining({
        decks: expect.arrayContaining([
          expect.objectContaining({
            name: 'Spanish',
          }),
        ]),
      }),
      expect.objectContaining({
        decks: expect.arrayContaining([
          expect.objectContaining({
            name: 'Spanish',
          }),
        ]),
      }),
      'device-test',
      expect.objectContaining({
        localSyncState: expect.objectContaining({
          version: 1,
        }),
      }),
    );
    expect(showSuccessFeedbackMock).toHaveBeenCalled();
  });

  it('reuses the cached sync baseline when the remote cursor has not changed', async () => {
    vi.doMock('@/hooks/useI18n', () => ({
      useI18n: () => ({ locale: 'de' }),
    }));
    vi.doMock('@/services/firebaseLearningSyncService', () => ({
      applyLearningCloudMutations: applyLearningCloudMutationsMock,
      getLearningSyncDeviceId: getLearningSyncDeviceIdMock,
      loadLearningCloudState: loadLearningCloudStateMock,
      loadLearningCloudSyncCursor: loadLearningCloudSyncCursorMock,
      pullLearningCloudMutations: pullLearningCloudMutationsMock,
      saveLearningCloudState: saveLearningCloudStateMock,
    }));
    vi.doMock('@/lib/learningCloudSyncBaseline', () => ({
      areLearningCloudSyncCursorsEqual: areLearningCloudSyncCursorsEqualMock,
      cacheLearningCloudSyncBaseline: cacheLearningCloudSyncBaselineMock,
      getCachedLearningCloudSyncBaseline: getCachedLearningCloudSyncBaselineMock,
    }));
    vi.doMock('@/lib/successFeedback', () => ({
      showSuccessFeedback: showSuccessFeedbackMock,
    }));
    vi.doMock('@/lib/promiseTimeout', () => ({
      withTimeout: withTimeoutMock,
    }));
    vi.doMock('@/lib/persistStorage', async () => {
      const actual = await vi.importActual<typeof import('@/lib/persistStorage')>('@/lib/persistStorage');
      return {
        ...actual,
        waitForPersistStorageIdle: waitForPersistStorageIdleMock,
      };
    });

    const [{ useManualLearningCloudSync }, { useAuthStore }, { useLearningStore }] = await Promise.all([
      import('@/hooks/useManualLearningCloudSync'),
      import('@/store/useAuthStore'),
      import('@/store/useLearningStore'),
    ]);

    vi.spyOn(useLearningStore.persist, 'rehydrate').mockResolvedValue(undefined as never);
    vi.spyOn(useLearningStore.persist, 'hasHydrated').mockReturnValue(true);
    waitForPersistStorageIdleMock.mockResolvedValue(undefined);
    withTimeoutMock.mockImplementation(async (promise: Promise<unknown>) => promise);

    const baselineState = {
      activeDeckId: 'deck-1',
      activeDeckUpdatedAt: 1_700_000_000_000,
      decks: [{
        id: 'deck-1',
        name: 'Spanish',
        description: '',
        language: 'de',
        tags: [],
        cardIds: ['card-1'],
        createdAt: 1_700_000_000_000,
        updatedAt: 1_700_000_000_000,
      }],
      notes: [{
        id: 'note-1',
        deckId: 'deck-1',
        type: 'basic' as const,
        front: 'hola',
        back: 'hello',
        tags: [],
        language: 'de',
        createdAt: 1_700_000_000_000,
        updatedAt: 1_700_000_000_000,
      }],
      cards: [{
        id: 'card-1',
        noteId: 'note-1',
        deckId: 'deck-1',
        type: 'basic' as const,
        state: 'new' as const,
        dueAt: 1_700_000_000_000,
        intervalDays: 0,
        easeFactor: 2.5,
        reps: 0,
        lapses: 0,
        stepIndex: 0,
        memoryState: null,
        createdAt: 1_700_000_000_000,
      }],
      reviewLogs: [],
      presets: [],
      cardBrowser: {
        selectedDeckId: 'deck-1',
        searchDraft: '',
        searchText: '',
        stateFilter: 'all' as const,
        sortBy: 'due' as const,
        sortDirection: 'asc' as const,
        selectedCardIds: [],
        updatedAt: 0,
      },
      savedCardQueries: [],
      filteredDeckLiteDefinition: {
        id: 'filtered-deck-lite-default',
        name: 'Filtered Deck Lite',
        primaryQuery: '',
        secondaryQuery: '',
        limit: 25,
        reschedule: false,
        allowEmpty: true,
        delayAgain: 10,
        delayHard: 30,
        delayGood: 120,
        updatedAt: 0,
      },
      filteredDeckLiteDefinitions: [],
      filteredDeckLiteRuns: [],
    };

    const localState = {
      ...baselineState,
      cards: [{
        ...baselineState.cards[0],
        lastReviewedAt: 1_700_000_005_000,
        dueAt: 1_700_086_400_000,
        intervalDays: 1,
      }],
    };

    useAuthStore.setState({
      status: 'authenticated',
      authReady: true,
      user: {
        uid: 'user-sync',
        email: 'user-sync@example.com',
      },
    });
    useLearningStore.setState({
      ...useLearningStore.getInitialState(),
      ...localState,
    }, true);

    loadLearningCloudSyncCursorMock.mockResolvedValue({
      mutationId: 'cursor-1',
      mutationAt: 1_700_000_001_000,
    });
    getCachedLearningCloudSyncBaselineMock.mockReturnValue({
      cursor: {
        mutationId: 'cursor-1',
        mutationAt: 1_700_000_001_000,
      },
      state: baselineState,
    });
    areLearningCloudSyncCursorsEqualMock.mockReturnValue(true);
    saveLearningCloudStateMock.mockResolvedValue({
      mutationCursor: {
        mutationId: 'cursor-2',
        mutationAt: 1_700_000_006_000,
      },
      lastMutationId: 'cursor-2',
      lastMutationAt: 1_700_000_006_000,
    });

    let latestHook: ReturnType<typeof useManualLearningCloudSync> | null = null;

    function Harness() {
      latestHook = useManualLearningCloudSync();
      return null;
    }

    render(<Harness />);

    let syncPromise: Promise<boolean> | null = null;
    await act(async () => {
      syncPromise = latestHook?.syncLearningCloud() ?? null;
      await Promise.resolve();
    });

    await expect(syncPromise).resolves.toBe(true);

    expect(loadLearningCloudStateMock).not.toHaveBeenCalled();
    expect(saveLearningCloudStateMock).toHaveBeenCalledWith(
      'user-sync',
      expect.objectContaining({
        cards: expect.arrayContaining([
          expect.objectContaining({
            id: 'card-1',
            intervalDays: 1,
          }),
        ]),
      }),
      expect.objectContaining({
        cards: expect.arrayContaining([
          expect.objectContaining({
            id: 'card-1',
            intervalDays: 0,
          }),
        ]),
      }),
      'device-test',
      expect.objectContaining({
        localSyncState: expect.objectContaining({
          version: 1,
        }),
      }),
    );
    expect(cacheLearningCloudSyncBaselineMock).toHaveBeenCalledWith(
      'user-sync',
      expect.objectContaining({
        cards: expect.arrayContaining([
          expect.objectContaining({
            id: 'card-1',
            intervalDays: 1,
          }),
        ]),
      }),
      expect.objectContaining({
        mutationId: 'cursor-2',
        mutationAt: 1_700_000_006_000,
      }),
    );
  });

  it('pushes metadata deletions even when the remote cursor is unchanged', async () => {
    vi.doMock('@/hooks/useI18n', () => ({
      useI18n: () => ({ locale: 'de' }),
    }));
    vi.doMock('@/services/firebaseLearningSyncService', () => ({
      applyLearningCloudMutations: applyLearningCloudMutationsMock,
      getLearningSyncDeviceId: getLearningSyncDeviceIdMock,
      loadLearningCloudState: loadLearningCloudStateMock,
      loadLearningCloudSyncCursor: loadLearningCloudSyncCursorMock,
      pullLearningCloudMutations: pullLearningCloudMutationsMock,
      saveLearningCloudState: saveLearningCloudStateMock,
    }));
    vi.doMock('@/lib/learningCloudSyncBaseline', () => ({
      areLearningCloudSyncCursorsEqual: areLearningCloudSyncCursorsEqualMock,
      cacheLearningCloudSyncBaseline: cacheLearningCloudSyncBaselineMock,
      getCachedLearningCloudSyncBaseline: getCachedLearningCloudSyncBaselineMock,
    }));
    vi.doMock('@/lib/successFeedback', () => ({
      showSuccessFeedback: showSuccessFeedbackMock,
    }));
    vi.doMock('@/lib/promiseTimeout', () => ({
      withTimeout: withTimeoutMock,
    }));
    vi.doMock('@/lib/persistStorage', async () => {
      const actual = await vi.importActual<typeof import('@/lib/persistStorage')>('@/lib/persistStorage');
      return {
        ...actual,
        waitForPersistStorageIdle: waitForPersistStorageIdleMock,
      };
    });

    const [{ useManualLearningCloudSync }, { useAuthStore }, { useLearningStore }] = await Promise.all([
      import('@/hooks/useManualLearningCloudSync'),
      import('@/store/useAuthStore'),
      import('@/store/useLearningStore'),
    ]);

    const now = 1_700_000_000_000;
    const entities = buildEntitiesFromRows(
      [{ deck: 'Spanish', front: 'hola', back: 'hello', type: 'basic' }],
      now,
    );
    const sharedState = {
      activeDeckId: entities.decks[0].id,
      activeDeckUpdatedAt: entities.decks[0].updatedAt,
      decks: entities.decks,
      notes: entities.notes,
      cards: entities.cards,
      reviewLogs: [],
      presets: getDefaultLearningPresets(),
      filteredDeckLiteDefinition: {
        id: 'filtered-deck-lite-default',
        name: 'Filtered Deck Lite',
        selectedDeckId: entities.decks[0].id,
        primaryQuery: '',
        secondaryQuery: '',
        limit: 25,
        reschedule: false,
        allowEmpty: true,
        delayAgain: 10,
        delayHard: 30,
        delayGood: 120,
        updatedAt: now,
      },
      filteredDeckLiteDefinitions: [],
      filteredDeckLiteRuns: [],
    };
    const previousSyncedState = {
      ...sharedState,
      savedCardQueries: [{
        id: 'remote-search',
        name: 'Remote Search',
        searchText: 'hola',
        stateFilter: 'all' as const,
        sortBy: 'due' as const,
        sortDirection: 'asc' as const,
        createdAt: now,
        updatedAt: now,
      }],
    };
    const currentState = {
      ...sharedState,
      savedCardQueries: [],
    };
    const remoteCursor = {
      mutationId: 'cursor-1',
      mutationAt: now + 1_000,
    };

    vi.spyOn(useLearningStore.persist, 'rehydrate').mockResolvedValue(undefined as never);
    vi.spyOn(useLearningStore.persist, 'hasHydrated').mockReturnValue(true);
    waitForPersistStorageIdleMock.mockResolvedValue(undefined);
    withTimeoutMock.mockImplementation(async (promise: Promise<unknown>) => promise);
    loadLearningCloudSyncCursorMock.mockResolvedValue(remoteCursor);
    areLearningCloudSyncCursorsEqualMock.mockReturnValue(true);
    saveLearningCloudStateMock.mockResolvedValue({
      mutationCursor: remoteCursor,
      lastMutationId: remoteCursor.mutationId,
      lastMutationAt: remoteCursor.mutationAt,
    });

    useAuthStore.setState({
      status: 'authenticated',
      authReady: true,
      user: {
        uid: 'user-sync',
        email: 'user-sync@example.com',
      },
    });
    useLearningStore.setState({
      ...useLearningStore.getInitialState(),
      ...currentState,
      learningCloudLocalSyncState: {
        version: 1 as const,
        lastSuccessfulSyncAt: now + 2_000,
        lastRemoteCursor: remoteCursor,
        lastSuccessfulStateSignature: getLearningCloudStateSignature(previousSyncedState),
        deletedDecks: [],
        deletedNotes: [],
        deletedCards: [],
        deletedReviewLogs: [],
        deletedPresets: [],
      },
    }, true);

    let latestHook: ReturnType<typeof useManualLearningCloudSync> | null = null;

    function Harness() {
      latestHook = useManualLearningCloudSync();
      return null;
    }

    render(<Harness />);

    let syncPromise: Promise<boolean> | null = null;
    await act(async () => {
      syncPromise = latestHook?.syncLearningCloud() ?? null;
      await Promise.resolve();
    });

    await expect(syncPromise).resolves.toBe(true);

    expect(loadLearningCloudStateMock).not.toHaveBeenCalled();
    expect(saveLearningCloudStateMock).toHaveBeenCalledWith(
      'user-sync',
      expect.objectContaining({
        savedCardQueries: [],
      }),
      null,
      'device-test',
      expect.objectContaining({
        localSyncState: expect.objectContaining({
          lastSuccessfulStateSignature: getLearningCloudStateSignature(previousSyncedState),
        }),
      }),
    );
  });
});
