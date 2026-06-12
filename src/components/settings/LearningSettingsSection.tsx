import { motion } from 'framer-motion';
import GlassCard from '@/components/GlassCard';
import { sectionItem } from '@/lib/motion';

type Translate = (key: string, vars?: Record<string, unknown>) => string;

interface LearningSettingsSectionProps {
  allPermissionsGranted: boolean;
  appIntroActionLabel: string;
  isGerman: boolean;
  modeLabel: string;
  onOpenTour: () => void;
  penaltyAmountSats: number;
  penaltyEnabled: boolean;
  t: Translate;
}

export function LearningSettingsSection({
  allPermissionsGranted,
  appIntroActionLabel,
  isGerman,
  modeLabel,
  onOpenTour,
  penaltyAmountSats,
  penaltyEnabled,
  t,
}: LearningSettingsSectionProps) {
  return (
    <motion.section id="overview" variants={sectionItem} className="section-anchor">
      <p className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">
        {isGerman ? 'Status & Hilfe' : 'Status & help'}
      </p>
      <div className="space-y-3">
        <div className="responsive-card-grid">
          <GlassCard className="surface-success">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-success">
              {t('settings.overview.setupEyebrow')}
            </p>
            <p className="mt-2 text-lg font-black text-foreground">
              {allPermissionsGranted ? t('settings.overview.ready') : t('settings.overview.incomplete')}
            </p>
          </GlassCard>

          <GlassCard>
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">
              {t('settings.overview.activeMode')}
            </p>
            <p className="mt-2 text-lg font-black text-foreground">{modeLabel}</p>
          </GlassCard>

          <GlassCard>
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">
              {t('settings.overview.wallet')}
            </p>
            <p className="mt-2 text-lg font-black text-foreground">
              {penaltyEnabled && penaltyAmountSats ? `${penaltyAmountSats.toLocaleString('de-DE')} sats` : t('common.status.inactive')}
            </p>
          </GlassCard>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onOpenTour}
            className="btn-press rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm font-bold text-primary"
          >
            {appIntroActionLabel}
          </button>
        </div>
      </div>
    </motion.section>
  );
}
