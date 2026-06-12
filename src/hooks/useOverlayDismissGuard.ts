import { useCallback, useEffect, useRef } from 'react';
import { abandonPendingNavigation, dismissBlockingOverlay } from '@/services/screenTimeService';

interface UseOverlayDismissGuardOptions {
  active: boolean;
  autoDismissOnUnmount?: boolean;
  overlaySessionId?: string | null;
}

const BACKGROUND_EXIT_GRACE_MS = 500;
const DISMISS_RETRY_DELAY_MS = 400;

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

/**
 * Dismiss with self-healing: a single failed native dismiss must never leave
 * the overlay/handoff state inconsistent until the next trigger. We retry
 * once after a short backoff, and if that also fails we abandon the pending
 * navigation so the native side clears its blocking flow state.
 */
async function dismissWithRecovery(sessionId: string | null): Promise<void> {
  try {
    await dismissBlockingOverlay(sessionId);
    return;
  } catch (firstError) {
    console.warn('Blocking overlay dismiss failed, retrying once:', firstError);
  }

  await wait(DISMISS_RETRY_DELAY_MS);

  try {
    await dismissBlockingOverlay(sessionId);
    return;
  } catch (retryError) {
    console.error('Blocking overlay dismiss failed after retry, forcing abandon:', retryError);
  }

  // Last resort: abandon clears the pending navigation + native flow state
  // through a different code path, preventing a stuck overlay session.
  await abandonPendingNavigation(sessionId);
}

export function useOverlayDismissGuard({
  active,
  autoDismissOnUnmount,
  overlaySessionId,
}: UseOverlayDismissGuardOptions) {
  const shouldAutoDismissOnUnmount = autoDismissOnUnmount ?? active;
  const dismissedRef = useRef(false);
  const activeRef = useRef(active);
  const sessionIdRef = useRef(overlaySessionId ?? null);
  const backgroundExitTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (sessionIdRef.current !== (overlaySessionId ?? null)) {
      sessionIdRef.current = overlaySessionId ?? null;
      dismissedRef.current = false;
    }
    activeRef.current = active;
    if (!active) {
      dismissedRef.current = false;
    }
  }, [active, overlaySessionId]);

  const clearBackgroundExitTimer = useCallback(() => {
    if (backgroundExitTimerRef.current === null) {
      return;
    }

    window.clearTimeout(backgroundExitTimerRef.current);
    backgroundExitTimerRef.current = null;
  }, []);

  const dismissForBackgroundExit = useCallback(async () => {
    if (!activeRef.current || dismissedRef.current) {
      return false;
    }

    dismissedRef.current = true;

    try {
      await abandonPendingNavigation(sessionIdRef.current);
    } catch (error) {
      console.warn('Pending navigation abandon failed during background exit:', error);
    }

    try {
      await dismissWithRecovery(sessionIdRef.current);
      return true;
    } catch (error) {
      dismissedRef.current = false;
      throw error;
    }
  }, []);

  const dismissOnce = useCallback(async () => {
    if (!activeRef.current || dismissedRef.current) {
      return false;
    }

    dismissedRef.current = true;
    try {
      await dismissWithRecovery(sessionIdRef.current);
      return true;
    } catch (error) {
      dismissedRef.current = false;
      throw error;
    }
  }, []);

  useEffect(() => {
    if (!active) {
      clearBackgroundExitTimer();
      return undefined;
    }

    const scheduleBackgroundExit = () => {
      if (!activeRef.current || dismissedRef.current || backgroundExitTimerRef.current !== null) {
        return;
      }

      backgroundExitTimerRef.current = window.setTimeout(() => {
        backgroundExitTimerRef.current = null;
        void dismissForBackgroundExit().catch((error) => {
          console.warn('Blocking overlay background dismiss failed:', error);
        });
      }, BACKGROUND_EXIT_GRACE_MS);
    };

    const cancelBackgroundExit = () => {
      clearBackgroundExitTimer();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        scheduleBackgroundExit();
        return;
      }

      cancelBackgroundExit();
    };

    const handlePageHide = () => {
      scheduleBackgroundExit();
    };

    const handleWindowBlur = () => {
      scheduleBackgroundExit();
    };

    const handleWindowFocus = () => {
      cancelBackgroundExit();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('beforeunload', handlePageHide);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handlePageHide);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
      cancelBackgroundExit();
    };
  }, [active, clearBackgroundExitTimer, dismissForBackgroundExit]);

  useEffect(() => {
    if (!active || !shouldAutoDismissOnUnmount) {
      return undefined;
    }

    return () => {
      if (!dismissedRef.current) {
        void dismissOnce();
      }
    };
  }, [active, shouldAutoDismissOnUnmount, dismissOnce]);

  return { dismissOnce };
}
