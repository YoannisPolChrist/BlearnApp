import { describe, expect, it } from 'vitest';
import { isBlockingOverlayRoute, isBlockingRouteForBottomNav, isBlockingRoutePath } from '@/lib/blockingOverlayRoutes';

describe('blocking overlay routes', () => {
  it('detects overlay blocking routes from the shared helper', () => {
    expect(isBlockingOverlayRoute('/checkin', '?overlaySessionId=session-1')).toBe(true);
    expect(isBlockingOverlayRoute('/checkin', '')).toBe(false);
    expect(isBlockingOverlayRoute('/settings', '?overlaySessionId=session-1')).toBe(false);
  });

  it('recognizes blocking route paths independent of overlay params', () => {
    expect(isBlockingRoutePath('/intervention')).toBe(true);
    expect(isBlockingRoutePath('/learn/review')).toBe(true);
    expect(isBlockingRoutePath('/learn')).toBe(false);
  });

  it('keeps bottom navigation hidden on pause and blocking overlay paths', () => {
    expect(isBlockingRouteForBottomNav('/pause')).toBe(true);
    expect(isBlockingRouteForBottomNav('/learn/review', '?overlaySessionId=session-1')).toBe(true);
    expect(isBlockingRouteForBottomNav('/learn')).toBe(false);
  });
});
