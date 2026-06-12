import { useEffect, useMemo, useState } from 'react';
import { Bell, Brain, Clock3, Shield, Wallet } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { showSuccessFeedback } from '@/lib/successFeedback';
import { useAppStore, type NotificationPreferences } from '@/store/useAppStore';
import {
  getNotificationPermissionState,
  requestNotificationPermission,
  syncNotificationPreferences,
  type NotificationPermissionState,
} from '@/services/notificationService';
import { tonePalettes } from '@/lib/semanticTones';

interface NotificationPermissionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
}

function getPermissionTone(state: NotificationPermissionState) {
  if (state === 'granted') return 'bg-success/10 text-success';
  if (state === 'denied') return 'bg-destructive/10 text-destructive';
  if (state === 'unsupported') return 'bg-muted text-muted-foreground';
  return 'bg-warning/10 text-warning';
}

function getPermissionLabel(state: NotificationPermissionState) {
  if (state === 'granted') return 'Erlaubt';
  if (state === 'denied') return 'Blockiert';
  if (state === 'unsupported') return 'Nicht verfügbar';
  return 'Offen';
}

const AREA_STYLES: Record<keyof NotificationPreferences, string> = {
  reminders: tonePalettes.primary.badge,
  statusHints: tonePalettes.accent.badge,
  learnProgress: tonePalettes.learn.badge,
  penaltyAlerts: tonePalettes.penalty.badge,
};

