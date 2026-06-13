import { startTransition, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Brain, Clock3 } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { BrandLockup, BrandMark } from '@/components/brand/BrandMark';
import { BlockedAppsDialog } from '@/components/dashboard/BlockedAppsDialog';
import PageTransition from '@/components/PageTransition';
import ThemeToggle from '@/components/ThemeToggle';
import { MetricCard } from '@/components/ui/MetricCard';
import { QuickActionCard } from '@/components/ui/QuickActionCard';
import { useI18n } from '@/hooks/useI18n';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  ctaFollowThrough,
  heroTimeline,
  heroTimelineItem,
  sectionItem,
  sectionStagger,
} from '@/lib/motion';
import { getModePalette, tonePalettes } from '@/lib/semanticTones';
import { countTargetsForMode } from '@/lib/targetModes';
import { getDashboardModeLabel } from '@/modules/dashboard/dashboardModeLabels';
import { ProtectionStatusCard } from '@/modules/protection/ProtectionStatusCard';
import { ProtectionShieldButton } from '@/modules/protection/ProtectionShieldButton';
import {
  formatScreenTime,
  getAppLabel,
} from '@/services/screenTimeNormalization';
import {
  getInstalledApps,
  getTodayUsage,
  isUnsupportedPlatformError,
} from '@/services/screenTimeService';
import { useAppStore } from '@/store/useAppStore';
import { useDashboardSummary } from '@/store/selectors';
import { cn } from '@/lib/utils';

