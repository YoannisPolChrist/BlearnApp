export const routeLoaders = {
  index: () => import('@/pages/Index'),
  intervention: () => import('@/pages/Intervention'),
  breathing: () => import('@/pages/Breathing'),
  checkin: () => import('@/pages/Checkin'),
  stats: () => import('@/pages/Stats'),
  modes: () => import('@/pages/Modes'),
  pause: () => import('@/pages/Pause'),
  settings: () => import('@/pages/AppSettings'),
  screenTime: () => import('@/pages/ScreenTime'),
  learn: () => import('@/pages/Learn'),
  learnTemplates: () => import('@/pages/LearnTemplates'),
  learnBrowser: () => import('@/pages/LearnBrowser'),
  learnFilteredDeck: () => import('@/pages/LearnFilteredDeck'),
  learnReview: () => import('@/pages/LearnReview'),
  wallet: () => import('@/pages/Wallet'),
  notFound: () => import('@/pages/NotFound'),
} as const;

const routePreloaders: Record<string, () => Promise<unknown>> = {
  '/': routeLoaders.index,
  '/intervention': routeLoaders.intervention,
  '/breathing': routeLoaders.breathing,
  '/checkin': routeLoaders.checkin,
  '/learn/review': routeLoaders.learnReview,
  '/learn/browser': routeLoaders.learnBrowser,
  '/learn/filtered': routeLoaders.learnFilteredDeck,
  '/screentime': routeLoaders.stats,
  '/learn': routeLoaders.learn,
  '/stats': routeLoaders.stats,
  '/settings': routeLoaders.settings,
  '/modes': routeLoaders.modes,
  '/wallet': routeLoaders.wallet,
};

const routePreloadCache = new Map<string, Promise<unknown>>();
const CRITICAL_BLOCKING_ROUTE_PATHS = [
  '/intervention',
  '/breathing',
  '/checkin',
  '/learn/review',
] as const;

export function preloadRoute(path: string) {
  const cached = routePreloadCache.get(path);
  if (cached) {
    return cached;
  }

  const loader = routePreloaders[path];
  if (!loader) {
    return Promise.resolve();
  }

  const preloadPromise = loader().catch((error) => {
    routePreloadCache.delete(path);
    throw error;
  });

  routePreloadCache.set(path, preloadPromise);
  return preloadPromise;
}

export function preloadCriticalBlockingRoutes() {
  return Promise.all(CRITICAL_BLOCKING_ROUTE_PATHS.map((path) => preloadRoute(path)));
}

// Die fünf Haupt-Tabs (Bottom-Nav). Im Idle nach dem Start vorgeladen, damit ein
// Tab-Wechsel nie einen kalten Chunk trifft (keine weißen Frames, < 200 ms).
const MAIN_TAB_ROUTE_PATHS = ['/', '/modes', '/learn', '/stats', '/settings'] as const;

export function preloadMainTabRoutes() {
  const run = () => MAIN_TAB_ROUTE_PATHS.forEach((path) => void preloadRoute(path));
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    (window as Window & { requestIdleCallback: (cb: () => void) => number }).requestIdleCallback(run);
  } else if (typeof window !== 'undefined') {
    window.setTimeout(run, 1200);
  }
}
