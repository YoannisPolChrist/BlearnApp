import { AnimatePresence, motion } from 'framer-motion';
import { Globe, Search, Smartphone, X } from 'lucide-react';
import { getDashboardModeLabel } from '@/modules/dashboard/dashboardModeLabels';
import { getModePalette } from '@/lib/semanticTones';
import type { TargetModeId } from '@/lib/targetModes';
import { cn } from '@/lib/utils';

type BlockedAppEntry = {
  appId: string;
  label: string;
  mode: TargetModeId | null;
};

type BlockedAppsDialogProps = {
  open: boolean;
  isGerman: boolean;
  blockedAppsCount: number;
  blockedWebsitesCount: number;
  blockedSearchTermsCount: number;
  blockedAppEntries: BlockedAppEntry[];
  t: (key: string, params?: Record<string, string | number>) => string;
  onOpenChange: (open: boolean) => void;
};

export function BlockedAppsDialog({
  open,
  isGerman,
  blockedAppsCount,
  blockedWebsitesCount,
  blockedSearchTermsCount,
  blockedAppEntries,
  t,
  onOpenChange,
}: BlockedAppsDialogProps) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            aria-label={isGerman ? 'Liste schließen' : 'Close list'}
            className="absolute inset-0 bg-background/78 lg:backdrop-blur-md"
            onClick={() => onOpenChange(false)}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={t('dashboard.cards.blocked')}
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.985 }}
            transition={{ duration: 0.22 }}
            className="relative z-10 flex max-h-[78vh] w-full max-w-xl flex-col overflow-hidden rounded-t-[1.9rem] border border-border/70 bg-background shadow-[0_30px_90px_hsl(var(--foreground)/0.24)] sm:rounded-[1.9rem]"
          >
            <div className="flex items-start justify-between gap-4 border-b border-border/70 px-5 py-4">
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">
                  {t('dashboard.cards.blocked')}
                </p>
                <h2 className="mt-2 text-xl font-black tracking-[-0.04em] text-foreground">
                  {isGerman ? 'Deine blockierten Apps' : 'Your blocked apps'}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {isGerman
                    ? 'Hier siehst du alle aktuell blockierten Apps mit ihrem zugewiesenen Modus.'
                    : 'This shows every currently blocked app and its assigned mode.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="rounded-full border border-border/70 p-2 text-muted-foreground transition hover:text-foreground"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {blockedAppEntries.length > 0 ? (
                <div className="space-y-3">
                  {blockedAppEntries.map((entry) => (
                    <div
                      key={entry.appId}
                      className="flex items-center justify-between gap-3 rounded-[1.35rem] border border-border/70 bg-[hsl(var(--surface-subtle)/0.72)] px-4 py-3"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                          <Smartphone size={18} />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black tracking-[-0.02em] text-foreground">{entry.label}</p>
                          <p className="truncate text-xs text-muted-foreground">{entry.appId}</p>
                        </div>
                      </div>
                      {entry.mode ? (
                        <span className={cn('rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em]', getModePalette(entry.mode).badge)}>
                          {getDashboardModeLabel(entry.mode, t)}
                        </span>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-[1.35rem] border border-dashed border-border/70 bg-[hsl(var(--surface-subtle)/0.52)] px-4 py-5 text-sm text-muted-foreground">
                  {isGerman ? 'Aktuell sind noch keine Apps blockiert.' : 'There are no blocked apps yet.'}
                </div>
              )}
            </div>

            <div className="grid gap-3 border-t border-border/70 px-5 py-4 sm:grid-cols-3">
              <div className="rounded-[1.2rem] border border-border/70 bg-background/75 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">
                  {t('dashboard.cards.blocked')}
                </p>
                <p className="mt-2 text-xl font-black tracking-[-0.04em] text-foreground">{blockedAppsCount}</p>
              </div>
              <div className="rounded-[1.2rem] border border-border/70 bg-background/75 px-4 py-3">
                <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">
                  <Globe size={12} />
                  {isGerman ? 'Websites' : 'Websites'}
                </p>
                <p className="mt-2 text-xl font-black tracking-[-0.04em] text-foreground">{blockedWebsitesCount}</p>
              </div>
              <div className="rounded-[1.2rem] border border-border/70 bg-background/75 px-4 py-3">
                <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">
                  <Search size={12} />
                  {isGerman ? 'Suchbegriffe' : 'Search terms'}
                </p>
                <p className="mt-2 text-xl font-black tracking-[-0.04em] text-foreground">{blockedSearchTermsCount}</p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
