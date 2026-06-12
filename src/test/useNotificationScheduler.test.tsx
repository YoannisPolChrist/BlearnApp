import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { useNotificationScheduler } from '@/hooks/useNotificationScheduler';
import { useAppStore } from '@/store/useAppStore';
import { useLearningStore } from '@/store/useLearningStore';

const {
  dispatchNotificationMock,
  getNotificationPermissionStateMock,
} = vi.hoisted(() => ({
  dispatchNotificationMock: vi.fn(),
  getNotificationPermissionStateMock: vi.fn(),
}));

vi.mock('@/services/notificationService', () => ({
  dispatchNotification: dispatchNotificationMock,
  getNotificationPermissionState: getNotificationPermissionStateMock,
}));

function NotificationSchedulerHarness() {
  useNotificationScheduler(true);
  return null;
}

async function settleScheduler() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('useNotificationScheduler', () => {
  beforeEach(() => {
    cleanup();
    useAppStore.setState(
      {
        ...useAppStore.getInitialState(),
        hasHydrated: true,
        notificationsEnabled: true,
        notificationPreferences: {
          reminders: true,
          statusHints: true,
          learnProgress: true,
          penaltyAlerts: true,
        },
      },
      true,
    );
    useLearningStore.setState(useLearningStore.getInitialState(), true);
    dispatchNotificationMock.mockReset();
    dispatchNotificationMock.mockResolvedValue(true);
    getNotificationPermissionStateMock.mockReset();
    getNotificationPermissionStateMock.mockResolvedValue('granted');
    vi.spyOn(useLearningStore.persist, 'hasHydrated').mockReturnValue(true);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('dispatches a status hint when the active mode changes', async () => {
    render(<NotificationSchedulerHarness />);

    await waitFor(() => {
      expect(getNotificationPermissionStateMock).toHaveBeenCalledTimes(1);
    });
    await settleScheduler();

    dispatchNotificationMock.mockClear();

    await act(async () => {
      useAppStore.setState({ activeMode: 'learn' });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(dispatchNotificationMock).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'statusHints',
          title: 'Modus: Learn',
        }),
      );
    });
  });

  it('dispatches a reminder when due cards appear after the baseline state', async () => {
    render(<NotificationSchedulerHarness />);

    await waitFor(() => {
      expect(getNotificationPermissionStateMock).toHaveBeenCalledTimes(1);
    });
    await settleScheduler();

    dispatchNotificationMock.mockClear();

    await act(async () => {
      useLearningStore.setState({
        activeDeckId: 'deck-1',
        decks: [{ id: 'deck-1', name: 'Starter' } as never],
        getDeckStats: (() => ({
          dueNowCount: 3,
          overdueCount: 1,
        })) as never,
      });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(dispatchNotificationMock).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'reminders',
          title: 'Zeit fuer Learn',
        }),
      );
    });
  });

  it('does not rerender for unrelated learning store updates', async () => {
    let renderCount = 0;

    function RenderCountHarness() {
      renderCount += 1;
      useNotificationScheduler(true);
      return null;
    }

    render(<RenderCountHarness />);

    await waitFor(() => {
      expect(getNotificationPermissionStateMock).toHaveBeenCalledTimes(1);
    });
    await settleScheduler();

    const stableRenderCount = renderCount;

    await act(async () => {
      useLearningStore.setState({
        notes: [
          {
            id: 'note-1',
            deckId: 'deck-1',
            type: 'basic',
            front: 'A',
            back: 'B',
            tags: [],
            language: 'de',
            createdAt: Date.now(),
          } as never,
        ],
      });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(renderCount).toBe(stableRenderCount);
    });
  });

  it('dispatches learn progress when a new unlock grant is registered', async () => {
    useLearningStore.getState().seedStarterDeck();
    const deckId = Object.values(useLearningStore.getState().decks)[0]?.id;
    expect(deckId).toBeTruthy();

    render(<NotificationSchedulerHarness />);

    await waitFor(() => {
      expect(getNotificationPermissionStateMock).toHaveBeenCalledTimes(1);
    });
    await settleScheduler();

    dispatchNotificationMock.mockClear();

    await act(async () => {
      useLearningStore.getState().registerUnlockGrant('YouTube', 'app', deckId!, 5, 12);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(dispatchNotificationMock).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'learnProgress',
          title: 'Freischaltung aktiv',
        }),
      );
    });
  });

  it('dispatches penalty alerts when a penalty transaction fails', async () => {
    render(<NotificationSchedulerHarness />);

    await waitFor(() => {
      expect(getNotificationPermissionStateMock).toHaveBeenCalledTimes(1);
    });
    await settleScheduler();

    dispatchNotificationMock.mockClear();

    await act(async () => {
      useAppStore.setState({
        penaltyTransactions: [
          {
            id: 'tx-1',
            timestamp: Date.now(),
            type: 'penalty',
            description: 'Penalty',
            targetApp: 'YouTube',
            amountSats: 700,
            deliveryStatus: 'failed',
            lastDeliveryError: 'Wallet offline.',
          },
        ],
      });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(dispatchNotificationMock).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'penaltyAlerts',
          title: 'Penalty fehlgeschlagen',
          body: 'Wallet offline.',
        }),
      );
    });
  });
});
