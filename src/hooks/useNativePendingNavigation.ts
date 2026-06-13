import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  recordNativeOverlayRuntimeEvent,
  subscribeToNativeRouteReady,
} from '@/lib/nativeOverlayRuntime';
import { isBlockableAppTargetId } from '@/lib/blockableApps';
import { isAndroidPlatform } from '@/lib/platform';
import { preloadRoute } from '@/lib/routeLoaders';
import { markBlockingLearnStart } from '@/modules/learning/session/sessionLatency';
import {
  consumePendingNavigation,
  getMonitoringStatus,
  peekPendingNavigation,
} from '@/services/screenTimeService';

const VISIBLE_IDLE_CONSUME_POLL_MS = 250;
const HIDDEN_IDLE_CONSUME_POLL_MS = 1_000;
const ERROR_RETRY_BASE_MS = 500;
const ERROR_RETRY_MAX_MS = 2_500;
const RETRY_DEBOUNCE_MS = 250;
const SAFETY_TIMEOUT_MS = 12_000;
const NATIVE_BRIDGE_TIMEOUT_MS = 1_500;

export type NativePendingNavigationFallbackReason = 'timeout' | 'missing-route' | 'chunk-error';

export interface NativePendingNavigationState {
  active: boolean;
  priming: boolean;
  handoffActive: boolean;
  fallbackVisible: boolean;
  fallbackReason?: NativePendingNavigationFallbackReason;
  route?: string;
  mode?: string;
  targetLabel?: string;
  targetType?: 'app' | 'website' | 'search';
}

function createIdlePendingState(
  overrides: Partial<NativePendingNavigationState> = {},
): NativePendingNavigationState {
  return {
    active: false,
    priming: false,
    handoffActive: false,
    fallbackVisible: false,
    fallbackReason: undefined,
    route: undefined,
    mode: undefined,
    targetLabel: undefined,
    targetType: undefined,
    ...overrides,
  };
}

function setNativeHandoffActive(active: boolean) {
  if (typeof window === 'undefined') {
    return;
  }

  (window as Window & { __blearnNativeHandoffActive?: boolean }).__blearnNativeHandoffActive = active;
}

function normalizePendingRoute(route: string) {
  const trimmedRoute = route.trim();
  if (!trimmedRoute) {
    return '/';
  }

  if (trimmedRoute.startsWith('/')) {
    return trimmedRoute;
  }

  return `/${trimmedRoute.replace(/^#?\/?/, '')}`;
}

function getPendingRoutePath(route: string) {
  const normalizedRoute = normalizePendingRoute(route);
  return new URL(normalizedRoute, 'https://blearn.local').pathname;
}

