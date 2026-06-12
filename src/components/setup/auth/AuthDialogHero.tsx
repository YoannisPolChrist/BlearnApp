import { Cloud, ShieldCheck } from 'lucide-react';

const featureCards = [
  {
    icon: Cloud,
    title: 'Geräteübergreifend',
    description: 'Dein Lernstand immer synchron.',
  },
  {
    icon: ShieldCheck,
    title: 'Sicher & Schnell',
    description: '1-Klick Login oder per E-Mail.',
  },
] as const;

export function AuthDialogHero() {
  return (
    <div className="relative overflow-hidden border-b border-border/60 bg-[linear-gradient(160deg,hsl(var(--primary)/0.18),hsl(var(--background))_36%,hsl(var(--accent)/0.18)_100%)] p-6 sm:p-8 md:border-b-0 md:border-r">
      <div className="absolute left-[-3rem] top-[-3rem] h-40 w-40 rounded-full bg-primary/20 blur-3xl" />
      <div className="absolute bottom-[-4rem] right-[-2rem] h-44 w-44 rounded-full bg-accent/20 blur-3xl" />

      <div className="relative flex flex-col gap-6 md:h-full md:justify-between">
        <div className="space-y-5">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/20 bg-background/75 px-4 py-2 text-[11px] font-black uppercase tracking-[0.2em] text-primary shadow-sm">
            <Cloud size={14} />
            Blearn Sync Konto
          </div>

          <div className="space-y-3">
            <h2 className="max-w-xl text-3xl font-black tracking-[-0.05em] text-foreground sm:text-4xl">
              Lernstand sichern.
            </h2>
            <p className="max-w-xl text-sm leading-7 text-foreground/80 sm:text-base">
              Erstelle einen kostenlosen Account, um deine Vokabeln überall synchron zu halten.
            </p>
          </div>
        </div>

        <div className="grid gap-3">
          {featureCards.map((card) => {
            const Icon = card.icon;

            return (
              <div
                key={card.title}
                className="rounded-[1.45rem] border border-white/30 bg-background/78 p-4 shadow-[0_18px_40px_rgba(0,0,0,0.06)] backdrop-blur"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                    <Icon size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-black tracking-[-0.02em] text-foreground">{card.title}</p>
                    <p className="mt-1 text-sm leading-6 text-foreground/72">{card.description}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
