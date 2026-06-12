import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import {
  isNative,
  syncPolicies,
} from '@/services/screenTimeService';
import { buildDevicePolicySnapshot } from '@/lib/nativePolicy';
import { isPenaltyRuntimeActive } from '@/lib/penaltyRuntime';
import { useAppStore } from '@/store/useAppStore';
import { useLearningStore } from '@/store/useLearningStore';

/**
 * Syncs blocked apps, websites, and search terms to native Android services
 * whenever they change. Mount once in App.tsx.
 */
export function useNativeSync(enabled = true) {
  const {
    activeModes,
    strictLockUntil,
    strictLockScope,
    strictAddons,
    blockedApps,
    blockedAppModes,
    blockedWebsites,
    blockedWebsiteModes,
    blockedSearchTerms,
    blockedSearchTermModes,
    penaltyAmountSats,
    penaltyEnabled,
    accountabilityPartner,
    albyConnection,
    albyConnectionTest,
    unlockedTargets,
    appHydrated,
    setNativeRuntimeIssue,
    clearNativeRuntimeIssue,
  } = useAppStore(
    useShallow((state) => ({
      activeModes: state.activeModes,
      strictLockUntil: state.strictLockUntil,
      strictLockScope: state.strictLockScope,
      strictAddons: state.strictAddons,
      blockedApps: state.blockedApps,
      blockedAppModes: state.blockedAppModes,
      blockedWebsites: state.blockedWebsites,
      blockedWebsiteModes: state.blockedWebsiteModes,
      blockedSearchTerms: state.blockedSearchTerms,
      blockedSearchTermModes: state.blockedSearchTermModes,
      penaltyAmountSats: state.penaltyAmountSats,
      penaltyEnabled: state.penaltyEnabled,
      accountabilityPartner: state.accountabilityPartner,
      albyConnection: state.albyConnection,
      albyConnectionTest: state.albyConnectionTest,
      unlockedTargets: state.unlockedTargets,
      appHydrated: state.hasHydrated,
      setNativeRuntimeIssue: state.setNativeRuntimeIssue,
      clearNativeRuntimeIssue: state.clearNativeRuntimeIssue,
    })),
  );
  const [learningHydrated, setLearningHydrated] = useState(() => useLearningStore.persist.hasHydrated());
  const { assignments, gateRule } = useLearningStore(
    useShallow((state) => ({
      assignments: state.assignments,
      gateRule: state.gateRule,
    })),
  );
  const penaltyRuntimeActive = isPenaltyRuntimeActive({
    penaltyAmountSats,
    penaltyEnabled,
    accountabilityPartner,
    albyConnection,
    albyConnectionTest,
  });
  const lastSyncedSnapshotKeyRef = useRef<string | null>(null);
  const getNativeIssueMessage = useCallback((error: unknown) => {
    if (error instanceof Error && error.message) return error.message;
    if (typeof error === 'string') return error;
    return 'Unknown native runtime error';
  }, []);
  const snapshot = useMemo(() => buildDevicePolicySnapshot({
    activeModes,
    gateRule,
    blockedApps,
    blockedAppModes,
    blockedWebsites,
    blockedWebsiteModes,
    blockedSearchTerms,
    blockedSearchTermModes,
    assignments,
    unlockedTargets,
    strictLockUntil,
    strictLockScope,
    strictAddons,
    penaltyRuntimeActive,
    penaltyAmountSats,
    accountabilityPartnerName: accountabilityPartner?.name,
  }), [
    accountabilityPartner?.name,
    activeModes,
    assignments,
    blockedApps,
    blockedAppModes,
    blockedSearchTerms,
    blockedSearchTermModes,
    blockedWebsites,
    blockedWebsiteModes,
    gateRule,
    penaltyAmountSats,
    penaltyRuntimeActive,
    strictLockUntil,
    strictLockScope,
    strictAddons,
    unlockedTargets,
  ]);
  const snapshotKey = useMemo(() => JSON.stringify(snapshot), [snapshot]);

  useEffect(() => {
    if (learningHydrated || useLearningStore.persist.hasHydrated()) {
      setLearningHydrated(true);
      return undefined;
    }

    return useLearningStore.persist.onFinishHydration(() => {
      setLearningHydrated(true);
    });
  }, [learningHydrated]);

  // Keep the native runtime on a single write path. The legacy granular
  // start/stop/update calls race with syncPolicies() because they mutate the
  // same prefs-backed state independently.
  useEffect(() => {
    if (!isNative || !enabled) return;
    if (!appHydrated || !learningHydrated) return;
    if (lastSyncedSnapshotKeyRef.current === snapshotKey) return;

    let cancelled = false;
    const hasMonitoringTargets = snapshot.targets.some(
      (target) => target.type === 'app' || target.type === 'search',
    );
    const hasWebsiteTargets = snapshot.targets.some((target) => target.type === 'website');
    const hasSearchTargets = snapshot.targets.some((target) => target.type === 'search');
    lastSyncedSnapshotKeyRef.current = snapshotKey;

    void syncPolicies(snapshot)
      .then(() => {
        if (cancelled) {
          return;
        }
        clearNativeRuntimeIssue('blockingService');
        clearNativeRuntimeIssue('websiteBlocking');
        clearNativeRuntimeIssue('searchTermSync');
        clearNativeRuntimeIssue('policySync');
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        const message = getNativeIssueMessage(error);
        console.warn('Native policy sync failed:', error);
        setNativeRuntimeIssue('policySync', message);

        if (hasMonitoringTargets) {
          setNativeRuntimeIssue('blockingService', message);
        } else {
          clearNativeRuntimeIssue('blockingService');
        }

        if (hasWebsiteTargets) {
          setNativeRuntimeIssue('websiteBlocking', message);
        } else {
          clearNativeRuntimeIssue('websiteBlocking');
        }

        if (hasSearchTargets) {
          setNativeRuntimeIssue('searchTermSync', message);
        } else {
          clearNativeRuntimeIssue('searchTermSync');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    clearNativeRuntimeIssue,
    appHydrated,
    enabled,
    getNativeIssueMessage,
    learningHydrated,
    setNativeRuntimeIssue,
    snapshot,
    snapshotKey,
  ]);
}
