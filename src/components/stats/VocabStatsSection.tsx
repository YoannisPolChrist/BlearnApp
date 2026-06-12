import type { ComponentProps } from 'react';
import { Activity, BookOpen, Clock3, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  ComparisonLineChart,
  DonutChart,
  GroupedBarChart,
} from '@/components/charts/ChartPrimitives';
import GlassCard from '@/components/GlassCard';
import { MetricCard } from '@/components/ui/MetricCard';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { sectionItem } from '@/lib/motion';
import type { VocabDeckComparisonDatum } from '@/modules/stats/types';

type VocabStatsSectionProps = {
  deckComparison: VocabDeckComparisonDatum[];
  reviewMomentum: {
    today: number;
    lastSevenDays: number;
    month: number;
  };
  reviewTrend: ComponentProps<typeof ComparisonLineChart>['data'];
  showDeckComparison: boolean;
  stateDistribution: ComponentProps<typeof DonutChart>['data'];
  vocabDueNowTotal: number;
};

export function VocabStatsSection({
  deckComparison,
  reviewMomentum,
  reviewTrend,
  showDeckComparison,
  stateDistribution,
  vocabDueNowTotal,
}: VocabStatsSectionProps) {
  return (
    <motion.section id="stats-section-vocab" variants={sectionItem}>
      <GlassCard elevation="raised" className="space-y-6">
        <SectionHeader
          eyebrow="Lernen"
          title="Lernfortschritt"
          description="Was du gerade lernst, wie konstant du dranbleibst und wie viel offen ist."
        />

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard icon={Activity} label="Heute gelernt" value={reviewMomentum.today} hint="einzigartige Karten heute" tone="primary" />
          <MetricCard icon={Clock3} label="Letzte 7 Tage" value={reviewMomentum.lastSevenDays} hint="einzigartige Karten diese Woche" tone="accent" />
          <MetricCard icon={TrendingUp} label="Diesen Monat" value={reviewMomentum.month} hint="einzigartige Karten seit Monatsstart" tone="success" />
          <MetricCard icon={BookOpen} label="Offen" value={vocabDueNowTotal} hint="aktuell fällige Karten" tone="warning" />
        </div>

        <GlassCard accentGlow className="space-y-4 p-4">
          <SectionHeader
            eyebrow="Verlauf"
            title="Reviews letzte 14 Tage"
            description="Wie viele Reviews und richtige Antworten in den letzten 14 Tagen gelaufen sind."
          />
          <ComparisonLineChart data={reviewTrend} labelStep={2} />
        </GlassCard>

        <div className={`grid gap-5 ${showDeckComparison ? 'xl:grid-cols-2' : ''}`}>
          <GlassCard accentGlow className="space-y-4 p-4">
            <SectionHeader
              eyebrow="Zustand"
              title="Kartenstatus"
              description="Wie sich deine Vokabeln auf new, learning, review und relearning verteilen."
            />
            <DonutChart data={stateDistribution} />
          </GlassCard>

          {showDeckComparison ? (
            <GlassCard accentGlow className="space-y-4 p-4">
              <SectionHeader
                eyebrow="Decks"
                title="Offene Vokabeln pro Deck"
                description="Die wichtigsten Decks mit due, overdue und Gesamtzahl nebeneinander."
              />
              <GroupedBarChart data={deckComparison} labelStep={1} />
            </GlassCard>
          ) : null}
        </div>
      </GlassCard>
    </motion.section>
  );
}
