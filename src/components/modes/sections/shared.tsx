import type { ComponentType, Dispatch, SetStateAction } from 'react';
import { useI18n } from '@/hooks/useI18n';
import { getModePalette, tonePalettes, type ModeColorId } from '@/lib/semanticTones';
import {
  normalizeTargetValue,
  type ActiveModeId,
  type StrictAddonLockedAppsByMode,
  type StrictAddonModeId,
  type TargetModeId,
} from '@/lib/targetModes';
import { getEffectiveStrictLockEndTime } from '@/lib/view-models/modes';
import { MAX_STRICT_LOCK_DURATION_HOURS } from '@/lib/strictLockLimits';
import type { ModeId } from '@/modules/modes/modeTypes';
import { cn } from '@/lib/utils';

export type { ModeId };

export interface ModeDefinition {
  id: ModeId;
  name: string;
  subtitle: string;
  description: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  tone: ModeColorId;
  showBlockConfig: boolean;
}

export interface SelectionClasses {
  selected: string;
  ring: string;
  dot: string;
  badge: string;
}

function getModeBadgeClasses(mode: TargetModeId | ActiveModeId) {
  return getModePalette(mode).badge;
}

export function getModeLabelText(mode: TargetModeId | ActiveModeId | 'normal', translate: (key: string, params?: Record<string, string | number>) => string) {
  switch (mode) {
    case 'penalty':
      return translate('modes.badges.penalty');
    case 'learn':
      return translate('modes.badges.learn');
    case 'lock':
      return translate('modes.badges.lock');
    case 'normal':
      return translate('common.modes.normal');
    default:
      return translate('modes.badges.strict');
  }
}

export function ModeBadge({ mode }: { mode: TargetModeId | ActiveModeId }) {
  const { t } = useI18n();
  return (
    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${getModeBadgeClasses(mode)}`}>
      {getModeLabelText(mode, t)}
    </span>
  );
}

export function isAssignableMode(mode: ModeId): mode is TargetModeId {
  return mode === 'strict' || mode === 'learn' || mode === 'penalty';
}

export const REVIEW_MIX_OPTIONS = [5, 10, 15, 20];

export function ModeStrictAddonBlock({
  mode,
  enabled,
  onEnabledChange,
  locked,
  startTime,
  setStartTime,
  endTime,
  setEndTime,
  strictDurationHours,
  strictDurationTooLong,
  assignedAppCount,
}: {
  mode: 'strict' | 'learn' | 'penalty';
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  locked?: boolean;
  startTime: string;
  setStartTime: Dispatch<SetStateAction<string>>;
  endTime: string;
  setEndTime: Dispatch<SetStateAction<string>>;
  strictDurationHours: number;
  strictDurationTooLong: boolean;
  assignedAppCount?: number;
}) {
  const { t, locale } = useI18n();
  const palette = getModePalette(mode);
  const durationLabel = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(strictDurationHours);
  const hintKey =
    mode === 'learn'
      ? 'modes.strictAddon.learnHint'
      : mode === 'penalty'
        ? 'modes.strictAddon.penaltyHint'
        : 'modes.strictAddon.reflectionHint';
  const assignedAppLabel =
    typeof assignedAppCount === 'number'
      ? t('modes.strictAddon.frozenApps', { count: assignedAppCount })
      : t('modes.strictAddon.freezeHint');

  return (
    <div className="space-y-3 rounded-[1.35rem] border border-border/70 bg-background/60 px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">
            {t('modes.strictAddon.eyebrow')}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {t(hintKey)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onEnabledChange(!enabled)}
          disabled={locked}
          className={cn(
            'rounded-2xl border px-4 py-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-55',
            enabled ? palette.badge : 'border-border/70 bg-background/70 text-foreground',
          )}
        >
          {enabled ? t('modes.strictAddon.enabled') : t('modes.strictAddon.disabled')}
        </button>
      </div>

      <div className="rounded-[1.25rem] border border-border/70 bg-background/70 px-4 py-4 text-sm text-muted-foreground">
        {assignedAppLabel}
        <span className="ml-2 text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground/80">
          {t('modes.strictAddon.systemHint')}
        </span>
      </div>

      {enabled ? (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="rounded-[1.4rem] border border-border/70 bg-background/65 px-4 py-4">
              <span className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">{t('modes.strictAddon.from')}</span>
              <input
                type="time"
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
                disabled={locked}
                className="mt-3 w-full rounded-xl border border-border/70 bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary/30 disabled:cursor-not-allowed disabled:opacity-55"
              />
            </label>
            <label className="rounded-[1.4rem] border border-border/70 bg-background/65 px-4 py-4">
              <span className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">{t('modes.strictAddon.to')}</span>
              <input
                type="time"
                value={endTime}
                onChange={(event) => setEndTime(event.target.value)}
                disabled={locked}
                className="mt-3 w-full rounded-xl border border-border/70 bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary/30 disabled:cursor-not-allowed disabled:opacity-55"
              />
            </label>
          </div>

          <div className={cn('rounded-[1.4rem] border px-4 py-4 text-sm', strictDurationTooLong ? 'border-destructive/35 bg-destructive/8 text-destructive' : palette.badge)}>
            {t('modes.strictAddon.durationInfo', { hours: durationLabel })}
            {' '}
            {strictDurationTooLong ? t('modes.strictAddon.durationTooLong') : t('modes.strictAddon.durationOk')}
            <span className="mt-1 block text-xs font-bold">
              {`Gesperrt bis ${getEffectiveStrictLockEndTime(startTime, endTime, MAX_STRICT_LOCK_DURATION_HOURS)}`}
            </span>
          </div>
          {locked ? (
            <div className="rounded-[1.4rem] border border-border/70 bg-background/70 px-4 py-4 text-sm text-muted-foreground">
              {t('modes.strictAddon.systemHint')}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

export function AppIcon({
  icon,
  badge,
  label,
  active,
  tone,
  disabled,
  onToggle,
}: {
  icon?: string;
  badge: string;
  label: string;
  active?: boolean;
  tone?: ModeColorId | ActiveModeId | TargetModeId;
  disabled?: boolean;
  onToggle: () => void;
}) {
  const activePalette = getModePalette(tone ?? 'normal');
  const commonClasses = cn(
    'flex h-12 w-12 items-center justify-center rounded-2xl border transition shadow-[0_10px_22px_hsl(var(--foreground)/0.05)]',
    active ? activePalette.icon : 'border-border/70 bg-background/75 text-foreground',
    disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:border-[hsl(var(--border)/0.96)]',
  );

  if (icon) {
    return (
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        aria-pressed={active}
        title={active ? `${label} blockiert` : `${label} blockieren`}
        className={`${commonClasses} overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background`}
      >
        <img src={icon} alt={`${label} Icon`} className="h-10 w-10 rounded-xl object-cover" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={active}
      title={active ? `${label} blockiert` : `${label} blockieren`}
      className={`${commonClasses} text-sm font-black tracking-[0.04em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background`}
    >
      {badge}
    </button>
  );
}
