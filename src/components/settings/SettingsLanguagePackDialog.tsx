import { Check, Download, Globe2, Sparkles } from 'lucide-react';
import { DOWNLOADABLE_APP_LANGUAGE_PACKS } from '@/lib/languages';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { type AppLanguage } from '@/store/useAppStore';
import { cn } from '@/lib/utils';

interface SettingsLanguagePackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appLanguage: AppLanguage;
  installedAppLanguagePacks: AppLanguage[];
  downloadingLanguage: AppLanguage | null;
  onActivateLanguage: (language: AppLanguage) => void;
  onInstallLanguage: (language: AppLanguage) => void;
}

export default function SettingsLanguagePackDialog({
  open,
  onOpenChange,
  appLanguage,
  installedAppLanguagePacks,
  downloadingLanguage,
  onActivateLanguage,
  onInstallLanguage,
}: SettingsLanguagePackDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-hidden rounded-[2rem] border-border bg-[linear-gradient(180deg,hsl(var(--background)/0.98),hsl(var(--card)/0.95))] p-0 sm:max-w-3xl">
        <div className="flex max-h-[85vh] flex-col">
          <DialogHeader className="border-b border-border/70 px-5 py-5 pr-16 sm:px-6 sm:pr-16">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-[1.35rem] border border-accent/20 bg-accent/10 text-accent shadow-[0_14px_34px_hsl(var(--accent)/0.18)]">
                <Globe2 size={20} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                  Sprachpakete
                </p>
                <DialogTitle className="mt-2 text-2xl font-black tracking-[-0.04em] text-foreground">
                  Sprachen verwalten
                </DialogTitle>
                <DialogDescription className="sr-only">
                  Installiere oder aktiviere Sprachpakete fuer die App-Sprache.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="grid gap-3 overflow-y-auto px-5 py-5 sm:grid-cols-2 sm:px-6">
            {DOWNLOADABLE_APP_LANGUAGE_PACKS.map((pack) => {
              const installed = installedAppLanguagePacks.includes(pack.value);
              const isBusy = downloadingLanguage === pack.value;
              const isActive = appLanguage === pack.value;
              const statusLabel = isActive
                ? 'Aktiv'
                : installed
                  ? 'Installiert'
                  : 'Download';
              const shellClassName = isActive
                ? 'border-primary/28 bg-[linear-gradient(145deg,hsl(var(--primary)/0.16),hsl(var(--card)/0.96))] shadow-[0_22px_54px_hsl(var(--primary)/0.14)]'
                : installed
                  ? 'border-success/24 bg-[linear-gradient(145deg,hsl(var(--success)/0.12),hsl(var(--card)/0.96))] shadow-[0_18px_44px_hsl(var(--success)/0.10)]'
                  : 'border-border/70 bg-[linear-gradient(145deg,hsl(var(--surface-subtle)/0.95),hsl(var(--card)/0.94))] shadow-[0_18px_44px_hsl(var(--foreground)/0.06)]';
              const statusClassName = isActive
                ? 'border-primary/18 bg-primary/12 text-primary'
                : installed
                  ? 'border-success/18 bg-success/12 text-success'
                  : 'border-accent/18 bg-accent/10 text-accent';

              return (
                <div
                  key={pack.value}
                  className={cn('flex flex-col gap-4 rounded-[1.6rem] border px-4 py-4', shellClassName)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <div
                        className={cn(
                          'flex h-12 w-12 shrink-0 items-center justify-center rounded-[1.2rem] border bg-background/82 text-sm font-black uppercase tracking-[0.12em] text-foreground',
                          isActive
                            ? 'border-primary/25 shadow-[0_12px_28px_hsl(var(--primary)/0.16)]'
                            : installed
                              ? 'border-success/20 shadow-[0_10px_24px_hsl(var(--success)/0.12)]'
                              : 'border-border/70 shadow-[0_10px_24px_hsl(var(--foreground)/0.08)]',
                        )}
                      >
                        {pack.value.toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-lg font-black tracking-[-0.03em] text-foreground">
                          {pack.label}
                        </p>
                      </div>
                    </div>
                    <span className={cn('rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em]', statusClassName)}>
                      {statusLabel}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <div
                      className={cn(
                        'flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.95rem] border bg-background/82',
                        isActive
                          ? 'border-primary/20 text-primary'
                          : installed
                            ? 'border-success/20 text-success'
                            : 'border-accent/18 text-accent',
                      )}
                    >
                      {installed ? <Check size={14} /> : <Download size={14} />}
                    </div>

                    {installed ? (
                      <button
                        onClick={() => onActivateLanguage(pack.value)}
                        disabled={isActive}
                        className={cn(
                          'btn-press rounded-[1rem] px-3.5 py-2.5 text-xs font-bold disabled:opacity-60',
                          isActive
                            ? 'border border-primary/20 bg-primary/12 text-primary'
                            : 'border border-success/22 bg-success/12 text-success',
                        )}
                      >
                        {isActive ? 'Aktiv' : 'Aktivieren'}
                      </button>
                    ) : (
                      <button
                        onClick={() => onInstallLanguage(pack.value)}
                        disabled={isBusy}
                        className="btn-press inline-flex items-center gap-2 rounded-[1rem] bg-primary px-3.5 py-2.5 text-xs font-bold text-primary-foreground shadow-[0_14px_32px_hsl(var(--primary)/0.22)] disabled:opacity-60"
                      >
                        {!isBusy ? <Sparkles size={14} /> : null}
                        {isBusy ? 'Wird installiert...' : 'Installieren'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
