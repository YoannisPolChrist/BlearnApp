import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Globe2, Shield, Sparkles, Wand2, type LucideIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AppGuidedTourOverlay from '@/components/setup/AppGuidedTourOverlay';
import { useAppTour } from '@/components/setup/appTourContext';
import FirstLaunchAnimation from '@/components/setup/FirstLaunchAnimation';
import SetupNarrativeDialog, { type SetupStep } from '@/components/setup/SetupNarrativeDialog';
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
  isUnsupportedPlatformError,
  requestAccessibilityPermission,
  requestOverlayPermission,
  requestUsagePermission,
  requestWebsiteBlockingPermission,
} from '@/services/screenTimeService';

type IntroPhase = 'product-tour' | 'permissions';

function getIntroRuntimeErrorMessage(error: unknown) {
  return isUnsupportedPlatformError(error)
    ? 'Diese Einrichtung ist nur in der nativen Android-App verfügbar.'
    : 'Berechtigungen nicht prüfbar – bitte erneut versuchen.';
}

function StatusBadge({
  label,
  tone,
}: {
  label: string;
  tone: 'success' | 'primary' | 'warning' | 'muted';
}) {
  const toneClasses =
    tone === 'success'
      ? 'border-success/20 bg-success/10 text-success'
      : tone === 'primary'
        ? 'border-primary/20 bg-primary/10 text-primary'
        : tone === 'warning'
          ? 'border-warning/20 bg-warning/10 text-warning'
          : 'border-border/70 bg-card/80 text-muted-foreground';

  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold ${toneClasses}`}>
      {label}
    </span>
  );
}

function PermissionStatusCard({
  title,
  description,
  statusLabel,
  statusTone,
  hint,
  errorMessage,
}: {
  title: string;
  description: string;
  statusLabel: string;
  statusTone: 'success' | 'primary' | 'warning' | 'muted';
  hint: string;
  errorMessage?: string | null;
}) {
  return (
    <div className="rounded-[1.6rem] border border-border/70 bg-card/80 p-4 shadow-[0_14px_32px_hsl(var(--foreground)/0.05)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-black text-foreground">{title}</p>
          <p className="mt-1 text-sm leading-6 text-foreground/72">{description}</p>
        </div>
        <StatusBadge label={statusLabel} tone={statusTone} />
      </div>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{hint}</p>
      {errorMessage ? (
        <p className="mt-3 rounded-2xl border border-warning/20 bg-warning/10 px-3 py-2 text-sm text-warning">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}

export default function AppIntroDialog() {
  const {
    isOpen,
    isFirstLaunchAnimationActive,
    completeFirstLaunchAnimation,
    closeTour,
    currentStep,
    currentStepIndex,
    setCurrentStepIndex,
    totalSteps,
  } = useAppTour();
  const navigate = useNavigate();
  const [phase, setPhase] = useState<IntroPhase>('product-tour');
  const [permissionStatus, setPermissionStatus] = useState(EMPTY_PERMISSION_STATUS);
  const [monitoringStatus, setMonitoringStatus] = useState(EMPTY_MONITORING_STATUS);
  const [permissionErrorMessage, setPermissionErrorMessage] = useState<string | null>(null);
  const [permissionActionKey, setPermissionActionKey] = useState<PermissionCheckpointKey | null>(null);
  const [permissionActionStartedAt, setPermissionActionStartedAt] = useState(0);
  const [permissionStatusReady, setPermissionStatusReady] = useState(!isNative);

  const refreshPermissions = useCallback(async () => {
    if (!isNative) {
      setPermissionStatusReady(true);
      return;
    }

    try {
      setPermissionErrorMessage(null);
      const [nextStatus, nextMonitoringStatus] = await Promise.all([
        checkPermissions(),
        getMonitoringStatus(),
      ]);
      setPermissionStatus(nextStatus);
      setMonitoringStatus(nextMonitoringStatus);

      if (
        (permissionActionKey === 'usage' && nextStatus.usageStats) ||
        (permissionActionKey === 'overlay' && nextStatus.overlay) ||
        (permissionActionKey === 'accessibility' &&
          nextStatus.accessibility &&
          hasAccessibilityRuntimeReady(nextMonitoringStatus)) ||
        (permissionActionKey === 'websiteBlocking' && nextStatus.vpnPermission)
      ) {
        setPermissionActionKey(null);
        setPermissionActionStartedAt(0);
      }
    } catch (error) {
      setPermissionStatus(EMPTY_PERMISSION_STATUS);
      setMonitoringStatus(EMPTY_MONITORING_STATUS);
      setPermissionErrorMessage(getIntroRuntimeErrorMessage(error));
    } finally {
      setPermissionStatusReady(true);
    }
  }, [permissionActionKey]);

  const runPermissionAction = useCallback(
    async (actionKey: PermissionCheckpointKey, action: () => Promise<void>) => {
      try {
        setPermissionErrorMessage(null);
        setPermissionActionKey(actionKey);
        setPermissionActionStartedAt(Date.now());
        await action();
        window.setTimeout(() => void refreshPermissions(), 700);
      } catch (error) {
        setPermissionActionKey(null);
        setPermissionActionStartedAt(0);
        setPermissionErrorMessage(getIntroRuntimeErrorMessage(error));
      }
    },
    [refreshPermissions],
  );

  const isPermissionPrompting = useCallback(
    (key: PermissionCheckpointKey) =>
      permissionActionKey === key && Date.now() - permissionActionStartedAt < 20_000,
    [permissionActionKey, permissionActionStartedAt],
  );

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
  const websiteCheckpointState = getPermissionCheckpointState({
    key: 'websiteBlocking',
    permissions: permissionStatus,
    monitoringStatus,
    prompting: isPermissionPrompting('websiteBlocking'),
  });

  const allPermissionsGranted =
    permissionStatus.usageStats &&
    permissionStatus.overlay &&
    permissionStatus.accessibility &&
    hasAccessibilityRuntimeReady(monitoringStatus);
  const canFinish = !isNative || (permissionStatusReady && allPermissionsGranted);

  useEffect(() => {
    if (!isOpen) {
      setPhase('product-tour');
      setPermissionActionKey(null);
      setPermissionActionStartedAt(0);
      setPermissionErrorMessage(null);
      setPermissionStatusReady(!isNative);
      return;
    }

    void refreshPermissions();
  }, [isOpen, refreshPermissions]);

  useEffect(() => {
    if (!isOpen || !isNative) return;

    const refreshOnReturn = () => void refreshPermissions();
    const refreshOnVisible = () => {
      if (document.visibilityState === 'visible') refreshOnReturn();
    };

    window.addEventListener('focus', refreshOnReturn);
    window.addEventListener('pageshow', refreshOnReturn);
    document.addEventListener('visibilitychange', refreshOnVisible);
    return () => {
      window.removeEventListener('focus', refreshOnReturn);
      window.removeEventListener('pageshow', refreshOnReturn);
      document.removeEventListener('visibilitychange', refreshOnVisible);
    };
  }, [isOpen, refreshPermissions]);

  useEffect(() => {
    if (!isOpen || !permissionActionKey) return;

    const retryInterval = window.setInterval(() => void refreshPermissions(), 1200);
    const actionTimeout = window.setTimeout(() => {
      setPermissionActionKey(null);
      setPermissionActionStartedAt(0);
    }, 20_000);
    return () => {
      window.clearInterval(retryInterval);
      window.clearTimeout(actionTimeout);
    };
  }, [isOpen, permissionActionKey, refreshPermissions]);

  const buildPermissionStep = useCallback(
    (options: {
      id: PermissionCheckpointKey;
      eyebrow: string;
      title: string;
      description: string;
      hint: string;
      icon: LucideIcon;
      completed: boolean;
      checkpointState: ReturnType<typeof getPermissionCheckpointState>;
      actionLabel?: string;
      actionStateLabel?: string;
      onAction?: () => Promise<void>;
    }): SetupStep => {
      const statusLabel = !isNative
        ? 'Nur in Android'
        : getPermissionCheckpointStatusLabel(options.checkpointState);
      const statusTone = !isNative
        ? 'muted'
        : getPermissionCheckpointTone(options.checkpointState);
      const content: ReactNode = (
        <PermissionStatusCard
          title={options.title}
          description={options.description}
          statusLabel={statusLabel}
          statusTone={statusTone}
          hint={!isNative ? 'Web-Vorschau: Android öffnet diese Einstellung direkt.' : options.hint}
          errorMessage={permissionErrorMessage}
        />
      );

      return {
        id: options.id,
        eyebrow: options.eyebrow,
        title: options.title,
        description: options.description,
        actionLabel: !isNative ? undefined : options.actionLabel,
        actionStateLabel: !isNative ? undefined : options.actionStateLabel,
        completed: !isNative || options.completed,
        icon: options.icon,
        onAction: !isNative ? undefined : options.onAction,
        content,
      };
    },
    [permissionErrorMessage],
  );

  const permissionSteps = useMemo<SetupStep[]>(
    () => [
      buildPermissionStep({
        id: 'usage',
        eyebrow: '1 von 4',
        title: 'Nutzungszugriff freigeben',
        description: 'Damit erkennt Blearn, welche App gerade geöffnet ist.',
        hint: 'Nötig, damit Blearn deine gewählten Ablenkungs-Apps erkennen kann.',
        icon: Shield,
        completed: usageCheckpointState === 'granted',
        checkpointState: usageCheckpointState,
        actionLabel: 'Nutzungszugriff öffnen',
        actionStateLabel: 'Nutzungszugriff erteilt',
        onAction: async () => runPermissionAction('usage', requestUsagePermission),
      }),
      buildPermissionStep({
        id: 'overlay',
        eyebrow: '2 von 4',
        title: 'Overlay freigeben',
        description: 'Damit kann Blearn den bewussten Unterbrechungs-Flow über anderen Apps anzeigen.',
        hint: 'Nötig, damit Blearn dich im entscheidenden Moment zuverlässig erreichen kann.',
        icon: Sparkles,
        completed: overlayCheckpointState === 'granted',
        checkpointState: overlayCheckpointState,
        actionLabel: 'Overlay freigeben',
        actionStateLabel: 'Overlay erteilt',
        onAction: async () => runPermissionAction('overlay', requestOverlayPermission),
      }),
      buildPermissionStep({
        id: 'accessibility',
        eyebrow: '3 von 4',
        title: 'Bedienungshilfe aktivieren',
        description: 'Damit der Android-Blockierpfad auch bei Browser- und Suchfeld-Tricks zuverlässig funktioniert.',
        hint: 'Blearn prüft nach deiner Rückkehr automatisch, ob der Dienst wirklich bereit ist.',
        icon: Wand2,
        completed: accessibilityCheckpointState === 'granted',
        checkpointState: accessibilityCheckpointState,
        actionLabel: 'Bedienungshilfe öffnen',
        actionStateLabel: 'Bedienungshilfe erteilt',
        onAction: async () => runPermissionAction('accessibility', requestAccessibilityPermission),
      }),
      buildPermissionStep({
        id: 'websiteBlocking',
        eyebrow: 'Optional',
        title: 'Webschutz freigeben',
        description: 'Damit kann Blearn deine Website-Regeln über einen lokalen Android-VPN-Schutz umsetzen.',
        hint: permissionStatus.websiteBlockingAvailable
          ? 'Optional: Aktiviere ihn jetzt, wenn Blearn auch Websites schützen soll.'
          : 'Auf diesem Gerät ist Webschutz nicht verfügbar. Der App-Schutz funktioniert trotzdem.',
        icon: Globe2,
        completed: !isNative || websiteCheckpointState === 'granted',
        checkpointState: websiteCheckpointState,
        actionLabel: permissionStatus.websiteBlockingAvailable ? 'Webschutz freigeben' : undefined,
        actionStateLabel: permissionStatus.websiteBlockingAvailable ? 'Webschutz bereit' : undefined,
        onAction: permissionStatus.websiteBlockingAvailable
          ? async () => runPermissionAction('websiteBlocking', requestWebsiteBlockingPermission)
          : undefined,
      }),
    ],
    [
      accessibilityCheckpointState,
      buildPermissionStep,
      overlayCheckpointState,
      permissionStatus.websiteBlockingAvailable,
      runPermissionAction,
      usageCheckpointState,
      websiteCheckpointState,
    ],
  );

  const beginPermissionSetup = () => {
    navigate('/settings', { replace: true });
    setPhase('permissions');
  };

  const finishSetup = () => {
    closeTour();
    navigate('/', { replace: true });
  };

  if (isFirstLaunchAnimationActive) {
    return <FirstLaunchAnimation active onComplete={completeFirstLaunchAnimation} />;
  }

  if (!isOpen || !currentStep) return null;

  if (phase === 'product-tour') {
    return (
      <AppGuidedTourOverlay
        step={currentStep}
        stepIndex={currentStepIndex}
        totalSteps={totalSteps}
        onStepChange={setCurrentStepIndex}
        onComplete={beginPermissionSetup}
        onSkip={beginPermissionSetup}
      />
    );
  }

  return (
    <SetupNarrativeDialog
      open={isOpen}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) closeTour();
      }}
      title="Jetzt machen wir deinen Schutz bereit"
      description="Die Rechte kommen erst jetzt – jeweils mit einer klaren Erklärung, wofür sie gebraucht werden."
      steps={permissionSteps}
      finishLabel={canFinish ? 'Loslegen' : 'Rechte fehlen noch'}
      onFinish={finishSetup}
      lockUntilFinished={isNative && !allPermissionsGranted}
      canFinish={canFinish}
    />
  );
}
