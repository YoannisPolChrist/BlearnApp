import ScreenTime, { type InstalledApp } from '@/plugins/ScreenTimePlugin';
import { isAndroidPlatform } from '@/lib/platform';
import { ensureArray, normalizeAppEntry } from '@/services/screenTimeNormalization';
import { UnsupportedPlatformError } from '@/services/screenTimePlatformError';

const INSTALLED_APPS_CACHE_TTL_MS = 60_000;

let installedAppsCache:
  | {
      value: InstalledApp[];
      expiresAt: number;
    }
  | null = null;
let installedAppsRequest: Promise<InstalledApp[]> | null = null;

function ensureAndroidSupport(feature: string) {
  if (!isAndroidPlatform) {
    throw new UnsupportedPlatformError(feature);
  }
}

export async function getInstalledApps(): Promise<InstalledApp[]> {
  ensureAndroidSupport('Installed apps');
  const now = Date.now();
  if (installedAppsCache && installedAppsCache.expiresAt > now) {
    return installedAppsCache.value;
  }

  if (installedAppsRequest) {
    return installedAppsRequest;
  }

  installedAppsRequest = ScreenTime.getInstalledApps()
    .then((result) => {
      const normalizedApps = ensureArray(result.apps).map(normalizeAppEntry);
      installedAppsCache = {
        value: normalizedApps,
        expiresAt: Date.now() + INSTALLED_APPS_CACHE_TTL_MS,
      };
      return normalizedApps;
    })
    .finally(() => {
      installedAppsRequest = null;
    });

  return installedAppsRequest;
}
