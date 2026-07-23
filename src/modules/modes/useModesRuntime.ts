import { useCallback, useEffect, useMemo, useState } from 'react';
import { EMPTY_PERMISSION_STATUS } from '@/services/screenTimeNormalization';
import {
  checkPermissions,
  getInstalledApps,
  getTodayUsage,
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
    let nextRuntimeError: string | null = null;

    try {
      setUsage(await getTodayUsage());
    } catch (error) {
      setUsage(null);
      nextRuntimeError = getModesRuntimeErrorMessage(
        error,
        isGerman,
        isGerman
          ? 'Android-Nutzungsdaten konnten nicht geladen werden. Pruefe dein Setup und versuche es erneut.'
          : 'Android usage data could not be loaded. Check your setup and try again.',
      );
    }

    try {
      const apps = await getInstalledApps({ includeIcons: true });
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
    // App icons are part of the target-selection affordance, but encoding them
    // across the native bridge is still non-critical. Let the Modes shell paint
    // first, then load the catalogue while the browser is idle.
    let cancelled = false;
    const loadWhenIdle = () => {
      if (!cancelled) {
        void loadRuntimeData();
      }
    };
    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    };

    if (typeof idleWindow.requestIdleCallback === 'function') {
      const idleHandle = idleWindow.requestIdleCallback(loadWhenIdle, { timeout: 1500 });
      return () => {
        cancelled = true;
        idleWindow.cancelIdleCallback?.(idleHandle);
      };
    }

    const timerId = window.setTimeout(loadWhenIdle, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timerId);
    };
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
