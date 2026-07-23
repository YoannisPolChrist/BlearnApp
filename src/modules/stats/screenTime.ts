import { useEffect, useMemo, useRef, useState } from 'react';
import type { InstalledApp, ScreenTimeSummary } from '@/plugins/ScreenTimePlugin';
import { getLocalDateKey } from '@/lib/localDate';
import {
  getAppId,
  getAppLabel,
} from '@/services/screenTimeNormalization';
import {
  getInstalledApps,
  getUsageForRange,
  getTodayUsage,
  isUnsupportedPlatformError,
} from '@/services/screenTimeService';
import { TIME_LABEL_FORMATTER } from './constants';
import type { ScreenSnapshot, TimeRange } from './types';


function normalizeAppLookupValue(value?: string) {
  return value?.trim().toLowerCase() ?? '';
}

export function getAppLookupKeys(entry?: {
  appId?: string;
  packageName?: string;
  processName?: string;
  label?: string;
  appName?: string;
}) {
  if (!entry) return [];

  const keys = new Set<string>();
  const addKey = (value?: string) => {
    const normalizedValue = normalizeAppLookupValue(value);
    if (normalizedValue) {
      keys.add(normalizedValue);
    }
  };

  addKey(entry.appId);
  addKey(entry.packageName);
  addKey(entry.processName);
  addKey(entry.label);
  addKey(entry.appName);
  addKey(getAppLabel(entry));

  return [...keys];
}

// Schnelle Kerndaten (Bildschirmzeit). Bewusst OHNE
// getInstalledApps({ includeIcons: true }) — das lädt alle Apps inkl. Base64-Icons über die Bridge und
// ist der eigentliche Stats-Bremsklotz; es wird separat nachgeladen.
export type UsageRangeBounds = {
  startMs: number;
  endMs: number;
};

function startOfLocalDay(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}

export function getUsageRangeBounds(
  range: TimeRange,
  referenceDate = new Date(),
  now = Date.now(),
): UsageRangeBounds {
  if (range === 'total') {
    return { startMs: 0, endMs: now };
  }

  let start: Date;
  let end: Date;

  if (range === 'month') {
    start = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
    end = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 1);
  } else if (range === 'week') {
    start = startOfLocalDay(referenceDate);
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    end = new Date(start);
    end.setDate(end.getDate() + 7);
  } else {
    start = startOfLocalDay(referenceDate);
    end = new Date(start);
    end.setDate(end.getDate() + 1);
  }

  return {
    startMs: start.getTime(),
    endMs: Math.min(end.getTime(), now),
  };
}

async function getFastScreenSnapshot(
  range: TimeRange,
  monthReference: Date,
): Promise<Omit<ScreenSnapshot, 'installedApps'>> {
  const bounds = getUsageRangeBounds(range, range === 'month' ? monthReference : new Date());
  const usage = range === 'day'
    ? await getTodayUsage()
    : await getUsageForRange(bounds.startMs, bounds.endMs);

  return {
    usage,
    loadedAt: Date.now(),
  };
}

function getStatsErrorMessage(error: unknown) {
  if (isUnsupportedPlatformError(error)) {
    return 'Diese Statistik ist nur in der Android-App verfügbar.';
  }

  return 'Screen-Time-Daten konnten nicht geladen werden. Prüfe Berechtigungen und versuche es erneut.';
}

function getUsageIconPackageNames(usage: ScreenTimeSummary, limit = 8) {
  return [...usage.entries]
    .sort((left, right) => right.totalTimeMs - left.totalTimeMs)
    .slice(0, limit)
    .map((entry) => getAppId(entry))
    .filter(Boolean);
}

export function getMillisecondsUntilNextLocalMidnight(now = Date.now()) {
  const nextMidnight = new Date(now);
  nextMidnight.setHours(24, 0, 0, 0);
  return Math.max(1, nextMidnight.getTime() - now);
}

export function formatTimeLabel(timestamp?: number) {
  if (!timestamp) return 'Noch keine Aktivität';
  return TIME_LABEL_FORMATTER.format(new Date(timestamp));
}

