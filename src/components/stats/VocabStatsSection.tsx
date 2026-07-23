import type { ComponentProps } from 'react';
import { Activity, BookOpen, ChevronLeft, ChevronRight } from 'lucide-react';
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
import type { TimeRange, VocabDeckComparisonDatum } from '@/modules/stats/types';

type VocabStatsSectionProps = {
  deckComparison: VocabDeckComparisonDatum[];
  onNextMonth: () => void;
  onPreviousMonth: () => void;
  onRangeChange: (range: TimeRange) => void;
  periodLabel: string;
  range: TimeRange;
  reviewMomentum: number;
  reviewTrend: ComponentProps<typeof ComparisonLineChart>['data'];
  showDeckComparison: boolean;
  stateDistribution: ComponentProps<typeof DonutChart>['data'];
  vocabDueNowTotal: number;
};

export function VocabStatsSection({
  deckComparison,
  onNextMonth,
  onPreviousMonth,
  onRangeChange,
  periodLabel,
  range,
  reviewMomentum,
  reviewTrend,
  showDeckComparison,
  stateDistribution,
  vocabDueNowTotal,
}: VocabStatsSectionProps) {
  return (
    <motion.section id="stats-section-vocab" data-tour-id="tour-stats-vocab" variants={sectionItem}>
      <GlassCard elevation="raised" className="space-y-6">
        <SectionHeader
          eyebrow={periodLabel}
          title="Lernfortschritt"
          description="Was du gerade lernst, wie konstant du dranbleibst und wie viel offen ist."
        />

        <div className="space-y-3">
          <div role="tablist" aria-label="Zeitraum des Lernfortschritts" className="grid grid-cols-4 gap-2 rounded-2xl bg-muted/60 p-1">
            {([
              ['day', 'Tag'],
              ['week', 'Woche'],
              ['month', 'Monat'],
              ['total', 'Gesamt'],
            ] as const).map(([nextRange, label]) => (
              <button
                key={nextRange}
                type="button"
                role="tab"
                aria-selected={range === nextRange}
                onClick={() => onRangeChange(nextRange)}
                className={`rounded-xl px-2 py-2 text-xs font-bold transition-colors ${
                  range === nextRange
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {range === 'month' ? (
            <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-background/55 px-2 py-1.5">
              <button
                type="button"
                aria-label="Vorheriger Lernmonat"
                onClick={onPreviousMonth}
                className="btn-press rounded-xl p-2 text-foreground hover:bg-muted"
              >
                <ChevronLeft size={18} />
              </button>
              <p aria-live="polite" className="text-sm font-bold text-foreground">{periodLabel}</p>
              <button
                type="button"
                aria-label="Nächster Lernmonat"
                onClick={onNextMonth}
                className="btn-press rounded-xl p-2 text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-35"
                disabled={periodLabel === 'Dieser Monat'}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <MetricCard icon={Activity} label="Gelernt" value={reviewMomentum} hint={`erstmals gelernte Karten: ${periodLabel}`} tone="primary" />
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
