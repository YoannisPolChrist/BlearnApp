import { Lock } from 'lucide-react';

type Translate = (key: string, vars?: Record<string, unknown>) => string;

interface SettingsLockBannerProps {
  t: Translate;
  strictLockScope: 'full' | 'settings' | null;
}

export function SettingsLockBanner({ t, strictLockScope }: SettingsLockBannerProps) {
  return (
    <div className="mb-4 flex items-center gap-3 rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3">
      <Lock size={16} className="text-destructive" />
      <p className="text-xs font-bold text-destructive">
        {strictLockScope === 'settings' ? t('settings.lock.settings') : t('settings.lock.full')}
      </p>
    </div>
  );
}
