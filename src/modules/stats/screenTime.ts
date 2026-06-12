import { useEffect, useMemo, useState } from 'react';
import type { InstalledApp, MonitoringStatus, ScreenTimeSummary } from '@/plugins/ScreenTimePlugin';
import {
  getAppId,
  getAppLabel,
} from '@/services/screenTimeNormalization';
import {
  getCurrentApp,
  getInstalledApps,
  getMonitoringStatus,
  getTodayUsage,
  isUnsupportedPlatformError,
} from '@/services/screenTimeService';
import { TIME_LABEL_FORMATTER } from './constants';
import type { ScreenSnapshot } from './types';

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

async function getScreenSnapshot(): Promise<ScreenSnapshot> {
  const [usage, status, installedApps, currentAppId] = await Promise.all([
    getTodayUsage(),
    getMonitoringStatus(),
    getInstalledApps(),
    getCurrentApp(),
  ]);

  return {
    usage,
    status,
    installedApps,
    currentAppId,
    loadedAt: Date.now(),
  };
}

function getStatsErrorMessage(error: unknown) {
  if (isUnsupportedPlatformError(error)) {
    return 'Diese Statistik ist nur in der Android-App verfügbar.';
  }

  return 'Screen-Time-Daten konnten nicht geladen werden. Prüfe Berechtigungen und versuche es erneut.';
}

export function formatTimeLabel(timestamp?: number) {
  if (!timestamp) return 'Noch keine Aktivität';
  return TIME_LABEL_FORMATTER.format(new Date(timestamp));
}

export function formatTaskComponentLabel(value?: string | null) {
  const normalizedValue = value?.trim();
  if (!normalizedValue) {
    return 'Nicht erkannt';
  }

  const slashIndex = normalizedValue.indexOf('/');
  const componentValue = slashIndex >= 0 ? normalizedValue.slice(slashIndex + 1) : normalizedValue;
  return componentValue.startsWith('.') ? componentValue.slice(1) : componentValue;
}

export function formatTaskSummary(task: NonNullable<MonitoringStatus['taskDiagnostics']>['appTasks'][number]) {
  const baseLabel = formatTaskComponentLabel(task.baseActivity);
  const topLabel = formatTaskComponentLabel(task.topActivity);
  if (baseLabel === topLabel) {
    return baseLabel;
  }

  return `${baseLabel} -> ${topLabel}`;
}

export function useScreenStatsSnapshot() {
  const [usage, setUsage] = useState<ScreenTimeSummary | null>(null);
  const [status, setStatus] = useState<MonitoringStatus | null>(null);
  const [installedApps, setInstalledApps] = useState<InstalledApp[]>([]);
  const [currentAppId, setCurrentAppId] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);

  const applySnapshot = (snapshot: ScreenSnapshot) => {
    setUsage(snapshot.usage);
    setStatus(snapshot.status);
    setInstalledApps(snapshot.installedApps);
    setCurrentAppId(snapshot.currentAppId);
    setLastUpdatedAt(snapshot.loadedAt);
  };

  useEffect(() => {
    let active = true;

    const loadSnapshot = async () => {
      setIsRefreshing(true);
      setError(null);

      try {
        const snapshot = await getScreenSnapshot();
        if (!active) return;

        applySnapshot(snapshot);
      } catch (nextError) {
        if (!active) return;
        setError(getStatsErrorMessage(nextError));
      } finally {
        if (active) {
          setIsRefreshing(false);
        }
      }
    };

    void loadSnapshot();

    return () => {
      active = false;
    };
  }, []);

  const refresh = async () => {
    setIsRefreshing(true);
    setError(null);

    try {
      const snapshot = await getScreenSnapshot();
      applySnapshot(snapshot);
    } catch (nextError) {
      setError(getStatsErrorMessage(nextError));
    } finally {
      setIsRefreshing(false);
    }
  };

  return {
    currentAppId,
    error,
    installedApps,
    isRefreshing,
    lastUpdatedAt,
    refresh,
    status,
    usage,
  };
}

export function useUsageStatsData(
  usage: ScreenTimeSummary | null,
  installedApps: InstalledApp[],
  currentAppId: string,
) {
  const appLabels = useMemo(() => {
    const entries = new Map<string, string>();

    installedApps.forEach((entry) => {
      entries.set(getAppId(entry), getAppLabel(entry));
    });

    usage?.entries.forEach((entry) => {
      entries.set(getAppId(entry), getAppLabel(entry));
    });

    return entries;
  }, [installedApps, usage?.entries]);

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

  const resolveAppLabel = (appId?: string) => {
    if (!appId) return '';
    return appLabels.get(appId) || appId;
  };

  return {
    appDetails,
    currentAppLabel: currentAppId ? resolveAppLabel(currentAppId) : 'Keine aktive App erkannt',
    strongestEntryTime: topEntries[0]?.totalTimeMs ?? 0,
    topEntries,
    topUsageEntry: usageEntries[0],
    usageEntries,
  };
}
