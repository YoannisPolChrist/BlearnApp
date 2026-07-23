import { Activity, ChevronLeft, ChevronRight, Clock3, TrendingUp } from 'lucide-react';
import GlassCard from '@/components/GlassCard';
import { MetricCard } from '@/components/ui/MetricCard';
import { SectionHeader } from '@/components/ui/SectionHeader';
import type { AppUsageEntry, InstalledApp, ScreenTimeSummary } from '@/plugins/ScreenTimePlugin';
import { formatScreenTime, getAppId, getAppLabel } from '@/services/screenTimeNormalization';
import {
  formatTimeLabel,
  getAppLookupKeys,
} from '@/modules/stats/screenTime';
import type { TimeRange } from '@/modules/stats/types';

type UsageOverviewSectionProps = {
  error: string | null;
  onOpenPermissions: () => void;
  onNextMonth: () => void;
  onPreviousMonth: () => void;
  onRefresh: () => void;
  onRangeChange: (range: TimeRange) => void;
  periodLabel: string;
  range: TimeRange;
  topUsageEntry?: AppUsageEntry;
  unlocks: number;
  usage: ScreenTimeSummary | null;
};

type UsageAppListSectionProps = {
  appDetails: Map<string, InstalledApp>;
  periodLabel: string;
  strongestEntryTime: number;
  topEntries: AppUsageEntry[];
};

export function UsageOverviewSection({
  error,
  onOpenPermissions,
  onNextMonth,
  onPreviousMonth,
  onRefresh,
  onRangeChange,
  periodLabel,
  range,
  topUsageEntry,
  unlocks,
  usage,
}: UsageOverviewSectionProps) {
  return (
    <section id="stats-section-usage" data-tour-id="tour-stats-usage">
      <GlassCard elevation="raised" className="space-y-5">
        <SectionHeader
          eyebrow={periodLabel}
          title="App-Nutzung"
          description="Aktive Vordergrund-Apps bei eingeschaltetem Bildschirm im gewählten Zeitraum."
        />

        <div className="space-y-3">
          <div role="tablist" aria-label="Zeitraum der App-Nutzung" className="grid grid-cols-4 gap-2 rounded-2xl bg-muted/60 p-1">
            {([
              ['day', 'Tag'],
              ['week', 'Woche'],
              ['month', 'Monat'],
              ['total', 'Gesamt'],
            ] as const).map(([nextRange, label]) => (
              <button
                key={nextRange}
                type="button"
                role="tab"
                aria-selected={range === nextRange}
                onClick={() => onRangeChange(nextRange)}
                className={`rounded-xl px-2 py-2 text-xs font-bold transition-colors ${
                  range === nextRange
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {range === 'month' ? (
            <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-background/55 px-2 py-1.5">
              <button
                type="button"
                aria-label="Vorheriger Monat"
                onClick={onPreviousMonth}
                className="btn-press rounded-xl p-2 text-foreground hover:bg-muted"
              >
                <ChevronLeft size={18} />
              </button>
              <p aria-live="polite" className="text-sm font-bold text-foreground">{periodLabel}</p>
              <button
                type="button"
                aria-label="Nächster Monat"
                onClick={onNextMonth}
                className="btn-press rounded-xl p-2 text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-35"
                disabled={periodLabel === 'Dieser Monat'}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-3">
          <MetricCard
            icon={Clock3}
            label="Gesamtzeit"
            value={usage ? formatScreenTime(usage.totalScreenTimeMs) : '--'}
            hint={`Bildschirmzeit: ${periodLabel}`}
            tone="primary"
          />
          <MetricCard
            icon={Activity}
            label="Entsperrt"
            value={unlocks}
            hint={`Freischaltungen: ${periodLabel}`}
            tone="accent"
          />
          <MetricCard
            icon={TrendingUp}
            label="Top-App"
            value={topUsageEntry ? getAppLabel(topUsageEntry) : '--'}
            hint={topUsageEntry ? formatScreenTime(topUsageEntry.totalTimeMs) : 'Noch keine Nutzungsdaten'}
            tone="success"
          />
        </div>

        {error ? (
          <div className="rounded-2xl border border-destructive/20 bg-destructive/8 px-4 py-4 text-sm text-destructive">
            <p>{error}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onRefresh}
                className="rounded-xl bg-destructive px-3 py-2 text-xs font-bold text-destructive-foreground"
              >
                Erneut prüfen
              </button>
              <button
                type="button"
                onClick={onOpenPermissions}
                className="rounded-xl border border-destructive/30 bg-background/80 px-3 py-2 text-xs font-bold text-foreground"
              >
                Android-Rechte öffnen
              </button>
            </div>
          </div>
        ) : null}
      </GlassCard>
    </section>
  );
}

export function UsageAppListSection({ appDetails, periodLabel, strongestEntryTime, topEntries }: UsageAppListSectionProps) {
  return (
    <section>
      <GlassCard elevation="raised" className="space-y-5">
        <SectionHeader
          eyebrow="Nach App"
          title={`Nutzung: ${periodLabel}`}
          description="Die längsten Nutzungszeiten direkt im Vergleich."
        />

        <div className="space-y-3">
          {topEntries.length === 0 ? (
            <div className="rounded-[1.75rem] bg-background/65 px-4 py-6 text-sm text-muted-foreground">
              Noch keine Nutzungsdaten verfuegbar.
            </div>
          ) : (
            topEntries.map((entry) => {
              const width = strongestEntryTime > 0 ? (entry.totalTimeMs / strongestEntryTime) * 100 : 0;
              const appId = getAppId(entry);
              const appLabel = getAppLabel(entry);
              const matchedApp = getAppLookupKeys(entry)
                .map((key) => appDetails.get(key))
                .find((candidate) => candidate?.icon);
              const appIcon = entry.icon || matchedApp?.icon;
              const appBadge = appLabel
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map((segment) => segment[0]?.toUpperCase() ?? '')
                .join('')
                .slice(0, 2) || 'AP';

              return (
                <div
                  key={appId}
                  className="rounded-[1.75rem] border border-primary/12 bg-[linear-gradient(180deg,hsl(var(--primary)/0.08),hsl(var(--background)/0.82))] px-4 py-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border/60 bg-background/85 shadow-[0_10px_24px_hsl(var(--foreground)/0.08)]">
                        {appIcon ? (
                          <img src={appIcon} alt={`${appLabel} Icon`} className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-xs font-black uppercase tracking-[0.14em] text-foreground/80">
                            {appBadge}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-foreground">{appLabel}</p>
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                        Zuletzt aktiv um {formatTimeLabel(entry.lastUsedTimestamp)}
                        </p>
                      </div>
                    </div>
                    <p className="shrink-0 text-sm font-bold text-foreground">
                      {formatScreenTime(entry.totalTimeMs)}
                    </p>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted/70">
                    <div
                      className="h-full rounded-full bg-[linear-gradient(90deg,hsl(var(--primary)),hsl(var(--accent)))]"
                      style={{ width: `${Math.max(width, 8)}%` }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </GlassCard>
    </section>
  );
}
