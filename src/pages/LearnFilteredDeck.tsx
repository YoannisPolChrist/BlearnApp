import { useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, Sparkles, Shuffle, ListChecks } from 'lucide-react';
import PageTransition from '@/components/PageTransition';
import { AmbientOrbs } from '@/components/ui/AmbientOrbs';
import { MetricCard } from '@/components/ui/MetricCard';
import { QuickActionCard } from '@/components/ui/QuickActionCard';
import { heroContent, heroStat, sectionItem, sectionStagger } from '@/lib/motion';
import { FilteredDeckForm } from '@/components/filtered-deck-lite/FilteredDeckForm';
import { FilteredDeckPreview } from '@/components/filtered-deck-lite/FilteredDeckPreview';
import { FilteredDeckRunHistory } from '@/components/filtered-deck-lite/FilteredDeckRunHistory';
import { useFilteredDeckLite } from '@/hooks/useFilteredDeckLite';

export default function LearnFilteredDeckPage() {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const filteredDeck = useFilteredDeckLite();

  return (
    <PageTransition variant="hero">
      <div className="app-page overflow-x-hidden">
        <div className="page-header page-header-wrap">
          <button
            onClick={() => navigate('/learn')}
            className="btn-press flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-card/70 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground/80">
              Filtered Deck Lite
            </p>
            <h1 className="break-words text-2xl font-black tracking-[-0.05em] text-foreground sm:text-3xl">
              Temporaere Lernstapel
            </h1>
          </div>
        </div>

        <div className="page-shell-clip overflow-hidden">
          <motion.div
            variants={sectionStagger}
            initial={reduceMotion ? undefined : 'hidden'}
            animate={reduceMotion ? undefined : 'show'}
            className="mt-6 section-stack"
          >
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
                <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                  <div className="max-w-2xl">
                    <span className="premium-pill">Suchfilter</span>
                    <h2 className="mt-4 max-w-2xl break-words text-3xl font-black leading-tight tracking-[-0.05em] text-foreground sm:text-4xl">
                      Stelle temporaere Lernstapel mit deinem Suchfilter zusammen.
                    </h2>
                    <p className="mt-3 break-words text-sm leading-relaxed text-muted-foreground sm:text-base">
                      Nutze Suchlogik, Limits und Verlauf, um fokussierte Lernstapel fuer genau den Abschnitt zu bauen,
                      den du jetzt wiederholen willst.
                    </p>
                  </div>

                  <div className="grid w-full min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:max-w-[34rem]">
                    <motion.div variants={heroStat}>
                      <MetricCard
                        icon={Shuffle}
                        label="Queue"
                        value={filteredDeck.previewCount}
                        hint="Karten in der Vorschau"
                        tone="learn"
                      />
                    </motion.div>
                    <motion.div variants={heroStat}>
                      <MetricCard
                        icon={ListChecks}
                        label="Total"
                        value={filteredDeck.totalCount}
                        hint="verfuegbare Karten im Bestand"
                        tone="accent"
                      />
                    </motion.div>
                  </div>
                </div>

                <div className="responsive-card-grid">
                  <QuickActionCard
                    icon={Shuffle}
                    title="Ausfuehren"
                    description="Das aktuelle Setup in die Session-Queue uebernehmen."
                    onClick={filteredDeck.runDefinition}
                    tone="learn"
                    badge="Run"
                  />
                  <QuickActionCard
                    icon={Sparkles}
                    title="Speichern"
                    description="Definition fuer spaetere Route-/Store-Integration ablegen."
                    onClick={filteredDeck.saveDefinition}
                    tone="accent"
                    badge="Save"
                  />
                </div>
              </motion.div>
            </motion.section>

            <motion.section variants={sectionItem} className="grid gap-4 xl:grid-cols-[1.08fr_.92fr]">
              <div className="space-y-4">
                <FilteredDeckForm
                  definition={filteredDeck.definition}
                  deckOptions={filteredDeck.decks}
                  onDefinitionNameChange={filteredDeck.setDefinitionName}
                  onSelectedDeckIdChange={filteredDeck.setSelectedDeckId}
                  onPrimaryQueryChange={filteredDeck.setPrimaryQuery}
                  onSecondaryQueryChange={filteredDeck.setSecondaryQuery}
                  onLimitChange={filteredDeck.setLimit}
                  onRescheduleChange={filteredDeck.setReschedule}
                  onAllowEmptyChange={filteredDeck.setAllowEmpty}
                  onDelayAgainChange={filteredDeck.setDelayAgain}
                  onDelayHardChange={filteredDeck.setDelayHard}
                  onDelayGoodChange={filteredDeck.setDelayGood}
                  onSaveDefinition={filteredDeck.saveDefinition}
                  onRunDefinition={filteredDeck.runDefinition}
                />

                <FilteredDeckPreview
                  previewRows={filteredDeck.previewRows}
                  previewCount={filteredDeck.previewCount}
                  totalCount={filteredDeck.totalCount}
                />
              </div>

              <FilteredDeckRunHistory
                history={filteredDeck.runHistory}
                onClearHistory={filteredDeck.clearHistory}
              />
            </motion.section>
          </motion.div>
        </div>
      </div>
    </PageTransition>
  );
}
