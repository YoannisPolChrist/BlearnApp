import { useCallback, useEffect, useMemo, useState } from 'react';
import { Globe2, Shield, Sparkles, Wand2 } from 'lucide-react';
import type { SetupStep } from '@/components/setup/SetupNarrativeDialog';
import {
  getPermissionCheckpointButtonLabel,
  getPermissionCheckpointState,
  getPermissionCheckpointStatusLabel,
  getPermissionCheckpointTone,
  type PermissionCheckpointKey,
} from '@/lib/view-models/settings';
import {
  EMPTY_MONITORING_STATUS,
  EMPTY_PERMISSION_STATUS,
  hasAccessibilityRuntimeReady,
} from '@/services/screenTimeNormalization';
import {
  checkPermissions,
  getMonitoringStatus,
  isNative,
  requestAccessibilityPermission,
  requestOverlayPermission,
  requestUsagePermission,
  requestWebsiteBlockingPermission,
  startWebsiteBlocking,
} from '@/services/screenTimeService';
import { getSettingsRuntimeErrorMessage, PERMISSIONS_GUIDE_STORAGE_KEY } from './settingsRuntime';

type Translate = (key: string, vars?: Record<string, unknown>) => string;

interface UseSettingsPermissionsOptions {
  blockedWebsites: string[];
  isGerman: boolean;
  onRuntimeResume?: () => void;
  t: Translate;
}

