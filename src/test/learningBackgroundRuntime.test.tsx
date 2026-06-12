import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { buildEntitiesFromRows, getDefaultGateRule, getDefaultLearningPresets } from '@/lib/learning';
import { waitForPersistStorageIdle } from '@/lib/persistStorage';
import { toRecordById } from './helpers/storeTestUtils';
import { normalizeMediaRegistry } from '@/modules/learning/media/mediaRegistry';
import { normalizeMediaTransferQueue } from '@/modules/learning/media/mediaTransferQueue';
import { normalizeLearningSyncWorkerQueue } from '@/modules/learning/workers/learningSyncWorker';
import {
  processLearningMediaRuntime,
  processLearningSyncRuntime,
} from '@/services/learningBackgroundService';
import { useAuthStore } from '@/store/useAuthStore';
import { useLearningStore } from '@/store/useLearningStore';
import {
  getLearningSyncWorkerQueueSignature,
  useLearningBackgroundRuntime,
} from '@/hooks/useLearningBackgroundRuntime';

const loadLearningCloudStateMock = vi.hoisted(() => vi.fn());
const LEARNING_STORAGE_KEY = 'blearn-learning-storage';

vi.mock('@/services/firebaseLearningSyncService', () => ({
  loadLearningCloudState: loadLearningCloudStateMock,
}));

function createCloudStateDeck(name: string, now: number) {
  return buildEntitiesFromRows([{ deck: name, front: 'hola', back: 'hello', type: 'basic' }], now);
}

function Harness() {
  useLearningBackgroundRuntime(true);
  return null;
}

function HarnessWithoutSync() {
  useLearningBackgroundRuntime(true, { syncEnabled: false });
  return null;
}

