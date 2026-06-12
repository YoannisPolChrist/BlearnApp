import { useEffect } from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useOverlayDismissGuard } from '@/hooks/useOverlayDismissGuard';

const dismissBlockingOverlayMock = vi.hoisted(() => vi.fn<() => Promise<void>>());
const abandonPendingNavigationMock = vi.hoisted(() => vi.fn<() => Promise<void>>());

vi.mock('@/services/screenTimeService', () => ({
  abandonPendingNavigation: abandonPendingNavigationMock,
  dismissBlockingOverlay: dismissBlockingOverlayMock,
}));

function GuardHarness({
  active,
  overlaySessionId,
  onReady,
}: {
  active: boolean;
  overlaySessionId?: string | null;
  onReady: (dismissOnce: () => Promise<boolean>) => void;
}) {
  const { dismissOnce } = useOverlayDismissGuard({ active, overlaySessionId });

  useEffect(() => {
    onReady(dismissOnce);
  }, [dismissOnce, onReady]);

  return null;
}

describe('useOverlayDismissGuard', () => {
  beforeEach(() => {
    abandonPendingNavigationMock.mockReset();
    dismissBlockingOverlayMock.mockReset();
  });

  it('abandons and dismisses the overlay after the blocking flow stays hidden', async () => {
    vi.useFakeTimers();
    let dismissOnce: () => Promise<boolean> = async () => false;
    const originalVisibilityDescriptor = Object.getOwnPropertyDescriptor(document, 'visibilityState');

    const onReady = vi.fn((nextDismissOnce: () => Promise<boolean>) => {
      dismissOnce = nextDismissOnce;
    });

    const view = render(<GuardHarness active={true} overlaySessionId="session-hidden" onReady={onReady} />);

    try {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        value: 'hidden',
      });

      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
      });

      expect(abandonPendingNavigationMock).toHaveBeenCalledWith('session-hidden');
      expect(dismissBlockingOverlayMock).toHaveBeenCalledWith('session-hidden');

      await act(async () => {
        await dismissOnce();
      });

      expect(dismissBlockingOverlayMock).toHaveBeenCalledTimes(1);
    } finally {
      view.unmount();
      if (originalVisibilityDescriptor) {
        Object.defineProperty(document, 'visibilityState', originalVisibilityDescriptor);
      }
      vi.runOnlyPendingTimers();
      vi.useRealTimers();
    }
  });

  it('resets its dismiss guard when the overlay becomes inactive and active again', async () => {
    let dismissOnce: () => Promise<boolean> = async () => false;

    const onReady = vi.fn((nextDismissOnce: () => Promise<boolean>) => {
      dismissOnce = nextDismissOnce;
    });

    const view = render(<GuardHarness active={true} onReady={onReady} />);

    await act(async () => {
      await dismissOnce();
    });

    view.rerender(<GuardHarness active={false} onReady={onReady} />);
    view.rerender(<GuardHarness active={true} onReady={onReady} />);
    view.unmount();

    await waitFor(() => expect(dismissBlockingOverlayMock).toHaveBeenCalledTimes(2));
  });

  it('self-heals dismissOnce: retries after a dismissal error and succeeds in one call', async () => {
    let dismissOnce: () => Promise<boolean> = async () => false;

    const onReady = vi.fn((nextDismissOnce: () => Promise<boolean>) => {
      dismissOnce = nextDismissOnce;
    });

    dismissBlockingOverlayMock
      .mockRejectedValueOnce(new Error('bridge busy'))
      .mockResolvedValueOnce(undefined);

    render(<GuardHarness active={true} overlaySessionId="session-retry" onReady={onReady} />);

    // New contract: a single failed native dismiss must never surface to the
    // caller or leave inconsistent state — the guard retries internally.
    await expect(dismissOnce()).resolves.toBe(true);

    expect(dismissBlockingOverlayMock).toHaveBeenNthCalledWith(1, 'session-retry');
    expect(dismissBlockingOverlayMock).toHaveBeenNthCalledWith(2, 'session-retry');
    expect(abandonPendingNavigationMock).not.toHaveBeenCalled();
  });

  it('forces abandon when dismiss keeps failing so native state cannot stay stuck', async () => {
    let dismissOnce: () => Promise<boolean> = async () => false;

    const onReady = vi.fn((nextDismissOnce: () => Promise<boolean>) => {
      dismissOnce = nextDismissOnce;
    });

    dismissBlockingOverlayMock.mockRejectedValue(new Error('bridge dead'));
    abandonPendingNavigationMock.mockResolvedValue(undefined);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<GuardHarness active={true} overlaySessionId="session-stuck" onReady={onReady} />);

    await expect(dismissOnce()).resolves.toBe(true);

    expect(dismissBlockingOverlayMock).toHaveBeenCalledTimes(2);
    expect(abandonPendingNavigationMock).toHaveBeenCalledWith('session-stuck');
    consoleError.mockRestore();
  });
});
