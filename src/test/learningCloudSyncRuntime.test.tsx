import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, waitFor } from '@testing-library/react';
import { buildEntitiesFromRows, getDefaultLearningPresets } from '@/lib/learning';
import { getLearningCloudStateSignature } from '@/lib/learningCloudSync';
import { waitForPersistStorageIdle } from '@/lib/persistStorage';
import { toRecordById } from './helpers/storeTestUtils';

const loadLearningCloudStateMock = vi.fn();
const loadLearningCloudSyncCursorMock = vi.fn();
const pullLearningCloudMutationsMock = vi.fn();
const applyLearningCloudMutationsMock = vi.fn();
const saveLearningCloudStateMock = vi.fn();
const subscribeToLearningCloudMetadataMock = vi.fn(() => vi.fn());
const getLearningSyncDeviceIdMock = vi.fn(() => 'device-test');
let metadataListener: ((meta: unknown) => void) | null = null;

const LEARNING_STORAGE_KEY = 'blearn-learning-storage';
const LEARNING_STORAGE_OWNER_KEY = 'blearn-learning-storage-owner';
const LEARNING_STORAGE_BACKUP_PREFIX = 'blearn-learning-storage-backup:';
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

async function loadHarness(options?: { firebaseWritesEnabled?: boolean }) {
  vi.resetModules();
  vi.doUnmock('@/lib/firebase');
  if (options?.firebaseWritesEnabled === false) {
    vi.doMock('@/lib/firebase', async () => {
      const actual = await vi.importActual<typeof import('@/lib/firebase')>('@/lib/firebase');
      return {
        ...actual,
        isFirebaseWriteEnabled: () => false,
      };
    });
  }
  loadLearningCloudStateMock.mockReset();
  loadLearningCloudSyncCursorMock.mockReset();
  pullLearningCloudMutationsMock.mockReset();
  applyLearningCloudMutationsMock.mockReset();
  saveLearningCloudStateMock.mockReset();
  subscribeToLearningCloudMetadataMock.mockClear();
  getLearningSyncDeviceIdMock.mockClear();
  metadataListener = null;

  loadLearningCloudSyncCursorMock.mockResolvedValue(null);
  pullLearningCloudMutationsMock.mockResolvedValue({ cursor: null, mutations: [] });
  applyLearningCloudMutationsMock.mockImplementation((state) => state);

  const [
    { __setLearningCloudSyncApiForTest, useLearningCloudSync },
    cloudSyncRuntime,
    { useAuthStore },
    { useLearningStore },
  ] = await Promise.all([
    import('@/hooks/useLearningCloudSync'),
    import('@/lib/cloudSyncRuntime'),
    import('@/store/useAuthStore'),
    import('@/store/useLearningStore'),
  ]);

  __setLearningCloudSyncApiForTest({
    applyLearningCloudMutations: applyLearningCloudMutationsMock,
    loadLearningCloudState: loadLearningCloudStateMock,
    loadLearningCloudSyncCursor: loadLearningCloudSyncCursorMock,
    pullLearningCloudMutations: pullLearningCloudMutationsMock,
    saveLearningCloudState: saveLearningCloudStateMock,
    subscribeToLearningCloudMetadata: vi.fn((userId: string, onChange: (meta: unknown) => void) => {
      metadataListener = onChange;
      return subscribeToLearningCloudMetadataMock(userId, onChange);
    }),
    getLearningSyncDeviceId: getLearningSyncDeviceIdMock,
  });

  function Harness() {
    useLearningCloudSync(true);
    return null;
  }

  return {
    Harness,
    cloudSyncRuntime,
    useAuthStore,
    useLearningStore,
  };
}

