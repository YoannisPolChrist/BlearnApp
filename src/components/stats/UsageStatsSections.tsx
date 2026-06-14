import { Activity, Clock3, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import GlassCard from '@/components/GlassCard';
import { MetricCard } from '@/components/ui/MetricCard';
import { SectionHeader } from '@/components/ui/SectionHeader';
import type { AppUsageEntry, InstalledApp, MonitoringStatus, ScreenTimeSummary } from '@/plugins/ScreenTimePlugin';
import { formatScreenTime, getAppId, getAppLabel } from '@/services/screenTimeNormalization';
import { denseListItem, denseListStagger, sectionItem } from '@/lib/motion';
import {
  formatTaskComponentLabel,
  formatTaskSummary,
  formatTimeLabel,
  getAppLookupKeys,
} from '@/modules/stats/screenTime';

type UsageOverviewSectionProps = {
  currentAppId: string;
  currentAppLabel: string;
  error: string | null;
  lastUpdatedAt: number | null;
  onOpenPermissions: () => void;
  onRefresh: () => void;
  status: MonitoringStatus | null;
  topUsageEntry?: AppUsageEntry;
  unlocksToday: number;
  usage: ScreenTimeSummary | null;
};

type UsageAppListSectionProps = {
  appDetails: Map<string, InstalledApp>;
  strongestEntryTime: number;
  topEntries: AppUsageEntry[];
};

export function UsageOverviewSection({
  currentAppId,
  currentAppLabel,
  error,
  lastUpdatedAt,
  onOpenPermissions,
  onRefresh,
  status,
  topUsageEntry,
  unlocksToday,
  usage,
}: UsageOverviewSectionProps) {
  return (
    <motion.section id="stats-section-usage" variants={sectionItem}>
      <GlassCard elevation="raised" accentGlow className="space-y-5">
        <SectionHeader
          eyebrow="Heute"
          title="App-Nutzung"
          description="Wie lange welche App heute genutzt wurde, direkt in einer Ansicht."
        />

        <div className="grid grid-cols-1 gap-3">
          <MetricCard
            icon={Clock3}
            label="Gesamtzeit"
            value={usage ? formatScreenTime(usage.totalScreenTimeMs) : '--'}
            hint="Bildschirmzeit heute"
            tone="primary"
          />
          <MetricCard
            icon={Activity}
            label="Entsperrt"
            value={unlocksToday}
            hint="Freischaltungen heute"
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

        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-2xl border border-primary/15 bg-primary/8 px-4 py-4">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">
              Aktive App
            </p>
            <p className="mt-2 text-lg font-black tracking-[-0.03em] text-foreground">
              {currentAppLabel}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {currentAppId ? 'Gerade im Vordergrund erkannt.' : 'Es wurde noch keine aktive App erkannt.'}
            </p>
          </div>

          <div className="rounded-2xl border border-accent/20 bg-accent/10 px-4 py-4">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">
              Zuletzt aktualisiert
            </p>
            <p className="mt-2 text-lg font-black tracking-[-0.03em] text-foreground">
              {formatTimeLabel(lastUpdatedAt ?? undefined)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {status?.monitoringActive ? 'Monitoring ist aktiv.' : 'Monitoring ist aktuell nicht aktiv.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold ${
              status?.monitoringActive ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
            }`}
          >
            Monitoring {status?.monitoringActive ? 'aktiv' : 'inaktiv'}
          </span>
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold ${
              status?.overlayPermission ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning'
            }`}
          >
            Overlay {status?.overlayPermission ? 'bereit' : 'fehlt'}
          </span>
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold ${
              status?.accessibilityPermission ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning'
            }`}
          >
            Accessibility {status?.accessibilityPermission ? 'bereit' : 'fehlt'}
          </span>
          <span className="rounded-full bg-background px-3 py-1 text-xs font-bold text-muted-foreground">
            Aktualisiert {formatTimeLabel(lastUpdatedAt ?? undefined)}
          </span>
        </div>

        {status?.taskDiagnostics ? (
          <div className="rounded-[1.75rem] border border-border/70 bg-background/65 px-4 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">
                  Android Runtime
                </p>
                <p className="mt-2 text-sm font-bold text-foreground">
                  Activity {formatTaskComponentLabel(status.taskDiagnostics.currentActivityClass)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${
                    status.taskDiagnostics.mainTaskAvailable
                      ? 'bg-success/15 text-success'
                      : 'bg-warning/15 text-warning'
                  }`}
                >
                  Main-Task {status.taskDiagnostics.mainTaskAvailable ? 'bereit' : 'fehlt'}
                </span>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${
                    status.taskDiagnostics.blockingTaskActive
                      ? 'bg-primary/15 text-primary'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  Blocking-Task {status.taskDiagnostics.blockingTaskActive ? 'aktiv' : 'weg'}
                </span>
              </div>
            </div>

            <div className="mt-3 space-y-2">
              {status.taskDiagnostics.appTasks.length > 0 ? (
                status.taskDiagnostics.appTasks.map((task, index) => (
                  <div
                    key={`${task.baseActivity ?? 'base'}-${task.topActivity ?? 'top'}-${index}`}
                    className="rounded-2xl border border-border/60 bg-card/70 px-3 py-3"
                  >
                    <p className="text-[11px] font-black uppercase tracking-[0.14em] text-muted-foreground">
                      App-Task {index + 1}
                    </p>
                    <p className="mt-1 text-sm font-bold text-foreground">
                      {formatTaskSummary(task)}
                    </p>
                    {task.baseIntentComponent ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Intent {formatTaskComponentLabel(task.baseIntentComponent)}
                      </p>
                    ) : null}
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">
                  Keine Blearn-Tasks im nativen Snapshot gefunden.
                </p>
              )}
            </div>
          </div>
        ) : null}
      </GlassCard>
    </motion.section>
  );
}

export function UsageAppListSection({ appDetails, strongestEntryTime, topEntries }: UsageAppListSectionProps) {
  return (
    <motion.section variants={sectionItem}>
      <GlassCard elevation="raised" accentGlow className="space-y-5">
        <SectionHeader
          eyebrow="Nach App"
          title="Nutzung heute"
          description="Die laengsten Nutzungszeiten direkt im Vergleich."
        />

        <motion.div variants={denseListStagger} initial="hidden" animate="show" className="space-y-3">
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
                <motion.div
                  key={appId}
                  variants={denseListItem}
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
                </motion.div>
              );
            })
          )}
        </motion.div>
      </GlassCard>
    </motion.section>
  );
}