async function preloadPendingRoute(route: string) {
  const routePath = getPendingRoutePath(route);
  await preloadRoute(routePath);
  return routePath;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: number | null = null;

  try {
    return await Promise.race<T>([
      promise,
      new Promise<T>((_resolve, reject) => {
        timer = window.setTimeout(() => {
          reject(new Error(`${label} timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer !== null) {
      window.clearTimeout(timer);
    }
  }
}

function applyPendingRoute(route: string, navigate: ReturnType<typeof useNavigate>) {
  markBlockingLearnStart();
  navigate(normalizePendingRoute(route), { replace: true });
}

export function useNativePendingNavigation() {
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  const consumingRef = useRef(false);
  const retryPrimeRef = useRef(false);
  const routeHandoffActiveRef = useRef(false);
  const retryTimerRef = useRef<number | null>(null);
  const errorRetryDelayRef = useRef(ERROR_RETRY_BASE_MS);
  const consumeRef = useRef<((primeScreen?: boolean, reason?: string) => Promise<void>) | null>(null);
  const [pendingState, setPendingState] = useState<NativePendingNavigationState>(() =>
    createIdlePendingState({
      priming: isAndroidPlatform,
    }),
  );

  useEffect(() => {
    navigateRef.current = navigate;
  }, [navigate]);

  useEffect(() => {
    if (!isAndroidPlatform) {
      setNativeHandoffActive(false);
      setPendingState(createIdlePendingState());
      return;
    }

    let cancelled = false;

    const clearRetryTimer = () => {
      if (retryTimerRef.current !== null) {
        window.clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };

    const scheduleRetry = (reason: string, delayMs: number) => {
      if (cancelled || routeHandoffActiveRef.current) {
        return;
      }

      clearRetryTimer();
      const safeDelay = Math.max(0, delayMs);
      retryTimerRef.current = window.setTimeout(() => {
        retryTimerRef.current = null;
        void consumeRef.current?.(true, reason);
      }, safeDelay);

      recordNativeOverlayRuntimeEvent({
        stage: 'retry-scheduled',
        source: 'hook',
        message: `scheduled next pending-navigation poll in ${safeDelay}ms`,
        delayMs: safeDelay,
      });
    };

    const resetRetryWindow = () => {
      clearRetryTimer();
      errorRetryDelayRef.current = ERROR_RETRY_BASE_MS;
    };

    const scheduleIdleRetry = (reason: string, delayMs?: number) => {
      errorRetryDelayRef.current = ERROR_RETRY_BASE_MS;
      scheduleRetry(
        reason,
        delayMs
          ?? (document.visibilityState === 'visible'
            ? VISIBLE_IDLE_CONSUME_POLL_MS
            : HIDDEN_IDLE_CONSUME_POLL_MS),
      );
    };

    const scheduleErrorRetry = (reason: string, delayMs?: number) => {
      const nextDelay = Math.max(ERROR_RETRY_BASE_MS, delayMs ?? errorRetryDelayRef.current);
      scheduleRetry(reason, nextDelay);
      errorRetryDelayRef.current = Math.min(ERROR_RETRY_MAX_MS, Math.round(nextDelay * 1.75));
    };

    const activatePendingNavigation = (
      nextNavigation: Awaited<ReturnType<typeof consumePendingNavigation>>,
      reason: string,
    ) => {
      if (!nextNavigation) {
        return false;
      }

      if (!nextNavigation.route) {
        showFallback(
          'missing-route',
          'pending navigation payload did not include a route, showing the emergency fallback',
        );
        scheduleErrorRetry('missing-route', HIDDEN_IDLE_CONSUME_POLL_MS);
        return true;
      }

      if (
        nextNavigation.targetType === 'app'
        && nextNavigation.targetId
        && !isBlockableAppTargetId(nextNavigation.targetId)
      ) {
        setPendingState(createIdlePendingState());
        recordNativeOverlayRuntimeEvent({
          stage: 'retry-scheduled',
          source: 'hook',
          message: 'ignored a stale pending navigation for a non-blockable app target',
          route: nextNavigation.route,
          overlaySessionId: nextNavigation.sessionId ?? null,
          targetId: nextNavigation.targetId ?? null,
          targetType: nextNavigation.targetType ?? null,
          delayMs: document.visibilityState === 'visible'
            ? VISIBLE_IDLE_CONSUME_POLL_MS
            : HIDDEN_IDLE_CONSUME_POLL_MS,
        });
        scheduleIdleRetry('ignored-non-blockable-target');
        return true;
      }

      resetRetryWindow();
      routeHandoffActiveRef.current = true;
      setNativeHandoffActive(true);
      setPendingState(
        createIdlePendingState({
          active: true,
          handoffActive: true,
          route: nextNavigation.route,
          mode: nextNavigation.mode,
          targetLabel: nextNavigation.targetLabel,
          targetType: nextNavigation.targetType,
        }),
      );
      recordNativeOverlayRuntimeEvent({
        stage: reason === 'route-ready' ? 'next-pending-item' : 'pending-navigation',
        source: 'hook',
        message:
          reason === 'peek'
            ? 'claimed a pending navigation from the native blocking host before the consume loop'
            : reason === 'route-ready'
              ? 'consumed the next pending navigation item after overlay handoff'
              : 'consumed a pending navigation item for the blocking overlay',
        route: nextNavigation.route,
        overlaySessionId: nextNavigation.sessionId ?? null,
        targetId: nextNavigation.targetId ?? null,
        targetType: nextNavigation.targetType ?? null,
      });

      applyPendingRoute(nextNavigation.route, navigateRef.current);
      void preloadPendingRoute(nextNavigation.route)
        .then((preloadedPath) => {
          if (cancelled) {
            return;
          }

          recordNativeOverlayRuntimeEvent({
            stage: 'route-preload',
            source: 'hook',
            message: 'preloaded the concrete blocking route after navigation started',
            route: preloadedPath,
            overlaySessionId: nextNavigation.sessionId ?? null,
            targetId: nextNavigation.targetId ?? null,
            targetType: nextNavigation.targetType ?? null,
          });
        })
        .catch((error) => {
          if (cancelled) {
            return;
          }

          console.warn('Blocking route preload failed after navigation started:', error);
          recordNativeOverlayRuntimeEvent({
            stage: 'route-preload',
            source: 'hook',
            message: 'blocking route preload failed after navigation started',
            route: nextNavigation.route,
            overlaySessionId: nextNavigation.sessionId ?? null,
            targetId: nextNavigation.targetId ?? null,
            targetType: nextNavigation.targetType ?? null,
          });
        });

      return true;
    };

    const showFallback = (
      reason: NativePendingNavigationFallbackReason,
      message: string,
      route?: string,
    ) => {
      routeHandoffActiveRef.current = false;
      setNativeHandoffActive(false);
      setPendingState(
        createIdlePendingState({
          fallbackVisible: true,
          fallbackReason: reason,
          route,
        }),
      );
      recordNativeOverlayRuntimeEvent({
        stage: 'fallback-visible',
        source: 'hook',
        message,
        route,
      });
    };

    const consume = async (primeScreen = false, reason = 'auto') => {
      if (routeHandoffActiveRef.current) {
        return;
      }

      if (consumingRef.current) {
        retryPrimeRef.current = retryPrimeRef.current || primeScreen;
        return;
      }

      consumingRef.current = true;

      try {
        // Do not race the destructive consume call against a short JS timeout. On a cold
        // WebView boot the native plugin can answer late, and timing out here would drop the
        // response while the native side still removes the pending item from the queue.
        const nextNavigation = await consumePendingNavigation();
        if (cancelled) {
          return;
        }

        if (!nextNavigation) {
          setPendingState(createIdlePendingState());
          recordNativeOverlayRuntimeEvent({
            stage: 'retry-scheduled',
            source: 'hook',
            message: 'no pending navigation available, returning to idle and keeping a fast retry loop warm',
            delayMs: document.visibilityState === 'visible'
              ? VISIBLE_IDLE_CONSUME_POLL_MS
              : HIDDEN_IDLE_CONSUME_POLL_MS,
          });
          scheduleIdleRetry(reason);
          return;
        }

        activatePendingNavigation(nextNavigation, reason);
      } catch (error) {
        console.warn('Pending native navigation failed:', error);
        routeHandoffActiveRef.current = false;
        setNativeHandoffActive(false);
        setPendingState(createIdlePendingState());
        recordNativeOverlayRuntimeEvent({
          stage: 'retry-scheduled',
          source: 'hook',
          message: 'pending navigation consumption failed, retrying with bounded backoff',
          delayMs: errorRetryDelayRef.current,
        });
        scheduleErrorRetry('error');
      } finally {
        consumingRef.current = false;
        const shouldRetry = retryPrimeRef.current;
        retryPrimeRef.current = false;

        if (!cancelled && shouldRetry && !routeHandoffActiveRef.current) {
          void consume(true);
        }
      }
    };

    const primeFromPeek = async () => {
      try {
        const [nextNavigation, monitoringStatus] = await Promise.all([
          withTimeout(peekPendingNavigation(), NATIVE_BRIDGE_TIMEOUT_MS, 'peekPendingNavigation'),
          withTimeout(getMonitoringStatus(), NATIVE_BRIDGE_TIMEOUT_MS, 'getMonitoringStatus'),
        ]);
        if (cancelled || !nextNavigation) {
          return false;
        }

        const nativeBlockingHostActive = monitoringStatus.handoffInProgress
          || monitoringStatus.overlayVisible
          || monitoringStatus.activeBlockingStage === 'consumed';
        if (!nativeBlockingHostActive) {
          return false;
        }

        return activatePendingNavigation(nextNavigation, 'peek');
      } catch (error) {
        console.warn('Pending native navigation preflight failed:', error);
        return false;
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        resetRetryWindow();
        recordNativeOverlayRuntimeEvent({
          stage: 'resume',
          source: 'hook',
          message: 'document became visible, resuming pending-navigation checks',
        });
        void consume(true, 'visibility');
      }
    };

    consumeRef.current = consume;

    void (async () => {
      const claimedFromPeek = await primeFromPeek();
      if (!cancelled && !claimedFromPeek) {
        await consume(false, 'initial');
      }
    })();
    window.addEventListener('focus', handleVisibility);
    document.addEventListener('visibilitychange', handleVisibility);
    const unsubscribeRouteReady = subscribeToNativeRouteReady(() => {
      if (!cancelled) {
        recordNativeOverlayRuntimeEvent({
          stage: 'handoff-complete',
          source: 'hook',
          message: 'native route ready signaled completion of the overlay handoff',
        });
        routeHandoffActiveRef.current = false;
        setNativeHandoffActive(false);
        setPendingState(createIdlePendingState());
        resetRetryWindow();
        window.setTimeout(() => {
          if (!cancelled) {
            void consume(true, 'route-ready');
          }
        }, 0);
      }
    });

    return () => {
      cancelled = true;
      routeHandoffActiveRef.current = false;
      setNativeHandoffActive(false);
      clearRetryTimer();
      window.removeEventListener('focus', handleVisibility);
      document.removeEventListener('visibilitychange', handleVisibility);
      unsubscribeRouteReady();
    };
  }, []);

  useEffect(() => {
    if (!isAndroidPlatform) {
      return undefined;
    }

    if (pendingState.priming) {
      const timer = window.setTimeout(() => {
        console.warn(
          `[useNativePendingNavigation] priming timed out after ${SAFETY_TIMEOUT_MS}ms - returning to idle`,
        );
        routeHandoffActiveRef.current = false;
        setNativeHandoffActive(false);
        setPendingState(createIdlePendingState());
        recordNativeOverlayRuntimeEvent({
          stage: 'resume',
          source: 'hook',
          message: 'priming timed out, returning to idle and retrying pending-navigation checks',
        });
        window.setTimeout(() => {
          void consumeRef.current?.(true, 'priming-timeout');
        }, RETRY_DEBOUNCE_MS);
      }, SAFETY_TIMEOUT_MS);

      return () => window.clearTimeout(timer);
    }

    if (!pendingState.handoffActive) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      console.warn(
        `[useNativePendingNavigation] safety timeout after ${SAFETY_TIMEOUT_MS}ms - enabling the emergency fallback`,
      );
      routeHandoffActiveRef.current = false;
      setNativeHandoffActive(false);
      setPendingState(
        createIdlePendingState({
          fallbackVisible: true,
          fallbackReason: 'timeout',
          route: pendingState.route,
        }),
      );
      recordNativeOverlayRuntimeEvent({
        stage: 'fallback-visible',
        source: 'hook',
        message: 'safety timeout reached while waiting for overlay handoff, showing the emergency fallback',
        route: pendingState.route,
      });
      window.setTimeout(() => {
        void consumeRef.current?.(true, 'safety-timeout');
      }, RETRY_DEBOUNCE_MS);
    }, SAFETY_TIMEOUT_MS);

    return () => window.clearTimeout(timer);
  }, [pendingState.handoffActive, pendingState.priming, pendingState.route]);

  return pendingState;
}
