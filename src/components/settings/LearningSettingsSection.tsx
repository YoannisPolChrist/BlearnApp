import { motion } from 'framer-motion';
import GlassCard from '@/components/GlassCard';
import { sectionItem } from '@/lib/motion';

interface LearningSettingsSectionProps {
  appIntroActionLabel: string;
  onOpenTour: () => void;
}

export function LearningSettingsSection({
  appIntroActionLabel,
  onOpenTour,
}: LearningSettingsSectionProps) {
  return (
    <motion.section id="overview" variants={sectionItem} className="section-anchor">
      <GlassCard className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-foreground">App-Einfuehrung</p>
          <p className="mt-1 text-xs text-muted-foreground">Die wichtigsten Funktionen noch einmal ansehen.</p>
        </div>
          <button
            type="button"
            onClick={onOpenTour}
            className="btn-press rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm font-bold text-primary"
          >
            {appIntroActionLabel}
          </button>
      </GlassCard>
    </motion.section>
  );
}
