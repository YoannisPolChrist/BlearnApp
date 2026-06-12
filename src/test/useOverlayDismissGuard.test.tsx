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

  it('allows retrying dismissOnce after a dismissal error', async () => {
    let dismissOnce: () => Promise<boolean> = async () => false;

    const onReady = vi.fn((nextDismissOnce: () => Promise<boolean>) => {
      dismissOnce = nextDismissOnce;
    });

    dismissBlockingOverlayMock
      .mockRejectedValueOnce(new Error('bridge busy'))
      .mockResolvedValueOnce(undefined);

    render(<GuardHarness active={true} overlaySessionId="session-retry" onReady={onReady} />);

    await expect(dismissOnce()).rejects.toThrow('bridge busy');
    await expect(dismissOnce()).resolves.toBe(true);

    expect(dismissBlockingOverlayMock).toHaveBeenNthCalledWith(1, 'session-retry');
    expect(dismissBlockingOverlayMock).toHaveBeenNthCalledWith(2, 'session-retry');
  });
});
