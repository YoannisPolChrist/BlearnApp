import { motion, useReducedMotion } from 'framer-motion';
import GlassCard from '@/components/GlassCard';
import { useI18n } from '@/hooks/useI18n';
import { useIsMobile } from '@/hooks/use-mobile';
import { denseListItem, denseListStagger, heroTimeline, heroTimelineItem, premiumEase, shouldAnimateDenseList } from '@/lib/motion';
import { getModePalette } from '@/lib/semanticTones';
import type { ActiveModeId } from '@/lib/targetModes';
import { cn } from '@/lib/utils';
import { ModeBadge, type ModeDefinition, type ModeId, type SelectionClasses } from './shared';

export function ModeChooserSection({
  modes,
  activeModes,
  savedModeSelection,
  selectedMode,
  setSelectedMode,
  getModeSelectionClasses,
  variants,
}: {
  modes: ModeDefinition[];
  activeModes: ActiveModeId[];
  savedModeSelection: Exclude<ModeId, 'lock'> | null;
  selectedMode: ModeId;
  setSelectedMode: (mode: ModeId) => void;
  getModeSelectionClasses: (modeId: ModeId) => SelectionClasses;
  variants?: Record<string, unknown>;
}) {
  const { t } = useI18n();
  const reducedMotion = useReducedMotion();
  const isMobile = useIsMobile();
  const allowHoverMotion = !reducedMotion && !isMobile;
  const allowTapMotion = !reducedMotion;
  const allowModeCascade = shouldAnimateDenseList({
    reducedMotion,
    isMobile,
    itemCount: modes.length,
    maxAnimatedItems: 6,
  });
  return (
    <motion.section variants={variants} className="space-y-4">
      <div data-tour-id="tour-modes-selector" className="rounded-[1.9rem]">
        <GlassCard elevation="hero" surface="hero" tone="primary" accentGlow className="space-y-4 overflow-hidden">
          <motion.div variants={heroTimeline} initial="hidden" animate="show" className="space-y-4">
            <motion.div variants={heroTimelineItem} className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">{t('modes.chooser.eyebrow')}</p>
                <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-foreground">{t('modes.chooser.title')}</h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{t('modes.chooser.description')}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {activeModes.length > 0 ? activeModes.map((mode) => (
                  <motion.div
                    key={mode}
                    initial={reducedMotion ? false : { opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.22, ease: premiumEase }}
                  >
                    <ModeBadge mode={mode} />
                  </motion.div>
                )) : (
                  <span className="rounded-full border border-border/70 bg-background/70 px-3 py-1 text-[11px] font-bold text-muted-foreground">
                    {t('modes.chooser.noneActive')}
                  </span>
                )}
              </div>
            </motion.div>

            <motion.div
              variants={allowModeCascade ? denseListStagger : undefined}
              initial={allowModeCascade ? 'hidden' : false}
              animate={allowModeCascade ? 'show' : undefined}
              className="grid gap-3 md:grid-cols-2 xl:grid-cols-5"
            >
            {modes.map((mode) => {
              const Icon = mode.icon;
              const selected = selectedMode === mode.id;
              const active = activeModes.includes(mode.id as ActiveModeId);
              const saved = savedModeSelection === mode.id;
              const styles = getModeSelectionClasses(mode.id);
              const palette = getModePalette(mode.tone);

              return (
                <motion.button
                  key={mode.id}
                  variants={allowModeCascade ? denseListItem : undefined}
                  type="button"
                  onClick={() => setSelectedMode(mode.id)}
                  whileHover={allowHoverMotion ? { y: -4, scale: 1.01 } : undefined}
                  whileTap={allowTapMotion ? { y: 1, scale: 0.985 } : undefined}
                  transition={{ duration: 0.24, ease: premiumEase }}
                  className={cn(
                    'relative overflow-hidden rounded-[1.6rem] border p-4 text-left transition',
                    selected
                      ? cn(styles.selected, styles.ring)
                      : 'border-border/70 bg-[hsl(var(--surface-subtle)/0.78)] hover:border-[hsl(var(--border)/0.96)]',
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <motion.div
                      className={cn('flex h-12 w-12 items-center justify-center rounded-2xl', palette.icon)}
                      animate={selected && !reducedMotion && !isMobile ? { y: [0, -2, 0], scale: [1, 1.03, 1] } : { y: 0, scale: 1 }}
                      transition={selected && !reducedMotion && !isMobile ? { duration: 0.42, ease: premiumEase } : { duration: 0.16, ease: premiumEase }}
                    >
                      <Icon size={22} />
                    </motion.div>
                    <div className="flex flex-col items-end gap-2">
                      {active ? <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${styles.badge}`}>{t('common.status.active')}</span> : null}
                      {!active && saved ? (
                        <span className="rounded-full border border-border/70 bg-background/80 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-foreground/70">
                          {t('modes.page.savedLabel')}
                        </span>
                      ) : null}
                      <motion.span
                        className={`h-3.5 w-3.5 rounded-full border ${styles.dot} ${selected ? '' : 'opacity-45'}`}
                        initial={false}
                        animate={{ scale: selected ? 1.08 : 1, opacity: selected ? 1 : 0.45 }}
                        transition={{ duration: 0.2, ease: premiumEase }}
                      />
                    </div>
                  </div>
                  <h3 className="mt-4 text-lg font-black tracking-[-0.03em] text-foreground">{mode.name}</h3>
                  <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">{mode.subtitle}</p>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{mode.description}</p>
                </motion.button>
              );
            })}
            </motion.div>
          </motion.div>
        </GlassCard>
      </div>
    </motion.section>
  );
}
