import { ShieldAlert, Smartphone } from 'lucide-react';
import { BrandLockup } from '@/components/brand/BrandMark';
import GlassCard from '@/components/GlassCard';

export default function AndroidOnlyAppScreen() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_hsl(var(--primary)/0.24),_transparent_42%),radial-gradient(circle_at_bottom_right,_hsl(var(--accent)/0.16),_transparent_36%),linear-gradient(180deg,_hsl(var(--background))_0%,_hsl(var(--surface-hero))_58%,_hsl(var(--background))_100%)] px-4 py-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-lg items-center">
        <GlassCard accentGlow className="w-full space-y-6 rounded-[2rem] p-6 sm:p-8">
          <BrandLockup subtitle="Android-only runtime" />

          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.4rem] bg-primary/12 text-primary">
              <Smartphone size={24} />
            </div>
            <div className="space-y-2">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-primary/80">
                Native Fokuszentrale
              </p>
              <h1 className="text-3xl font-black tracking-[-0.05em] text-foreground">
                Blearn läuft jetzt nur noch als Android-App.
              </h1>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Blocking, Berechtigungen, Overlay-Gates und Screen-Time-Daten sind nur im nativen Android-Flow verlässlich.
              </p>
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-warning/30 bg-warning/8 px-4 py-4 text-sm text-foreground shadow-[0_18px_36px_hsl(var(--warning)/0.08)]">
            <div className="flex items-start gap-3">
              <ShieldAlert size={18} className="mt-0.5 shrink-0 text-warning" />
              <div className="space-y-2">
                <p className="font-bold text-foreground">Dieser Browser-Build ist nur noch eine Hinweisansicht.</p>
                <p className="leading-relaxed text-foreground/78">
                  Wenn du Blearn testen oder nutzen willst, installiere die Android-App per Capacitor-Build auf einem Gerät oder Emulator.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[1.35rem] border border-border/70 bg-background/60 px-4 py-4">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">
                Verlässlich in Android
              </p>
              <p className="mt-2 text-sm font-semibold text-foreground">
                Overlay-Gates, App-Blocking, Website-Schutz und Resume zur Ziel-App.
              </p>
            </div>
            <div className="rounded-[1.35rem] border border-border/70 bg-background/60 px-4 py-4">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">
                Nicht mehr als Web-App
              </p>
              <p className="mt-2 text-sm font-semibold text-foreground">
                Keine PWA-Installation, keine Demo-Daten und keine Desktop-Fallback-Flows mehr.
              </p>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
