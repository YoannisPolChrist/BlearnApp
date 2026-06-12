import { motion } from 'framer-motion';
import { Lock } from 'lucide-react';
import PageTransition from '@/components/PageTransition';
import { formatCountdown } from '@/lib/view-models/modes';
import { cn } from '@/lib/utils';

interface StrictLockedModeScreenProps {
  remaining: number;
  strictLockScope: string;
  iconClassName: string;
  textClassName: string;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function StrictLockedModeScreen({
  remaining,
  strictLockScope,
  iconClassName,
  textClassName,
  t,
}: StrictLockedModeScreenProps) {
  return (
    <PageTransition>
      <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-4">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center text-center">
          <motion.div
            className={cn('mb-8 flex h-32 w-32 items-center justify-center rounded-full', iconClassName)}
            animate={{ boxShadow: ['0 0 40px hsl(var(--mode-strict-glow) / 0.14)', '0 0 80px hsl(var(--mode-strict-glow) / 0.28)', '0 0 40px hsl(var(--mode-strict-glow) / 0.14)'] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Lock size={48} />
          </motion.div>
          <h1 className="mb-2 font-serif text-3xl font-bold text-foreground">{strictLockScope === 'settings' ? t('modes.locked.settingsTitle') : t('modes.locked.lockTitle')}</h1>
          <p className="mb-8 text-muted-foreground">{strictLockScope === 'settings' ? t('modes.locked.settingsDescription') : t('modes.locked.lockDescription')}</p>
          <div className="mb-8 rounded-2xl border border-border bg-card/60 px-8 py-6">
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">{t('modes.locked.countdownLabel')}</p>
            <motion.p className={cn('font-mono text-4xl font-black', textClassName)} key={Math.floor(remaining / 1000)} initial={{ scale: 1.05, opacity: 0.7 }} animate={{ scale: 1, opacity: 1 }}>{formatCountdown(remaining)}</motion.p>
          </div>
        </motion.div>
      </div>
    </PageTransition>
  );
}
