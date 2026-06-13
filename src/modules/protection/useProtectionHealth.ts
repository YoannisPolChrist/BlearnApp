import { useCallback, useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { getMonitoringStatus, isUnsupportedPlatformError } from '@/services/screenTimeService';
import { EMPTY_MONITORING_STATUS } from '@/services/screenTimeNormalization';
import { useAppStore } from '@/store/useAppStore';
import { buildProtectionHealth, type ProtectionHealth } from './protectionHealth';

const REFRESH_INTERVAL_MS = 30_000;

export interface UseProtectionHealthResult {
  health: ProtectionHealth;
  supported: boolean;
  refresh: () => Promise<void>;
  /** True, sobald für die aktive Konfiguration Schutz konfiguriert ist. */
  active: boolean;
}

/**
 * Geteilte Schutz-Health-Quelle (Masterplan 1.1) für Dashboard-Karte und das
 * Header-Schild. Pollt den nativen Status konfigurationsabhängig und leitet das
 * grün/gelb/rot-Modell ab.
 */
export function useProtectionHealth(): UseProtectionHealthResult {
  const [status, setStatus] = useState(EMPTY_MONITORING_STATUS);
  const [supported, setSupported] = useState(true);
  const { activeModes, blockedApps, blockedSearchTerms, blockedWebsites, isStrictLocked } =
    useAppStore(
      useShallow((state) => ({
        activeModes: state.activeModes,
        blockedApps: state.blockedApps,
        blockedSearchTerms: state.blockedSearchTerms,
        blockedWebsites: state.blockedWebsites,
        isStrictLocked: state.isStrictLocked,
      })),
    );

  const refresh = useCallback(async () => {
    try {
      setStatus(await getMonitoringStatus());
      setSupported(true);
    } catch (error) {
      if (isUnsupportedPlatformError(error)) {
        setSupported(false);
      }
    }
  }, []);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(), REFRESH_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);

  const blockingModesActive = activeModes.some((mode) => mode !== 'normal');
  const health = useMemo(
    () =>
      buildProtectionHealth(status, {
        appBlockingConfigured:
          blockingModesActive && (blockedApps.length > 0 || blockedSearchTerms.length > 0),
        websiteBlockingConfigured: blockingModesActive && blockedWebsites.length > 0,
        strictLockActive: isStrictLocked(),
      }),
    [blockedApps.length, blockedSearchTerms.length, blockedWebsites.length, blockingModesActive, isStrictLocked, status],
  );

  return {
    health,
    supported,
    refresh,
    active: health.overall !== 'inactive',
  };
}
