import { motion } from 'framer-motion';
import { Bell, Globe2, Palette } from 'lucide-react';
import type { NotificationPermissionState } from '@/services/notificationService';
import type { AppLanguage } from '@/store/useAppStore';
import GlassCard from '@/components/GlassCard';
import ThemeToggle from '@/components/ThemeToggle';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { sectionItem } from '@/lib/motion';
import { cn } from '@/lib/utils';

type Translate = (key: string, vars?: Record<string, unknown>) => string;
type LanguageOption = {
  label: string;
  value: AppLanguage;
};

interface AppearanceSettingsSectionProps {
  appLanguage: AppLanguage;
  isGerman: boolean;
  notificationPermissionState: NotificationPermissionState;
  notificationStatusLabel: string;
  notificationsEnabled: boolean;
  onAppLanguageChange: (language: AppLanguage) => void;
  onManageLanguages: () => void;
  onNotificationsToggle: (enabled: boolean) => void;
  onOpenNotificationDialog: () => void;
  onThemeChange: (nextTheme: 'light' | 'dark') => void;
  selectableLanguageOptions: ReadonlyArray<LanguageOption>;
  t: Translate;
  theme?: string;
  visibleLanguagePackTiles: ReadonlyArray<LanguageOption>;
}

export function AppearanceSettingsSection({
  appLanguage,
  isGerman,
  notificationPermissionState,
  notificationStatusLabel,
  notificationsEnabled,
  onAppLanguageChange,
  onManageLanguages,
  onNotificationsToggle,
  onOpenNotificationDialog,
  onThemeChange,
  selectableLanguageOptions,
  t,
  theme,
  visibleLanguagePackTiles,
}: AppearanceSettingsSectionProps) {
  return (
    <motion.section id="general" variants={sectionItem} className="section-anchor">
      <GlassCard accentGlow className="space-y-3">
        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">
          {t('settings.general.eyebrow')}
        </p>

        <div className="setting-row">
          <div className="setting-row-main">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Palette size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-foreground">
                {theme === 'dark' ? t('settings.general.themeDark') : t('settings.general.themeLight')}
              </p>
            </div>
          </div>
          <div className="setting-row-control">
            <ThemeToggle onThemeChange={onThemeChange} />
          </div>
        </div>

        <div className="setting-row">
          <div className="setting-row-main">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/10 text-accent">
              <Globe2 size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-foreground">{t('settings.general.languageTitle')}</p>
            </div>
          </div>
          <div className="setting-row-control w-full sm:w-56">
            <div className="space-y-2">
              <Select value={appLanguage} onValueChange={(value) => onAppLanguageChange(value as AppLanguage)}>
                <SelectTrigger className="h-11 rounded-xl border-border bg-card/70 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {selectableLanguageOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div
          data-testid="language-pack-summary"
          className="rounded-[1.6rem] border border-border/70 bg-[linear-gradient(160deg,hsl(var(--background)/0.98),hsl(var(--card)/0.95))] px-4 py-4 shadow-[0_24px_56px_hsl(var(--foreground)/0.06)]"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-bold text-foreground">{t('settings.general.packageTitle')}</p>
            <button
              onClick={onManageLanguages}
              className="btn-press rounded-xl border border-primary/20 bg-primary/10 px-3 py-2 text-xs font-bold text-primary"
            >
              {isGerman ? 'Sprachen verwalten' : 'Manage languages'}
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2.5">
            {visibleLanguagePackTiles.map((pack) => {
              const isActive = appLanguage === pack.value;

              return (
                <span
                  key={pack.value}
                  aria-current={isActive ? 'true' : undefined}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-semibold tracking-[-0.01em]',
                    isActive
                      ? 'border-primary/22 bg-primary/10 text-primary shadow-[0_12px_28px_hsl(var(--primary)/0.14)]'
                      : 'border-border/70 bg-background/80 text-foreground/78',
                  )}
                >
                  <span
                    className={cn(
                      'h-2.5 w-2.5 rounded-full',
                      isActive ? 'bg-primary shadow-[0_0_0_4px_hsl(var(--primary)/0.12)]' : 'bg-foreground/18',
                    )}
                  />
                  <span>{pack.label}</span>
                </span>
              );
            })}
          </div>
        </div>

        <div className="setting-row">
          <div className="setting-row-main">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-success/10 text-success">
              <Bell size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-foreground">{t('settings.notifications.title')}</p>
            </div>
          </div>
          <div className="setting-row-control">
            <div className="flex flex-wrap items-center justify-end gap-2">
              <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${
                notificationPermissionState === 'granted'
                  ? 'bg-success/10 text-success'
                  : notificationPermissionState === 'denied'
                    ? 'bg-destructive/10 text-destructive'
                    : notificationPermissionState === 'unsupported'
                      ? 'bg-muted text-muted-foreground'
                      : 'bg-warning/10 text-warning'
              }`}>
                {notificationStatusLabel}
              </span>
              <button
                onClick={onOpenNotificationDialog}
                className="btn-press rounded-xl border border-primary/20 bg-primary/10 px-3 py-2 text-xs font-bold text-primary"
              >
                {isGerman ? 'Bereiche' : 'Categories'}
              </button>
              <Switch checked={notificationsEnabled} onCheckedChange={onNotificationsToggle} />
            </div>
          </div>
        </div>
      </GlassCard>
    </motion.section>
  );
}
