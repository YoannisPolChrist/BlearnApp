import { useCallback, useEffect, useMemo, useState } from 'react';
import { Brain, Shield, Sparkles, Wand2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppTour } from '@/components/setup/appTourContext';
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
} from '@/services/screenTimeService';

function getIntroRuntimeErrorMessage(error: unknown) {
  if (isUnsupportedPlatformError(error)) {
    return 'Diese Einrichtung ist nur in der nativen Android-App verfügbar.';
  }

  return 'Die Android-Berechtigungen konnten gerade nicht geprüft werden. Versuche es bitte erneut.';
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

function IntroFeatureGrid() {
  const items = [
    {
      title: 'Apps erkennen',
      description: 'Blearn merkt, wann du in Ablenkungen wechselst.',
    },
    {
      title: 'Direkt stoppen',
      description: 'Sperren, Learn-Gates und Fokus-Flows greifen direkt im Moment.',
    },
    {
      title: 'Besser lernen',
      description: 'Du baust Fokus auf, statt nur stumpf zu blockieren.',
    },
  ];

  return (
    <div className="grid gap-3 md:grid-cols-3">
      {items.map((item) => (
        <div
          key={item.title}
          className="rounded-[1.35rem] border border-border/70 bg-card/80 px-4 py-4 shadow-[0_14px_32px_hsl(var(--foreground)/0.05)]"
        >
          <p className="text-sm font-black text-foreground">{item.title}</p>
          <p className="mt-2 text-sm leading-6 text-foreground/72">{item.description}</p>
        </div>
      ))}
    </div>
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
  const { isOpen, closeTour } = useAppTour();
  const navigate = useNavigate();
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
        permissionActionKey === 'usage' && nextStatus.usageStats
        || permissionActionKey === 'overlay' && nextStatus.overlay
        || permissionActionKey === 'accessibility'
          && nextStatus.accessibility
          && hasAccessibilityRuntimeReady(nextMonitoringStatus)
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
      setPermissionErrorMessage(getIntroRuntimeErrorMessage(error));
    }
  }, [refreshPermissions]);

  const isPermissionPrompting = useCallback((key: PermissionCheckpointKey) => {
    return permissionActionKey === key && Date.now() - permissionActionStartedAt < 20_000;
  }, [permissionActionKey, permissionActionStartedAt]);

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

  const allPermissionsGranted = permissionStatus.usageStats
    && permissionStatus.overlay
    && permissionStatus.accessibility
    && hasAccessibilityRuntimeReady(monitoringStatus);
  const canFinish = !isNative || (permissionStatusReady && allPermissionsGranted);

  useEffect(() => {
    if (!isOpen) {
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

    const handleResumeRefresh = () => {
      void refreshPermissions();
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
  }, [isOpen, refreshPermissions]);

  useEffect(() => {
    if (!isOpen || !permissionActionKey) return;

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
  }, [isOpen, permissionActionKey, refreshPermissions]);

  const buildPermissionStep = useCallback((options: {
    id: PermissionCheckpointKey;
    eyebrow: string;
    title: string;
    description: string;
    bullets: string[];
    actionLabel: string;
    actionStateLabel: string;
    hint: string;
    icon: typeof Shield;
    completed: boolean;
    checkpointState: ReturnType<typeof getPermissionCheckpointState>;
    onAction: () => Promise<void>;
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
        hint={!isNative ? 'In der Web-Vorschau kannst du diesen Schritt nur ansehen. Auf Android öffnet Blearn direkt die richtige Systemeinstellung.' : options.hint}
        errorMessage={permissionErrorMessage}
      />
    );

    return {
      id: options.id,
      eyebrow: options.eyebrow,
      title: options.title,
      description: options.description,
      bullets: options.bullets,
      actionLabel: !isNative ? undefined : options.actionLabel,
      actionStateLabel: !isNative ? undefined : options.actionStateLabel,
      completed: !isNative || options.completed,
      icon: options.icon,
      onAction: !isNative ? undefined : options.onAction,
      content,
    };
  }, [permissionErrorMessage]);

  const steps = useMemo<SetupStep[]>(() => {
    return [
      {
        id: 'value',
        eyebrow: 'Blearn',
        title: 'Block and learn',
        description: 'Blearn hilft dir, Ablenkungen direkt auf deinem Handy zu stoppen und Fokus wieder aufzubauen.',
        bullets: [
          'Die App erkennt, wenn du in ablenkende Apps oder Browser wechselst.',
          'Blearn kann dich sofort stoppen und in einen kurzen Fokus-Flow schicken.',
          'Du arbeitest nicht nur mit Blocken, sondern mit echter Struktur auf dem Handy.',
        ],
        icon: Brain,
        completed: true,
        content: <IntroFeatureGrid />,
      },
      buildPermissionStep({
        id: 'usage',
        eyebrow: '1',
        title: 'Nutzungszugriff freigeben',
        description: 'Damit erkennt Blearn, welche App gerade offen ist.',
        bullets: [
          'Tippe auf "Nutzungszugriff öffnen".',
          'Wähle danach Blearn in den Android-Einstellungen aus.',
          'Aktiviere den Schalter und kehre zurück zur App.',
        ],
        actionLabel: 'Nutzungszugriff öffnen',
        actionStateLabel: 'Nutzungszugriff erteilt',
        hint: 'Ohne diesen Schritt kann Blearn nicht sehen, wann eine Ablenkungs-App aktiv wird.',
        icon: Shield,
        completed: usageCheckpointState === 'granted',
        checkpointState: usageCheckpointState,
        onAction: async () => {
          await runPermissionAction('usage', requestUsagePermission);
        },
      }),
      buildPermissionStep({
        id: 'overlay',
        eyebrow: '2',
        title: 'Overlay freigeben',
        description: 'Damit darf Blearn Sperrfenster und Learn-Gates über anderen Apps anzeigen.',
        bullets: [
          'Tippe auf "Overlay freigeben".',
          'Erlaube Blearn, über anderen Apps angezeigt zu werden.',
          'Kehre danach direkt zurück, Blearn prüft den Status automatisch.',
        ],
        actionLabel: 'Overlay freigeben',
        actionStateLabel: 'Overlay erteilt',
        hint: 'Ohne Overlay kann Blearn dich im wichtigen Moment nicht direkt auf dem Handy stoppen.',
        icon: Sparkles,
        completed: overlayCheckpointState === 'granted',
        checkpointState: overlayCheckpointState,
        onAction: async () => {
          await runPermissionAction('overlay', requestOverlayPermission);
        },
      }),
      buildPermissionStep({
        id: 'accessibility',
        eyebrow: '3',
        title: 'Bedienungshilfe aktivieren',
        description: 'Damit bleibt der Schutz auf Android auch in kniffligen Browser- und Suchfeld-Situationen stabil.',
        bullets: [
          'Tippe auf "Bedienungshilfe öffnen".',
          'Aktiviere dort den Dienst für Blearn.',
          'Wechsle zurück, damit der Schritt direkt grün wird.',
        ],
        actionLabel: 'Bedienungshilfe öffnen',
        actionStateLabel: 'Bedienungshilfe erteilt',
        hint: 'Dieser Schritt ergänzt den Schutz, wenn Android Standard-Overlays oder Browser-Suchen sonst umgehen würden.',
        icon: Wand2,
        completed: accessibilityCheckpointState === 'granted',
        checkpointState: accessibilityCheckpointState,
        onAction: async () => {
          await runPermissionAction('accessibility', requestAccessibilityPermission);
        },
      }),
    ];
  }, [
    accessibilityCheckpointState,
    buildPermissionStep,
    overlayCheckpointState,
    runPermissionAction,
    usageCheckpointState,
  ]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      closeTour();
    }
  };

  const handleFinish = () => {
    closeTour();
    navigate('/', { replace: true });
  };

  if (!isOpen) {
    return null;
  }

  return (
    <SetupNarrativeDialog
      open={isOpen}
      onOpenChange={handleOpenChange}
      title="Blearn starten"
      description="Zuerst kurz verstehen, was Blearn für dich macht. Danach aktivierst du die nötigen Android-Rechte direkt in der richtigen Reihenfolge."
      steps={steps}
      finishLabel={canFinish ? 'Loslegen' : 'Rechte fehlen noch'}
      onFinish={handleFinish}
      lockUntilFinished={isNative && !allPermissionsGranted}
      canFinish={canFinish}
    />
  );
}
