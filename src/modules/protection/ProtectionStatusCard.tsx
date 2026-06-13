import { useCallback } from 'react';
import { ShieldCheck, ShieldAlert, ShieldOff } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { Button } from '@/components/ui/button';
import { requestNotificationPermission } from '@/services/notificationService';
import {
  clearVpnBootInterruption,
  requestAccessibilityPermission,
  requestBatteryOptimizationExemption,
  requestOverlayPermission,
  requestUsagePermission,
  startWebsiteBlocking,
} from '@/services/screenTimeService';
import { useAppStore } from '@/store/useAppStore';
import { cn } from '@/lib/utils';
import { useProtectionHealth } from './useProtectionHealth';
import {
  type ProtectionHealthItem,
  type ProtectionItemKey,
} from './protectionHealth';

const ITEM_LABELS: Record<ProtectionItemKey, { de: string; en: string }> = {
  accessibility: { de: 'Bedienungshilfe', en: 'Accessibility service' },
  overlay: { de: 'Overlay-Berechtigung', en: 'Overlay permission' },
  usageStats: { de: 'Nutzungszugriff', en: 'Usage access' },
  battery: { de: 'Akku-Ausnahme', en: 'Battery exemption' },
  notifications: { de: 'Benachrichtigungen', en: 'Notifications' },
  vpn: { de: 'Website-Schutz (VPN)', en: 'Website shield (VPN)' },
  vpnPermission: { de: 'VPN-Berechtigung', en: 'VPN permission' },
  privateDns: { de: 'Privates DNS aktiv', en: 'Private DNS active' },
  deviceAdmin: { de: 'Geräteadministrator', en: 'Device admin' },
};

const FIX_LABELS: Partial<Record<ProtectionItemKey, { de: string; en: string }>> = {
  accessibility: { de: 'Aktivieren', en: 'Enable' },
  overlay: { de: 'Erlauben', en: 'Allow' },
  usageStats: { de: 'Erlauben', en: 'Allow' },
  battery: { de: 'Ausnehmen', en: 'Exempt' },
  notifications: { de: 'Erlauben', en: 'Allow' },
  vpn: { de: 'Starten', en: 'Start' },
  vpnPermission: { de: 'Erlauben', en: 'Allow' },
};

export function ProtectionStatusCard({ isGerman }: { isGerman: boolean }) {
  const { health, supported, refresh } = useProtectionHealth();
  const blockedWebsites = useAppStore(useShallow((state) => state.blockedWebsites));

  const runFix = useCallback(
    async (key: ProtectionItemKey) => {
      try {
        if (key === 'accessibility') await requestAccessibilityPermission();
        else if (key === 'overlay') await requestOverlayPermission();
        else if (key === 'usageStats') await requestUsagePermission();
        else if (key === 'battery') await requestBatteryOptimizationExemption();
        else if (key === 'notifications') await requestNotificationPermission();
        else if (key === 'vpn' || key === 'vpnPermission') {
          await startWebsiteBlocking(blockedWebsites);
          await clearVpnBootInterruption();
        }
      } catch {
        // Systemdialog abgelehnt oder Intent fehlgeschlagen; nächster Refresh zeigt den Stand.
      }
      void refresh();
    },
    [blockedWebsites, refresh],
  );

  // Im grünen Zustand genügt das Header-Schild — die Karte erscheint nur, wenn
  // es etwas zu beheben gibt (gelb/rot). Spart Dashboard-Fläche und Erklär-Copy.
  if (!supported || health.overall === 'inactive' || health.overall === 'ok') {
    return null;
  }

  const issues = health.items.filter((item) => item.state !== 'ok');
  const Icon = health.overall === 'ok' ? ShieldCheck : health.overall === 'warn' ? ShieldAlert : ShieldOff;
  const headline =
    health.overall === 'ok'
      ? isGerman ? 'Schutz aktiv' : 'Protection active'
      : health.overall === 'warn'
        ? isGerman ? 'Schutz eingeschränkt' : 'Protection limited'
        : isGerman ? 'Schutz unterbrochen' : 'Protection interrupted';

  return (
    <section
      data-testid="protection-status"
      className={cn(
        'rounded-[1.5rem] border px-4 py-4 shadow-[0_14px_34px_hsl(var(--foreground)/0.08)]',
        health.overall === 'ok' && 'border-success/30 bg-success/10',
        health.overall === 'warn' && 'border-warning/40 bg-warning/10',
        health.overall === 'error' && 'border-destructive/40 bg-destructive/10',
      )}
    >
      <div className="flex items-center gap-3">
        <Icon
          size={22}
          className={cn(
            health.overall === 'ok' && 'text-success',
            health.overall === 'warn' && 'text-warning',
            health.overall === 'error' && 'text-destructive',
          )}
        />
        <p className="text-sm font-black tracking-[-0.02em] text-foreground">{headline}</p>
      </div>
      {issues.length > 0 && (
        <ul className="mt-3 space-y-2">
          {issues.map((item: ProtectionHealthItem) => (
            <li key={item.key} className="flex min-h-[2.75rem] items-center justify-between gap-3">
              <span className="text-sm text-foreground/85">
                {isGerman ? ITEM_LABELS[item.key].de : ITEM_LABELS[item.key].en}
              </span>
              {FIX_LABELS[item.key] ? (
                <Button size="sm" variant="outline" onClick={() => void runFix(item.key)}>
                  {isGerman ? FIX_LABELS[item.key]!.de : FIX_LABELS[item.key]!.en}
                </Button>
              ) : (
                <span className="text-xs text-foreground/60">{isGerman ? 'Hinweis' : 'Note'}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