export function useSettingsPermissions({
  blockedWebsites,
  isGerman,
  onRuntimeResume,
  t,
}: UseSettingsPermissionsOptions) {
  const [permissionStatus, setPermissionStatus] = useState(EMPTY_PERMISSION_STATUS);
  const [monitoringStatus, setMonitoringStatus] = useState(EMPTY_MONITORING_STATUS);
  const [permissionErrorMessage, setPermissionErrorMessage] = useState<string | null>(null);
  const [permissionActionKey, setPermissionActionKey] = useState<PermissionCheckpointKey | null>(null);
  const [permissionActionStartedAt, setPermissionActionStartedAt] = useState(0);
  const [showPermissionGuide, setShowPermissionGuide] = useState(false);
  const [permissionGuideSeen, setPermissionGuideSeen] = useState(false);
  const [permissionGuideHydrated, setPermissionGuideHydrated] = useState(false);
  const [permissionStatusReady, setPermissionStatusReady] = useState(!isNative);

  const refreshPermissions = useCallback(async () => {
    try {
      setPermissionErrorMessage(null);
      const [nextStatus, nextMonitoringStatus] = await Promise.all([
        checkPermissions(),
        getMonitoringStatus(),
      ]);
      setPermissionStatus(nextStatus);
      setMonitoringStatus(nextMonitoringStatus);

      if (
        permissionActionKey === 'usage' && nextStatus.usageStats ||
        permissionActionKey === 'overlay' && nextStatus.overlay ||
        permissionActionKey === 'accessibility' && nextStatus.accessibility && hasAccessibilityRuntimeReady(nextMonitoringStatus) ||
        permissionActionKey === 'websiteBlocking' && nextStatus.vpnPermission
      ) {
        setPermissionActionKey(null);
        setPermissionActionStartedAt(0);
      }
    } catch (error) {
      setPermissionStatus(EMPTY_PERMISSION_STATUS);
      setMonitoringStatus(EMPTY_MONITORING_STATUS);
      setPermissionErrorMessage(getSettingsRuntimeErrorMessage(error));
    } finally {
      setPermissionStatusReady(true);
    }
  }, [permissionActionKey]);

  const runPermissionAction = useCallback(async (actionKey: PermissionCheckpointKey, action: () => Promise<void>) => {
    try {
      setPermissionErrorMessage(null);
      setPermissionActionKey(actionKey);
      setPermissionActionStartedAt(Date.now());
      await action();
      window.setTimeout(() => {
        void refreshPermissions();
      }, 700);
    } catch (error) {
      setPermissionActionKey(null);
      setPermissionActionStartedAt(0);
      setPermissionErrorMessage(getSettingsRuntimeErrorMessage(error));
    }
  }, [refreshPermissions]);

  const allPermissionsGranted =
    permissionStatus.usageStats
    && permissionStatus.overlay
    && permissionStatus.accessibility
    && hasAccessibilityRuntimeReady(monitoringStatus);
  const showPermissionsSection = Boolean(permissionErrorMessage) || !allPermissionsGranted || permissionStatus.websiteBlockingAvailable;
  const shouldOfferPermissionGuide = permissionGuideHydrated && permissionStatusReady && !permissionGuideSeen && !allPermissionsGranted;
  const showPermissionGuideCta = shouldOfferPermissionGuide;

  const websiteBlockingStatusLabel =
    !permissionStatus.websiteBlockingAvailable
      ? 'Aus'
      : permissionStatus.websiteBlockingActive
        ? 'Aktiv'
        : permissionStatus.vpnPermission
          ? 'Bereit'
          : 'Aus';
  const isPermissionPrompting = (key: PermissionCheckpointKey) =>
    permissionActionKey === key && Date.now() - permissionActionStartedAt < 20_000;
  const usageCheckpointState = getPermissionCheckpointState({
    key: 'usage',
    permissions: permissionStatus,
    monitoringStatus,
    prompting: isPermissionPrompting('usage'),
  });
  const overlayCheckpointState = getPermissionCheckpointState({
    key: 'overlay',
    permissions: permissionStatus,
    monitoringStatus,
    prompting: isPermissionPrompting('overlay'),
  });
  const accessibilityCheckpointState = getPermissionCheckpointState({
    key: 'accessibility',
    permissions: permissionStatus,
    monitoringStatus,
    prompting: isPermissionPrompting('accessibility'),
  });
  const websiteBlockingCheckpointState = getPermissionCheckpointState({
    key: 'websiteBlocking',
    permissions: permissionStatus,
    monitoringStatus,
    blockedWebsitesCount: blockedWebsites.length,
    prompting: isPermissionPrompting('websiteBlocking'),
  });

  useEffect(() => {
    void refreshPermissions();
  }, [refreshPermissions]);

  useEffect(() => {
    if (!isNative) return;

    const handleResumeRefresh = () => {
      void refreshPermissions();
      onRuntimeResume?.();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleResumeRefresh();
      }
    };

    window.addEventListener('focus', handleResumeRefresh);
    window.addEventListener('pageshow', handleResumeRefresh);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleResumeRefresh);
      window.removeEventListener('pageshow', handleResumeRefresh);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [onRuntimeResume, refreshPermissions]);

  useEffect(() => {
    if (!permissionActionKey) return;

    const retryInterval = window.setInterval(() => {
      void refreshPermissions();
    }, 1200);
    const actionTimeout = window.setTimeout(() => {
      setPermissionActionKey(null);
      setPermissionActionStartedAt(0);
    }, 20_000);

    return () => {
      window.clearInterval(retryInterval);
      window.clearTimeout(actionTimeout);
    };
  }, [permissionActionKey, refreshPermissions]);

  useEffect(() => {
    setPermissionGuideSeen(window.localStorage.getItem(PERMISSIONS_GUIDE_STORAGE_KEY) === 'true');
    setPermissionGuideHydrated(true);
  }, []);

  useEffect(() => {
    if (!isNative) return;
    if (!shouldOfferPermissionGuide) return;
    setShowPermissionGuide(true);
  }, [shouldOfferPermissionGuide]);

  const permissionSetupSteps = useMemo<SetupStep[]>(
    () => [
      {
        id: 'usage',
        eyebrow: '1',
        title: 'Nutzungszugriff',
        description: 'Erkennt, welche App oder welcher Browser gerade aktiv ist.',
        bullets: [
          'Basis für Trigger und App-Erkennung.',
          'Ohne ihn greift die Sperrlogik unzuverlässig.',
        ],
        actionLabel: 'Nutzungszugriff öffnen',
        actionStateLabel: 'Nutzungszugriff erteilt',
        completed: usageCheckpointState === 'granted',
        icon: Shield,
        onAction: async () => {
          await runPermissionAction('usage', requestUsagePermission);
        },
      },
      {
        id: 'overlay',
        eyebrow: '2',
        title: 'Overlay freigeben',
        description: 'Zeigt Sperrfenster und Learn-Gates über anderen Apps.',
        bullets: [
          'Macht Interventionen direkt sichtbar.',
          'Ist für Android-Overlays nötig.',
        ],
        actionLabel: 'Overlay freigeben',
        actionStateLabel: 'Overlay erteilt',
        completed: overlayCheckpointState === 'granted',
        icon: Sparkles,
        onAction: async () => {
          await runPermissionAction('overlay', requestOverlayPermission);
        },
      },
      {
        id: 'accessibility',
        eyebrow: '3',
        title: 'Bedienungshilfe aktivieren',
        description: 'Hilft bei Suchfeldern und beim erneuten Gate nach Abbruch.',
        bullets: [
          'Wichtig für Text-Trigger im Browser.',
          'Ergänzt die native Sperrlogik.',
        ],
        actionLabel: 'Bedienungshilfe öffnen',
        actionStateLabel: 'Bedienungshilfe erteilt',
        completed: accessibilityCheckpointState === 'granted',
        icon: Wand2,
        onAction: async () => {
          await runPermissionAction('accessibility', requestAccessibilityPermission);
        },
      },
      {
        id: 'websiteBlocking',
        eyebrow: '4',
        title: 'Website-Schutz freigeben',
        description: 'Aktiviert Domain-Schutz per lokalem VPN.',
        bullets: [
          'Nur für Websites, nicht für App-Blocking.',
          'Bleibt danach als eigener Status sichtbar.',
        ],
        actionLabel: permissionStatus.vpnPermission ? 'Website-Schutz prüfen' : 'Website-Schutz freigeben',
        actionStateLabel: permissionStatus.websiteBlockingActive ? 'Website-Schutz aktiv' : 'Website-Schutz bereit',
        completed: websiteBlockingCheckpointState === 'granted',
        icon: Globe2,
        onAction: async () => {
          await runPermissionAction('websiteBlocking', async () => {
            if (!permissionStatus.vpnPermission) {
              await requestWebsiteBlockingPermission();
            } else if (blockedWebsites.length > 0 && !permissionStatus.websiteBlockingActive) {
              await startWebsiteBlocking(blockedWebsites);
            }
          });
        },
      },
    ],
    [
      accessibilityCheckpointState,
      blockedWebsites,
      overlayCheckpointState,
      permissionStatus,
      runPermissionAction,
      usageCheckpointState,
      websiteBlockingCheckpointState,
    ],
  );

  const permissionCards = [
    {
      key: 'usage',
      label: t('settings.permissions.usage'),
      description: t('settings.permissions.usageDescription'),
      granted: usageCheckpointState === 'granted',
      statusLabel: getPermissionCheckpointStatusLabel(usageCheckpointState),
      statusTone: getPermissionCheckpointTone(usageCheckpointState),
      buttonLabel: getPermissionCheckpointButtonLabel(usageCheckpointState),
      action: async () => {
        await runPermissionAction('usage', requestUsagePermission);
      },
    },
    {
      key: 'overlay',
      label: t('settings.permissions.overlay'),
      description: t('settings.permissions.overlayDescription'),
      granted: overlayCheckpointState === 'granted',
      statusLabel: getPermissionCheckpointStatusLabel(overlayCheckpointState),
      statusTone: getPermissionCheckpointTone(overlayCheckpointState),
      buttonLabel: getPermissionCheckpointButtonLabel(overlayCheckpointState),
      action: async () => {
        await runPermissionAction('overlay', requestOverlayPermission);
      },
    },
    {
      key: 'accessibility',
      label: t('settings.permissions.accessibility'),
      description: t('settings.permissions.accessibilityDescription'),
      granted: accessibilityCheckpointState === 'granted',
      statusLabel: getPermissionCheckpointStatusLabel(accessibilityCheckpointState),
      statusTone: getPermissionCheckpointTone(accessibilityCheckpointState),
      buttonLabel: getPermissionCheckpointButtonLabel(accessibilityCheckpointState),
      action: async () => {
        await runPermissionAction('accessibility', requestAccessibilityPermission);
      },
    },
    {
      key: 'websiteBlocking',
      label: 'Website-Schutz',
      description:
        blockedWebsites.length > 0
          ? `${blockedWebsites.length} Website-Regeln warten auf den Android-Webschutz.`
          : 'Aktiviert den lokalen VPN-Webschutz für Website-Regeln und Domain-Interventionen.',
      granted: websiteBlockingCheckpointState === 'granted',
      statusLabel:
        websiteBlockingCheckpointState === 'granted'
          ? websiteBlockingStatusLabel
          : getPermissionCheckpointStatusLabel(websiteBlockingCheckpointState),
      statusTone: getPermissionCheckpointTone(websiteBlockingCheckpointState),
      buttonLabel: permissionStatus.vpnPermission
        ? permissionStatus.websiteBlockingActive
          ? 'Prüfen'
          : blockedWebsites.length > 0
            ? 'Aktivieren'
            : 'Bereit'
        : 'Freigeben',
      action: async () => {
        await runPermissionAction('websiteBlocking', async () => {
          if (!permissionStatus.vpnPermission) {
            await requestWebsiteBlockingPermission();
          } else if (blockedWebsites.length > 0 && !permissionStatus.websiteBlockingActive) {
            await startWebsiteBlocking(blockedWebsites);
          }
        });
      },
    },
  ] as const;
  const grantedPermissionCount = permissionCards.filter((card) => card.granted).length;
  const permissionCardCount = permissionCards.length;
  const permissionsNeedAttention = Boolean(permissionErrorMessage) || grantedPermissionCount < permissionCardCount;
  const permissionSummaryLabel = permissionErrorMessage
    ? (isGerman ? 'Setup pruefen' : 'Check setup')
    : permissionsNeedAttention
      ? `${grantedPermissionCount}/${permissionCardCount} ${isGerman ? 'aktiv' : 'active'}`
      : (isGerman ? 'Alles aktiv' : 'All active');

  const markPermissionGuideSeen = () => {
    window.localStorage.setItem(PERMISSIONS_GUIDE_STORAGE_KEY, 'true');
    setPermissionGuideSeen(true);
  };

  return {
    allPermissionsGranted,
    monitoringStatus,
    permissionCards,
    permissionErrorMessage,
    permissionSetupSteps,
    permissionStatus,
    permissionSummaryLabel,
    permissionsNeedAttention,
    refreshPermissions,
    setShowPermissionGuide,
    showPermissionGuide,
    showPermissionGuideCta,
    showPermissionsSection,
    markPermissionGuideSeen,
  };
}

export type SettingsPermissionCard = ReturnType<typeof useSettingsPermissions>['permissionCards'][number];
