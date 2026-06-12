import { motion } from 'framer-motion';
import type { Dispatch, SetStateAction } from 'react';
import GlassCard from '@/components/GlassCard';
import { useI18n } from '@/hooks/useI18n';
import { getModePalette } from '@/lib/semanticTones';
import { cn } from '@/lib/utils';
import { ModeStrictAddonBlock, type ModeId } from './shared';

export function StrictProtectionSection({
  selectedMode,
  strictAddonEnabled,
  onStrictAddonChange,
  strictAddonLocked,
  assignedAppCount,
  variants,
  startTime,
  setStartTime,
  endTime,
  setEndTime,
  strictDurationHours,
  strictDurationTooLong,
  localPatternId,
  setLocalPatternId,
  localBreathingRoundsDraft,
  setLocalBreathingRoundsDraft,
  commitLocalBreathingRoundsDraft,
  localIntervalDraft,
  setLocalIntervalDraft,
  commitLocalIntervalDraft,
  breathingPatterns,
}: {
  selectedMode: ModeId;
  strictAddonEnabled?: boolean;
  onStrictAddonChange: (enabled: boolean) => void;
  strictAddonLocked?: boolean;
  assignedAppCount?: number;
  variants?: Record<string, unknown>;
  startTime: string;
  setStartTime: Dispatch<SetStateAction<string>>;
  endTime: string;
  setEndTime: Dispatch<SetStateAction<string>>;
  strictDurationHours: number;
  strictDurationTooLong: boolean;
  localPatternId: string;
  setLocalPatternId: Dispatch<SetStateAction<string>>;
  localBreathingRoundsDraft: string;
  setLocalBreathingRoundsDraft: (value: string) => void;
  commitLocalBreathingRoundsDraft: () => void;
  localIntervalDraft: string;
  setLocalIntervalDraft: (value: string) => void;
  commitLocalIntervalDraft: () => void;
  breathingPatterns: Array<{ id: string; name: string }>;
}) {
  const { t, locale } = useI18n();
  if (selectedMode !== 'strict' && selectedMode !== 'lock') return null;

  const showBreathingControls = selectedMode === 'strict';
  const strictPalette = getModePalette(selectedMode === 'lock' ? 'lock' : 'strict');
  const description = selectedMode === 'strict'
    ? t('modes.strict.descriptionStrict')
    : t('modes.strict.descriptionLock');

  return (
    <motion.section variants={variants}>
      <GlassCard elevation="hero" surface="hero" tone={selectedMode === 'lock' ? 'strict' : 'reflection'} accentGlow className="space-y-5">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">{t('modes.strict.eyebrow')}</p>
          <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-foreground">
            {showBreathingControls ? t('modes.strict.titleStrict') : t('modes.strict.titleLock')}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        </div>

        {showBreathingControls ? (
          <div className="grid gap-3 md:grid-cols-3">
            <label className="rounded-[1.4rem] border border-border/70 bg-background/65 px-4 py-4">
              <span className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">{t('modes.strict.rounds')}</span>
              <input type="number" min={1} max={12} value={localBreathingRoundsDraft} onChange={(event) => setLocalBreathingRoundsDraft(event.target.value)} onBlur={commitLocalBreathingRoundsDraft} className="mt-3 w-full rounded-xl border border-border/70 bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary/30" />
            </label>
            <label className="rounded-[1.4rem] border border-border/70 bg-background/65 px-4 py-4">
              <span className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">{t('modes.strict.interval')}</span>
              <input type="number" min={5} max={240} step={5} value={localIntervalDraft} onChange={(event) => setLocalIntervalDraft(event.target.value)} onBlur={commitLocalIntervalDraft} className="mt-3 w-full rounded-xl border border-border/70 bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary/30" />
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{t('modes.strict.unlockHint')}</p>
            </label>
            <label className="rounded-[1.4rem] border border-border/70 bg-background/65 px-4 py-4">
              <span className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">{t('modes.strict.pattern')}</span>
              <select value={localPatternId} onChange={(event) => setLocalPatternId(event.target.value)} className="mt-3 w-full rounded-xl border border-border/70 bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary/30">
                {breathingPatterns.map((pattern) => <option key={pattern.id} value={pattern.id}>{pattern.name}</option>)}
              </select>
            </label>
          </div>
        ) : null}

        {selectedMode === 'strict' ? (
          <ModeStrictAddonBlock
            mode="strict"
            enabled={Boolean(strictAddonEnabled)}
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
        ) : null}

        {selectedMode === 'lock' ? (
          <div className="grid gap-3 md:grid-cols-2">
            <label className="rounded-[1.4rem] border border-border/70 bg-background/65 px-4 py-4">
              <span className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">{t('modes.strict.from')}</span>
              <input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} className="mt-3 w-full rounded-xl border border-border/70 bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary/30" />
            </label>
            <label className="rounded-[1.4rem] border border-border/70 bg-background/65 px-4 py-4">
              <span className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">{t('modes.strict.to')}</span>
              <input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} className="mt-3 w-full rounded-xl border border-border/70 bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary/30" />
            </label>
          </div>
        ) : null}

        {selectedMode === 'lock' ? (
          <div className={cn('rounded-[1.4rem] border px-4 py-4 text-sm', strictPalette.badge)}>
            {t('modes.strict.standardDescription')}
          </div>
        ) : null}
      </GlassCard>
    </motion.section>
  );
}
