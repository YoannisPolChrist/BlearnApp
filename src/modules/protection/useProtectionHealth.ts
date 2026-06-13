import { useCallback, useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { MonitoringStatus } from '@/plugins/ScreenTimePlugin';
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

// Geteilter Monitoring-Poll: Dashboard-Karte UND Header-Schild konsumieren
// denselben nativen Status — ein Intervall/Listener statt zwei.
interface MonitoringPollState {
  status: MonitoringStatus;
  supported: boolean;
}

let pollState: MonitoringPollState = { status: EMPTY_MONITORING_STATUS, supported: true };
const subscribers = new Set<(state: MonitoringPollState) => void>();
let intervalId: number | null = null;
let monitoringVisibilityHandler: (() => void) | null = null;

async function refreshMonitoringStatus() {
  try {
    pollState = { status: await getMonitoringStatus(), supported: true };
  } catch (error) {
    if (isUnsupportedPlatformError(error)) {
      pollState = { ...pollState, supported: false };
    }
  }
  subscribers.forEach((notify) => notify(pollState));
}

function subscribeMonitoring(notify: (state: MonitoringPollState) => void): () => void {
  subscribers.add(notify);
  notify(pollState);

  if (intervalId === null) {
    void refreshMonitoringStatus();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refreshMonitoringStatus();
    };
    intervalId = window.setInterval(() => void refreshMonitoringStatus(), REFRESH_INTERVAL_MS);
    document.addEventListener('visibilitychange', onVisible);
    // Listener-Teardown am Singleton-Handle festhalten.
    monitoringVisibilityHandler = onVisible;
  }

  return () => {
    subscribers.delete(notify);
    if (subscribers.size === 0 && intervalId !== null) {
      window.clearInterval(intervalId);
      intervalId = null;
      if (monitoringVisibilityHandler) {
        document.removeEventListener('visibilitychange', monitoringVisibilityHandler);
        monitoringVisibilityHandler = null;
      }
    }
  };
}

/**
 * Konfigurationsabhängiges Schutz-Health-Modell (Masterplan 1.1), geteilt über
 * einen Singleton-Poll. Leitet das grün/gelb/rot-Modell aus dem nativen Status
 * und der aktiven Blocking-Konfiguration ab.
 */
export function useProtectionHealth(): UseProtectionHealthResult {
  const [{ status, supported }, setPollState] = useState<MonitoringPollState>(() => pollState);
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

  useEffect(() => subscribeMonitoring(setPollState), []);

  const refresh = useCallback(() => refreshMonitoringStatus(), []);

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
