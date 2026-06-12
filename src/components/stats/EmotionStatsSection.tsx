import type { ComponentProps } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  ComparisonLineChart,
  GroupedBarChart,
  RadarProfileChart,
} from '@/components/charts/ChartPrimitives';
import GlassCard from '@/components/GlassCard';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ALL_EMOTIONS, RANGE_LABELS } from '@/modules/stats/constants';
import { getMoodEntrySourceLabel } from '@/modules/stats/emotions';
import type { MoodEntry, TimeRange, TopEmotion } from '@/modules/stats/types';
import {
  chartReveal,
  denseListItem,
  denseListStagger,
  premiumEase,
  sectionItem,
} from '@/lib/motion';

type EmotionStatsSectionProps = {
  activityData: ComponentProps<typeof ComparisonLineChart>['data'];
  barLabelStep: number;
  emotionRadar: ComponentProps<typeof RadarProfileChart>['data'];
  lineLabelStep: number;
  maxCount: number;
  moodData: ComponentProps<typeof GroupedBarChart>['data'];
  onRangeChange: (range: TimeRange) => void;
  range: TimeRange;
  recentMoodEntries: MoodEntry[];
  topEmotions: TopEmotion[];
};

export function EmotionStatsSection({
  activityData,
  barLabelStep,
  emotionRadar,
  lineLabelStep,
  maxCount,
  moodData,
  onRangeChange,
  range,
  recentMoodEntries,
  topEmotions,
}: EmotionStatsSectionProps) {
  const reducedMotion = useReducedMotion();

  return (
    <motion.section id="stats-section-emotions" variants={sectionItem}>
      <GlassCard elevation="raised" className="space-y-5">
        <SectionHeader
          eyebrow="Stimmung"
          title="Stimmung kompakt"
          description="Muster, Verlauf und die letzten Check-ins in einer zusammengezogenen Ansicht."
        />

        <Tabs value={range} onValueChange={(value) => onRangeChange(value as TimeRange)} className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 rounded-[1.5rem] border border-border bg-card/60 p-1 lg:backdrop-blur-xl">
            {(['day', 'week', 'month'] as TimeRange[]).map((entry) => (
              <TabsTrigger
                key={entry}
                value={entry}
                className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary transition-all duration-300"
              >
                {RANGE_LABELS[entry]}
              </TabsTrigger>
            ))}
          </TabsList>

          <AnimatePresence mode="wait">
            <motion.div
              key={range}
              variants={chartReveal}
              initial="hidden"
              animate="show"
              exit={{ opacity: 0, y: -14, scale: 0.992, transition: { duration: 0.16 } }}
              className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]"
            >
              <div className="space-y-4 rounded-[1.75rem] bg-background/55 p-4">
                <div>
                  <p className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    Aktivität - {RANGE_LABELS[range]}
                  </p>
                  <ComparisonLineChart data={activityData} labelStep={lineLabelStep} />
                </div>

                <div>
                  <p className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    Stimmungsverlauf
                  </p>
                  <GroupedBarChart data={moodData} labelStep={barLabelStep} />
                </div>

                {emotionRadar.length >= 3 ? (
                  <div>
                    <p className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                      Emotions-Profil
                    </p>
                    <RadarProfileChart data={emotionRadar} />
                  </div>
                ) : null}
              </div>

              <div className="space-y-4 rounded-[1.75rem] bg-background/55 p-4">
                <div>
                  <p className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    Häufigste Emotionen
                  </p>
                  {topEmotions.length === 0 ? (
                    <p className="rounded-[1.5rem] bg-background/65 px-4 py-6 text-center text-sm text-muted-foreground">
                      Noch keine Check-ins vorhanden
                    </p>
                  ) : (
                    <motion.div variants={denseListStagger} initial="hidden" animate="show" className="space-y-4">
                      {topEmotions.map((emotion, index) => (
                        <motion.div key={emotion.id} variants={denseListItem} className="flex items-center gap-3">
                          <motion.span
                            className="text-2xl"
                            whileHover={reducedMotion ? undefined : { scale: 1.18, rotate: 8 }}
                            transition={{ duration: 0.22, ease: premiumEase }}
                          >
                            {emotion.emoji}
                          </motion.span>
                          <div className="flex-1">
                            <div className="mb-1 flex items-center justify-between">
                              <span className="text-sm font-medium text-foreground">{emotion.label}</span>
                              <span className="text-xs text-muted-foreground">{emotion.count}x</span>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                              <motion.div
                                className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                                initial={{ width: 0 }}
                                animate={{ width: `${(emotion.count / maxCount) * 100}%` }}
                                transition={{
                                  duration: 0.8,
                                  delay: 0.16 + index * 0.08,
                                  ease: premiumEase,
                                }}
                              />
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </motion.div>
                  )}
                </div>

                <div>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                      Letzte Stimmungen
                    </p>
                    <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground/80">
                      3 zuletzt
                    </span>
                  </div>

                  <motion.div variants={denseListStagger} initial="hidden" animate="show" className="space-y-2">
                    {recentMoodEntries.map((entry) => (
                      <motion.div
                        key={entry.id}
                        variants={denseListItem}
                        className="rounded-[1.5rem] bg-background/65 p-4"
                      >
                        <div className="mb-2 flex items-center justify-between">
                          <div className="flex gap-1">
                            {entry.emotions.slice(0, 4).map((emotionId) => {
                              const emotion = ALL_EMOTIONS.find((entry) => entry.id === emotionId);
                              return (
                                <span key={emotionId} className="text-lg">
                                  {emotion?.emoji}
                                </span>
                              );
                            })}
                          </div>
                          <div className="text-right">
                            <span className="block text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground/80">
                              {getMoodEntrySourceLabel(entry.source)}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(entry.timestamp).toLocaleDateString('de-DE', {
                                day: '2-digit',
                                month: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                        </div>
                        {entry.reflection ? (
                          <p className="line-clamp-2 text-sm text-muted-foreground">{entry.reflection}</p>
                        ) : null}
                      </motion.div>
                    ))}

                    {recentMoodEntries.length === 0 ? (
                      <div className="rounded-[1.5rem] bg-background/65 px-4 py-6 text-center text-sm text-muted-foreground">
                        Noch keine Stimmungseintraege vorhanden
                      </div>
                    ) : null}
                  </motion.div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </Tabs>
      </GlassCard>
    </motion.section>
  );
}
