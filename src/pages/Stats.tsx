import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCcw } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import PageTransition from '@/components/PageTransition';
import { EmotionStatsSection } from '@/components/stats/EmotionStatsSection';
import { StatsSectionTabs } from '@/components/stats/StatsSectionTabs';
import { UsageAppListSection, UsageOverviewSection } from '@/components/stats/UsageStatsSections';
import { VocabStatsSection } from '@/components/stats/VocabStatsSection';
import { useEmotionStatsData } from '@/modules/stats/emotions';
import { useScreenStatsSnapshot, useUsageStatsData } from '@/modules/stats/screenTime';
import type { StatsSection, TimeRange } from '@/modules/stats/types';
import { useReviewMomentum, useVocabChartData } from '@/modules/stats/vocab';
import { useAppStore } from '@/store/useAppStore';
import { useLearningStore } from '@/store/useLearningStore';
import { useAuthStore } from '@/store/useAuthStore';
import { syncAppUsageToFirestore } from '@/services/firebaseProgressSyncService';

const EMPTY_LEARNING_DECKS: Array<{ id: string; name: string }> = [];
const EMPTY_LEARNING_CARDS: Array<{
  deckId: string;
  state: Parameters<typeof useVocabChartData>[1][number]['state'];
}> = [];
const EMPTY_LEARNING_REVIEW_LOGS: Array<{
  cardId: string;
  reviewedAt: number;
  wasCorrect: boolean;
  deckId: string;
}> = [];

export default function StatsPage() {
  const navigate = useNavigate();
  const authUserId = useAuthStore((state) => state.user?.uid);
  const {
    checkins,
    userProfile,
    unlockHistory,
  } = useAppStore(
    useShallow((state) => ({
      checkins: state.checkins,
      userProfile: state.userProfile,
      unlockHistory: state.unlockHistory,
    })),
  );
  const unlocksToday = useMemo(() => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const dayStart = startOfDay.getTime();
    return (unlockHistory ?? []).filter((ts) => ts >= dayStart).length;
  }, [unlockHistory]);
  const { learningDeckMap, learningCardMap, learningReviewLogMap, getDeckStats } = useLearningStore(
    useShallow((state) => ({
      learningDeckMap: state.decks,
      learningCardMap: state.cards,
      learningReviewLogMap: state.reviewLogs,
      getDeckStats: state.getDeckStats,
    })),
  );
  const [section, setSection] = useState<StatsSection>('usage');
  const [range, setRange] = useState<TimeRange>('week');
  const learningDecks = useMemo(
    () => (section === 'vocab' ? Object.values(learningDeckMap) : EMPTY_LEARNING_DECKS),
    [learningDeckMap, section],
  );
  const learningCards = useMemo(
    () => (section === 'vocab' ? Object.values(learningCardMap) : EMPTY_LEARNING_CARDS),
    [learningCardMap, section],
  );
  const learningReviewLogs = useMemo(
    () => (section === 'vocab' ? Object.values(learningReviewLogMap) : EMPTY_LEARNING_REVIEW_LOGS),
    [learningReviewLogMap, section],
  );

  const {
    error,
    installedApps,
    isRefreshing,
    refresh,
    usage,
  } = useScreenStatsSnapshot();
  const {
    appDetails,
    strongestEntryTime,
    topEntries,
    topUsageEntry,
  } = useUsageStatsData(usage, installedApps);
  const {
    activityData,
    emotionRadar,
    maxCount,
    moodData,
    recentMoodEntries,
    topEmotions,
  } = useEmotionStatsData(range, checkins, userProfile);
  const { deckComparison, reviewTrend, stateDistribution } = useVocabChartData(
    learningDecks,
    learningCards,
    learningReviewLogs,
    getDeckStats,
  );
  const reviewMomentum = useReviewMomentum(learningReviewLogs);
  const lineLabelStep = range === 'total' ? 2 : range === 'month' ? 6 : range === 'day' ? 5 : 1;
  const barLabelStep = range === 'total' ? 2 : range === 'month' ? 6 : range === 'day' ? 5 : 1;
  const vocabDueNowTotal = deckComparison.reduce(
    (sum, deck) => sum + (deck.series.find((series) => series.key === 'due')?.value ?? 0),
    0,
  );
  const showDeckComparison = deckComparison.length > 1;

  useEffect(() => {
    if (authUserId) {
      void syncAppUsageToFirestore(authUserId).catch((err) => {
        console.warn('[StatsPage] App usage sync on mount failed:', err);
      });
    }
  }, [authUserId]);

  const handleRefresh = () => {
    void refresh();
    if (authUserId) {
      void syncAppUsageToFirestore(authUserId).catch((err) => {
        console.warn('[StatsPage] App usage sync on refresh failed:', err);
      });
    }
  };

  return (
    <PageTransition variant="hero" disableMotion>
      <div className="app-page">
        <div className="page-header justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="rounded-full p-2 text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft size={22} />
            </button>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground/80">
                Monitoring und Lernverlauf
              </p>
              <h1 className="whitespace-nowrap text-3xl font-black tracking-[-0.05em] text-foreground">Deine Stats</h1>
            </div>
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            className="btn-press inline-flex items-center gap-2 rounded-2xl border border-border bg-background/80 px-4 py-2 text-sm font-bold text-foreground disabled:opacity-50"
            disabled={isRefreshing}
          >
            <RefreshCcw size={16} className={isRefreshing ? 'animate-spin' : ''} />
            Aktualisieren
          </button>
        </div>

        <div className="section-stack">
          <StatsSectionTabs section={section} onSectionChange={setSection} />

          {section === 'usage' ? (
            <>
              <UsageOverviewSection
                error={error}
                onOpenPermissions={() => navigate('/settings#permissions')}
                onRefresh={handleRefresh}
                topUsageEntry={topUsageEntry}
                unlocksToday={unlocksToday}
                usage={usage}
              />
              <UsageAppListSection
                appDetails={appDetails}
                strongestEntryTime={strongestEntryTime}
                topEntries={topEntries}
              />
            </>
          ) : null}

          {section === 'vocab' ? (
            <VocabStatsSection
              deckComparison={deckComparison}
              reviewMomentum={reviewMomentum}
              reviewTrend={reviewTrend}
              showDeckComparison={showDeckComparison}
              stateDistribution={stateDistribution}
              vocabDueNowTotal={vocabDueNowTotal}
            />
          ) : null}

          {section === 'emotions' ? (
            <EmotionStatsSection
              activityData={activityData}
              barLabelStep={barLabelStep}
              emotionRadar={emotionRadar}
              lineLabelStep={lineLabelStep}
              maxCount={maxCount}
              moodData={moodData}
              onRangeChange={setRange}
              range={range}
              recentMoodEntries={recentMoodEntries}
              topEmotions={topEmotions}
            />
          ) : null}
        </div>
      </div>
    </PageTransition>
  );
}
