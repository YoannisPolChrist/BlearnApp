import { useCallback, useEffect, useMemo, useState } from 'react';
import { EMPTY_PERMISSION_STATUS } from '@/services/screenTimeNormalization';
import {
  checkPermissions,
  getInstalledApps,
  getTodayUsage,
  getUsageForRange,
  isUnsupportedPlatformError,
} from '@/services/screenTimeService';
import type { InstalledApp, ScreenTimeSummary } from '@/plugins/ScreenTimePlugin';

function getModesRuntimeErrorMessage(error: unknown, isGerman: boolean, genericMessage: string) {
  if (isUnsupportedPlatformError(error)) {
    return isGerman
      ? 'Diese Fokussteuerung funktioniert nur in der Android-App. Starte Blearn nativ, um Blocking, Permissions und Resume zu pruefen.'
      : 'These focus controls only work inside the Android app. Launch Blearn natively to verify blocking, permissions, and resume.';
  }

  return genericMessage;
}

type UseModesRuntimeOptions = {
  isGerman: boolean;
};

export function useModesRuntime({ isGerman }: UseModesRuntimeOptions) {
  const [installedApps, setInstalledApps] = useState<InstalledApp[]>([]);
  const [usage, setUsage] = useState<ScreenTimeSummary | null>(null);
  const [permissionErrorMessage, setPermissionErrorMessage] = useState<string | null>(null);
  const [runtimeStatusMessage, setRuntimeStatusMessage] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState(EMPTY_PERMISSION_STATUS);

  const loadRuntimeData = useCallback(async () => {
    const endMs = Date.now();
    const startMs = endMs - 30 * 24 * 60 * 60 * 1000;
    let nextRuntimeError: string | null = null;

    try {
      const monthlyUsage = await getUsageForRange(startMs, endMs);
      setUsage(monthlyUsage);
    } catch (error) {
      try {
        const todayUsage = await getTodayUsage();
        setUsage(todayUsage);
      } catch (todayError) {
        setUsage(null);
        nextRuntimeError = getModesRuntimeErrorMessage(
          todayError,
          isGerman,
          isGerman
            ? 'Android-Nutzungsdaten konnten nicht geladen werden. Pruefe dein Setup und versuche es erneut.'
            : 'Android usage data could not be loaded. Check your setup and try again.',
        );
      }

      if (!isUnsupportedPlatformError(error)) {
        console.warn('Monthly usage failed, falling back to today:', error);
      }
    }

    try {
      const apps = await getInstalledApps();
      setInstalledApps(apps);
    } catch (error) {
      setInstalledApps([]);
      nextRuntimeError = nextRuntimeError ?? getModesRuntimeErrorMessage(
        error,
        isGerman,
        isGerman
          ? 'Installierte Apps konnten nicht geladen werden. Pruefe dein Android-Setup und versuche es erneut.'
          : 'Installed apps could not be loaded. Check your Android setup and try again.',
      );
    }

    setRuntimeStatusMessage(nextRuntimeError);
  }, [isGerman]);

  const refreshPermissions = useCallback(async () => {
    try {
      setPermissionErrorMessage(null);
      const nextStatus = await checkPermissions();
      setPermissionStatus(nextStatus);
    } catch (error) {
      setPermissionStatus(EMPTY_PERMISSION_STATUS);
      setPermissionErrorMessage(
        getModesRuntimeErrorMessage(
          error,
          isGerman,
          isGerman
            ? 'Berechtigungen konnten nicht geprueft werden. Pruefe dein Android-Setup und versuche es erneut.'
            : 'Permissions could not be checked. Check your Android setup and try again.',
        ),
      );
    }
  }, [isGerman]);

  useEffect(() => {
    void loadRuntimeData();
  }, [loadRuntimeData]);

  useEffect(() => {
    void refreshPermissions();
  }, [refreshPermissions]);

  useEffect(() => {
    const handleVisibility = () => {
      if (!document.hidden) {
        void refreshPermissions();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [refreshPermissions]);

  const retryRuntimeChecks = useCallback(() => {
    void refreshPermissions();
    void loadRuntimeData();
  }, [loadRuntimeData, refreshPermissions]);

  return useMemo(() => ({
    installedApps,
    usage,
    permissionErrorMessage,
    runtimeStatusMessage,
    permissionStatus,
    retryRuntimeChecks,
  }), [
    installedApps,
    permissionErrorMessage,
    permissionStatus,
    retryRuntimeChecks,
    runtimeStatusMessage,
    usage,
  ]);
}