export function useScreenStatsSnapshot(range: TimeRange = 'day', monthReference = new Date()) {
  const [usage, setUsage] = useState<ScreenTimeSummary | null>(null);
  const [installedApps, setInstalledApps] = useState<InstalledApp[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const loadedDayKeyRef = useRef<string | null>(null);
  const monthKey = `${monthReference.getFullYear()}-${monthReference.getMonth()}`;

  const loadSnapshot = async (isActive: () => boolean) => {
    setIsRefreshing(true);
    setError(null);
    let fast: Omit<ScreenSnapshot, 'installedApps'>;

    try {
      // Phase 1: Kerndaten sofort anzeigen (schnell).
      fast = await getFastScreenSnapshot(range, monthReference);
      if (!isActive()) return;
      setUsage(fast.usage);
      setLastUpdatedAt(fast.loadedAt);
      loadedDayKeyRef.current = getLocalDateKey(fast.loadedAt);
    } catch (nextError) {
      if (!isActive()) return;
      setError(getStatsErrorMessage(nextError));
      setIsRefreshing(false);
      return;
    } finally {
      if (isActive()) {
        setIsRefreshing(false);
      }
    }

    // Phase 2: App-Liste nebenläufig nachladen. Icons brauchen wir nur für die
    // sichtbaren Top-Apps; alle 160 Icons über die Bridge zu schicken ist auf
    // schwächeren Geräten deutlich teurer als der Stats-Screen selbst.
    try {
      const apps = await getInstalledApps({
        iconPackageNames: getUsageIconPackageNames(fast.usage),
      });
      if (isActive()) {
        setInstalledApps(apps);
      }
    } catch {
      // App-Liste ist optional; Kern-Stats stehen bereits.
    }
  };

  useEffect(() => {
    let active = true;
    let midnightRefreshTimer: number | undefined;
    const isActive = () => active;

    const refreshIfDayChanged = () => {
      if (range !== 'day') return;
      if (!loadedDayKeyRef.current || loadedDayKeyRef.current === getLocalDateKey()) return;
      void loadSnapshot(isActive);
    };

    const scheduleMidnightRefresh = () => {
      midnightRefreshTimer = window.setTimeout(() => {
        if (!active) return;
        void loadSnapshot(isActive);
        scheduleMidnightRefresh();
      }, getMillisecondsUntilNextLocalMidnight());
    };

    void loadSnapshot(isActive);
    if (range === 'day') {
      scheduleMidnightRefresh();
    }
    window.addEventListener('focus', refreshIfDayChanged);
    document.addEventListener('visibilitychange', refreshIfDayChanged);

    return () => {
      active = false;
      if (midnightRefreshTimer !== undefined) {
        window.clearTimeout(midnightRefreshTimer);
      }
      window.removeEventListener('focus', refreshIfDayChanged);
      document.removeEventListener('visibilitychange', refreshIfDayChanged);
    };
  // monthKey keeps an explicitly selected historical month stable across renders.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, monthKey]);

  const refresh = async () => {
    await loadSnapshot(() => true);
  };

  return {
    error,
    installedApps,
    isRefreshing,
    lastUpdatedAt,
    refresh,
    usage,
  };
}

export function useUsageStatsData(
  usage: ScreenTimeSummary | null,
  installedApps: InstalledApp[],
) {
  const appDetails = useMemo(() => {
    const entries = new Map<string, InstalledApp>();

    installedApps.forEach((entry) => {
      getAppLookupKeys(entry).forEach((key) => {
        if (!entries.has(key)) {
          entries.set(key, entry);
        }
      });
    });

    return entries;
  }, [installedApps]);

  const usageEntries = useMemo(
    () => [...(usage?.entries ?? [])].sort((left, right) => right.totalTimeMs - left.totalTimeMs),
    [usage?.entries],
  );
  const topEntries = useMemo(() => usageEntries.slice(0, 8), [usageEntries]);

  return {
    appDetails,
    strongestEntryTime: topEntries[0]?.totalTimeMs ?? 0,
    topEntries,
    topUsageEntry: usageEntries[0],
    usageEntries,
  };
}
