import { useCallback } from 'react';
import { toast } from 'sonner';
import { buildDevicePolicySnapshot } from '@/lib/nativePolicy';
import { isPenaltyRuntimeActive } from '@/lib/penaltyRuntime';
import { showSuccessFeedback } from '@/lib/successFeedback';
import { useAppStore } from '@/store/useAppStore';
import { useLearningStore } from '@/store/useLearningStore';
import type { ModeId } from '@/modules/modes/modeTypes';
import { hasAccessibilityRuntimeReady } from '@/services/screenTimeNormalization';
import {
  getMonitoringStatus,
  isNative,
  recheckCurrentForegroundTarget,
  syncPolicies,
} from '@/services/screenTimeService';
import {
  isQuotaExceededError,
  waitForPersistStorageIdle,
} from '@/lib/persistStorage';
import { MAX_STRICT_LOCK_DURATION_HOURS } from '@/modules/modes/useModesActivationState';

const MODE_SAVE_HYDRATION_ERROR = 'Persisted stores did not finish hydrating before mode save.';

type UseModesSaveActionsOptions = {
  isGerman: boolean;
  selectedMode: ModeId;
  strictDurationTooLong: boolean;
  selectedModeUsesStrictWindow: boolean;
  strictAddonEnabledForSelectedMode: boolean;
  hasRequiredPermissions: boolean;
  selectedModeNeedsAssignedApp: boolean;
  selectedModeHasRequiredApp: boolean;
  needsPenaltyActivation: boolean;
  penaltySetupReady: boolean;
  penaltyReadyConfirmed: boolean;
  hasChanges: boolean;
  confirmText: string;
  confirmCode: string;
  setShowConfirmStep1: (open: boolean) => void;
  setShowConfirmStep2: (open: boolean) => void;
  setConfirmText: (value: string) => void;
  setIsSaving: (value: boolean) => void;
  setSaveErrorMessage: (message: string | null) => void;
  clearDraftSnapshot: () => void;
  persistModeChanges: () => void;
  activateStrictLock: () => void;
  activateStrictAddon: () => void;
  enablePenaltyMode: () => void;
  logModesDebug: (reason: string) => void;
  missingPermissionsMessage: string;
};

