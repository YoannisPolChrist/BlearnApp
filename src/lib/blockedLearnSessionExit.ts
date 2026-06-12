export interface BlockedLearnSessionExitOptions {
  destination: string;
  abandonPendingNavigation: (sessionId?: string | null) => Promise<void>;
  dismissOverlay: () => Promise<boolean>;
  isAndroidOverlayUnlockFlow: boolean;
  navigate: (to: string, options: { replace: true }) => void;
  overlaySessionId?: string | null;
}

export async function exitBlockedLearnSession({
  destination,
  abandonPendingNavigation,
  dismissOverlay,
  isAndroidOverlayUnlockFlow,
  navigate,
  overlaySessionId,
}: BlockedLearnSessionExitOptions) {
  if (isAndroidOverlayUnlockFlow) {
    try {
      await abandonPendingNavigation(overlaySessionId);
    } catch (error) {
      console.warn('Pending navigation abandon failed:', error);
    }

    try {
      await dismissOverlay();
    } catch (error) {
      console.warn('Blocking overlay dismiss failed:', error);
    }
  }

  navigate(destination, { replace: true });
}
