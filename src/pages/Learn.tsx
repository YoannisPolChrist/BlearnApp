import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowRight, BookOpen, BookMarked, RefreshCw, Sparkles } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import PageTransition from '@/components/PageTransition';
import { AmbientOrbs } from '@/components/ui/AmbientOrbs';
import { MetricCard } from '@/components/ui/MetricCard';
import { QuickActionCard } from '@/components/ui/QuickActionCard';
import { useManualLearningCloudSync } from '@/hooks/useManualLearningCloudSync';
import { ctaFollowThrough, heroContent, heroStat, sectionItem, sectionStagger } from '@/lib/motion';
import { buildLearnHubSummary } from '@/lib/view-models/learn';
import { useLearnHubActions } from '@/store/selectors';
import { useLearningStore } from '@/store/useLearningStore';

const LearnDeckLibraryDialog = lazy(() => import('@/components/learn/LearnDeckLibraryDialog'));

function buildLearnReviewRoute(deckId?: string) {
  return deckId ? `/learn/review?deckId=${deckId}` : '/learn/review';
}

export default function LearnPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [libraryOpen, setLibraryOpen] = useState(false);
  const { activeDeckId, deckMap, getDeckStats, getResolvedPresetForDeck } = useLearningStore(
    useShallow((state) => ({
      activeDeckId: state.activeDeckId,
      deckMap: state.decks,
      getDeckStats: state.getDeckStats,
      getResolvedPresetForDeck: state.getResolvedPresetForDeck,
    })),
  );
  const { seedStarterDeck, exportDeckToJson, setActiveDeck, setDeckReviewMix } = useLearnHubActions();
  const {
    canSync,
    syncError,
    syncing: learningCloudSyncBusy,
    syncLearningCloud,
  } = useManualLearningCloudSync();
  const reduceMotion = useReducedMotion();
  const decks = useMemo(() => Object.values(deckMap), [deckMap]);



  useEffect(() => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'auto',
    });
  }, []);

  useEffect(() => {
    if (searchParams.get('library') !== '1') return;
    setLibraryOpen(true);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('library');
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const { deckStats, activeDeck, totalDueCards } = useMemo(
    () => buildLearnHubSummary({ activeDeckId, decks, getDeckStats, getResolvedPresetForDeck }),
    [activeDeckId, decks, getDeckStats, getResolvedPresetForDeck],
  );

  const handleDeckDownload = (deckId: string) => {
    const payload = exportDeckToJson(deckId);
    const deck = decks.find((entry) => entry.id === deckId);
    if (!payload || !deck) return;

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${deck.name.toLowerCase().replace(/\s+/g, '-')}.json`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <PageTransition variant="hero">
      <div className="app-page overflow-x-hidden">
        <div className="page-header page-header-wrap">
          <button
            onClick={() => navigate(-1)}
            className="btn-press flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-card/70 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground/80">
                Learn
              </p>
              <h1 className="break-words text-2xl font-black tracking-[-0.05em] text-foreground sm:text-3xl">
                Learn Mode
              </h1>
            </div>
            <motion.button
              type="button"
              initial="rest"
              animate="rest"
              whileHover={reduceMotion ? 'rest' : 'hover'}
              whileTap={reduceMotion ? 'rest' : 'tap'}
              variants={ctaFollowThrough}
              onClick={() => {
                if (!canSync) {
                  navigate('/settings#account');
                  return;
                }

                void syncLearningCloud();
              }}
              className="btn-press inline-flex min-h-[2.75rem] shrink-0 items-center gap-2 self-center rounded-full border border-border/80 bg-card/85 px-4 py-2.5 text-sm font-black text-foreground shadow-[0_14px_32px_hsl(var(--foreground)/0.08)]"
            >
              <RefreshCw size={16} className={learningCloudSyncBusy ? 'animate-spin' : ''} />
              {learningCloudSyncBusy ? 'Sync laeuft' : canSync ? 'Sync' : 'Sync aktivieren'}
            </motion.button>
          </div>
        </div>

        <div className="page-shell-clip overflow-hidden">
          <motion.div
            variants={sectionStagger}
            initial={reduceMotion ? undefined : 'hidden'}
            animate={reduceMotion ? undefined : 'show'}
            className="mt-6 section-stack"
          >
            <div data-tour-id="tour-learn-hero" className="rounded-[2rem]">
              <motion.section
                variants={sectionItem}
                initial={reduceMotion ? undefined : 'hidden'}
                animate={reduceMotion ? undefined : 'show'}
                className="premium-hero premium-hero-learn premium-shell overflow-hidden p-5 sm:p-6 md:p-8"
              >
                <AmbientOrbs variant="hero" disabled />
                <motion.div
                  variants={heroContent}
                  initial={reduceMotion ? undefined : 'hidden'}
                  animate={reduceMotion ? undefined : 'show'}
                  className="relative z-10 space-y-5 sm:space-y-6"
                >
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-stretch lg:justify-between">
                    <div className="max-w-2xl flex-1">
                      <span className="premium-pill">Learn Hub</span>
                      <div className="mt-4">
                        <h2 className="max-w-xl break-words text-3xl font-black leading-tight tracking-[-0.05em] text-foreground sm:text-4xl">
                          Vokabeln Verwalten
                        </h2>
                      </div>
                      <p className="mt-3 break-words text-sm leading-relaxed text-foreground/76 sm:text-base">
                        Bibliothek, Templates und Cloud-Sync fuer deinen Vokabel-Workflow an einem Ort.
                      </p>
                      {syncError ? (
                        <p className="mt-3 max-w-xl text-sm font-semibold text-destructive">
                          {syncError}
                        </p>
                      ) : null}

                      <motion.button
                        type="button"
                        initial="rest"
                        animate="rest"
                        whileHover={reduceMotion ? 'rest' : 'hover'}
                        whileTap={reduceMotion ? 'rest' : 'tap'}
                        variants={ctaFollowThrough}
                        onClick={() => {
                          if (activeDeck?.id) {
                            navigate(buildLearnReviewRoute(activeDeck.id));
                            return;
                          }
                          setLibraryOpen(true);
                        }}
                        className="btn-press mt-5 flex w-full max-w-xl flex-col items-start rounded-[1.7rem] border border-[hsl(var(--mode-learn-border)/0.62)] bg-[linear-gradient(145deg,hsl(var(--mode-learn)/0.96),hsl(var(--accent)/0.92))] px-5 py-5 text-left text-[hsl(var(--mode-learn-foreground))] shadow-[0_28px_64px_hsl(var(--mode-learn-glow)/0.28)] sm:mt-6 sm:px-6 sm:py-6"
                      >
                        <span className="rounded-full border border-black/10 bg-white/20 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-[hsl(var(--mode-learn-foreground)/0.88)]">
                          Lernsession
                        </span>
                        <span className="mt-4 text-[1.5rem] font-black leading-tight tracking-[-0.05em] sm:text-[1.85rem]">
                          Jetzt Vokabeln lernen
                        </span>
                        <span className="mt-2 max-w-lg text-sm leading-relaxed text-[hsl(var(--mode-learn-foreground)/0.84)] sm:text-base">
                          {activeDeck
                            ? `${activeDeck.name} ist aktiv. Starte direkt deine naechste Review-Session.`
                            : 'Waehle zuerst ein Deck aus deiner Bibliothek oder starte mit einem Template.'}
                        </span>
                        <span className="mt-5 inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-[hsl(var(--mode-learn-foreground)/0.9)]">
                          Direkt starten
                          <ArrowRight size={16} />
                        </span>
                      </motion.button>
                    </div>

                    <div className="grid w-full min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:max-w-[32rem]">
                      <motion.div variants={heroStat}>
                        <MetricCard
                          icon={BookOpen}
                          label="Decks"
                          value={deckStats.length}
                          hint="aktive Lernsammlungen"
                          tone="learn"
                        />
                      </motion.div>
                      <motion.div variants={heroStat}>
                        <MetricCard
                          icon={Sparkles}
                          label="Faellig"
                          value={totalDueCards}
                          hint="bereit fuer Reviews"
                          tone="accent"
                        />
                      </motion.div>
                    </div>
                  </div>

                  <div className="responsive-card-grid" data-tour-id="tour-learn-actions">
                    <QuickActionCard
                      icon={BookMarked}
                      title="Bibliothek"
                      description={
                        activeDeck
                          ? `${deckStats.length} Decks sichtbar. ${activeDeck.name} ist aktuell ausgewaehlt.`
                          : 'Oeffne deine Decks, waehle ein aktives Deck oder exportiere vorhandene Sammlungen.'
                      }
                      onClick={() => setLibraryOpen(true)}
                      tone="accent"
                      motionPreset="hero"
                      badge={deckStats.length > 0 ? `${deckStats.length}` : undefined}
                    />
                    <QuickActionCard
                      icon={Sparkles}
                      title="Templates"
                      description="Fuege neue Vokabel-Vorlagen zu deiner Bibliothek hinzu."
                      onClick={() => navigate('/learn/templates')}
                      tone="learn"
                      motionPreset="hero"
                      badge="Neu"
                    />
                  </div>
                </motion.div>
              </motion.section>
            </div>
          </motion.div>
        </div>

        {libraryOpen ? (
          <Suspense fallback={null}>
            <LearnDeckLibraryDialog
              open={libraryOpen}
              onOpenChange={setLibraryOpen}
              decks={deckStats}
              activeDeckId={activeDeck?.id}
              onSelectDeck={setActiveDeck}
              onReviewMixChange={setDeckReviewMix}
              onStartLearning={(deckId) => navigate(buildLearnReviewRoute(deckId))}
              onExportDeck={handleDeckDownload}
              title="Bibliothek"
              description="Waehle ein Deck mit einem Klick oder starte es direkt von hier."
            />
          </Suspense>
        ) : null}
      </div>
    </PageTransition>
  );
}