async function renderHarness(Harness: () => null) {
  await act(async () => {
    render(<Harness />);
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function setAuthenticatedUser(
  useAuthStore: {
    setState: (value: {
      status: 'authenticated';
      authReady: true;
      user: {
        uid: string;
        email: string;
      };
    }) => void;
  },
  uid: string,
  email: string,
) {
  await act(async () => {
    useAuthStore.setState({
      status: 'authenticated',
      authReady: true,
      user: {
        uid,
        email,
      },
    });
    await Promise.resolve();
  });
}

describe('useLearningCloudSync account isolation', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    await deletePersistDatabase();
  });

  afterEach(async () => {
    window.localStorage.clear();
    await waitForPersistStorageIdle(LEARNING_STORAGE_KEY).catch(() => undefined);
    await deletePersistDatabase();
    vi.resetModules();
  });

  it('backs up local vocab per account and restores it when switching back', async () => {
    const now = 1_700_000_000_000;
    const localEntities = buildEntitiesFromRows(
      [{ deck: 'Spanish', front: 'hola', back: 'hello', type: 'basic' }],
      now,
    );
    const remoteEntities = buildEntitiesFromRows(
      [{ deck: 'French', front: 'bonjour', back: 'hello', type: 'basic' }],
      now + 5_000,
    );
    const { Harness, useAuthStore, useLearningStore } = await loadHarness();

    useLearningStore.setState(
      {
        ...useLearningStore.getInitialState(),
        activeDeckId: localEntities.decks[0].id,
        activeDeckUpdatedAt: localEntities.decks[0].updatedAt,
        decks: toRecordById(localEntities.decks),
        notes: toRecordById(localEntities.notes),
        cards: toRecordById(localEntities.cards),
        presets: toRecordById(getDefaultLearningPresets()),
      },
      true,
    );
    await waitForPersistStorageIdle(LEARNING_STORAGE_KEY);

    window.localStorage.setItem(LEARNING_STORAGE_OWNER_KEY, 'user-a');
    loadLearningCloudStateMock.mockResolvedValue({
      activeDeckId: remoteEntities.decks[0].id,
      activeDeckUpdatedAt: remoteEntities.decks[0].updatedAt,
      decks: remoteEntities.decks,
      notes: remoteEntities.notes,
      cards: remoteEntities.cards,
      reviewLogs: [],
      presets: getDefaultLearningPresets(),
    });

    useAuthStore.setState({
      status: 'authenticated',
      authReady: true,
      user: {
        uid: 'user-b',
        email: 'user-b@example.com',
      },
    });

    await renderHarness(Harness);

    await waitFor(() => {
      expect(Object.values(useLearningStore.getState().decks).map((deck) => deck.name)).toEqual(['French']);
    });

    expect(Object.values(useLearningStore.getState().cards)).toHaveLength(1);
    expect(Object.values(useLearningStore.getState().cards)[0]?.deckId).toBe(remoteEntities.decks[0].id);
    expect(loadLearningCloudStateMock).toHaveBeenCalledWith('user-b');
    expect(window.localStorage.getItem(LEARNING_STORAGE_OWNER_KEY)).toBe('user-b');
    expect(Object.values(useLearningStore.getState().decks).some((deck) => deck.id === localEntities.decks[0].id)).toBe(false);

    const learningStorage = useLearningStore.persist.getOptions().storage;
    const userABackup = await learningStorage?.getItem(`${LEARNING_STORAGE_BACKUP_PREFIX}user-a`);
    expect(userABackup).not.toBeNull();

    loadLearningCloudStateMock.mockResolvedValueOnce(null);
    await setAuthenticatedUser(useAuthStore, 'user-a', 'user-a@example.com');

    await waitFor(() => {
      expect(Object.values(useLearningStore.getState().decks).map((deck) => deck.name)).toEqual(['Spanish']);
    });

    expect(window.localStorage.getItem(LEARNING_STORAGE_OWNER_KEY)).toBe('user-a');
  });

  it('does not merge the previous account local vocab into a new empty account', async () => {
    const now = 1_700_000_000_000;
    const localEntities = buildEntitiesFromRows(
      [{ deck: 'Spanish', front: 'hola', back: 'hello', type: 'basic' }],
      now,
    );
    const { Harness, useAuthStore, useLearningStore } = await loadHarness();

    useLearningStore.setState(
      {
        ...useLearningStore.getInitialState(),
        activeDeckId: localEntities.decks[0].id,
        activeDeckUpdatedAt: localEntities.decks[0].updatedAt,
        decks: toRecordById(localEntities.decks),
        notes: toRecordById(localEntities.notes),
        cards: toRecordById(localEntities.cards),
        presets: toRecordById(getDefaultLearningPresets()),
      },
      true,
    );
    await waitForPersistStorageIdle(LEARNING_STORAGE_KEY);

    window.localStorage.setItem(LEARNING_STORAGE_OWNER_KEY, 'user-a');
    loadLearningCloudStateMock.mockResolvedValue(null);

    useAuthStore.setState({
      status: 'authenticated',
      authReady: true,
      user: {
        uid: 'user-empty',
        email: 'user-empty@example.com',
      },
    });

    await renderHarness(Harness);

    await waitFor(() => {
      expect(Object.values(useLearningStore.getState().decks)).toHaveLength(0);
    });

    expect(Object.values(useLearningStore.getState().notes)).toHaveLength(0);
    expect(Object.values(useLearningStore.getState().cards)).toHaveLength(0);
    expect(saveLearningCloudStateMock).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(LEARNING_STORAGE_OWNER_KEY)).toBe('user-empty');

    const learningStorage = useLearningStore.persist.getOptions().storage;
    const userABackup = await learningStorage?.getItem(`${LEARNING_STORAGE_BACKUP_PREFIX}user-a`);
    expect(userABackup).not.toBeNull();
  });

  it('does not bootstrap cloud sync when Firebase writes are disabled for the build', async () => {
    const { Harness, cloudSyncRuntime, useAuthStore } = await loadHarness({ firebaseWritesEnabled: false });

    cloudSyncRuntime.resetCloudSyncRuntimeForTests();

    useAuthStore.setState({
      status: 'authenticated',
      authReady: true,
      user: {
        uid: 'user-guarded',
        email: 'user-guarded@example.com',
      },
    });

    await renderHarness(Harness);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(loadLearningCloudSyncCursorMock).not.toHaveBeenCalled();
    expect(loadLearningCloudStateMock).not.toHaveBeenCalled();
    expect(saveLearningCloudStateMock).not.toHaveBeenCalled();
    expect(subscribeToLearningCloudMetadataMock).not.toHaveBeenCalled();
    expect(cloudSyncRuntime.useCloudSyncRuntimeStore.getState().learning.status).toBe('blocked-writes-disabled');
  });

  it('pushes local pending mutations through the debounced save path', async () => {
    try {
      const now = 1_700_000_000_000;
      const localEntities = buildEntitiesFromRows(
        [{ deck: 'Spanish', front: 'hola', back: 'hello', type: 'basic' }],
        now,
      );
      const { Harness, useAuthStore, useLearningStore } = await loadHarness();

      loadLearningCloudStateMock.mockResolvedValue(null);
      saveLearningCloudStateMock.mockResolvedValue({
        schemaVersion: 1,
        lastMutationId: 'mutation-local-1',
        updatedByDeviceId: 'device-test',
        clientUpdatedAt: Date.now(),
      });

      useAuthStore.setState({
        status: 'authenticated',
        authReady: true,
        user: {
          uid: 'user-sync',
          email: 'user-sync@example.com',
        },
      });

      await renderHarness(Harness);

      await waitFor(() => {
        expect(loadLearningCloudStateMock).toHaveBeenCalledWith('user-sync');
      });

      await act(async () => {
        useLearningStore.setState(
        {
          ...useLearningStore.getInitialState(),
          activeDeckId: localEntities.decks[0].id,
          activeDeckUpdatedAt: localEntities.decks[0].updatedAt,
          decks: toRecordById(localEntities.decks),
          notes: toRecordById(localEntities.notes),
          cards: toRecordById(localEntities.cards),
          presets: toRecordById(getDefaultLearningPresets()),
        },
        true,
        );
      });

      await act(async () => {
        await new Promise((resolve) => window.setTimeout(resolve, 1300));
      });

      await waitFor(() => {
        expect(saveLearningCloudStateMock).toHaveBeenCalledTimes(1);
      });

      const [userId, nextState, previousState, deviceId, options] = saveLearningCloudStateMock.mock.calls[0] || [];
    expect(userId).toBe('user-sync');
      expect(nextState.decks).toHaveLength(1);
      expect(previousState?.decks).toHaveLength(0);
      expect(deviceId).toBe('device-test');
      expect(options).toEqual(expect.objectContaining({
        localSyncState: expect.objectContaining({
          version: 1,
        }),
      }));
    } finally {
      vi.useRealTimers();
    }
  });

  it('flushes the latest local learning state immediately for blocked review completion', async () => {
    const now = 1_700_000_000_000;
    const localEntities = buildEntitiesFromRows(
      [{ deck: 'Spanish', front: 'hola', back: 'hello', type: 'basic' }],
      now,
    );
    const { Harness, useAuthStore, useLearningStore } = await loadHarness();
    const { flushLearningCloudSaveIfAvailable } = await import('@/lib/learningCloudImmediateSave');

    loadLearningCloudStateMock.mockResolvedValue(null);
    saveLearningCloudStateMock.mockResolvedValue({
      schemaVersion: 1,
      lastMutationId: 'mutation-blocked-review-1',
      lastMutationAt: now + 1,
      updatedByDeviceId: 'device-test',
      clientUpdatedAt: now + 1,
    });

    useAuthStore.setState({
      status: 'authenticated',
      authReady: true,
      user: {
        uid: 'user-sync',
        email: 'user-sync@example.com',
      },
    });

    await renderHarness(Harness);

    await waitFor(() => {
      expect(loadLearningCloudStateMock).toHaveBeenCalledWith('user-sync');
    });

    await act(async () => {
      useLearningStore.setState(
        {
          ...useLearningStore.getInitialState(),
          activeDeckId: localEntities.decks[0].id,
          activeDeckUpdatedAt: localEntities.decks[0].updatedAt,
          decks: toRecordById(localEntities.decks),
          notes: toRecordById(localEntities.notes),
          cards: toRecordById(localEntities.cards),
          presets: toRecordById(getDefaultLearningPresets()),
        },
        true,
      );
    });

    let flushed = false;
    await act(async () => {
      flushed = await flushLearningCloudSaveIfAvailable('blocked-learn-unlock');
    });

    expect(flushed).toBe(true);
    expect(saveLearningCloudStateMock).toHaveBeenCalledTimes(1);
    const [userId, nextState, previousState, deviceId] = saveLearningCloudStateMock.mock.calls[0] || [];
    expect(userId).toBe('user-sync');
    expect(nextState.decks).toHaveLength(1);
    expect(previousState?.decks).toHaveLength(0);
    expect(deviceId).toBe('device-test');
    expect(useLearningStore.getState().learningCloudLocalSyncState.lastSuccessfulStateSignature)
      .toBe(getLearningCloudStateSignature(nextState));
  });

  it('reuses the cached baseline on bootstrap when the remote cursor is unchanged', async () => {
    const now = 1_700_000_000_000;
    const cachedEntities = buildEntitiesFromRows(
      [{ deck: 'French', front: 'bonjour', back: 'hello', type: 'basic' }],
      now,
    );
    const { Harness, useAuthStore, useLearningStore } = await loadHarness();
    const remoteCursor = {
      mutationId: 'cursor-1',
      mutationAt: now + 1_000,
    };

    const { cacheLearningCloudSyncBaseline } = await import('@/lib/learningCloudSyncBaseline');
    cacheLearningCloudSyncBaseline('user-cached', {
      activeDeckId: cachedEntities.decks[0].id,
      activeDeckUpdatedAt: cachedEntities.decks[0].updatedAt,
      decks: cachedEntities.decks,
      notes: cachedEntities.notes,
      cards: cachedEntities.cards,
      reviewLogs: [],
      presets: getDefaultLearningPresets(),
    }, remoteCursor);

    loadLearningCloudSyncCursorMock.mockResolvedValue(remoteCursor);
    loadLearningCloudStateMock.mockResolvedValue({
      activeDeckId: 'unexpected',
      activeDeckUpdatedAt: now + 2_000,
      decks: [],
      notes: [],
      cards: [],
      reviewLogs: [],
      presets: getDefaultLearningPresets(),
    });

    useAuthStore.setState({
      status: 'authenticated',
      authReady: true,
      user: {
        uid: 'user-cached',
        email: 'user-cached@example.com',
      },
    });

    await renderHarness(Harness);

    await waitFor(() => {
      expect(Object.values(useLearningStore.getState().decks).map((deck) => deck.name)).toEqual(['French']);
    });

    expect(loadLearningCloudSyncCursorMock).toHaveBeenCalledWith('user-cached');
    expect(loadLearningCloudStateMock).not.toHaveBeenCalled();
  });

  it('uses the remote mutation cursor but still falls back to snapshot reloads for legacy metadata', async () => {
    const now = 1_700_000_000_000;
    const localEntities = buildEntitiesFromRows(
      [{ deck: 'Spanish', front: 'hola', back: 'hello', type: 'basic' }],
      now,
    );
    const remoteEntities = buildEntitiesFromRows(
      [{ deck: 'French', front: 'bonjour', back: 'hello', type: 'basic' }],
      now + 5_000,
    );
    const { Harness, useAuthStore, useLearningStore } = await loadHarness();
    const remoteMutationCursor = {
      mutationId: 'remote-mutation-1',
      mutationAt: now + 5_000,
    };
    const remoteCloudState = {
      activeDeckId: remoteEntities.decks[0].id,
      activeDeckUpdatedAt: remoteEntities.decks[0].updatedAt,
      decks: remoteEntities.decks,
      notes: remoteEntities.notes,
      cards: remoteEntities.cards,
      reviewLogs: [],
      presets: getDefaultLearningPresets(),
    };
    const localCloudState = {
      activeDeckId: localEntities.decks[0].id,
      activeDeckUpdatedAt: localEntities.decks[0].updatedAt,
      decks: toRecordById(localEntities.decks),
      notes: toRecordById(localEntities.notes),
      cards: toRecordById(localEntities.cards),
      reviewLogs: [],
      presets: getDefaultLearningPresets(),
    };

    loadLearningCloudStateMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(localCloudState);
    pullLearningCloudMutationsMock.mockResolvedValue({
      cursor: remoteMutationCursor,
      mutations: [
        {
          id: 'mutation_remote',
          deviceId: 'remote-device',
          mutationAt: now + 5_000,
          baseCursor: null,
          cursor: remoteMutationCursor,
          delta: {},
          snapshot: remoteCloudState,
          acknowledgedAt: now + 5_000,
        },
      ],
    });
    applyLearningCloudMutationsMock.mockReturnValue(remoteCloudState);

    useAuthStore.setState({
      status: 'authenticated',
      authReady: true,
      user: {
        uid: 'user-cursor',
        email: 'user-cursor@example.com',
      },
    });

    await renderHarness(Harness);

    await waitFor(() => {
      expect(loadLearningCloudStateMock).toHaveBeenCalledWith('user-cursor');
    });

    await act(async () => {
      metadataListener?.({
        schemaVersion: 2,
        updatedByDeviceId: 'remote-device',
        mutationCursor: remoteMutationCursor,
        lastMutationId: remoteMutationCursor.mutationId,
        lastMutationAt: remoteMutationCursor.mutationAt,
      });
    });

    await waitFor(() => {
      expect(Object.values(useLearningStore.getState().decks).map((deck) => deck.name)).toEqual(['French']);
    });

    expect(pullLearningCloudMutationsMock).toHaveBeenCalledTimes(1);
    expect(pullLearningCloudMutationsMock).toHaveBeenCalledWith('user-cursor', null);
    expect(loadLearningCloudStateMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      metadataListener?.({
        schemaVersion: 2,
        updatedByDeviceId: 'remote-device',
        mutationCursor: remoteMutationCursor,
        lastMutationId: remoteMutationCursor.mutationId,
        lastMutationAt: remoteMutationCursor.mutationAt,
      });
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(pullLearningCloudMutationsMock).toHaveBeenCalledTimes(1);
    expect(loadLearningCloudStateMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      metadataListener?.({
        schemaVersion: 1,
        updatedByDeviceId: 'remote-device',
      });
    });

    await waitFor(() => {
      expect(loadLearningCloudStateMock).toHaveBeenCalledTimes(2);
      expect(Object.values(useLearningStore.getState().decks).map((deck) => deck.name).sort()).toEqual(['French', 'Spanish']);
    });
  });

  it('saves local metadata deletions when the stored state signature no longer matches the synced baseline', async () => {
    const now = 1_700_000_000_000;
    const entities = buildEntitiesFromRows(
      [{ deck: 'Spanish', front: 'hola', back: 'hello', type: 'basic' }],
      now,
    );
    const { Harness, useAuthStore, useLearningStore } = await loadHarness();
    const remoteCursor = {
      mutationId: 'cursor-1',
      mutationAt: now + 1_000,
    };
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

    loadLearningCloudSyncCursorMock.mockResolvedValue(remoteCursor);
    loadLearningCloudStateMock.mockResolvedValue({
      ...sharedState,
      savedCardQueries: [{
        id: 'unexpected-load',
        name: 'Unexpected',
        searchText: 'bonjour',
        stateFilter: 'all' as const,
        sortBy: 'due' as const,
        sortDirection: 'asc' as const,
        createdAt: now,
        updatedAt: now,
      }],
    });
    saveLearningCloudStateMock.mockResolvedValue({
      schemaVersion: 2,
      mutationCursor: remoteCursor,
      lastMutationId: remoteCursor.mutationId,
      lastMutationAt: remoteCursor.mutationAt,
      updatedByDeviceId: 'device-test',
      clientUpdatedAt: now + 2_000,
    });

    useLearningStore.setState({
      ...useLearningStore.getInitialState(),
      activeDeckId: entities.decks[0].id,
      activeDeckUpdatedAt: entities.decks[0].updatedAt,
      decks: toRecordById(entities.decks),
      notes: toRecordById(entities.notes),
      cards: toRecordById(entities.cards),
      presets: toRecordById(getDefaultLearningPresets()),
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
    useAuthStore.setState({
      status: 'authenticated',
      authReady: true,
      user: {
        uid: 'user-sync',
        email: 'user-sync@example.com',
      },
    });

    await renderHarness(Harness);

    await waitFor(() => {
      expect(saveLearningCloudStateMock).toHaveBeenCalledTimes(1);
    });

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
