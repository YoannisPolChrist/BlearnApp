import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCcw } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import PageTransition from '@/components/PageTransition';
import { EmotionStatsSection } from '@/components/stats/EmotionStatsSection';
import { StatsSectionTabs } from '@/components/stats/StatsSectionTabs';
import { UsageAppListSection, UsageOverviewSection } from '@/components/stats/UsageStatsSections';
import { VocabStatsSection } from '@/components/stats/VocabStatsSection';
import { useEmotionStatsData } from '@/modules/stats/emotions';
import { getUsageRangeBounds, useScreenStatsSnapshot, useUsageStatsData } from '@/modules/stats/screenTime';
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

function getStatsSectionFromSearch(search: string): StatsSection {
  const requested = new URLSearchParams(search).get('section');
  return requested === 'usage' || requested === 'emotions' || requested === 'vocab'
    ? requested
    : 'usage';
}

function getStatsPeriodLabel(range: TimeRange, month: Date) {
  if (range === 'day') return 'Heute';
  if (range === 'week') return 'Diese Woche';
  if (range === 'total') return 'Gesamte Historie';
  const isCurrentMonth = month.getFullYear() === new Date().getFullYear()
    && month.getMonth() === new Date().getMonth();
  return isCurrentMonth
    ? 'Dieser Monat'
    : new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' }).format(month);
}

export default function StatsPage() {
  const navigate = useNavigate();
  const location = useLocation();
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
  const [usageRange, setUsageRange] = useState<TimeRange>('day');
  const [usageMonth, setUsageMonth] = useState(() => {
    const current = new Date();
    return new Date(current.getFullYear(), current.getMonth(), 1);
  });
  const usagePeriodLabel = useMemo(() => getStatsPeriodLabel(usageRange, usageMonth), [usageMonth, usageRange]);
  const unlocks = useMemo(() => {
    // Unlocks are local Blearn events. Keep the complete selected calendar period
    // visible, while Android usage itself is capped at the current instant natively.
    const referenceDate = usageRange === 'month' ? usageMonth : new Date();
    const { startMs, endMs } = getUsageRangeBounds(usageRange, referenceDate, Number.MAX_SAFE_INTEGER);
    return (unlockHistory ?? []).filter((timestamp) => timestamp >= startMs && timestamp <= endMs).length;
  }, [unlockHistory, usageMonth, usageRange]);
  const { learningDeckMap, learningCardMap, learningReviewLogMap, getDeckStats } = useLearningStore(
    useShallow((state) => ({
      learningDeckMap: state.decks,
      learningCardMap: state.cards,
      learningReviewLogMap: state.reviewLogs,
      getDeckStats: state.getDeckStats,
    })),
  );
  const [section, setSection] = useState<StatsSection>(() => getStatsSectionFromSearch(location.search));
  const [emotionRange, setEmotionRange] = useState<TimeRange>('week');
  const [vocabRange, setVocabRange] = useState<TimeRange>('day');
  const [vocabMonth, setVocabMonth] = useState(() => {
    const current = new Date();
    return new Date(current.getFullYear(), current.getMonth(), 1);
  });
  const vocabPeriodLabel = useMemo(() => getStatsPeriodLabel(vocabRange, vocabMonth), [vocabMonth, vocabRange]);
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
  } = useScreenStatsSnapshot(usageRange, usageMonth);
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
  } = useEmotionStatsData(emotionRange, checkins, userProfile);
  const { deckComparison, reviewTrend, stateDistribution } = useVocabChartData(
    learningDecks,
    learningCards,
    learningReviewLogs,
    getDeckStats,
  );
  const reviewMomentum = useReviewMomentum(learningReviewLogs, vocabRange, vocabMonth);
  const lineLabelStep = emotionRange === 'total' ? 2 : emotionRange === 'month' ? 6 : emotionRange === 'day' ? 5 : 1;
  const barLabelStep = emotionRange === 'total' ? 2 : emotionRange === 'month' ? 6 : emotionRange === 'day' ? 5 : 1;
  const vocabDueNowTotal = deckComparison.reduce(
    (sum, deck) => sum + (deck.series.find((series) => series.key === 'due')?.value ?? 0),
    0,
  );
  const showDeckComparison = deckComparison.length > 1;

  useEffect(() => {
    setSection(getStatsSectionFromSearch(location.search));
  }, [location.search]);

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
              <h1 data-tour-id="tour-stats-title" className="whitespace-nowrap text-3xl font-black tracking-[-0.05em] text-foreground">Deine Stats</h1>
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

        <div data-tour-id="tour-stats-overview" className="section-stack">
          <StatsSectionTabs section={section} onSectionChange={setSection} />

          {section === 'usage' ? (
            <>
              <UsageOverviewSection
                error={error}
                onOpenPermissions={() => navigate('/settings#permissions')}
                onNextMonth={() => setUsageMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
                onPreviousMonth={() => setUsageMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
                onRefresh={handleRefresh}
                onRangeChange={setUsageRange}
                periodLabel={usagePeriodLabel}
                range={usageRange}
                topUsageEntry={topUsageEntry}
                unlocks={unlocks}
                usage={usage}
              />
              <UsageAppListSection
                appDetails={appDetails}
                periodLabel={usagePeriodLabel}
                strongestEntryTime={strongestEntryTime}
                topEntries={topEntries}
              />
            </>
          ) : null}

          {section === 'vocab' ? (
            <VocabStatsSection
              deckComparison={deckComparison}
              onNextMonth={() => setVocabMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
              onPreviousMonth={() => setVocabMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
              onRangeChange={setVocabRange}
              periodLabel={vocabPeriodLabel}
              range={vocabRange}
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
              onRangeChange={setEmotionRange}
              range={emotionRange}
              recentMoodEntries={recentMoodEntries}
              topEmotions={topEmotions}
            />
          ) : null}

        </div>
      </div>
    </PageTransition>
  );
}
