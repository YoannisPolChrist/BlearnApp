import { CircleAlert } from 'lucide-react';
import type { MonitoringStatus } from '@/plugins/ScreenTimePlugin';
import { hasAccessibilityRuntimeReady } from '@/services/screenTimeNormalization';

interface AccessibilityHealthNoticeProps {
  locale: string;
  monitoringStatus: MonitoringStatus;
  onOpenAccessibilitySettings: () => void;
}

function formatInterruptionTime(timestamp: number, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(timestamp));
}

/** Explains a real outage without treating Android's brief reconnect window as a failure. */
export function AccessibilityHealthNotice({
  locale,
  monitoringStatus,
  onOpenAccessibilitySettings,
}: AccessibilityHealthNoticeProps) {
  if (hasAccessibilityRuntimeReady(monitoringStatus)) {
    return null;
  }

  const disconnectedAt = monitoringStatus.accessibilityServiceDisconnectedAt;
  const permissionDisabled = !monitoringStatus.accessibilityPermission;
  const interruptionTime =
    typeof disconnectedAt === 'number' && disconnectedAt > 0
      ? formatInterruptionTime(disconnectedAt, locale)
      : null;

  const title = permissionDisabled
    ? 'Bedienungshilfe ist ausgeschaltet'
    : 'Bedienungshilfe ist nicht verbunden';
  const description = permissionDisabled
    ? 'Die Android-Systemfreigabe für Blearn ist ausgeschaltet. Blearn darf sie nicht selbst wieder einschalten.'
    : interruptionTime
      ? `Android hat die Verbindung zum Blearn-Dienst am ${interruptionTime} beendet. Blearn kann ihn aus Sicherheitsgründen nicht selbst neu starten.`
      : 'Die Android-Freigabe besteht noch, aber der Blearn-Dienst antwortet gerade nicht. Android kann ihn getrennt oder noch nicht wieder verbunden haben.';

  return (
    <div
      data-testid="accessibility-health-notice"
      role="alert"
      className="rounded-2xl border border-warning/30 bg-warning/8 px-4 py-4 text-foreground shadow-[0_14px_34px_hsl(var(--warning)/0.08)]"
    >
      <div className="flex items-start gap-3">
        <CircleAlert className="mt-0.5 shrink-0 text-warning" size={19} aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-sm font-black text-foreground">{title}</p>
          <p className="mt-1 text-sm leading-relaxed text-foreground/82">{description}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onOpenAccessibilitySettings}
        className="btn-press mt-3 w-full rounded-xl bg-warning px-3 py-2.5 text-sm font-bold text-warning-foreground sm:w-auto"
      >
        Bedienungshilfe-Einstellungen öffnen
      </button>
    </div>
  );
}
