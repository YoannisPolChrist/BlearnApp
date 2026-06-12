import { useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  BookOpen,
  Compass,
  FilePlus2,
  Globe2,
  Languages,
  Loader2,
  MessageSquare,
  Sparkles,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import { useShallow } from 'zustand/react/shallow';
import GlassCard from '@/components/GlassCard';
import { AmbientOrbs } from '@/components/ui/AmbientOrbs';
import { MetricCard } from '@/components/ui/MetricCard';
import { QuickActionCard } from '@/components/ui/QuickActionCard';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { heroContent, heroStat, sectionItem, sectionStagger } from '@/lib/motion';
import {
  getFeaturedDeckTemplates,
  isFeaturedDeckTemplateImported,
  type FeaturedDeckTemplate,
} from '@/lib/learning';
import { showSuccessFeedback } from '@/lib/successFeedback';
import { tonePalettes, type SemanticTone } from '@/lib/semanticTones';
import { useLearnStudioActions } from '@/store/selectors';
import { useLearningStore } from '@/store/useLearningStore';
import { cn } from '@/lib/utils';

interface LearnTemplatesContentProps {
  onOpenLearn: () => void;
}

interface TemplatePresentation {
  icon: LucideIcon;
  ribbonClassName: string;
  tone: Extract<SemanticTone, 'primary' | 'accent' | 'learn' | 'breathing'>;
}

function getTemplatePresentation(template: FeaturedDeckTemplate): TemplatePresentation {
  switch (template.accent) {
    case 'arabic':
      return {
        icon: Globe2,
        ribbonClassName:
          'from-[hsl(var(--accent)/0.3)] via-[hsl(var(--mode-learn-glow)/0.18)] to-transparent',
        tone: 'accent',
      };
    case 'spanish':
      return {
        icon: Compass,
        ribbonClassName:
          'from-[hsl(var(--mode-learn-glow)/0.34)] via-[hsl(var(--accent)/0.16)] to-transparent',
        tone: 'learn',
      };
    case 'italian':
      return {
        icon: BookOpen,
        ribbonClassName:
          'from-[hsl(var(--primary)/0.28)] via-[hsl(var(--mode-breathing-glow)/0.14)] to-transparent',
        tone: 'primary',
      };
    case 'french':
    default:
      return {
        icon: MessageSquare,
        ribbonClassName:
          'from-[hsl(var(--mode-breathing-glow)/0.3)] via-[hsl(var(--primary)/0.14)] to-transparent',
        tone: 'breathing',
      };
  }
}

export function LearnTemplatesContent({
  onOpenLearn,
}: LearnTemplatesContentProps) {
  const navigate = useNavigate();
  const { deckMap } = useLearningStore(
    useShallow((state) => ({
      deckMap: state.decks,
    })),
  );
  const { importTemplateDeck } = useLearnStudioActions();
  const [importingTemplateId, setImportingTemplateId] = useState<string | null>(null);

  const featuredTemplates = useMemo(() => getFeaturedDeckTemplates(), []);
  const decks = useMemo(() => Object.values(deckMap), [deckMap]);
  const templateCount = featuredTemplates.length;
  const templates = useMemo(
    () => featuredTemplates.map((template) => ({
      template,
      imported: isFeaturedDeckTemplateImported(template, decks),
    })),
    [decks, featuredTemplates],
  );
  const importedTemplatesCount = templates.filter((entry) => entry.imported).length;
  const availableTemplatesCount = templateCount - importedTemplatesCount;

  async function handleImport(template: FeaturedDeckTemplate) {
    if (importingTemplateId) return;

    setImportingTemplateId(template.id);
    try {
      const result = await importTemplateDeck(template.id);

      if (result.status === 'failed') {
        toast.error(`Import fehlgeschlagen: ${result.error || result.job?.error || 'Unbekannter Fehler'}`);
        return;
      }

      if (result.status === 'already-existed') {
        toast.message(`${template.title} war bereits vorhanden.`);
        return;
      }

      if (result.status === 'imported') {
        showSuccessFeedback({
          eyebrow: 'Learn Templates',
          title: template.replaceExistingOnImport ? 'Template aktualisiert' : 'Template hinzugefügt',
          description: template.replaceExistingOnImport
            ? `${template.title} aktualisiert (${result.job?.itemCount || 0} Karten).`
            : `${template.title} importiert (${result.job?.itemCount || 0} Karten).`,
        });
        
        navigate('/learn?library=1', { replace: true });
        if (onOpenLearn) {
          onOpenLearn();
        }
      }
    } finally {
      setImportingTemplateId(null);
    }
  }

  return (
    <motion.div
      variants={sectionStagger}
      initial="hidden"
      animate="show"
      className="section-stack"
    >
      <motion.section
        variants={sectionItem}
        className="premium-hero premium-hero-learn premium-shell p-5 sm:p-6 md:p-8"
      >
        <AmbientOrbs variant="hero" />
        <motion.div
          variants={heroContent}
          initial="hidden"
          animate="show"
          className="relative z-10 space-y-5 sm:space-y-6"
        >
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <span className="premium-pill">On-demand Bibliothek</span>
              <h2 className="mt-4 max-w-2xl break-words text-3xl font-black leading-tight tracking-[-0.05em] text-foreground sm:text-4xl">
                {templateCount} saubere Standardpakete, ohne duplizierte Restkarten.
              </h2>
              <p className="mt-3 break-words text-sm leading-relaxed text-muted-foreground sm:text-base">
                Die Templates bleiben leichtgewichtig sichtbar. Erst beim echten Import wird das
                jeweilige 5000er-Deck geladen, damit Startzeit und Bundle klein bleiben.
              </p>
            </div>

            <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-3 lg:max-w-[29rem]">
              <motion.div variants={heroStat}>
                <MetricCard
                  icon={Languages}
                  label="Standard"
                  value={templateCount}
                  hint="öffentliche Sprachdecks"
                  tone="learn"
                />
              </motion.div>
              <motion.div variants={heroStat}>
                <MetricCard
                  icon={Sparkles}
                  label="Schon aktiv"
                  value={importedTemplatesCount}
                  hint="bereits in deiner Learn-Bibliothek"
                  tone="primary"
                />
              </motion.div>
              <motion.div variants={heroStat}>
                <MetricCard
                  icon={FilePlus2}
                  label="Noch offen"
                  value={availableTemplatesCount}
                  hint="direkt auf dieser Seite importierbar"
                  tone="accent"
                />
              </motion.div>
            </div>
          </div>

          <div className="responsive-card-grid">
            <QuickActionCard
              icon={BookOpen}
              title="Zur Learn-Übersicht"
              description="Zurück zu deinen Decks, Reviews und Importen."
              onClick={onOpenLearn}
              tone="learn"
            />
            <QuickActionCard
              icon={Sparkles}
              title="Nur echte Standardpakete"
              description="Eigene und vorhandene Decks bleiben in der Bibliothek."
              onClick={onOpenLearn}
              tone="accent"
            />
          </div>
        </motion.div>
      </motion.section>

      <motion.section variants={sectionItem}>
        <GlassCard elevation="hero" highlight className="space-y-5">
          <SectionHeader
            eyebrow="Template Dashboard"
            title={`${templateCount} Standardpakete für deinen Start`}
            description="Jedes Paket erscheint genau einmal; Importiertes ist markiert."
          />

          <div className="responsive-card-grid">
            <AnimatePresence initial={false}>
              {templates.map(({ template, imported }) => {
                const presentation = getTemplatePresentation(template);
                const Icon = presentation.icon;
                const isLoading = importingTemplateId === template.id;
                const palette = tonePalettes[presentation.tone];
                const supportsRefreshImport = Boolean(template.replaceExistingOnImport);
                const opensLibrary = imported && !supportsRefreshImport;

                return (
                  <motion.div
                    key={template.id}
                    layout
                    initial={{ opacity: 0, y: 20, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -18, scale: 0.92 }}
                    transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                    className="min-w-0"
                  >
                    <GlassCard
                      elevation="raised"
                      surface="featured"
                      interactive
                      tilt
                      tone={presentation.tone}
                      className="relative h-full overflow-hidden p-0"
                    >
                      <div
                        className={`absolute inset-x-0 top-0 h-28 bg-gradient-to-br ${presentation.ribbonClassName}`}
                      />
                      <div className="relative flex h-full flex-col p-5">
                        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                          <div
                            className={cn(
                              'flex h-12 w-12 items-center justify-center rounded-2xl',
                              palette.icon,
                            )}
                          >
                            <Icon size={22} strokeWidth={2.2} />
                          </div>
                          <div className="flex flex-wrap justify-end gap-2">
                            <span className="premium-pill">{template.language.toUpperCase()}</span>
                            <span
                              className={cn(
                                'rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em]',
                                palette.badge,
                              )}
                            >
                              {template.category}
                            </span>
                            {template.rtl ? <span className="premium-pill">RTL</span> : null}
                            {imported ? (
                              <span className="premium-pill">
                                {supportsRefreshImport ? 'Aktueller Stand ladbar' : 'Schon in Bibliothek'}
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <h3 className="break-words text-xl font-black tracking-[-0.03em] text-foreground">
                          {template.title}
                        </h3>
                        <p className="mt-2 break-words text-sm leading-relaxed text-muted-foreground">
                          {template.description}
                        </p>

                        <div className="mt-4 flex flex-wrap gap-2">
                          {template.highlights.map((item) => (
                            <span
                              key={`${template.id}-${item}`}
                              className="rounded-full border border-border/70 bg-background/75 px-3 py-1 text-[11px] font-bold tracking-[0.04em] text-muted-foreground"
                            >
                              {item}
                            </span>
                          ))}
                        </div>

                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <div className="rounded-2xl bg-background/70 px-4 py-3">
                            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">
                              Karten
                            </p>
                            <p className="mt-2 text-xl font-black tracking-[-0.04em] text-foreground">
                              {template.cardCount.toLocaleString('de-DE')}
                            </p>
                          </div>
                          <div className="rounded-2xl bg-background/70 px-4 py-3">
                            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">
                              Import
                            </p>
                            <p className="mt-2 text-sm font-bold text-foreground">
                              Nur bei Bedarf
                            </p>
                          </div>
                        </div>

                        <motion.button
                          whileHover={{ y: -2, scale: 1.01 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => {
                            if (opensLibrary) {
                              navigate('/learn?library=1');
                            } else {
                              void handleImport(template);
                            }
                          }}
                          disabled={Boolean(importingTemplateId) && importingTemplateId !== template.id}
                          className={cn(
                            'btn-press mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-70',
                            opensLibrary ? 'border border-border bg-background/75 text-foreground' : palette.button,
                          )}
                        >
                          {!opensLibrary && isLoading ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : opensLibrary ? (
                            <BookOpen size={15} />
                          ) : (
                            <Sparkles size={15} />
                          )}
                          {opensLibrary
                            ? 'Zur Bibliothek'
                            : isLoading
                              ? 'Wird geladen...'
                              : supportsRefreshImport && imported
                                ? 'Jean Paul 2.0 neu laden'
                                : 'Jetzt hinzufügen'}
                        </motion.button>
                      </div>
                    </GlassCard>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </GlassCard>
      </motion.section>
    </motion.div>
  );
}
