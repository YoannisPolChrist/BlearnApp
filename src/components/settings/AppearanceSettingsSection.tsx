import { motion } from 'framer-motion';
import { Bell, Globe2, Palette } from 'lucide-react';
import { getLanguageLabel, type SupportedAppLanguage } from '@/lib/languages';
import type { NotificationPermissionState } from '@/services/notificationService';
import GlassCard from '@/components/GlassCard';
import ThemeToggle from '@/components/ThemeToggle';
import { Switch } from '@/components/ui/switch';
import { sectionItem } from '@/lib/motion';

type Translate = (key: string, vars?: Record<string, unknown>) => string;

interface AppearanceSettingsSectionProps {
  activeLanguage: SupportedAppLanguage;
  isGerman: boolean;
  notificationPermissionState: NotificationPermissionState;
  notificationStatusLabel: string;
  notificationsEnabled: boolean;
  onManageLanguages: () => void;
  onNotificationsToggle: (enabled: boolean) => void;
  onOpenNotificationDialog: () => void;
  onThemeChange: (nextTheme: 'light' | 'dark') => void;
  t: Translate;
  theme?: string;
}

export function AppearanceSettingsSection({
  activeLanguage,
  isGerman,
  notificationPermissionState,
  notificationStatusLabel,
  notificationsEnabled,
  onManageLanguages,
  onNotificationsToggle,
  onOpenNotificationDialog,
  onThemeChange,
  t,
  theme,
}: AppearanceSettingsSectionProps) {
  return (
    <motion.section id="general" variants={sectionItem} className="section-anchor">
      <GlassCard accentGlow className="space-y-3">
        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">
          {t('settings.general.eyebrow')}
        </p>

        <div className="setting-row">
          <div className="setting-row-main">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Palette size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-foreground">
                {theme === 'dark' ? t('settings.general.themeDark') : t('settings.general.themeLight')}
              </p>
            </div>
          </div>
          <div className="setting-row-control">
            <ThemeToggle
              variant="segmented"
              lightLabel={t('settings.general.themeLight')}
              darkLabel={t('settings.general.themeDark')}
              onThemeChange={onThemeChange}
            />
          </div>
        </div>

        <div data-testid="language-pack-summary" className="rounded-2xl border border-border/70 bg-muted/20 p-3">
          <div className="setting-row-main">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/10 text-xl shadow-[inset_0_1px_0_hsl(var(--card)/0.5)]" aria-hidden="true">
              {LANGUAGE_FLAGS[activeLanguage]}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-foreground">{getLanguageLabel(activeLanguage)}</p>
            </div>
          </div>
          <button
            type="button"
            aria-label={isGerman ? 'Sprachen verwalten' : 'Manage languages'}
            onClick={onManageLanguages}
            className="btn-press mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-primary/24 bg-primary/12 px-4 py-3 text-sm font-black text-primary shadow-[0_10px_24px_hsl(var(--primary)/0.12)] transition-colors hover:bg-primary/16"
          >
            <Globe2 size={16} aria-hidden="true" />
            {isGerman ? 'Verwalten' : 'Manage'}
          </button>
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

const LANGUAGE_FLAGS: Record<SupportedAppLanguage, string> = {
  de: '🇩🇪',
  en: '🇺🇸',
  fr: '🇫🇷',
  es: '🇪🇸',
  it: '🇮🇹',
  ar: '🇸🇦',
};
