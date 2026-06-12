import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, BookOpen, Search, Shapes, Sparkles } from 'lucide-react';
import PageTransition from '@/components/PageTransition';
import { AmbientOrbs } from '@/components/ui/AmbientOrbs';
import { MetricCard } from '@/components/ui/MetricCard';
import { QuickActionCard } from '@/components/ui/QuickActionCard';
import { heroContent, heroStat, sectionItem, sectionStagger } from '@/lib/motion';
import { CardBrowserToolbar } from '@/components/learn-browser/CardBrowserToolbar';
import { CardBrowserTable } from '@/components/learn-browser/CardBrowserTable';
import { CardInspectorDrawer } from '@/components/learn-browser/CardInspectorDrawer';
import { StructuredSearchDrawer } from '@/components/learn-browser/StructuredSearchDrawer';
import { useCardBrowser } from '@/hooks/useCardBrowser';

export default function LearnBrowserPage() {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const browser = useCardBrowser();
  const [searchDrawerOpen, setSearchDrawerOpen] = useState(true);

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
              Learn Browser
            </p>
            <h1 className="break-words text-2xl font-black tracking-[-0.05em] text-foreground sm:text-3xl">
              Karten inspizieren und strukturieren
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
                    <span className="premium-pill">Browser in Learn</span>
                    <h2 className="mt-4 max-w-2xl break-words text-3xl font-black leading-tight tracking-[-0.05em] text-foreground sm:text-4xl">
                      Karten, Tags und Fälligkeiten in einer ruhigen Arbeitsfläche.
                    </h2>
                    <p className="mt-3 break-words text-sm leading-relaxed text-muted-foreground sm:text-base">
                      Dieser Bereich ist schon als echte Arbeitsoberfläche gedacht: links die Query, rechts die Tabelle,
                      in der Mitte der Inspektor.
                    </p>
                  </div>

                  <div className="grid w-full min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:max-w-[34rem]">
                    <motion.div variants={heroStat}>
                      <MetricCard
                        icon={BookOpen}
                        label="Karten"
                        value={browser.totalCount}
                        hint="im aktuellen Datenbestand"
                        tone="learn"
                      />
                    </motion.div>
                    <motion.div variants={heroStat}>
                      <MetricCard
                        icon={Sparkles}
                        label="Gefiltert"
                        value={browser.visibleCount}
                hint="Treffer für die aktuelle Suche"
                        tone="accent"
                      />
                    </motion.div>
                  </div>
                </div>

                <div className="responsive-card-grid">
                  <QuickActionCard
                    icon={Search}
                    title="Suchen"
                    description="Freitext, Deck und Status im Browser zusammenfuehren."
                    onClick={() => browser.applySearchDraft()}
                    tone="learn"
                    badge="Aktiv"
                  />
                  <QuickActionCard
                    icon={Shapes}
                    title="Gespeicherte Suchen"
                    description="Wiederkehrende Filterkombinationen direkt wiederverwenden."
                    onClick={() => setSearchDrawerOpen(true)}
                    tone="accent"
                    badge={browser.savedSearches.length > 0 ? `${browser.savedSearches.length}` : 'Neu'}
                  />
                </div>
              </motion.div>
            </motion.section>

            <motion.section variants={sectionItem} className="grid gap-4 xl:grid-cols-[1.2fr_.8fr]">
              <div className="space-y-4">
                <CardBrowserToolbar
                  activeDeckId={browser.activeDeckId}
                  deckOptions={browser.deckOptions}
                  filters={browser.filters}
                  onSearchDraftChange={browser.setSearchDraft}
                  onApplySearchDraft={browser.applySearchDraft}
                  onSelectedDeckIdChange={browser.setSelectedDeckId}
                  onStateFilterChange={browser.setStateFilter}
                  onSortByChange={browser.setSortBy}
                  onSortDirectionChange={browser.setSortDirection}
                  onOpenSearchDrawer={() => setSearchDrawerOpen(true)}
                  resultCount={browser.visibleCount}
                  totalCount={browser.totalCount}
                />

                <CardBrowserTable
                  rows={browser.visibleRows}
                  selectedCardId={browser.selectedRow?.cardId}
                  onSelectCard={browser.selectRow}
                />
              </div>

              <div className="space-y-4">
                <CardInspectorDrawer
                  row={browser.selectedRow}
                  onOpenReview={(deckId) => navigate(`/learn/review?deckId=${deckId}`)}
                  onClearSelection={browser.clearSelection}
                />

                <StructuredSearchDrawer
                  open={searchDrawerOpen}
                  onToggleOpen={() => setSearchDrawerOpen((current) => !current)}
                  searchText={browser.filters.searchText}
                  onSearchTextChange={browser.setSearchDraft}
                  savedSearches={browser.savedSearches}
                  onSaveSearch={browser.saveSearch}
                  onApplySavedSearch={browser.applySavedSearch}
                  onDeleteSavedSearch={browser.deleteSavedSearch}
                />
              </div>
            </motion.section>
          </motion.div>
        </div>
      </div>
    </PageTransition>
  );
}
