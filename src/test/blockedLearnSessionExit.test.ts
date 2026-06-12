import { describe, expect, it, vi } from 'vitest';
import { exitBlockedLearnSession } from '@/lib/blockedLearnSessionExit';

describe('exitBlockedLearnSession', () => {
  it('dismisses the active overlay session before routing into the normal learn hub', async () => {
    const abandonPendingNavigation = vi.fn().mockResolvedValue(undefined);
    const dismissOverlay = vi.fn().mockResolvedValue(true);
    const navigate = vi.fn();

    await exitBlockedLearnSession({
      abandonPendingNavigation,
      destination: '/learn',
      dismissOverlay,
      isAndroidOverlayUnlockFlow: true,
      navigate,
      overlaySessionId: 'session-learn',
    });

    expect(abandonPendingNavigation).toHaveBeenCalledWith('session-learn');
    expect(dismissOverlay).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('/learn', { replace: true });
    expect(abandonPendingNavigation.mock.invocationCallOrder[0]).toBeLessThan(dismissOverlay.mock.invocationCallOrder[0]);
    expect(dismissOverlay.mock.invocationCallOrder[0]).toBeLessThan(navigate.mock.invocationCallOrder[0]);
  });

  it('navigates directly when no Android overlay session is active', async () => {
    const abandonPendingNavigation = vi.fn().mockResolvedValue(undefined);
    const dismissOverlay = vi.fn().mockResolvedValue(false);
    const navigate = vi.fn();

    await exitBlockedLearnSession({
      abandonPendingNavigation,
      destination: '/',
      dismissOverlay,
      isAndroidOverlayUnlockFlow: false,
      navigate,
    });

    expect(abandonPendingNavigation).not.toHaveBeenCalled();
    expect(dismissOverlay).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/', { replace: true });
  });

  it('still dismisses and navigates when abandoning the pending session fails', async () => {
    const abandonPendingNavigation = vi.fn().mockRejectedValue(new Error('abandon failed'));
    const dismissOverlay = vi.fn().mockResolvedValue(true);
    const navigate = vi.fn();

    await exitBlockedLearnSession({
      abandonPendingNavigation,
      destination: '/learn',
      dismissOverlay,
      isAndroidOverlayUnlockFlow: true,
      navigate,
      overlaySessionId: 'session-learn',
    });

    expect(dismissOverlay).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('/learn', { replace: true });
  });

  it('still navigates when dismissing the overlay fails', async () => {
    const abandonPendingNavigation = vi.fn().mockResolvedValue(undefined);
    const dismissOverlay = vi.fn().mockRejectedValue(new Error('dismiss failed'));
    const navigate = vi.fn();

    await exitBlockedLearnSession({
      abandonPendingNavigation,
      destination: '/learn',
      dismissOverlay,
      isAndroidOverlayUnlockFlow: true,
      navigate,
      overlaySessionId: 'session-learn',
    });

    expect(abandonPendingNavigation).toHaveBeenCalledWith('session-learn');
    expect(dismissOverlay).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('/learn', { replace: true });
  });
});
