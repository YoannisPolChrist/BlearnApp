import type { BlockTargetType } from '@/lib/learning';

export interface BlockingFlowQueryContext {
  targetId?: string;
  targetType: BlockTargetType;
  targetLabel?: string;
  overlaySessionId?: string;
  isBlockedFlow: boolean;
  isOverlayBlockingFlow: boolean;
}

function normalizeText(value: string | null) {
  const normalized = value?.trim() || '';
  return normalized || undefined;
}

export function getBlockingFlowQueryContext(searchParams: URLSearchParams): BlockingFlowQueryContext {
  const targetId = normalizeText(searchParams.get('targetId') || searchParams.get('targetApp'));
  const targetType = (normalizeText(searchParams.get('targetType') || searchParams.get('blockType')) || 'app') as BlockTargetType;
  const targetLabel = normalizeText(
    searchParams.get('targetLabel') || searchParams.get('targetApp') || searchParams.get('targetId'),
  );
  const overlaySessionId = normalizeText(searchParams.get('overlaySessionId'));
  const isOverlayBlockingFlow = Boolean(targetId && overlaySessionId);

  return {
    targetId,
    targetType,
    targetLabel,
    overlaySessionId,
    isBlockedFlow: isOverlayBlockingFlow,
    isOverlayBlockingFlow,
  };
}
