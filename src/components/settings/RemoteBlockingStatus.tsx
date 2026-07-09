import { useState } from 'react';
import { useI18n } from '@/hooks/useI18n';
import { useVisibilityGatedInterval } from '@/hooks/useVisibilityGatedInterval';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/useAppStore';
import { useAuthStore } from '@/store/useAuthStore';

/**
 * Live-Status der Coach-Remote-Sperre in den Einstellungen. Macht die
 * Vertrauenskette beobachtbar (Anmeldung -> Instruktion -> aufgeloeste Apps),
 * damit "warum schaltet es nicht?" direkt am Geraet beantwortbar ist statt
 * nur ueber Firestore-Konsole und Logs.
 */
export function RemoteBlockingStatus({ enabled }: { enabled: boolean }) {
  const { t, locale } = useI18n();
  const authStatus = useAuthStore((state) => state.status);
  const authUid = useAuthStore((state) => state.user?.uid);
  const instruction = useAppStore((state) => state.remoteBlockingInstruction);
  const resolvedApps = useAppStore((state) => state.resolvedRemoteBlockedApps);

  // Minuetlicher Tick, damit "aktiv" nach Ablauf ohne Interaktion in
  // "keine aktive Sperre" umspringt.
  const [, setTick] = useState(0);
  useVisibilityGatedInterval(() => setTick((tick) => tick + 1), 60_000, enabled);

  if (!enabled) {
    return null;
  }

  const now = Date.now();
  const isActive = Boolean(instruction && instruction.expiresAt > now);

  let toneClassName = 'text-muted-foreground';
  let label: string;

  if (authStatus !== 'authenticated') {
    toneClassName = 'text-warning';
    label = t('remoteBlocking.settings.status.notSignedIn');
  } else if (isActive && instruction) {
    const timeString = new Date(instruction.expiresAt).toLocaleTimeString(locale, {
      hour: '2-digit',
      minute: '2-digit',
    });
    if (resolvedApps.length === 0) {
      // Instruktion ist da, aber die Kategorie-Aufloesung hat keine App
      // getroffen — der wichtigste Diagnosefall.
      toneClassName = 'text-warning';
      label = t('remoteBlocking.settings.status.activeNoApps', { time: timeString });
    } else {
      toneClassName = 'text-destructive';
      label = t('remoteBlocking.settings.status.active', {
        time: timeString,
        count: resolvedApps.length,
      });
    }
  } else if (instruction) {
    const endedString = new Date(instruction.expiresAt).toLocaleTimeString(locale, {
      hour: '2-digit',
      minute: '2-digit',
    });
    label = t('remoteBlocking.settings.status.expired', { time: endedString });
  } else {
    label = t('remoteBlocking.settings.status.idle');
  }

  return (
    <div className="space-y-1">
      <p
        data-testid="remote-blocking-status"
        className={cn('text-xs font-semibold leading-relaxed', toneClassName)}
      >
        {label}
      </p>
      {authStatus === 'authenticated' && authUid ? (
        // Macht den haeufigsten stillen Fehler sichtbar: Handy-Konto-ID muss der
        // USER_ID im Coach-Server entsprechen, sonst schreibt Hermes ins Leere.
        <p
          data-testid="remote-blocking-uid"
          className="select-all break-all text-[10px] leading-relaxed text-muted-foreground/70"
        >
          {t('remoteBlocking.settings.status.deviceId', { uid: authUid })}
        </p>
      ) : null}
    </div>
  );
}
