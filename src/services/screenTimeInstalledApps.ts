import ScreenTime, { type InstalledApp } from '@/plugins/ScreenTimePlugin';
import { isAndroidPlatform } from '@/lib/platform';
import { ensureArray, normalizeAppEntry } from '@/services/screenTimeNormalization';
import { UnsupportedPlatformError } from '@/services/screenTimePlatformError';

const INSTALLED_APPS_CACHE_TTL_MS = 60_000;

export type InstalledAppsOptions = {
  includeIcons?: boolean;
  iconPackageNames?: string[];
};
type InstalledAppsCacheEntry = { value: InstalledApp[]; expiresAt: number };

const installedAppsCache = new Map<string, InstalledAppsCacheEntry>();
const installedAppsRequests = new Map<string, Promise<InstalledApp[]>>();

function ensureAndroidSupport(feature: string) {
  if (!isAndroidPlatform) {
    throw new UnsupportedPlatformError(feature);
  }
}

export async function getInstalledApps(options: InstalledAppsOptions = {}): Promise<InstalledApp[]> {
  ensureAndroidSupport('Installed apps');
  const iconPackageNames = [...new Set(
    (options.iconPackageNames ?? [])
      .map((packageName) => packageName.trim())
      .filter(Boolean),
  )].sort();
  const includeIcons = options.includeIcons === true;
  const cacheKey = includeIcons
    ? 'icons:all'
    : iconPackageNames.length > 0
      ? `icons:${iconPackageNames.join('|')}`
      : 'icons:none';
  const now = Date.now();
  const cached = installedAppsCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const pendingRequest = installedAppsRequests.get(cacheKey);
  if (pendingRequest) {
    return pendingRequest;
  }

  const request = ScreenTime.getInstalledApps({
    includeIcons,
    iconPackageNames: iconPackageNames.length > 0 ? iconPackageNames : undefined,
  })
    .then((result) => {
      const normalizedApps = ensureArray(result.apps).map(normalizeAppEntry);
      installedAppsCache.set(cacheKey, {
        value: normalizedApps,
        expiresAt: Date.now() + INSTALLED_APPS_CACHE_TTL_MS,
      });
      return normalizedApps;
    })
    .finally(() => {
      installedAppsRequests.delete(cacheKey);
    });

  installedAppsRequests.set(cacheKey, request);
  return request;
}