export default function NotificationPermissionDialog({
  open,
  onOpenChange,
  title = 'Benachrichtigungen einrichten',
  description = 'Lege fest, worüber Blearn dich informieren darf.',
}: NotificationPermissionDialogProps) {
  const {
    notificationsEnabled,
    notificationPreferences,
    setNotificationsEnabled,
    setNotificationPreference,
  } = useAppStore();
  const [permissionState, setPermissionState] = useState<NotificationPermissionState>('unsupported');
  const [requestBusy, setRequestBusy] = useState(false);

  const notificationAreas = useMemo(
    () => [
      {
        key: 'reminders' as const,
        title: 'Erinnerungen',
        description: 'Regelmäßige Hinweise für Fokus, Atempausen und Rückkehr in den Flow.',
        icon: Clock3,
      },
      {
        key: 'statusHints' as const,
        title: 'Statushinweise',
        description: 'Kurze Hinweise zu aktivem Modus, Schutzstatus und Freischaltungen.',
        icon: Bell,
      },
      {
        key: 'learnProgress' as const,
        title: 'Learn & Gate',
        description: 'Hinweise zu fälligen Karten, Learn-Fortschritt und aktiven Freigaben.',
        icon: Brain,
      },
      {
        key: 'penaltyAlerts' as const,
        title: 'Wallet & Strafe',
        description: 'Wichtige Hinweise zu Strafmodus, Konto und Accountability-Status.',
        icon: Wallet,
      },
    ],
    [],
  );

  useEffect(() => {
    if (!open) return;
    getNotificationPermissionState().then(setPermissionState).catch(() => setPermissionState('unsupported'));
  }, [open]);

  const handleRequestPermission = async () => {
    setRequestBusy(true);
    try {
      const nextState = await requestNotificationPermission();
      setPermissionState(nextState);
      await syncNotificationPreferences({
        enabled: notificationsEnabled,
        preferences: notificationPreferences,
      }).catch(() => undefined);
      if (nextState === 'granted') {
        showSuccessFeedback({
          eyebrow: 'Benachrichtigungen aktiv',
          title: 'Systemfreigabe erteilt',
          description: 'Blearn darf dir jetzt Erinnerungen und Statushinweise senden.',
          detail: 'Browser- oder App-Rechte bestätigt',
          emoji: '🔔',
        });
      }
    } finally {
      setRequestBusy(false);
    }
  };

  const handleNotificationsToggle = (enabled: boolean) => {
    setNotificationsEnabled(enabled);
    void syncNotificationPreferences({
      enabled,
      preferences: notificationPreferences,
      preview: enabled
        ? {
            category: 'statusHints',
            title: 'Benachrichtigungen aktiv',
            body: 'Blearn kann dir jetzt native Hinweise senden.',
          }
        : null,
    }).catch(() => undefined);
    showSuccessFeedback({
      eyebrow: 'Hinweise',
      title: 'Einstellung gespeichert',
      description: enabled
        ? 'Benachrichtigungen sind jetzt insgesamt aktiv.'
        : 'Benachrichtigungen sind jetzt insgesamt pausiert.',
    });
  };

  const handleAreaToggle = (key: keyof NotificationPreferences, enabled: boolean) => {
    setNotificationPreference(key, enabled);
    const areaTitle = notificationAreas.find((area) => area.key === key)?.title || 'Bereich';
    void syncNotificationPreferences({
      enabled: notificationsEnabled,
      preferences: {
        ...notificationPreferences,
        [key]: enabled,
      },
      preview: enabled
        ? {
            category: key,
            title: `${areaTitle} aktiv`,
            body: `${areaTitle} darf dir jetzt native Hinweise senden.`,
          }
        : null,
    }).catch(() => undefined);
    showSuccessFeedback({
      eyebrow: 'Hinweise',
      title: 'Einstellung gespeichert',
      description: enabled
        ? `${areaTitle} sendet jetzt Hinweise.`
        : `${areaTitle} sendet jetzt keine Hinweise mehr.`,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-hidden rounded-[2rem] border-border bg-background/95 p-0 sm:max-w-3xl">
        <div className="flex max-h-[88vh] flex-col">
          <DialogHeader className="border-b border-border px-5 py-4 pr-16 sm:px-6 sm:pr-16">
            <DialogTitle className="text-2xl font-black tracking-[-0.04em] text-foreground">
              {title}
            </DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          <div className="space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
            <div className="rounded-[1.7rem] border border-border/70 bg-[linear-gradient(145deg,hsl(var(--card)/0.96),hsl(var(--accent)/0.08))] p-5 shadow-[0_20px_55px_hsl(var(--foreground)/0.05)]">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                      <Shield size={20} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">
                        Systemrecht
                      </p>
                      <p className="mt-1 text-lg font-black text-foreground">Benachrichtigungen für Blearn</p>
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                    Ohne Systemfreigabe kann Blearn keine echten Hinweise außerhalb der App senden. Die unteren Bereiche bleiben trotzdem schon vorkonfigurierbar.
                  </p>
                </div>

                <div className="flex flex-col gap-3 lg:min-w-[13rem]">
                  <span className={`rounded-full px-3 py-1.5 text-center text-[11px] font-black uppercase tracking-[0.14em] ${getPermissionTone(permissionState)}`}>
                    {getPermissionLabel(permissionState)}
                  </span>
                  {permissionState === 'default' ? (
                    <button
                      onClick={() => {
                        void handleRequestPermission();
                      }}
                      disabled={requestBusy}
                      className="btn-press rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground disabled:opacity-60"
                    >
                      {requestBusy ? 'Wird angefragt...' : 'Systemfreigabe anfragen'}
                    </button>
                  ) : permissionState === 'denied' ? (
                    <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-xs leading-relaxed text-destructive">
                      Die Freigabe wurde bereits blockiert. Bitte aktiviere Benachrichtigungen direkt in deinen Browser- oder App-Einstellungen.
                    </div>
                  ) : permissionState === 'unsupported' ? (
                    <div className="rounded-xl border border-border bg-card/80 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
                      Dieses Gerät stellt hier aktuell kein direktes Notification-Popup bereit. Die Bereiche unten kannst du trotzdem vorbereiten.
                    </div>
                  ) : (
                    <div className="rounded-xl border border-success/20 bg-success/5 px-4 py-3 text-xs leading-relaxed text-success">
                      Blearn darf dir jetzt Erinnerungen und Statushinweise senden.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-[1.65rem] border border-border/70 bg-card/65 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">
                    Gesamtsteuerung
                  </p>
                  <p className="mt-1 text-sm font-bold text-foreground">Benachrichtigungen insgesamt</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Schaltet Erinnerungen und Statushinweise global für deine App ein oder aus.
                  </p>
                </div>
                <div className="flex items-center gap-3 rounded-2xl border border-border bg-background/70 px-4 py-3">
                  <span className="text-sm font-semibold text-foreground">
                    {notificationsEnabled ? 'Aktiv' : 'Pausiert'}
                  </span>
                  <Switch checked={notificationsEnabled} onCheckedChange={handleNotificationsToggle} />
                </div>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              {notificationAreas.map((area) => {
                const Icon = area.icon;
                const enabled = notificationPreferences[area.key];

                return (
                  <div
                    key={area.key}
                    className={`rounded-[1.55rem] border p-4 shadow-[0_14px_36px_hsl(var(--foreground)/0.04)] ${AREA_STYLES[area.key]}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-background/80 text-foreground">
                          <Icon size={18} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-foreground">{area.title}</p>
                          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{area.description}</p>
                        </div>
                      </div>
                      <Switch
                        checked={enabled}
                        disabled={!notificationsEnabled}
                        onCheckedChange={(nextValue) => handleAreaToggle(area.key, nextValue)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
