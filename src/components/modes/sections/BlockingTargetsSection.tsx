import { motion, useReducedMotion } from 'framer-motion';
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { ChevronDown, ChevronUp, Globe, Plus, Search, Trash2 } from 'lucide-react';
import GlassCard from '@/components/GlassCard';
import { useI18n } from '@/hooks/useI18n';
import { useIsMobile } from '@/hooks/use-mobile';
import { denseListItem, denseListStagger, premiumEase, shouldAnimateDenseList } from '@/lib/motion';
import { getModePalette, tonePalettes } from '@/lib/semanticTones';
import type { VisibleAppItem } from '@/lib/view-models/modes';
import type { StrictAddonLockedAppsByMode, TargetModeId } from '@/lib/targetModes';
import { cn } from '@/lib/utils';
import { getModeLabelText, isAssignableMode, ModeBadge, type ModeId } from './shared';
import { AppTargetRow } from './AppTargetRow';

export function BlockingTargetsSection({
  variants,
  selectedMode,
  showBlockConfig,
  setShowBlockConfig,
  totalBlocked,
  totalAssignedToSelectedMode,
  blockedWebsites,
  blockedWebsiteModes,
  blockedSearchTerms,
  blockedSearchTermModes,
  blockTabs,
  blockTab,
  setBlockTab,
  appSearch,
  setAppSearch,
  availableApps,
  displayedAvailableApps,
  assignedToSelectedMode,
  assignedToOtherModes,
  remainingAvailableCount,
  expandedApp,
  setExpandedApp,
  blockSchedules,
  toggleBlockedApp,
  setBlockedAppsMode,
  clearBlockedAppsMode,
  toggleBlockedWebsite,
  setBlockSchedule,
  removeBlockSchedule,
  getAppBadge,
  shouldShowFullAppList,
  setShowAllApps,
  newWebsite,
  setNewWebsite,
  handleAddWebsite,
  removeBlockedWebsite,
  newSearchTerm,
  setNewSearchTerm,
  handleAddSearchTerm,
  toggleBlockedSearchTerm,
  removeBlockedSearchTerm,
  assignmentsLocked = false,
  lockedAppIdsByMode = {},
}: {
  variants?: Record<string, unknown>;
  selectedMode: ModeId;
  showBlockConfig: boolean;
  setShowBlockConfig: Dispatch<SetStateAction<boolean>>;
  totalBlocked: number;
  totalAssignedToSelectedMode: number;
  blockedWebsites: string[];
  blockedWebsiteModes: Record<string, TargetModeId>;
  blockedSearchTerms: string[];
  blockedSearchTermModes: Record<string, TargetModeId>;
  blockTabs: Array<{ id: 'apps' | 'websites' | 'search'; label: string; icon: ReactNode; count: number }>;
  blockTab: 'apps' | 'websites' | 'search';
  setBlockTab: Dispatch<SetStateAction<'apps' | 'websites' | 'search'>>;
  appSearch: string;
  setAppSearch: Dispatch<SetStateAction<string>>;
  availableApps: VisibleAppItem[];
  displayedAvailableApps: VisibleAppItem[];
  assignedToSelectedMode: Array<VisibleAppItem>;
  assignedToOtherModes: Array<VisibleAppItem & { mode: TargetModeId }>;
  remainingAvailableCount: number;
  expandedApp: string | null;
  setExpandedApp: Dispatch<SetStateAction<string | null>>;
  blockSchedules: Record<string, { from: string; to: string }>;
  toggleBlockedApp: (app: string, mode: TargetModeId) => void;
  setBlockedAppsMode: (apps: string[], mode: TargetModeId) => void;
  clearBlockedAppsMode: () => void;
  toggleBlockedWebsite: (url: string, mode: TargetModeId) => void;
  setBlockSchedule: (app: string, from: string, to: string) => void;
  removeBlockSchedule: (app: string) => void;
  getAppBadge: (entry: { packageName?: string; appName?: string }) => string;
  shouldShowFullAppList: boolean;
  setShowAllApps: Dispatch<SetStateAction<boolean>>;
  newWebsite: string;
  setNewWebsite: Dispatch<SetStateAction<string>>;
  handleAddWebsite: () => void;
  removeBlockedWebsite: (url: string) => void;
  newSearchTerm: string;
  setNewSearchTerm: Dispatch<SetStateAction<string>>;
  handleAddSearchTerm: () => void;
  toggleBlockedSearchTerm: (term: string, mode: TargetModeId) => void;
  removeBlockedSearchTerm: (term: string) => void;
  assignmentsLocked?: boolean;
  lockedAppIdsByMode?: StrictAddonLockedAppsByMode;
}) {
  const { t } = useI18n();
  const reducedMotion = useReducedMotion();
  const isMobile = useIsMobile();
  const allowHoverMotion = !reducedMotion && !isMobile;
  const allowTapMotion = !reducedMotion;
  const editableMode = isAssignableMode(selectedMode) ? selectedMode : null;
  const editableModeLabel = editableMode ? getModeLabelText(editableMode, t) : '';
  const editablePalette = editableMode ? getModePalette(editableMode) : tonePalettes.primary;
  const totalAppRows = assignedToSelectedMode.length + assignedToOtherModes.length + displayedAvailableApps.length;
  const allowAppListCascade = shouldAnimateDenseList({
    reducedMotion,
    isMobile,
    itemCount: totalAppRows,
    maxAnimatedItems: 18,
  });
  const allowBlockTabsMotion = shouldAnimateDenseList({
    reducedMotion,
    isMobile,
    itemCount: blockTabs.length,
    maxAnimatedItems: 6,
  });
  const allowWebsiteListMotion = shouldAnimateDenseList({
    reducedMotion,
    isMobile,
    itemCount: blockedWebsites.length,
    maxAnimatedItems: 16,
  });
  const allowSearchListMotion = shouldAnimateDenseList({
    reducedMotion,
    isMobile,
    itemCount: blockedSearchTerms.length,
    maxAnimatedItems: 16,
  });
  const renderAppRow = (
    app: VisibleAppItem,
    currentMode: TargetModeId | null,
    options?: {
      isSelectedMode?: boolean;
      actionLabel?: string;
      onAction?: () => void;
      showSchedule?: boolean;
    },
  ) => (
    <AppTargetRow
      key={app.packageName}
      app={app}
      currentMode={currentMode}
      options={options}
      editableMode={editableMode}
      assignmentsLocked={assignmentsLocked}
      lockedAppIdsByMode={lockedAppIdsByMode}
      blockSchedules={blockSchedules}
      expandedApp={expandedApp}
      setExpandedApp={setExpandedApp}
      toggleBlockedApp={toggleBlockedApp}
      setBlockSchedule={setBlockSchedule}
      removeBlockSchedule={removeBlockSchedule}
      getAppBadge={getAppBadge}
      allowAppListCascade={allowAppListCascade}
      allowHoverMotion={allowHoverMotion}
      allowTapMotion={allowTapMotion}
    />
  );

  return (
    <motion.section variants={variants} className="space-y-4">
      <div data-tour-id="tour-modes-blocking" className="rounded-[1.9rem]">
        <GlassCard
          elevation="hero"
          surface="hero"
          tone={editableMode ?? 'primary'}
          accentGlow
          className="space-y-4"
        >
          <button type="button" onClick={() => setShowBlockConfig((current) => !current)} className="flex w-full items-center justify-between gap-4 text-left">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">{t('modes.blocking.eyebrow')}</p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-foreground">{t('modes.blocking.title')}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {editableMode
                  ? t('modes.blocking.summaryAssigned', { count: totalAssignedToSelectedMode, mode: editableModeLabel })
                  : t('modes.blocking.summaryNoMode')}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-full border border-border/70 bg-background/75 px-3 py-1 text-[11px] font-bold text-muted-foreground">
                {t('modes.blocking.totalLabel', { count: totalBlocked })}
              </span>
              {showBlockConfig ? <ChevronUp size={20} className="text-muted-foreground" /> : <ChevronDown size={20} className="text-muted-foreground" />}
            </div>
          </button>

        {showBlockConfig ? (
          <div className="space-y-4">
            <motion.div
              variants={allowBlockTabsMotion ? denseListStagger : undefined}
              initial={allowBlockTabsMotion ? 'hidden' : false}
              animate={allowBlockTabsMotion ? 'show' : undefined}
              className="grid gap-2 sm:grid-cols-3"
            >
              {blockTabs.map((tab) => (
                <motion.button
                  key={tab.id}
                  variants={allowBlockTabsMotion ? denseListItem : undefined}
                  type="button"
                  onClick={() => setBlockTab(tab.id)}
                  whileHover={allowHoverMotion ? { y: -2, scale: 1.005 } : undefined}
                  whileTap={allowTapMotion ? { y: 1, scale: 0.985 } : undefined}
                  transition={{ duration: 0.2, ease: premiumEase }}
                  className={cn(
                    'flex items-center justify-between rounded-2xl border px-4 py-3 text-sm font-bold transition',
                    blockTab === tab.id
                      ? editablePalette.badge
                      : 'border-border/70 bg-background/60 text-muted-foreground hover:text-foreground',
                  )}
                >
                  <span className="flex items-center gap-2">{tab.icon}{tab.label}</span>
                  <span className="rounded-full bg-background/80 px-2 py-0.5 text-[11px]">{tab.count}</span>
                </motion.button>
              ))}
            </motion.div>

            {!editableMode ? (
              <div className="rounded-[1.6rem] border border-dashed border-border/70 bg-background/55 px-4 py-5 text-sm leading-relaxed text-muted-foreground">
                {t('modes.blocking.nonAssignableHint')}
              </div>
            ) : null}

            {blockTab === 'apps' ? (
              <div className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                    <input value={appSearch} onChange={(event) => setAppSearch(event.target.value)} placeholder={t('modes.apps.searchPlaceholder')} className="w-full rounded-2xl border border-border/70 bg-background/70 py-3 pl-11 pr-4 text-sm text-foreground outline-none transition focus:border-primary/35" />
                  </div>
                  {editableMode ? (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setBlockedAppsMode(availableApps.map((app) => app.packageName), editableMode)}
                        disabled={assignmentsLocked || availableApps.length === 0}
                        className="rounded-2xl border border-border/70 bg-background/70 px-4 py-3 text-sm font-bold text-foreground transition hover:border-[hsl(var(--border)/0.96)] disabled:opacity-35"
                      >
                        {t('modes.apps.assignFree')}
                      </button>
                      {assignedToSelectedMode.length > 0 ? (
                        <button
                          type="button"
                          onClick={clearBlockedAppsMode}
                          disabled={assignmentsLocked}
                          className="rounded-2xl border border-border/70 bg-background/70 px-4 py-3 text-sm font-bold text-foreground transition hover:border-[hsl(var(--border)/0.96)] disabled:opacity-35"
                        >
                          {t('modes.apps.clearCurrentMode')}
                        </button>
                      ) : null}
                      {appSearch.trim() ? (
                        <button
                          type="button"
                          onClick={() => setBlockedAppsMode(availableApps.map((app) => app.packageName), editableMode)}
                          disabled={assignmentsLocked || availableApps.length === 0}
                          className={cn(
                            'rounded-2xl border px-4 py-3 text-sm font-bold transition disabled:opacity-35',
                            editablePalette.badge,
                          )}
                        >
                          {t('modes.apps.assignSearch')}
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <motion.div
                  variants={allowAppListCascade ? denseListStagger : undefined}
                  initial={allowAppListCascade ? 'hidden' : false}
                  animate={allowAppListCascade ? 'show' : undefined}
                  className="space-y-3"
                >
                  {assignedToSelectedMode.length > 0 ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">{t('modes.apps.assignedTitle')}</p>
                        <span className="rounded-full border border-border/70 bg-background/75 px-3 py-1 text-[11px] font-bold text-muted-foreground">{assignedToSelectedMode.length}</span>
                      </div>
                      {assignedToSelectedMode.map((app) => renderAppRow(app, editableMode, { isSelectedMode: true }))}
                    </div>
                  ) : null}
                  {assignedToOtherModes.length > 0 ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">{t('modes.apps.otherModesTitle')}</p>
                        <span className="rounded-full border border-border/70 bg-background/75 px-3 py-1 text-[11px] font-bold text-muted-foreground">{assignedToOtherModes.length}</span>
                      </div>
                      {assignedToOtherModes.map((app) => renderAppRow(app, app.mode, {
                        actionLabel: t('modes.apps.takeOver'),
                        onAction: editableMode ? () => toggleBlockedApp(app.packageName, editableMode) : undefined,
                      }))}
                    </div>
                  ) : null}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">{t('modes.apps.availableTitle', { mode: editableMode ? editableModeLabel : getModeLabelText('strict', t) })}</p>
                      <span className="rounded-full border border-border/70 bg-background/75 px-3 py-1 text-[11px] font-bold text-muted-foreground">{availableApps.length}</span>
                    </div>
                    {displayedAvailableApps.length > 0 ? displayedAvailableApps.map((app) => renderAppRow(app, null, { showSchedule: false })) : (
                      <div className="rounded-[1.4rem] border border-dashed border-border/70 bg-background/55 px-4 py-4 text-sm text-muted-foreground">
                        {t('modes.apps.noMatches')}
                      </div>
                    )}
                  </div>
                </motion.div>

                {!shouldShowFullAppList && remainingAvailableCount > 0 ? (
                  <button type="button" onClick={() => setShowAllApps(true)} className="w-full rounded-2xl border border-border/70 bg-background/60 px-4 py-3 text-sm font-bold text-foreground transition hover:border-[hsl(var(--border)/0.96)]">
                    {t('modes.apps.loadMore', { count: remainingAvailableCount })}
                  </button>
                ) : null}
              </div>
            ) : null}

            {blockTab === 'websites' ? (
              <div className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row">
                  <input value={newWebsite} onChange={(event) => setNewWebsite(event.target.value)} placeholder={t('modes.websites.placeholder')} className="flex-1 rounded-2xl border border-border/70 bg-background/70 px-4 py-3 text-sm text-foreground outline-none transition focus:border-primary/35" />
                  <button
                    type="button"
                    onClick={handleAddWebsite}
                    disabled={!editableMode || assignmentsLocked || !newWebsite.trim()}
                    className={cn(
                      'inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold disabled:opacity-35',
                      editablePalette.button,
                    )}
                  >
                    <Plus size={16} />
                    {t('modes.websites.addButton')}
                  </button>
                </div>

                <motion.div
                  variants={allowWebsiteListMotion ? denseListStagger : undefined}
                  initial={allowWebsiteListMotion ? 'hidden' : false}
                  animate={allowWebsiteListMotion ? 'show' : undefined}
                  className="space-y-3"
                >
                  {blockedWebsites.map((website) => {
                    const currentMode = blockedWebsiteModes[website];
                    return (
                      <motion.div
                        key={website}
                        variants={allowWebsiteListMotion ? denseListItem : undefined}
                        whileHover={allowHoverMotion ? { y: -2, scale: 1.004 } : undefined}
                        transition={{ duration: 0.2, ease: premiumEase }}
                        className="flex items-center gap-3 rounded-[1.4rem] border border-border/70 bg-background/65 px-4 py-3"
                      >
                        <div className={cn('flex h-11 w-11 items-center justify-center rounded-2xl', editablePalette.icon)}>
                          <Globe size={18} />
                        </div>
                        <button type="button" onClick={() => { if (editableMode && !assignmentsLocked) toggleBlockedWebsite(website, editableMode); }} disabled={assignmentsLocked} className="min-w-0 flex-1 text-left disabled:cursor-not-allowed disabled:opacity-70">
                          <p className="truncate text-sm font-black tracking-[-0.02em] text-foreground">{website}</p>
                          <div className="mt-1 flex flex-wrap gap-2">
                            {currentMode ? <ModeBadge mode={currentMode} /> : null}
                          </div>
                        </button>
                        <button type="button" onClick={() => removeBlockedWebsite(website)} disabled={assignmentsLocked} className="rounded-full border border-border/70 p-2 text-muted-foreground transition hover:text-destructive disabled:cursor-not-allowed disabled:opacity-55">
                          <Trash2 size={16} />
                        </button>
                      </motion.div>
                    );
                  })}
                </motion.div>
              </div>
            ) : null}

            {blockTab === 'search' ? (
              <div className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row">
                  <input value={newSearchTerm} onChange={(event) => setNewSearchTerm(event.target.value)} placeholder={t('modes.search.placeholder')} className="flex-1 rounded-2xl border border-border/70 bg-background/70 px-4 py-3 text-sm text-foreground outline-none transition focus:border-primary/35" />
                  <button
                    type="button"
                    onClick={handleAddSearchTerm}
                    disabled={!editableMode || assignmentsLocked || !newSearchTerm.trim()}
                    className={cn(
                      'inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold disabled:opacity-35',
                      editablePalette.button,
                    )}
                  >
                    <Plus size={16} />
                    {t('modes.search.addButton')}
                  </button>
                </div>

                <motion.div
                  variants={allowSearchListMotion ? denseListStagger : undefined}
                  initial={allowSearchListMotion ? 'hidden' : false}
                  animate={allowSearchListMotion ? 'show' : undefined}
                  className="space-y-3"
                >
                  {blockedSearchTerms.map((term) => {
                    const currentMode = blockedSearchTermModes[term];
                    return (
                      <motion.div
                        key={term}
                        variants={allowSearchListMotion ? denseListItem : undefined}
                        whileHover={allowHoverMotion ? { y: -2, scale: 1.004 } : undefined}
                        transition={{ duration: 0.2, ease: premiumEase }}
                        className="flex items-center gap-3 rounded-[1.4rem] border border-border/70 bg-background/65 px-4 py-3"
                      >
                        <div className={cn('flex h-11 w-11 items-center justify-center rounded-2xl', editablePalette.icon)}>
                          <Search size={18} />
                        </div>
                        <button type="button" onClick={() => { if (editableMode && !assignmentsLocked) toggleBlockedSearchTerm(term, editableMode); }} disabled={assignmentsLocked} className="min-w-0 flex-1 text-left disabled:cursor-not-allowed disabled:opacity-70">
                          <p className="truncate text-sm font-black tracking-[-0.02em] text-foreground">{term}</p>
                          <div className="mt-1 flex flex-wrap gap-2">
                            {currentMode ? <ModeBadge mode={currentMode} /> : null}
                          </div>
                        </button>
                        <button type="button" onClick={() => removeBlockedSearchTerm(term)} disabled={assignmentsLocked} className="rounded-full border border-border/70 p-2 text-muted-foreground transition hover:text-destructive disabled:cursor-not-allowed disabled:opacity-55">
                          <Trash2 size={16} />
                        </button>
                      </motion.div>
                    );
                  })}
                </motion.div>
              </div>
            ) : null}
          </div>
        ) : null}
        </GlassCard>
      </div>
    </motion.section>
  );
}
