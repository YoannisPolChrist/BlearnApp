const NATIVE_ROUTE_READY_EVENT = 'blearn:native-route-ready';
const NATIVE_OVERLAY_RUNTIME_EVENT = 'blearn:native-overlay-runtime';
const NATIVE_OVERLAY_RUNTIME_PREFIX = '[nativeOverlayRuntime]';

export type NativeOverlayRuntimeStage =
  | 'pending-navigation'
  | 'route-preload'
  | 'overlay-session'
  | 'route-mounted'
  | 'handoff-complete'
  | 'next-pending-item'
  | 'resume'
  | 'retry-scheduled'
  | 'fallback-visible';

export interface NativeOverlayRuntimeEvent {
  stage: NativeOverlayRuntimeStage;
  source: 'hook' | 'app';
  message: string;
  route?: string;
  overlaySessionId?: string | null;
  targetId?: string | null;
  targetType?: string | null;
  delayMs?: number;
  at: number;
}

function canUseWindow() {
  return typeof window !== 'undefined';
}

export function notifyNativeRouteReady() {
  if (!canUseWindow()) {
    return;
  }

  window.dispatchEvent(new CustomEvent(NATIVE_ROUTE_READY_EVENT));
}

export function subscribeToNativeRouteReady(listener: () => void) {
  if (!canUseWindow()) {
    return () => undefined;
  }

  window.addEventListener(NATIVE_ROUTE_READY_EVENT, listener);
  return () => {
    window.removeEventListener(NATIVE_ROUTE_READY_EVENT, listener);
  };
}

export function recordNativeOverlayRuntimeEvent(
  event: Omit<NativeOverlayRuntimeEvent, 'at'>,
) {
  const payload: NativeOverlayRuntimeEvent = {
    ...event,
    at: Date.now(),
  };

  if (canUseWindow()) {
    window.dispatchEvent(new CustomEvent(NATIVE_OVERLAY_RUNTIME_EVENT, { detail: payload }));
  }

  if (import.meta.env.DEV) {
    console.info(
      `${NATIVE_OVERLAY_RUNTIME_PREFIX} ${payload.stage}`,
      payload.message,
      payload,
    );
  }

  return payload;
}

export function subscribeToNativeOverlayRuntimeEvent(
  listener: (event: NativeOverlayRuntimeEvent) => void,
) {
  if (!canUseWindow()) {
    return () => undefined;
  }

  const handler = (event: Event) => {
    const detail = (event as CustomEvent<NativeOverlayRuntimeEvent>).detail;
    if (detail) {
      listener(detail);
    }
  };

  window.addEventListener(NATIVE_OVERLAY_RUNTIME_EVENT, handler);
  return () => {
    window.removeEventListener(NATIVE_OVERLAY_RUNTIME_EVENT, handler);
  };
}

export function createBlockingFlowSearchParams(searchParams: URLSearchParams) {
  const params = new URLSearchParams(searchParams);
  const targetType = params.get('targetType') || params.get('blockType');
  const targetLabel = params.get('targetLabel') || params.get('targetApp') || params.get('targetId');

  if (targetType) {
    params.set('targetType', targetType);
    params.set('blockType', targetType);
  }

  if (targetLabel) {
    params.set('targetLabel', targetLabel);
    params.set('targetApp', targetLabel);
  }

  return params;
}
