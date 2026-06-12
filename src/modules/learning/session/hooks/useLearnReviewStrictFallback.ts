import { useEffect, useState } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import { createBlockingFlowSearchParams } from '@/lib/nativeOverlayRuntime';
import type { BlockTargetType } from '@/lib/learning';

export function useLearnReviewStrictFallback({
  activeDeckId,
  assignmentDeckId,
  deckId,
  hasUsableLearningDeck,
  isBlockedFlow,
  learningHydrated,
  navigate,
  searchParams,
  success,
  targetId,
  targetType,
}: {
  activeDeckId?: string;
  assignmentDeckId?: string;
  deckId?: string;
  hasUsableLearningDeck: boolean;
  isBlockedFlow: boolean;
  learningHydrated: boolean;
  navigate: NavigateFunction;
  searchParams: URLSearchParams;
  success: boolean;
  targetId?: string;
  targetType: BlockTargetType;
}) {
  const [fallbackReady, setFallbackReady] = useState(false);

  useEffect(() => {
    if (!learningHydrated || !isBlockedFlow || success) {
      setFallbackReady(false);
      return undefined;
    }

    setFallbackReady(false);
    const timer = window.setTimeout(() => {
      setFallbackReady(true);
    }, 1200);

    return () => {
      window.clearTimeout(timer);
    };
  }, [activeDeckId, assignmentDeckId, deckId, isBlockedFlow, learningHydrated, success, targetId, targetType]);

  useEffect(() => {
    if (!learningHydrated || !isBlockedFlow || success || hasUsableLearningDeck || !fallbackReady) {
      return;
    }

    const params = createBlockingFlowSearchParams(searchParams);
    params.set('targetId', targetId!);
    params.set('targetType', targetType);
    params.set('mode', 'strict');
    navigate(`/breathing?${params.toString()}`, { replace: true });
  }, [
    fallbackReady,
    hasUsableLearningDeck,
    isBlockedFlow,
    learningHydrated,
    navigate,
    searchParams,
    success,
    targetId,
    targetType,
  ]);
}
