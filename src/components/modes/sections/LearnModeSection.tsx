import { motion } from 'framer-motion';
import type { Dispatch, SetStateAction } from 'react';
import GlassCard from '@/components/GlassCard';
import { useI18n } from '@/hooks/useI18n';
import type { GateRule, LearningDeck, LearningDeckStats } from '@/lib/learning';
import { getModePalette } from '@/lib/semanticTones';
import { cn } from '@/lib/utils';
import { ModeStrictAddonBlock } from './shared';
import { REVIEW_MIX_OPTIONS, type ModeId } from './modeShared';

export function LearnModeSection({
  selectedMode,
  variants,
  resolvedLearnDeck,
  onUseLatestDeck,
  onOpenLibrary,
  onOpenLearnHub,
  onReviewMixChange,
  gateRule,
  strictAddonEnabled,
  onStrictAddonChange,
  strictAddonLocked,
  strictDurationHours,
  strictDurationTooLong,
  assignedAppCount,
  startTime,
  setStartTime,
  endTime,
  setEndTime,
  sessionCreditsRequiredDraft,
  setSessionCreditsRequiredDraft,
  commitSessionCreditsRequiredDraft,
  unlockDurationMinutesDraft,
  setUnlockDurationMinutesDraft,
  commitUnlockDurationMinutesDraft,
  typedAnswerEnabledDraft,
  setTypedAnswerEnabledDraft,
}: {
  selectedMode: ModeId;
  variants?: Record<string, unknown>;
  resolvedLearnDeck?: (LearningDeck & LearningDeckStats & {
    reviewsBetweenNewCards: number;
    reviewMixLabel: string;
  }) | null;
  onUseLatestDeck: () => void;
  onOpenLibrary: () => void;
  onOpenLearnHub: () => void;
  onReviewMixChange: (reviewsBetweenNewCards: number) => void;
  gateRule: GateRule;
  strictAddonEnabled: boolean;
  onStrictAddonChange: (enabled: boolean) => void;
  strictAddonLocked?: boolean;
  strictDurationHours: number;
  strictDurationTooLong: boolean;
  assignedAppCount?: number;
  startTime: string;
  setStartTime: Dispatch<SetStateAction<string>>;
  endTime: string;
  setEndTime: Dispatch<SetStateAction<string>>;
  sessionCreditsRequiredDraft: string;
  setSessionCreditsRequiredDraft: (value: string) => void;
  commitSessionCreditsRequiredDraft: () => void;
  unlockDurationMinutesDraft: string;
  setUnlockDurationMinutesDraft: (value: string) => void;
  commitUnlockDurationMinutesDraft: () => void;
  typedAnswerEnabledDraft: boolean;
  setTypedAnswerEnabledDraft: (value: boolean) => void;
}) {
  const { t, locale } = useI18n();
  if (selectedMode !== 'learn') return null;
  const learnPalette = getModePalette('learn');
  const isGerman = locale.toLowerCase().startsWith('de');
  const reviewMixSummary = resolvedLearnDeck
    ? (isGerman
        ? `Neue Karte nach ${resolvedLearnDeck.reviewsBetweenNewCards} Wiederholungen`
        : `New card after ${resolvedLearnDeck.reviewsBetweenNewCards} reviews`)
    : (isGerman ? 'Erst ein Deck auswählen' : 'Select a deck first');
  return (
    <motion.section variants={variants}>
      <GlassCard elevation="hero" surface="hero" tone="learn" accentGlow className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">{t('modes.learnGate.eyebrow')}</p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-foreground">{t('modes.learnGate.title')}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t('modes.learnGate.description')}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onOpenLibrary} className={cn('rounded-2xl border px-4 py-3 text-sm font-bold transition', learnPalette.badge)}>{t('modes.learnGate.selectDeck')}</button>
            <button type="button" onClick={onOpenLearnHub} className={cn('rounded-2xl px-4 py-3 text-sm font-bold', learnPalette.button)}>{t('modes.learnGate.openHub')}</button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-[1.4rem] border border-border/70 bg-background/65 px-4 py-4">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">{t('modes.learnGate.activeDeck')}</p>
            <p className="mt-2 text-lg font-black tracking-[-0.03em] text-foreground">{resolvedLearnDeck?.name || t('modes.learnGate.noneSelected')}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {resolvedLearnDeck
                ? `${resolvedLearnDeck.dueNowCount} fällig · ${resolvedLearnDeck.overdueCount} überfällig · ${resolvedLearnDeck.newLeftToday} neu`
                : t('modes.learnGate.deckHint')}
            </p>
          </div>
          <div data-tour-id="tour-learn-gate-settings" className="grid gap-3 md:col-span-2 md:grid-cols-2">
            <label className="rounded-[1.4rem] border border-border/70 bg-background/65 px-4 py-4">
              <span className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">{t('modes.learnGate.correctAnswers')}</span>
              <input type="number" min={1} max={20} value={sessionCreditsRequiredDraft} onChange={(event) => setSessionCreditsRequiredDraft(event.target.value)} onBlur={commitSessionCreditsRequiredDraft} className="mt-3 w-full rounded-xl border border-border/70 bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary/30" />
            </label>
            <label className="rounded-[1.4rem] border border-border/70 bg-background/65 px-4 py-4">
              <span className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">{t('modes.learnGate.unlockMinutes')}</span>
              <input type="number" min={1} max={120} value={unlockDurationMinutesDraft} onChange={(event) => setUnlockDurationMinutesDraft(event.target.value)} onBlur={commitUnlockDurationMinutesDraft} className="mt-3 w-full rounded-xl border border-border/70 bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary/30" />
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {t('modes.learnGate.unlockHint')}
              </p>
            </label>
          </div>
        </div>

        {resolvedLearnDeck ? (
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-[1.3rem] border border-border/70 bg-background/60 px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">Overdue</p>
              <p className="mt-2 text-2xl font-black tracking-[-0.05em] text-foreground">{resolvedLearnDeck.overdueCount}</p>
            </div>
            <div className="rounded-[1.3rem] border border-border/70 bg-background/60 px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">Reviews heute</p>
              <p className="mt-2 text-2xl font-black tracking-[-0.05em] text-foreground">{resolvedLearnDeck.reviewsLeftToday}</p>
            </div>
            <div className="rounded-[1.3rem] border border-border/70 bg-background/60 px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">Retention</p>
              <p className="mt-2 text-2xl font-black tracking-[-0.05em] text-foreground">{Math.round(resolvedLearnDeck.desiredRetention * 100)}%</p>
            </div>
          </div>
        ) : null}

        <div data-tour-id="tour-learn-new-cards" className="rounded-[1.3rem] border border-border/70 bg-background/60 px-4 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">
                {isGerman ? 'Neue Karten Abstand' : 'New-card spacing'}
              </p>
              <p className="mt-2 text-sm font-black tracking-[-0.03em] text-foreground">
                {reviewMixSummary}
              </p>
            </div>
            {resolvedLearnDeck ? (
              <span className={cn('rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em]', learnPalette.badge)}>
                Mix {resolvedLearnDeck.reviewMixLabel}
              </span>
            ) : null}
          </div>

          {resolvedLearnDeck ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {REVIEW_MIX_OPTIONS.map((value) => {
                const active = resolvedLearnDeck.reviewsBetweenNewCards === value;

                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => onReviewMixChange(value)}
                    className={cn(
                      'rounded-2xl border px-4 py-2.5 text-sm font-black transition',
                      active
                        ? learnPalette.button
                        : 'border-border/70 bg-background/80 text-foreground hover:border-primary/30',
                    )}
                    aria-pressed={active}
                  >
                    1:{value}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onUseLatestDeck} className={cn('rounded-2xl border px-4 py-3 text-sm font-bold', learnPalette.badge)}>{t('modes.learnGate.useLatest')}</button>
        </div>

        <ModeStrictAddonBlock
          mode="learn"
          enabled={strictAddonEnabled}
          onEnabledChange={onStrictAddonChange}
          locked={strictAddonLocked}
          startTime={startTime}
          setStartTime={setStartTime}
          endTime={endTime}
          setEndTime={setEndTime}
          strictDurationHours={strictDurationHours}
          strictDurationTooLong={strictDurationTooLong}
          assignedAppCount={assignedAppCount}
        />

        <div data-tour-id="tour-learn-typed-answer" className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 rounded-[1.35rem] border border-border/70 bg-background/60 px-4 py-4 sm:px-5">
          <div className="min-w-0 pr-1">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">
              {t('modes.learnGate.typedAnswerLabel')}
            </p>
            <p className="mt-2 max-w-[28rem] text-sm leading-relaxed text-muted-foreground">
              {t('modes.learnGate.typedAnswerHint')}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <button
              type="button"
              role="switch"
              aria-checked={typedAnswerEnabledDraft}
              aria-label={t('modes.learnGate.typedAnswerLabel')}
              onClick={() => setTypedAnswerEnabledDraft(!typedAnswerEnabledDraft)}
              className={cn(
                'relative h-9 w-[4.5rem] rounded-full border p-1 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                typedAnswerEnabledDraft
                  ? 'border-[hsl(var(--mode-learn-border)/0.5)] bg-[hsl(var(--mode-learn)/0.92)] shadow-[0_8px_20px_hsl(var(--mode-learn-glow)/0.22)]'
                  : 'border-border/80 bg-background/85',
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  'block size-7 rounded-full bg-background shadow-[0_2px_7px_rgba(0,0,0,0.2)] transition-transform duration-200',
                  typedAnswerEnabledDraft ? 'translate-x-9' : 'translate-x-0',
                )}
              />
            </button>
            <span
              className={cn(
                'rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.13em]',
                typedAnswerEnabledDraft ? learnPalette.badge : 'border-border/70 bg-background/75 text-muted-foreground',
              )}
            >
              {typedAnswerEnabledDraft ? t('modes.learnGate.typedAnswerOn') : t('modes.learnGate.typedAnswerOff')}
            </span>
          </div>
        </div>
      </GlassCard>
    </motion.section>
  );
}
