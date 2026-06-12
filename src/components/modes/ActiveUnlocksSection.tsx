import { motion } from 'framer-motion';
import { Globe, Search, Shield, Smartphone } from 'lucide-react';
import { formatCountdown } from '@/lib/view-models/modes';
import type { ActiveUnlockDisplayEntry } from '@/modules/modes/modesPageModel';

interface ActiveUnlocksSectionProps {
  activeUnlocks: ActiveUnlockDisplayEntry[];
  isGerman: boolean;
  variants: Record<string, unknown>;
}

export function ActiveUnlocksSection({ activeUnlocks, isGerman, variants }: ActiveUnlocksSectionProps) {
  if (activeUnlocks.length === 0) {
    return null;
  }

  return (
    <motion.section variants={variants}>
      <div className="rounded-[1.7rem] border border-success/20 bg-[linear-gradient(150deg,hsl(var(--card)/0.96),hsl(var(--success)/0.08))] p-5 shadow-[0_20px_48px_hsl(var(--success)/0.08)]">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-success">
              {isGerman ? 'Aktive Freigaben' : 'Active unlocks'}
            </p>
            <h2 className="mt-2 text-lg font-black text-foreground">
              {isGerman ? 'Jedes Ziel läuft mit eigener Uhr' : 'Each target keeps its own timer'}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-foreground/72">
              {isGerman
                ? 'Jede Freigabe läuft pro Ziel separat ab.'
                : 'Each unlock expires per target; renewing extends only that one.'}
            </p>
          </div>
          <span className="rounded-full bg-success/12 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-success">
            {activeUnlocks.length} {isGerman ? 'aktiv' : 'active'}
          </span>
        </div>

        <div className="mt-4 space-y-3">
          {activeUnlocks.map((entry) => {
            const Icon =
              entry.targetType === 'app'
                ? Smartphone
                : entry.targetType === 'website'
                  ? Globe
                  : entry.targetType === 'search'
                    ? Search
                    : Shield;
            const typeLabel =
              entry.targetType === 'app'
                ? (isGerman ? 'App' : 'App')
                : entry.targetType === 'website'
                  ? (isGerman ? 'Website' : 'Website')
                  : entry.targetType === 'search'
                    ? (isGerman ? 'Suche' : 'Search')
                    : (isGerman ? 'Ziel' : 'Target');

            return (
              <div
                key={`${entry.targetType}:${entry.targetId}`}
                className="flex flex-col gap-3 rounded-[1.35rem] border border-success/15 bg-background/75 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-success/12 text-success">
                    <Icon size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-foreground">{entry.label}</p>
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{typeLabel}</p>
                  </div>
                </div>
                <div className="rounded-2xl border border-success/20 bg-success/8 px-4 py-3 text-left sm:text-right">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-success">
                    {isGerman ? 'Freigabe endet in' : 'Unlock ends in'}
                  </p>
                  <p className="mt-1 font-mono text-2xl font-black text-foreground">
                    {formatCountdown(entry.remainingMs)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </motion.section>
  );
}
