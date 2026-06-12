import { AnimatePresence, motion } from 'framer-motion';
import type { Dispatch, SetStateAction } from 'react';
import { ChevronUp, Clock3 } from 'lucide-react';
import { useI18n } from '@/hooks/useI18n';
import { ctaFollowThrough, denseListItem, premiumEase } from '@/lib/motion';
import { getModePalette, type ModeColorId } from '@/lib/semanticTones';
import type { VisibleAppItem } from '@/lib/view-models/modes';
import { normalizeTargetValue, type StrictAddonLockedAppsByMode, type StrictAddonModeId, type TargetModeId } from '@/lib/targetModes';
import { cn } from '@/lib/utils';
import { AppIcon, ModeBadge } from './shared';

type AppTargetRowOptions = {
  isSelectedMode?: boolean;
  actionLabel?: string;
  onAction?: () => void;
  showSchedule?: boolean;
};

export function AppTargetRow({
  app,
  currentMode,
  options,
  editableMode,
  assignmentsLocked,
  lockedAppIdsByMode,
  blockSchedules,
  expandedApp,
  setExpandedApp,
  toggleBlockedApp,
  setBlockSchedule,
  removeBlockSchedule,
  getAppBadge,
  allowAppListCascade,
  allowHoverMotion,
  allowTapMotion,
}: {
  app: VisibleAppItem;
  currentMode: TargetModeId | null;
  options?: AppTargetRowOptions;
  editableMode: TargetModeId | null;
  assignmentsLocked: boolean;
  lockedAppIdsByMode: StrictAddonLockedAppsByMode;
  blockSchedules: Record<string, { from: string; to: string }>;
  expandedApp: string | null;
  setExpandedApp: Dispatch<SetStateAction<string | null>>;
  toggleBlockedApp: (app: string, mode: TargetModeId) => void;
  setBlockSchedule: (app: string, from: string, to: string) => void;
  removeBlockSchedule: (app: string) => void;
  getAppBadge: (entry: { packageName?: string; appName?: string }) => string;
  allowAppListCascade: boolean;
  allowHoverMotion: boolean;
  allowTapMotion: boolean;
}) {
  const { t } = useI18n();
  const normalizedAppId = normalizeTargetValue('app', app.packageName);
  const lockedModeEntry = (Object.entries(lockedAppIdsByMode || {}) as [StrictAddonModeId, Set<string>][]).find(([, lockedAppIds]) =>
    lockedAppIds.has(normalizedAppId),
  );
  const appAssignmentLocked = Boolean(lockedModeEntry);
  const schedule = blockSchedules[app.packageName];
  const expanded = expandedApp === app.packageName;
  const isAssigned = Boolean(currentMode);
  const isSelectedMode = Boolean(options?.isSelectedMode);
  const rowPalette = getModePalette((currentMode ?? editableMode ?? 'normal') as ModeColorId | TargetModeId);
  const disableAssignmentToggle = !editableMode || assignmentsLocked || appAssignmentLocked;
  const disableScheduleEditing = assignmentsLocked || appAssignmentLocked;
  const handleToggleAssignment = () => {
    if (disableAssignmentToggle) return;
    toggleBlockedApp(app.packageName, editableMode);
    setExpandedApp((current) => (current === app.packageName ? null : current));
  };

  return (
    <motion.div
      key={app.packageName}
      variants={allowAppListCascade ? denseListItem : undefined}
      style={{ contentVisibility: 'auto', containIntrinsicSize: expanded ? '148px' : '92px' }}
      className="space-y-2"
    >
      <motion.div
        whileHover={allowHoverMotion ? { y: -2, scale: 1.004 } : undefined}
        transition={{ duration: 0.22, ease: premiumEase }}
        className={cn(
          'relative flex w-full items-center gap-4 rounded-[1.5rem] border px-4 py-3 transition',
          isSelectedMode
            ? cn(rowPalette.card, rowPalette.ring)
            : isAssigned
              ? rowPalette.card
              : 'border-border/60 bg-[hsl(var(--surface-subtle)/0.76)] hover:border-[hsl(var(--border)/0.96)]',
        )}
      >
        <AppIcon
          icon={app.icon}
          label={app.appName}
          badge={getAppBadge(app)}
          active={isAssigned}
          tone={currentMode ?? editableMode ?? 'normal'}
          disabled={disableAssignmentToggle}
          onToggle={handleToggleAssignment}
        />
        <button
          type="button"
          onClick={handleToggleAssignment}
          disabled={disableAssignmentToggle}
          className={cn(
            'flex min-w-0 flex-1 flex-col gap-1 text-left',
            disableAssignmentToggle && 'cursor-not-allowed opacity-70',
          )}
        >
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <p className="truncate text-sm font-black tracking-[-0.02em] text-foreground">{app.appName}</p>
            {currentMode ? <ModeBadge mode={currentMode} /> : null}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>
              {isAssigned ? (schedule ? `${schedule.from} - ${schedule.to}` : t('modes.apps.scheduleAllDay')) : 'Bereit zum Zuweisen'}
            </span>
          </div>
        </button>
        {options?.onAction ? (
          <button
            type="button"
            onClick={() => {
              options.onAction?.();
              setExpandedApp((current) => (current === app.packageName ? null : current));
            }}
            disabled={assignmentsLocked || appAssignmentLocked}
            className={cn(
              'rounded-xl border bg-background/80 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] transition disabled:cursor-not-allowed disabled:opacity-50',
              rowPalette.badge,
            )}
          >
            {options.actionLabel}
          </button>
        ) : null}
        {options?.showSchedule !== false && isAssigned ? (
          <motion.button
            type="button"
            onClick={() => setExpandedApp((current) => (current === app.packageName ? null : app.packageName))}
            className={cn('rounded-full border border-border/70 p-2 text-muted-foreground transition', rowPalette.text)}
            initial="rest"
            animate="rest"
            whileHover={allowHoverMotion ? 'hover' : 'rest'}
            whileTap={allowTapMotion ? 'tap' : 'rest'}
            variants={ctaFollowThrough}
          >
            {expanded ? <ChevronUp size={16} /> : <Clock3 size={16} />}
          </motion.button>
        ) : null}
      </motion.div>

      <AnimatePresence initial={false}>
        {expanded && isAssigned && options?.showSchedule !== false ? (
          <motion.div
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -6, height: 0 }}
            transition={{ duration: 0.22, ease: premiumEase }}
            className="grid gap-3 overflow-hidden rounded-[1.4rem] border border-border/70 bg-background/70 px-4 py-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
          >
            <label className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
              {t('modes.apps.scheduleFrom')}
              <input type="time" value={schedule?.from || '00:00'} onChange={(event) => setBlockSchedule(app.packageName, event.target.value, schedule?.to || '23:59')} disabled={disableScheduleEditing} className="mt-2 w-full rounded-xl border border-border/70 bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary/30 disabled:cursor-not-allowed disabled:opacity-55" />
            </label>
            <label className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
              {t('modes.apps.scheduleTo')}
              <input type="time" value={schedule?.to || '23:59'} onChange={(event) => setBlockSchedule(app.packageName, schedule?.from || '00:00', event.target.value)} disabled={disableScheduleEditing} className="mt-2 w-full rounded-xl border border-border/70 bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary/30 disabled:cursor-not-allowed disabled:opacity-55" />
            </label>
            <button type="button" onClick={() => removeBlockSchedule(app.packageName)} disabled={disableScheduleEditing} className="rounded-xl border border-border/70 bg-background px-4 py-2 text-sm font-bold text-muted-foreground transition hover:text-foreground disabled:cursor-not-allowed disabled:opacity-55">
              {t('modes.apps.scheduleAllDay')}
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}