export default function IndexPage() {
  const navigate = useNavigate();
  const { t, locale } = useI18n();
  const reducedMotion = useReducedMotion();
  const isMobile = useIsMobile();
  const {
    activeMode,
    activeModes,
    lastModeActivation,
    strictLockScope,
    blockedAppsCount,
    blockedWebsitesCount,
    blockedSearchTermsCount,
    isStrictLocked,
  } = useDashboardSummary();
  const {
    blockedApps,
    blockedWebsites,
    blockedSearchTerms,
    blockedAppModes,
    blockedWebsiteModes,
    blockedSearchTermModes,
  } = useAppStore(
    useShallow((state) => ({
      blockedApps: state.blockedApps,
      blockedWebsites: state.blockedWebsites,
      blockedSearchTerms: state.blockedSearchTerms,
      blockedAppModes: state.blockedAppModes,
      blockedWebsiteModes: state.blockedWebsiteModes,
      blockedSearchTermModes: state.blockedSearchTermModes,
    })),
  );
  const [screenTimeLabel, setScreenTimeLabel] = useState('...');
  const [blockedAppsDialogOpen, setBlockedAppsDialogOpen] = useState(false);
  const [installedAppLabels, setInstalledAppLabels] = useState<Record<string, string>>({});
  const isGerman = locale.toLowerCase().startsWith('de');
  const locked = isStrictLocked();
  const allowRichMotion = !reducedMotion && !isMobile;
  const dashboardOverviewTitle = 'Modi anpassen';

  useEffect(() => {
    let mounted = true;

    getTodayUsage()
      .then((usage) => {
        if (mounted) {
          startTransition(() => {
            setScreenTimeLabel(formatScreenTime(usage.totalScreenTimeMs));
          });
        }
      })
      .catch((error) => {
        if (!mounted) return;
        setScreenTimeLabel(
          isUnsupportedPlatformError(error)
            ? (isGerman ? 'Android-App' : 'Android app')
            : (isGerman ? 'Setup fehlt' : 'Setup required'),
        );
      });

    return () => {
      mounted = false;
    };
  }, [isGerman]);

  useEffect(() => {
    let mounted = true;

    getInstalledApps()
      .then((apps) => {
        if (!mounted) return;

        const nextLabels: Record<string, string> = {};
        apps.forEach((app) => {
          const label = getAppLabel(app);
          if (app.appId) nextLabels[app.appId] = label;
          if (app.packageName) nextLabels[app.packageName] = label;
        });
        startTransition(() => {
          setInstalledAppLabels(nextLabels);
        });
      })
      .catch(() => {
        if (mounted) {
          startTransition(() => {
            setInstalledAppLabels({});
          });
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const totalBlockedTargets = blockedAppsCount + blockedWebsitesCount + blockedSearchTermsCount;
  const modeLabel = activeModes.length > 1
    ? t('dashboard.modeHints.multi', { count: activeModes.length })
    : getDashboardModeLabel(activeMode, t);
  const modeHint = locked
    ? strictLockScope === 'settings'
      ? t('dashboard.modeHints.settingsLock')
      : t('dashboard.modeHints.fullLock')
    : activeModes.length > 1
      ? t('dashboard.modeHints.multiTargets', { count: totalBlockedTargets })
      : activeMode === 'normal'
        ? t('dashboard.modeHints.normal')
        : getDashboardModeLabel(activeMode, t);

  const modeCounts = useMemo(
    () => ({
      strict: countTargetsForMode({ blockedAppModes, blockedWebsiteModes, blockedSearchTermModes }, 'strict'),
      learn: countTargetsForMode({ blockedAppModes, blockedWebsiteModes, blockedSearchTermModes }, 'learn'),
      penalty: countTargetsForMode({ blockedAppModes, blockedWebsiteModes, blockedSearchTermModes }, 'penalty'),
    }),
    [blockedAppModes, blockedSearchTermModes, blockedWebsiteModes],
  );

  const modesHeroPalette =
    activeModes.length === 1 && activeModes[0] !== 'normal'
      ? getModePalette(activeModes[0])
      : tonePalettes.primary;

  const modePreviewItems = useMemo(
    () => ([
      { id: 'strict' as const, label: getDashboardModeLabel('strict', t), count: modeCounts.strict },
      { id: 'learn' as const, label: getDashboardModeLabel('learn', t), count: modeCounts.learn },
      { id: 'penalty' as const, label: getDashboardModeLabel('penalty', t), count: modeCounts.penalty },
    ]),
    [modeCounts.learn, modeCounts.penalty, modeCounts.strict, t],
  );

  const dashboardSnapshot = useMemo(
    () => [
      {
        id: 'mode-state',
        label: t('dashboard.metrics.activeMode'),
        value: modeLabel,
      },
      {
        id: 'blocked-apps',
        label: t('dashboard.cards.blocked'),
        value: String(blockedAppsCount),
      },
    ],
    [blockedAppsCount, modeLabel, t],
  );

  const blockedAppEntries = useMemo(
    () =>
      blockedApps
        .map((appId) => ({
          appId,
          label: installedAppLabels[appId] || getAppLabel({ packageName: appId }) || appId,
          mode: blockedAppModes[appId] ?? null,
        }))
        .sort((left, right) => left.label.localeCompare(right.label, locale)),
    [blockedAppModes, blockedApps, installedAppLabels, locale],
  );

  const isFreshActivation = Boolean(
    lastModeActivation && Date.now() - lastModeActivation.activatedAt < 15000,
  );

  useEffect(() => {
    if (isFreshActivation) {
      window.scrollTo({ top: 0, behavior: allowRichMotion ? 'smooth' : 'auto' });
    }
  }, [allowRichMotion, isFreshActivation]);

  return (
    <>
      <PageTransition variant="hero">
        <div className="app-page">
          <div className="page-header justify-between">
            <div className="space-y-3">
              <BrandLockup subtitle="block and learn" subtitleClassName="!normal-case" />
            </div>
            <div className="flex items-center gap-2">
              <ProtectionShieldButton isGerman={isGerman} />
              <ThemeToggle />
            </div>
          </div>

          <motion.div
            variants={sectionStagger}
            initial={allowRichMotion ? 'hidden' : false}
            animate={allowRichMotion ? 'show' : undefined}
            className="space-y-5 sm:space-y-6"
          >
            <motion.section variants={sectionItem}>
              <ProtectionStatusCard isGerman={isGerman} />
            </motion.section>

            <motion.section variants={sectionItem}>
              <div data-tour-id="tour-dashboard-modes" className="rounded-[2rem] sm:rounded-[2.25rem]">
                <motion.div
                  initial={
                    allowRichMotion
                      ? { opacity: 0, y: isFreshActivation ? -18 : 16, scale: isFreshActivation ? 0.96 : 0.985 }
                      : false
                  }
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={allowRichMotion ? { duration: 0.42, ease: [0.16, 1, 0.3, 1] } : { duration: 0 }}
                  className={cn(
                    modesHeroPalette.hero,
                    'relative overflow-hidden rounded-[2rem] p-4 shadow-[0_28px_82px_hsl(var(--foreground)/0.14)] sm:rounded-[2.25rem] sm:p-6 lg:p-7',
                  )}
                >
                  <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/12 blur-3xl" aria-hidden="true" />
                  <div
                    className={cn('absolute bottom-2 left-6 h-28 w-28 rounded-full blur-[56px]', modesHeroPalette.glow)}
                    aria-hidden="true"
                  />

                  <motion.div
                    variants={heroTimeline}
                    initial={allowRichMotion ? 'hidden' : false}
                    animate={allowRichMotion ? 'show' : undefined}
                    className="relative z-10 grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.85fr)] lg:items-start"
                  >
                    <div className="flex min-w-0 flex-col gap-4 sm:gap-5">
                      <motion.div variants={heroTimelineItem} className="flex items-start gap-4">
                        <motion.div
                          className={cn(
                            'flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.35rem] p-2 sm:h-16 sm:w-16 sm:rounded-[1.6rem]',
                            modesHeroPalette.icon,
                          )}
                          initial={allowRichMotion ? { scale: 0.92, rotate: -5 } : false}
                          animate={{ scale: 1, rotate: 0 }}
                          transition={allowRichMotion ? { duration: 0.28, ease: [0.16, 1, 0.3, 1] } : { duration: 0 }}
                        >
                          <BrandMark size={40} withAnimation={allowRichMotion} />
                        </motion.div>

                        <div className="min-w-0">
                          <div className="flex flex-wrap gap-2">
                            <span
                              className={cn(
                                'rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em]',
                                modesHeroPalette.badge,
                              )}
                            >
                              {activeModes.length > 0 ? modeLabel : t('dashboard.metrics.activeMode')}
                            </span>
                            <span className="rounded-full border border-white/24 bg-white/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-white/88">
                              {t('dashboard.cards.blocked')} | {blockedAppsCount}
                            </span>
                          </div>

                          <h2 className="mt-3 text-[1.85rem] font-black leading-tight tracking-[-0.06em] text-foreground sm:mt-4 sm:text-4xl">
                            {dashboardOverviewTitle}
                          </h2>
                          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-foreground/86 sm:mt-3 sm:text-base">
                            {t('dashboard.actions.modesDescription')}
                          </p>
                          <p className="mt-2 max-w-xl text-sm font-semibold text-foreground/80 sm:mt-3">
                            {modeHint}
                          </p>
                        </div>
                      </motion.div>

                      <motion.div variants={heroTimelineItem} className="grid gap-2 sm:grid-cols-2">
                        {dashboardSnapshot.map((item) => (
                          <div
                            key={item.id}
                            className="min-w-0 rounded-[1.2rem] border border-white/14 bg-background/74 px-3 py-3 shadow-[0_12px_28px_hsl(var(--foreground)/0.08)] lg:backdrop-blur-xl"
                          >
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-foreground/64">
                              {item.label}
                            </p>
                            <p className="mt-2 text-base font-black tracking-[-0.04em] text-foreground sm:text-lg">
                              {item.value}
                            </p>
                          </div>
                        ))}
                      </motion.div>

                      <motion.div variants={heroTimelineItem} className="grid gap-3 sm:grid-cols-3">
                        {modePreviewItems.map((item) => (
                          <div
                            key={item.id}
                            className="min-w-0 rounded-[1.35rem] border border-white/16 bg-background/78 px-4 py-3 shadow-[0_14px_34px_hsl(var(--foreground)/0.08)] lg:backdrop-blur-xl"
                          >
                            <span
                              className={cn(
                                'inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em]',
                                getModePalette(item.id).badge,
                              )}
                            >
                              {item.label}
                            </span>
                            <p className="mt-3 text-3xl font-black tracking-[-0.06em] text-foreground">{item.count}</p>
                            <p className="mt-1 break-words text-xs text-foreground/78">
                              {t('dashboard.cards.targetsAssigned', { count: item.count })}
                            </p>
                          </div>
                        ))}
                      </motion.div>
                    </div>

                    <motion.div variants={heroTimelineItem} className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-1">
                      <motion.button
                        variants={ctaFollowThrough}
                        initial="rest"
                        animate="rest"
                        whileHover={allowRichMotion ? 'hover' : 'rest'}
                        whileTap={allowRichMotion ? 'tap' : 'rest'}
                        onClick={() => navigate('/modes')}
                        className={cn(
                          'btn-press flex min-h-[10.75rem] w-full min-w-0 flex-col items-start justify-between rounded-[1.5rem] px-4 py-4 text-left shadow-[0_24px_54px_hsl(var(--foreground)/0.14)] sm:min-h-[12.5rem] sm:px-5 sm:py-5 lg:min-h-[14.25rem] lg:rounded-[1.7rem]',
                          modesHeroPalette.button,
                        )}
                      >
                        <div>
                          <p className="text-[11px] font-black uppercase tracking-[0.16em] opacity-90">
                            {t('dashboard.actions.modesEyebrow')}
                          </p>
                          <p className="mt-2 text-xl font-black tracking-[-0.05em] sm:mt-3 sm:text-2xl">
                            {dashboardOverviewTitle}
                          </p>
                          <p className="mt-2 max-w-none text-sm leading-relaxed opacity-95">
                            {t('dashboard.actions.modesDescription')}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em]">
                          {t('dashboard.actions.modesOpenCta')}
                          <ArrowRight size={16} />
                        </div>
                      </motion.button>

                      <button
                        type="button"
                        onClick={() => setBlockedAppsDialogOpen(true)}
                        className="min-w-0 rounded-[1.5rem] border border-white/16 bg-background/78 px-4 py-4 text-left shadow-[0_16px_34px_hsl(var(--foreground)/0.08)] transition hover:border-white/28 lg:backdrop-blur-xl"
                      >
                        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-foreground/68">
                          {t('dashboard.cards.blocked')}
                        </p>
                        <p className="mt-2 text-3xl font-black tracking-[-0.06em] text-foreground">{blockedAppsCount}</p>
                        <p className="mt-2 break-words text-sm leading-relaxed text-foreground/82">
                          {isGerman
                            ? 'Tippe hier für die Liste deiner blockierten Apps.'
                            : 'Tap here to open the list of blocked apps.'}
                        </p>
                        <p className="mt-2 break-words text-xs text-foreground/76">
                          {blockedWebsitesCount} {isGerman ? 'Websites' : 'websites'} · {blockedSearchTermsCount} {isGerman ? 'Suchbegriffe' : 'search terms'}
                        </p>
                      </button>
                    </motion.div>
                  </motion.div>
                </motion.div>
              </div>
            </motion.section>

            <motion.section variants={sectionItem}>
              <div data-tour-id="tour-dashboard-focus" className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
                <MetricCard
                  icon={Clock3}
                  label={t('dashboard.metrics.screenTime')}
                  value={screenTimeLabel}
                  hint={t('dashboard.metrics.today')}
                  tone="accent"
                  onClick={() => navigate('/stats')}
                  motionPreset="soft"
                />
                <div data-tour-id="tour-dashboard-learn" className="h-full rounded-[1.65rem]">
                  <QuickActionCard
                    icon={Brain}
                    title={t('dashboard.actions.learnTitle')}
                    description={t('dashboard.actions.learnDescription')}
                    onClick={() => navigate('/learn')}
                    tone="learn"
                    badge={t('dashboard.actions.activeBadge')}
                    motionPreset="soft"
                    className="min-h-[13rem] sm:min-h-[15rem]"
                  />
                </div>
              </div>
            </motion.section>
          </motion.div>
        </div>
      </PageTransition>

      <BlockedAppsDialog
        open={blockedAppsDialogOpen}
        isGerman={isGerman}
        blockedAppsCount={blockedAppsCount}
        blockedWebsitesCount={blockedWebsites.length}
        blockedSearchTermsCount={blockedSearchTerms.length}
        blockedAppEntries={blockedAppEntries}
        t={t}
        onOpenChange={setBlockedAppsDialogOpen}
      />
    </>
  );
}
