export const BLOCKING_OVERLAY_ROUTE_PATHS = [
  '/intervention',
  '/breathing',
  '/checkin',
  '/learn/review',
] as const;

export const BLOCKING_NAV_HIDDEN_PATHS = [
  ...BLOCKING_OVERLAY_ROUTE_PATHS,
  '/pause',
] as const;

export type BlockingOverlayRoutePath = typeof BLOCKING_OVERLAY_ROUTE_PATHS[number];

function hasOverlaySessionId(search: string) {
  return new URLSearchParams(search).has('overlaySessionId');
}

function matchesRoutePrefix(pathname: string, route: string) {
  return pathname === route || pathname.startsWith(`${route}/`);
}

export function isBlockingRoutePath(pathname: string) {
  return BLOCKING_OVERLAY_ROUTE_PATHS.some((route) => matchesRoutePrefix(pathname, route));
}

export function isBlockingOverlayRoute(pathname: string, search = '') {
  return hasOverlaySessionId(search) && isBlockingRoutePath(pathname);
}

export function isBlockingRouteForBottomNav(pathname: string, search = '') {
  return BLOCKING_NAV_HIDDEN_PATHS.some((route) => matchesRoutePrefix(pathname, route))
    || isBlockingOverlayRoute(pathname, search);
}
