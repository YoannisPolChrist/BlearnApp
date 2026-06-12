import { motion } from 'framer-motion';
import { sectionItem } from '@/lib/motion';
import { STATS_SECTION_LABELS } from '@/modules/stats/constants';
import type { StatsSection } from '@/modules/stats/types';

type StatsSectionTabsProps = {
  section: StatsSection;
  onSectionChange: (section: StatsSection) => void;
};

export function StatsSectionTabs({ section, onSectionChange }: StatsSectionTabsProps) {
  return (
    <motion.section variants={sectionItem}>
      <div
        role="tablist"
        aria-label="Statistikbereiche"
        className="grid w-full grid-cols-3 gap-2 rounded-[1.85rem] border border-border/70 bg-card/60 p-2 shadow-[0_20px_50px_-32px_rgba(15,23,42,0.5)] lg:backdrop-blur-xl"
      >
        {(Object.entries(STATS_SECTION_LABELS) as Array<[StatsSection, string]>).map(([key, label]) => {
          const isActive = section === key;

          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`stats-section-${key}`}
              onClick={() => onSectionChange(key)}
              className={`inline-flex min-h-[3.4rem] items-center justify-center whitespace-nowrap rounded-[1.3rem] border px-3 py-2 text-[13px] font-black tracking-[-0.02em] transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                isActive
                  ? 'border-primary/45 bg-primary text-primary-foreground shadow-[0_18px_40px_-24px_hsl(var(--primary)/0.9)]'
                  : 'border-border/70 bg-background/45 text-muted-foreground hover:border-primary/25 hover:bg-background/80 hover:text-foreground'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </motion.section>
  );
}