export function useModesSaveActions({
  isGerman,
  selectedMode,
  strictDurationTooLong,
  selectedModeUsesStrictWindow,
  strictAddonEnabledForSelectedMode,
  hasRequiredPermissions,
  selectedModeNeedsAssignedApp,
  selectedModeHasRequiredApp,
  needsPenaltyActivation,
  penaltySetupReady,
  penaltyReadyConfirmed,
  hasChanges,
  confirmText,
  confirmCode,
  setShowConfirmStep1,
  setShowConfirmStep2,
  setConfirmText,
  setIsSaving,
  setSaveErrorMessage,
  clearDraftSnapshot,
  persistModeChanges,
  activateStrictLock,
  activateStrictAddon,
  enablePenaltyMode,
  logModesDebug,
  missingPermissionsMessage,
}: UseModesSaveActionsOptions) {
  const syncCurrentNativePolicies = useCallback(async () => {
    if (!isNative) return;

    const appState = useAppStore.getState();
    const learningState = useLearningStore.getState();
    const snapshot = buildDevicePolicySnapshot({
      activeModes: appState.activeModes,
      gateRule: learningState.gateRule,
      blockedApps: appState.blockedApps,
      blockedAppModes: appState.blockedAppModes,
      blockedWebsites: appState.blockedWebsites,
      blockedWebsiteModes: appState.blockedWebsiteModes,
      blockedSearchTerms: appState.blockedSearchTerms,
      blockedSearchTermModes: appState.blockedSearchTermModes,
      assignments: learningState.assignments,
      unlockedTargets: appState.unlockedTargets,
      strictLockUntil: appState.strictLockUntil,
      strictLockScope: appState.strictLockScope,
      strictAddons: appState.strictAddons,
      penaltyRuntimeActive: isPenaltyRuntimeActive(appState),
      penaltyAmountSats: appState.penaltyAmountSats,
      accountabilityPartnerName: appState.accountabilityPartner?.name,
    });

    const expectsMonitoringTargets = snapshot.targets.some((target) => target.type === 'app' || target.type === 'search');
    const hasUnsyncedMonitoringDraft =
      snapshot.activeModes.length === 0
      && (snapshot.blockedPackages.length > 0 || snapshot.blockedSearchTerms.length > 0);

    if (hasUnsyncedMonitoringDraft) {
      throw new Error('Latest blocking draft did not produce active monitoring targets.');
    }

    try {
      await syncPolicies(snapshot);
    } catch (error) {
      if (!expectsMonitoringTargets) {
        throw error;
      }

      try {
        const monitoringStatus = await getMonitoringStatus();
        if (
          !monitoringStatus.accessibilityPermission
          || !hasAccessibilityRuntimeReady(monitoringStatus)
          || !monitoringStatus.monitoringActive
        ) {
          throw error;
        }
      } catch {
        throw error;
      }
    }

    if (!expectsMonitoringTargets) {
      return;
    }

    const monitoringStatus = await getMonitoringStatus();
    if (
      !monitoringStatus.accessibilityPermission
      || !hasAccessibilityRuntimeReady(monitoringStatus)
      || !monitoringStatus.monitoringActive
    ) {
      throw new Error('Android app blocking is not active after sync.');
    }
  }, []);

  const ensurePersistedStoresHydrated = useCallback(async () => {
    const pendingHydrations: Array<Promise<unknown>> = [];

    if (!useAppStore.persist.hasHydrated()) {
      pendingHydrations.push(Promise.resolve(useAppStore.persist.rehydrate()));
    }

    if (!useLearningStore.persist.hasHydrated()) {
      pendingHydrations.push(Promise.resolve(useLearningStore.persist.rehydrate()));
    }

    if (pendingHydrations.length === 0) {
      return;
    }

    await Promise.race([
      Promise.all(pendingHydrations),
      new Promise<never>((_, reject) => {
        window.setTimeout(() => reject(new Error(MODE_SAVE_HYDRATION_ERROR)), 10000);
      }),
    ]);
  }, []);

  const waitForModePersistence = useCallback(async () => {
    await Promise.all([
      waitForPersistStorageIdle('mindful-usage-storage'),
      waitForPersistStorageIdle('blearn-learning-storage'),
    ]);
  }, []);

  const markModeSaveSuccess = useCallback((label?: string) => {
    clearDraftSnapshot();
    showSuccessFeedback({
      eyebrow: isGerman ? 'Modi' : 'Modes',
      title: label || (isGerman ? 'Gespeichert' : 'Saved'),
      description: isGerman
        ? 'Deine Fokusregeln sind jetzt aktiv.'
        : 'Your focus rules are now active.',
    });
  }, [clearDraftSnapshot, isGerman]);

  const getModeSaveErrorMessage = useCallback(() => (
    isGerman
      ? 'Die Aenderungen wurden lokal uebernommen, aber der Schutz konnte noch nicht mit Android synchronisiert werden.'
      : 'The changes were saved locally, but protection could not yet be synced with Android.'
  ), [isGerman]);

  const getQuotaStorageErrorMessage = useCallback(() => (
    isGerman
      ? 'Der lokale Learn-Speicher war voll. Ich habe den Speicherpfad jetzt auf IndexedDB umgestellt; bitte speichere den Modus noch einmal.'
      : 'Local Learn storage was full. The app now uses IndexedDB for this data; save the mode once more.'
  ), [isGerman]);

  const getHydrationProtectionErrorMessage = useCallback(() => (
    isGerman
      ? 'Die Vokabeldaten werden noch geladen. Ich habe absichtlich nichts gespeichert, damit dein Lernstand nicht überschrieben wird. Bitte versuche es gleich noch einmal.'
      : 'Learning data is still loading. Nothing was saved on purpose so your progress cannot be overwritten. Please try again in a moment.'
  ), [isGerman]);

  const handleActivate = useCallback(async () => {
    if (!hasRequiredPermissions) {
      logModesDebug('save-skip-missing-permissions');
      toast.error(missingPermissionsMessage);
      return;
    }
    if (selectedModeUsesStrictWindow && strictDurationTooLong) {
      logModesDebug('save-skip-strict-window-too-long');
      toast.error(
        isGerman
          ? `Waehle fuer den Strikt-Zusatz ein kuerzeres Zeitfenster. Maximal ${MAX_STRICT_LOCK_DURATION_HOURS} Stunden sind erlaubt.`
          : `Choose a shorter window for the strict add-on. Maximum ${MAX_STRICT_LOCK_DURATION_HOURS} hours are allowed.`,
      );
      return;
    }
    if (selectedMode === 'lock') {
      logModesDebug('save-lock-confirmation');
      if (!strictDurationTooLong) setShowConfirmStep1(true);
      return;
    }
    if (selectedModeNeedsAssignedApp && !selectedModeHasRequiredApp) {
      logModesDebug('save-skip-missing-app');
      toast.error(isGerman ? 'Waehle zuerst mindestens eine App fuer diesen Modus aus.' : 'Select at least one app for this mode first.');
      return;
    }
    if (needsPenaltyActivation && (!penaltySetupReady || !penaltyReadyConfirmed)) {
      logModesDebug('save-skip-penalty-not-ready');
      return;
    }
    if (!hasChanges) {
      logModesDebug('save-skip-no-changes');
      return;
    }
    logModesDebug('save-start');
    setSaveErrorMessage(null);
    setIsSaving(true);

    try {
      logModesDebug('save-hydration-start');
      await ensurePersistedStoresHydrated();
      logModesDebug('save-hydration-done');

      persistModeChanges();
      if (needsPenaltyActivation) {
        enablePenaltyMode();
      }
      if (strictAddonEnabledForSelectedMode) {
        activateStrictAddon();
      }

      const savePipeline = async () => {
        logModesDebug('save-persist-start');
        await waitForModePersistence();
        logModesDebug('save-persist-done');

        logModesDebug('save-sync-start');
        await syncCurrentNativePolicies();
        logModesDebug('save-sync-done');

        if (selectedMode === 'strict') {
          logModesDebug('save-recheck-start');
          await recheckCurrentForegroundTarget();
          logModesDebug('save-recheck-done');
        }
      };

      await Promise.race([
        savePipeline(),
        new Promise<never>((_, reject) => {
          window.setTimeout(() => reject(new Error('Mode save pipeline timed out after 5 s.')), 5000);
        }),
      ]);

      logModesDebug('save-complete');
      markModeSaveSuccess();
    } catch (error) {
      const nextMessage = error instanceof Error && error.message === MODE_SAVE_HYDRATION_ERROR
        ? getHydrationProtectionErrorMessage()
        : isQuotaExceededError(error)
          ? getQuotaStorageErrorMessage()
          : getModeSaveErrorMessage();
      console.warn('Mode save follow-up failed:', error);
      setSaveErrorMessage(nextMessage);
      toast.error(nextMessage);
    } finally {
      setIsSaving(false);
    }
  }, [
    enablePenaltyMode,
    activateStrictAddon,
    ensurePersistedStoresHydrated,
    getHydrationProtectionErrorMessage,
    getModeSaveErrorMessage,
    getQuotaStorageErrorMessage,
    hasChanges,
    hasRequiredPermissions,
    isGerman,
    logModesDebug,
    markModeSaveSuccess,
    missingPermissionsMessage,
    needsPenaltyActivation,
    penaltyReadyConfirmed,
    penaltySetupReady,
    persistModeChanges,
    selectedMode,
    selectedModeHasRequiredApp,
    selectedModeNeedsAssignedApp,
    setIsSaving,
    setSaveErrorMessage,
    setShowConfirmStep1,
    selectedModeUsesStrictWindow,
    strictAddonEnabledForSelectedMode,
    strictDurationTooLong,
    syncCurrentNativePolicies,
    waitForModePersistence,
  ]);

  const handleConfirmStep2 = useCallback(async () => {
    if (confirmText !== confirmCode) return;
    if (!hasRequiredPermissions) {
      toast.error(missingPermissionsMessage);
      return;
    }
    setSaveErrorMessage(null);
    setIsSaving(true);
    setShowConfirmStep2(false);
    setConfirmText('');
    try {
      logModesDebug('lock-hydration-start');
      await ensurePersistedStoresHydrated();
      logModesDebug('lock-hydration-done');

      persistModeChanges();
      activateStrictLock();

      const savePipeline = async () => {
        logModesDebug('lock-persist-start');
        await waitForModePersistence();
        logModesDebug('lock-persist-done');

        logModesDebug('lock-sync-start');
        await syncCurrentNativePolicies();
        logModesDebug('lock-sync-done');
      };

      await Promise.race([
        savePipeline(),
        new Promise<never>((_, reject) => {
          window.setTimeout(() => reject(new Error('Strict lock save pipeline timed out after 5 s.')), 5000);
        }),
      ]);

      logModesDebug('lock-save-complete');
      markModeSaveSuccess(isGerman ? 'Strict Lock aktiv' : 'Strict Lock active');
    } catch (error) {
      const nextMessage = error instanceof Error && error.message === MODE_SAVE_HYDRATION_ERROR
        ? getHydrationProtectionErrorMessage()
        : isQuotaExceededError(error)
          ? getQuotaStorageErrorMessage()
          : getModeSaveErrorMessage();
      console.warn('Strict lock sync failed:', error);
      setSaveErrorMessage(nextMessage);
      toast.error(nextMessage);
    } finally {
      setIsSaving(false);
    }
  }, [
    activateStrictLock,
    confirmCode,
    confirmText,
    getHydrationProtectionErrorMessage,
    getModeSaveErrorMessage,
    getQuotaStorageErrorMessage,
    hasRequiredPermissions,
    isGerman,
    logModesDebug,
    markModeSaveSuccess,
    missingPermissionsMessage,
    persistModeChanges,
    setConfirmText,
    setIsSaving,
    setSaveErrorMessage,
    setShowConfirmStep2,
    syncCurrentNativePolicies,
    ensurePersistedStoresHydrated,
    waitForModePersistence,
  ]);

  return {
    handleActivate,
    handleConfirmStep2,
  };
}
