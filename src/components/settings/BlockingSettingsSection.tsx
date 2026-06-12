import { motion } from 'framer-motion';
import { Shield, ShieldCheck, Wallet } from 'lucide-react';
import type { UserProfile } from '@/store/appStore.types';
import GlassCard from '@/components/GlassCard';
import { cardCascade, cardCascadeItem, sectionItem } from '@/lib/motion';

type Translate = (key: string, vars?: Record<string, unknown>) => string;

interface BlockingSettingsSectionProps {
  blockedSearchTermsCount: number;
  isGerman: boolean;
  locked: boolean;
  onForceReleaseLock: () => void;
  onOpenModes: () => void;
  onOpenWallet: () => void;
  showForceReleaseEscape: boolean;
  t: Translate;
  userProfile: UserProfile;
}

export function BlockingSettingsSection({
  blockedSearchTermsCount,
  isGerman,
  locked,
  onForceReleaseLock,
  onOpenModes,
  onOpenWallet,
  showForceReleaseEscape,
  t,
  userProfile,
}: BlockingSettingsSectionProps) {
  return (
    <motion.section id="areas" variants={sectionItem} className="section-anchor">
      <p className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">
        {t('settings.areas.title')}
      </p>
      <motion.div variants={cardCascade} initial="hidden" animate="show" className="responsive-card-grid">
        <motion.div variants={cardCascadeItem}>
          <GlassCard interactive={!locked} accentGlow onClick={() => !locked && onOpenModes()} className={locked ? 'opacity-60' : ''}>
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
              <Shield size={20} className="text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-foreground">{t('settings.areas.modesTitle')}</p>
            </div>
          </div>
          </GlassCard>

          {showForceReleaseEscape ? (
            <div className="mt-2 rounded-2xl border border-warning/30 bg-warning/8 px-4 py-3">
              <p className="text-xs font-bold text-warning">
                {isGerman
                  ? 'Strikmodus-Sperre aktiv \u2014 Zeitraum gerade nicht aktiv'
                  : 'Strict lock active \u2014 schedule window not currently active'}
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-foreground/72">
                {isGerman
                  ? 'Die Sperre ist aus einer fr\u00fcheren Aktivierung erhalten geblieben. Du kannst sie jetzt manuell aufheben.'
                  : 'The lock persisted from a previous activation. You can manually release it now.'}
              </p>
              <button
                type="button"
                onClick={onForceReleaseLock}
                className="btn-press mt-3 rounded-xl border border-warning/40 bg-warning/16 px-4 py-2 text-xs font-bold text-warning"
              >
                {isGerman ? 'Strikmodus aufheben' : 'Release strict lock'}
              </button>
            </div>
          ) : null}
        </motion.div>

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
          <GlassCard accentGlow className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted/70">
              <ShieldCheck size={20} className="text-foreground" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-foreground">{t('settings.areas.profileTitle')}</p>
              <p className="text-xs text-muted-foreground">
                {t('settings.areas.sessions', { count: userProfile.totalSessions })}
              </p>
            </div>
          </div>
          <div className="premium-divider" />
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{t('settings.areas.challenges')}</p>
              <p className="font-bold text-foreground">{userProfile.totalChallengesCompleted}</p>
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{t('settings.areas.blockedTerms')}</p>
              <p className="font-bold text-foreground">{blockedSearchTermsCount}</p>
            </div>
          </div>
          </GlassCard>
        </motion.div>
      </motion.div>
    </motion.section>
  );
}
