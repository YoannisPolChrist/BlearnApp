import { notifyNativeRouteReady } from '@/lib/nativeOverlayRuntime';
import { completePendingNavigation } from '@/services/screenTimeService';

const COMPLETED_OVERLAY_SESSIONS = new Set<string>();
const COMPLETED_OVERLAY_SESSION_ORDER: string[] = [];
const IN_FLIGHT_OVERLAY_SESSIONS = new Set<string>();
const MAX_TRACKED_OVERLAY_SESSIONS = 64;

function normalizeOverlaySessionId(overlaySessionId?: string | null) {
  return overlaySessionId?.trim() || '';
}

function rememberCompletedOverlaySession(sessionId: string) {
  if (COMPLETED_OVERLAY_SESSIONS.has(sessionId)) {
    return;
  }

  COMPLETED_OVERLAY_SESSIONS.add(sessionId);
  COMPLETED_OVERLAY_SESSION_ORDER.push(sessionId);

  while (COMPLETED_OVERLAY_SESSION_ORDER.length > MAX_TRACKED_OVERLAY_SESSIONS) {
    const expiredSessionId = COMPLETED_OVERLAY_SESSION_ORDER.shift();
    if (expiredSessionId) {
      COMPLETED_OVERLAY_SESSIONS.delete(expiredSessionId);
    }
  }
}

export async function completeNativeRouteHandoff(overlaySessionId?: string | null) {
  const normalizedSessionId = normalizeOverlaySessionId(overlaySessionId);
  let completed = false;

  if (
    normalizedSessionId
    && (IN_FLIGHT_OVERLAY_SESSIONS.has(normalizedSessionId) || COMPLETED_OVERLAY_SESSIONS.has(normalizedSessionId))
  ) {
    return;
  }

  if (normalizedSessionId) {
    IN_FLIGHT_OVERLAY_SESSIONS.add(normalizedSessionId);
  }

  try {
    if (import.meta.env.DEV) {
      console.info('[nativeRouteHandoff] completing pending navigation');
    }
    await completePendingNavigation(normalizedSessionId);
    completed = true;
    if (normalizedSessionId) {
      rememberCompletedOverlaySession(normalizedSessionId);
    }
  } catch (error) {
    if (normalizedSessionId) {
      IN_FLIGHT_OVERLAY_SESSIONS.delete(normalizedSessionId);
    }
    console.warn('Pending navigation completion failed:', error);
  } finally {
    if (normalizedSessionId) {
      IN_FLIGHT_OVERLAY_SESSIONS.delete(normalizedSessionId);
    }
    if (completed) {
      notifyNativeRouteReady();
    }
  }
}
