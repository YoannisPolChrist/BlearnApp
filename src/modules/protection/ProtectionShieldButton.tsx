import { ShieldCheck, ShieldAlert, ShieldOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProtectionHealth } from './useProtectionHealth';

/**
 * Kompakter Schutz-Indikator im Header (neben dem Theme-Toggle), sichtbar nur
 * wenn für die aktive Konfiguration Schutz läuft. Farbe spiegelt die Health:
 * grün = alles aktiv, gelb = eingeschränkt, rot = unterbrochen. Tippen scrollt
 * zur Schutzstatus-Karte.
 */
export function ProtectionShieldButton({ isGerman }: { isGerman: boolean }) {
  const { health, supported, active } = useProtectionHealth();

  if (!supported || !active) {
    return null;
  }

  const Icon = health.overall === 'ok' ? ShieldCheck : health.overall === 'warn' ? ShieldAlert : ShieldOff;
  const label =
    health.overall === 'ok'
      ? isGerman ? 'Schutz aktiv' : 'Protection active'
      : health.overall === 'warn'
        ? isGerman ? 'Schutz eingeschränkt' : 'Protection limited'
        : isGerman ? 'Schutz unterbrochen' : 'Protection interrupted';

  const scrollToCard = () => {
    document
      .querySelector('[data-testid="protection-status"]')
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <button
      type="button"
      onClick={scrollToCard}
      aria-label={label}
      title={label}
      className={cn(
        'btn-press flex h-10 w-10 items-center justify-center rounded-full border transition-colors',
        health.overall === 'ok' && 'border-success/30 bg-success/10 text-success',
        health.overall === 'warn' && 'border-warning/40 bg-warning/10 text-warning',
        health.overall === 'error' && 'border-destructive/40 bg-destructive/10 text-destructive',
      )}
    >
      <Icon size={18} />
    </button>
  );
}