async function advanceTimers(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

function createMatchingCloudState(local: ReturnType<typeof createCloudStateDeck>, now: number) {
  return {
    activeDeckId: local.decks[0].id,
    activeDeckUpdatedAt: local.decks[0].updatedAt,
    decks: local.decks,
    notes: local.notes,
    cards: local.cards,
    reviewLogs: [],
    presets: getDefaultLearningPresets(),
    cardBrowser: {
      selectedDeckId: local.decks[0].id,
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
      selectedDeckId: local.decks[0].id,
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
}

describe('learning background runtime', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useLearningStore.setState(useLearningStore.getInitialState(), true);
    useAuthStore.setState({
      status: 'authenticated',
      authReady: true,
      user: {
        uid: 'user-runtime',
        email: 'user-runtime@example.com',
      },
    });
    loadLearningCloudStateMock.mockReset();
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    vi.clearAllTimers();
    vi.useRealTimers();
    useLearningStore.setState(useLearningStore.getInitialState(), true);
    useAuthStore.setState({
      status: 'idle',
      authReady: false,
      user: null,
    });
    return waitForPersistStorageIdle(LEARNING_STORAGE_KEY).catch(() => undefined);
  });

  it('processes media assets through the background worker cycle', async () => {
    const now = 1_700_000_000_000;
    const { notes, cards } = createCloudStateDeck('Deck', now);

    const result = await processLearningMediaRuntime(
      {
        notes: [
          {
            ...notes[0],
            mediaUrl: 'https://cdn.example.com/media/sun.png',
          },
        ],
        mediaRegistry: normalizeMediaRegistry(),
        mediaTransferQueue: normalizeMediaTransferQueue(),
      },
      now,
    );

    expect(result.processedJobIds).toHaveLength(1);
    expect(result.registry.assets).toHaveLength(1);
    expect(result.registry.assets[0]?.state).toBe('synced');
    expect(result.registry.assets[0]?.remoteUrl).toBe('https://cdn.example.com/media/sun.png');
    expect(result.queue.jobs[0]?.status).toBe('succeeded');
    expect(cards).toHaveLength(1);
  });

  it('derives a stable queue signature without serializing the full queue payload', () => {
    const baseQueue = normalizeLearningSyncWorkerQueue({
      updatedAt: 1_700_000_000_000,
      jobs: Array.from({ length: 48 }, (_, index) => ({
        id: `job-${index}`,
        kind: 'merge' as const,
        status: index % 3 === 0 ? 'queued' as const : index % 3 === 1 ? 'running' as const : 'failed' as const,
        attempts: index % 4,
        maxAttempts: 3,
        nextAttemptAt: 1_700_000_000_000 + index * 1000,
        createdAt: 1_700_000_000_000 - index * 10,
        updatedAt: 1_700_000_000_000 + index * 10,
        lastAttemptAt: index % 2 === 0 ? 1_700_000_000_000 + index * 5 : undefined,
        lastError: index % 5 === 0 ? 'boom' : undefined,
        localSignature: `local-${index}`,
        remoteSignature: `remote-${index}`,
      })),
      version: 1,
    });
    const sameQueue = normalizeLearningSyncWorkerQueue({
      updatedAt: 1_700_000_000_000,
      jobs: [...baseQueue.jobs],
      version: 1,
    });
    const changedQueue = normalizeLearningSyncWorkerQueue({
      updatedAt: 1_700_000_000_000,
      jobs: baseQueue.jobs.map((job) => (
        job.id === 'job-24'
          ? {
              ...job,
              attempts: job.attempts + 1,
            }
          : job
      )),
      version: 1,
    });

    const baseSignature = getLearningSyncWorkerQueueSignature(baseQueue);
    const sameSignature = getLearningSyncWorkerQueueSignature(sameQueue);
    const changedSignature = getLearningSyncWorkerQueueSignature(changedQueue);

    expect(baseSignature).toBe(sameSignature);
    expect(changedSignature).not.toBe(baseSignature);
    expect(baseSignature).toMatch(/^v1\|u1700000000470\|n48\|h[0-9a-z]+$/);
  });

  it('runs the sync maintenance worker on app focus', async () => {
    const now = 1_700_000_000_000;
    const local = createCloudStateDeck('Local', now);
    const remote = createCloudStateDeck('Remote', now + 5_000);

    useLearningStore.setState(
      {
        ...useLearningStore.getInitialState(),
        activeDeckId: local.decks[0].id,
        activeDeckUpdatedAt: local.decks[0].updatedAt,
        decks: toRecordById(local.decks),
        notes: toRecordById(local.notes),
        cards: toRecordById(local.cards),
        presets: toRecordById(getDefaultLearningPresets()),
        mediaRegistry: normalizeMediaRegistry(),
        mediaTransferQueue: normalizeMediaTransferQueue(),
        learningSyncWorkerQueue: normalizeLearningSyncWorkerQueue(),
      },
      true,
    );

    loadLearningCloudStateMock.mockResolvedValue({
      activeDeckId: remote.decks[0].id,
      activeDeckUpdatedAt: remote.decks[0].updatedAt,
      decks: remote.decks,
      notes: remote.notes,
      cards: remote.cards,
      reviewLogs: [],
      presets: getDefaultLearningPresets(),
      cardBrowser: {
        selectedDeckId: remote.decks[0].id,
        searchDraft: '',
        searchText: '',
        stateFilter: 'all',
        sortBy: 'due',
        sortDirection: 'asc',
        selectedCardIds: [],
        updatedAt: now,
      },
      savedCardQueries: [],
      filteredDeckLiteDefinition: {
        id: 'filtered-deck-lite-default',
        name: 'Filtered Deck Lite',
        selectedDeckId: remote.decks[0].id,
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

    await act(async () => {
      render(<Harness />);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(loadLearningCloudStateMock).toHaveBeenCalledWith('user-runtime');
    });

    loadLearningCloudStateMock.mockClear();
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
      await new Promise((resolve) => window.setTimeout(resolve, 0));
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });

    await waitFor(() => {
      expect(loadLearningCloudStateMock).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(useLearningStore.getState().activeDeckId).toBe(remote.decks[0]?.id);
      expect(Object.values(useLearningStore.getState().decks).some((deck) => deck.name === 'Remote')).toBe(true);
      expect(useLearningStore.getState().learningSyncWorkerQueue.jobs.some((job) => job.status === 'succeeded')).toBe(true);
    });
  });

  it('defers a dirty sync until the throttle window expires and runs it once', async () => {
    const now = 1_700_000_000_000;
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const local = createCloudStateDeck('Local', now);
    useLearningStore.setState(
      {
        ...useLearningStore.getInitialState(),
        activeDeckId: local.decks[0].id,
        activeDeckUpdatedAt: local.decks[0].updatedAt,
        decks: toRecordById(local.decks),
        notes: toRecordById(local.notes),
        cards: toRecordById(local.cards),
        presets: toRecordById(getDefaultLearningPresets()),
        mediaRegistry: normalizeMediaRegistry(),
        mediaTransferQueue: normalizeMediaTransferQueue(),
        learningSyncWorkerQueue: normalizeLearningSyncWorkerQueue(),
      },
      true,
    );

    loadLearningCloudStateMock.mockResolvedValue(createMatchingCloudState(local, now));

    await act(async () => {
      render(<Harness />);
    });
    await advanceTimers(300);

    expect(loadLearningCloudStateMock).toHaveBeenCalledTimes(1);
    loadLearningCloudStateMock.mockClear();

    await act(async () => {
      vi.setSystemTime(now + 1_000);
      useLearningStore.setState((state) => ({
        activeDeckUpdatedAt: (state.activeDeckUpdatedAt ?? now) + 1,
      }));
    });

    await advanceTimers(250);
    expect(loadLearningCloudStateMock).toHaveBeenCalledTimes(0);

    await advanceTimers(15_000);
    expect(loadLearningCloudStateMock).toHaveBeenCalledTimes(1);
  });

  it('coalesces a burst of dirty sync triggers into one remote fetch after the throttle window', async () => {
    const now = 1_700_000_000_000;
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const local = createCloudStateDeck('Local', now);
    useLearningStore.setState(
      {
        ...useLearningStore.getInitialState(),
        activeDeckId: local.decks[0].id,
        activeDeckUpdatedAt: local.decks[0].updatedAt,
        decks: toRecordById(local.decks),
        notes: toRecordById(local.notes),
        cards: toRecordById(local.cards),
        presets: toRecordById(getDefaultLearningPresets()),
        mediaRegistry: normalizeMediaRegistry(),
        mediaTransferQueue: normalizeMediaTransferQueue(),
        learningSyncWorkerQueue: normalizeLearningSyncWorkerQueue(),
      },
      true,
    );

    loadLearningCloudStateMock.mockResolvedValue(createMatchingCloudState(local, now));

    await act(async () => {
      render(<Harness />);
    });
    await advanceTimers(300);

    expect(loadLearningCloudStateMock).toHaveBeenCalledTimes(1);
    loadLearningCloudStateMock.mockClear();

    await act(async () => {
      vi.setSystemTime(now + 1_000);
      useLearningStore.setState((state) => ({
        activeDeckUpdatedAt: (state.activeDeckUpdatedAt ?? now) + 1,
      }));
      vi.setSystemTime(now + 2_000);
      useLearningStore.setState((state) => ({
        activeDeckUpdatedAt: (state.activeDeckUpdatedAt ?? now) + 2,
      }));
      vi.setSystemTime(now + 3_000);
      useLearningStore.setState((state) => ({
        activeDeckUpdatedAt: (state.activeDeckUpdatedAt ?? now) + 3,
      }));
    });

    await advanceTimers(250);
    expect(loadLearningCloudStateMock).toHaveBeenCalledTimes(0);

    await advanceTimers(15_000);
    expect(loadLearningCloudStateMock).toHaveBeenCalledTimes(1);
  });

  it('does not start the background remote merge loop when sync is explicitly disabled', async () => {
    const now = 1_700_000_000_000;
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const local = createCloudStateDeck('Local', now);
    useLearningStore.setState(
      {
        ...useLearningStore.getInitialState(),
        activeDeckId: local.decks[0].id,
        activeDeckUpdatedAt: local.decks[0].updatedAt,
        decks: toRecordById(local.decks),
        notes: toRecordById(local.notes),
        cards: toRecordById(local.cards),
        presets: toRecordById(getDefaultLearningPresets()),
        mediaRegistry: normalizeMediaRegistry(),
        mediaTransferQueue: normalizeMediaTransferQueue(),
        learningSyncWorkerQueue: normalizeLearningSyncWorkerQueue(),
      },
      true,
    );

    loadLearningCloudStateMock.mockResolvedValue(createMatchingCloudState(local, now));

    await act(async () => {
      render(<HarnessWithoutSync />);
    });

    await advanceTimers(500);
    expect(loadLearningCloudStateMock).not.toHaveBeenCalled();

    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });

    await advanceTimers(500);
    expect(loadLearningCloudStateMock).not.toHaveBeenCalled();
  });

  it('stays idle without enqueueing maintenance jobs when local and remote states already match', async () => {
    const now = 1_700_000_000_000;
    const local = createCloudStateDeck('Local', now);
    const baseRuntimeState = {
      activeDeckId: local.decks[0].id,
      activeDeckUpdatedAt: local.decks[0].updatedAt,
      decks: toRecordById(local.decks),
      notes: toRecordById(local.notes),
      cards: toRecordById(local.cards),
      reviewLogs: {},
      presets: toRecordById(getDefaultLearningPresets()),
      cardBrowser: {
        selectedDeckId: local.decks[0].id,
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
        selectedDeckId: local.decks[0].id,
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
      mediaRegistry: normalizeMediaRegistry(),
      mediaTransferQueue: normalizeMediaTransferQueue(),
      learningSyncWorkerQueue: normalizeLearningSyncWorkerQueue(),
    };

    const result = await processLearningSyncRuntime(
      baseRuntimeState,
      {
        activeDeckId: local.decks[0].id,
        activeDeckUpdatedAt: local.decks[0].updatedAt,
        decks: [...local.decks].reverse(),
        notes: [...local.notes].reverse(),
        cards: [...local.cards].reverse(),
        reviewLogs: [],
        presets: [...getDefaultLearningPresets()].reverse(),
        cardBrowser: baseRuntimeState.cardBrowser,
        savedCardQueries: [],
        filteredDeckLiteDefinition: baseRuntimeState.filteredDeckLiteDefinition,
        filteredDeckLiteDefinitions: [],
        filteredDeckLiteRuns: [],
      },
      now,
      { forceRun: true },
    );

    expect(result.status).toBe('idle');
    expect(result.processedJobIds).toHaveLength(0);
    expect(result.queue.jobs).toHaveLength(0);
    expect(result.localSignature).toBe(result.remoteSignature);
  });

  it('preserves learn assignments and gate rule through the background sync merge', async () => {
    const now = 1_700_000_000_000;
    const local = createCloudStateDeck('Local', now);
    const gateRule = {
      ...getDefaultGateRule(),
      sessionCreditsRequired: 4,
      unlockDurationMinutes: 9,
      typedAnswerEnabled: false,
    };
    const assignment = {
      id: 'assignment-app-com.example',
      targetId: 'com.example',
      targetType: 'app' as const,
      deckId: local.decks[0].id,
      sessionCreditsRequired: 4,
      requiredCorrectReviews: 4,
      unlockDurationMinutes: 9,
      enabled: true,
      updatedAt: now + 1_000,
    };
    const baseRuntimeState = {
      activeDeckId: local.decks[0].id,
      activeDeckUpdatedAt: local.decks[0].updatedAt,
      decks: toRecordById(local.decks),
      notes: toRecordById(local.notes),
      cards: toRecordById(local.cards),
      reviewLogs: {},
      presets: toRecordById(getDefaultLearningPresets()),
      assignments: [assignment],
      gateRule,
      gateRuleUpdatedAt: now + 2_000,
      cardBrowser: {
        selectedDeckId: local.decks[0].id,
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
        selectedDeckId: local.decks[0].id,
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
      mediaRegistry: normalizeMediaRegistry(),
      mediaTransferQueue: normalizeMediaTransferQueue(),
      learningSyncWorkerQueue: normalizeLearningSyncWorkerQueue(),
    };

    const result = await processLearningSyncRuntime(
      baseRuntimeState,
      createMatchingCloudState(local, now),
      now,
      { forceRun: true },
    );

    expect(result.mergedState.assignments).toHaveLength(1);
    expect(result.mergedState.assignments[0]).toMatchObject({
      targetId: 'com.example',
      targetType: 'app',
      deckId: local.decks[0].id,
      sessionCreditsRequired: 4,
      unlockDurationMinutes: 9,
      enabled: true,
    });
    expect(result.mergedState.gateRule.sessionCreditsRequired).toBe(4);
    expect(result.mergedState.gateRule.unlockDurationMinutes).toBe(9);
    expect(result.mergedState.gateRule.typedAnswerEnabled).toBe(false);
  });
});
