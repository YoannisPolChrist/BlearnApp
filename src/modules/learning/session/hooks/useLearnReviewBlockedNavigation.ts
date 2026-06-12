import { useCallback } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import { exitBlockedLearnSession as exitBlockedLearnSessionFlow } from '@/lib/blockedLearnSessionExit';
import { primeNativeUnlockHandoff } from '@/lib/nativeUnlockHandoff';
import { createBlockingFlowSearchParams } from '@/lib/nativeOverlayRuntime';
import { isAndroidPlatform } from '@/lib/platform';
import { openTarget, abandonPendingNavigation } from '@/services/screenTimeService';
import type { BlockTargetType } from '@/lib/learning';

interface LearnReviewBlockedNavigationOptions {
  dismissOnce: () => Promise<void>;
  isAndroidOverlayUnlockFlow: boolean;
  isBlockedFlow: boolean;
  navigate: NavigateFunction;
  overlaySessionId?: string;
  overlaySuccessHandled: boolean;
  searchParams: URLSearchParams;
  setOverlaySuccessHandled: (handled: boolean) => void;
  targetId?: string;
  targetType: BlockTargetType;
  unlockDurationMinutes: number;
}

export function useLearnReviewBlockedNavigation({
  dismissOnce,
  isAndroidOverlayUnlockFlow,
  isBlockedFlow,
  navigate,
  overlaySessionId,
  overlaySuccessHandled,
  searchParams,
  setOverlaySuccessHandled,
  targetId,
  targetType,
  unlockDurationMinutes,
}: LearnReviewBlockedNavigationOptions) {
  const goBack = useCallback(() => navigate(-1), [navigate]);

  const exitBlockedLearnSession = useCallback(
    async (destination: string) => {
      await exitBlockedLearnSessionFlow({
        abandonPendingNavigation,
        destination,
        dismissOverlay: dismissOnce,
        isAndroidOverlayUnlockFlow,
        navigate,
        overlaySessionId,
      });
    },
    [dismissOnce, isAndroidOverlayUnlockFlow, navigate, overlaySessionId],
  );

  const openLearnHub = useCallback(() => {
    if (isBlockedFlow) {
      void exitBlockedLearnSession('/learn');
      return;
    }

    navigate('/learn');
  }, [exitBlockedLearnSession, isBlockedFlow, navigate]);

  const handleContinueToTarget = useCallback(async () => {
    if (isAndroidPlatform && targetId) {
      if (isAndroidOverlayUnlockFlow) {
        let handoffPrimed = false;

        try {
          await primeNativeUnlockHandoff(targetId, targetType, unlockDurationMinutes);
          handoffPrimed = true;
        } catch (error) {
          console.warn('Native unlock handoff prime failed:', error);
        } finally {
          try {
            await dismissOnce();
          } catch (error) {
            console.warn('Blocking overlay dismiss failed:', error);
          }
        }

        if (!handoffPrimed) {
          navigate('/');
          return;
        }
      }

      try {
        await openTarget(targetId, targetType);
      } catch (error) {
        console.warn('Target open failed:', error);
        navigate('/');
      }
      return;
    }

    navigate('/');
  }, [dismissOnce, isAndroidOverlayUnlockFlow, navigate, targetId, targetType, unlockDurationMinutes]);

  const handleOverlaySuccessDone = useCallback(async () => {
    if (overlaySuccessHandled) return;
    setOverlaySuccessHandled(true);
    await handleContinueToTarget();
  }, [handleContinueToTarget, overlaySuccessHandled, setOverlaySuccessHandled]);

  const handleFallbackToStrictBreathing = useCallback(() => {
    if (!targetId) {
      return;
    }

    const params = createBlockingFlowSearchParams(searchParams);
    params.set('targetId', targetId);
    params.set('targetType', targetType);
    params.set('mode', 'strict');
    void exitBlockedLearnSession(`/breathing?${params.toString()}`);
  }, [exitBlockedLearnSession, searchParams, targetId, targetType]);

  return {
    goBack,
    handleContinueToTarget,
    handleFallbackToStrictBreathing,
    handleOverlaySuccessDone,
    openLearnHub,
  };
}
