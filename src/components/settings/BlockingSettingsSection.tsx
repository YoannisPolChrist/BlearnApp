import { motion } from 'framer-motion';
import { Wallet, Radio } from 'lucide-react';
import GlassCard from '@/components/GlassCard';
import { RemoteBlockingStatus } from '@/components/settings/RemoteBlockingStatus';
import { Switch } from '@/components/ui/switch';
import { cardCascade, cardCascadeItem, sectionItem } from '@/lib/motion';

type Translate = (key: string, vars?: Record<string, unknown>) => string;

interface BlockingSettingsSectionProps {
  isGerman: boolean;
  remoteBlockingEnabled: boolean;
  onRemoteBlockingToggle: (enabled: boolean) => void;
  onForceReleaseLock: () => void;
  onOpenWallet: () => void;
  showForceReleaseEscape: boolean;
  t: Translate;
}

export function BlockingSettingsSection({
  isGerman,
  remoteBlockingEnabled,
  onRemoteBlockingToggle,
  onForceReleaseLock,
  onOpenWallet,
  showForceReleaseEscape,
  t,
}: BlockingSettingsSectionProps) {
  return (
    <motion.section id="areas" variants={sectionItem} className="section-anchor">
      <p className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">
        {t('settings.areas.title')}
      </p>
      <motion.div variants={cardCascade} initial="hidden" animate="show" className="responsive-card-grid">
        <motion.div variants={cardCascadeItem}>
          <GlassCard interactive accentGlow onClick={onOpenWallet} className="flex items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
            <Wallet size={20} className="text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-foreground">{t('settings.areas.walletTitle')}</p>
          </div>
          </GlassCard>
        </motion.div>

        <motion.div variants={cardCascadeItem}>
          <GlassCard accentGlow className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <Radio size={20} className="text-primary animate-pulse" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-foreground">
                    {t('remoteBlocking.settings.title')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t('remoteBlocking.settings.subtitle')}
                  </p>
                </div>
              </div>
              <div className="shrink-0">
                <Switch
                  checked={remoteBlockingEnabled}
                  onCheckedChange={onRemoteBlockingToggle}
                />
              </div>
            </div>
            <div className="premium-divider" />
            <p className="text-xs leading-relaxed text-muted-foreground/90">
              {t('remoteBlocking.settings.description')}
            </p>
            <RemoteBlockingStatus enabled={remoteBlockingEnabled} />
          </GlassCard>
        </motion.div>
      </motion.div>

      {showForceReleaseEscape ? (
        <div className="mt-3 rounded-2xl border border-warning/30 bg-warning/8 px-4 py-3">
          <p className="text-xs font-bold text-warning">
            {isGerman ? 'Striktmodus-Sperre aktiv — Zeitraum gerade nicht aktiv' : 'Strict lock active — schedule window not currently active'}
          </p>
          <button type="button" onClick={onForceReleaseLock} className="btn-press mt-3 rounded-xl border border-warning/40 bg-warning/16 px-4 py-2 text-xs font-bold text-warning">
            {isGerman ? 'Striktmodus aufheben' : 'Release strict lock'}
          </button>
        </div>
      ) : null}
    </motion.section>
  );
}
