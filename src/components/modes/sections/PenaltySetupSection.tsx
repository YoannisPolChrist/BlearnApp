import { motion } from 'framer-motion';
import type { Dispatch, SetStateAction } from 'react';
import { Banknote, Check } from 'lucide-react';
import GlassCard from '@/components/GlassCard';
import { InlineConfirmationBadge } from '@/components/ui/InlineConfirmationBadge';
import { useI18n } from '@/hooks/useI18n';
import { getModePalette, tonePalettes } from '@/lib/semanticTones';
import { cn } from '@/lib/utils';
import { ModeStrictAddonBlock, type ModeId } from './shared';

export function PenaltySetupSection({
  selectedMode,
  variants,
  albyReady,
  recipientVerified,
  walletLabel,
  recipientName,
  recipientAddress,
  penaltyAmountLabel,
  connectionStatusLabel,
  penaltySetupReady,
  penaltyReadyConfirmed,
  confirmFeedbackVisible,
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
  onOpenWallet,
  onConfirm,
}: {
  selectedMode: ModeId;
  variants?: Record<string, unknown>;
  albyReady: boolean;
  recipientVerified: boolean;
  walletLabel?: string;
  recipientName: string;
  recipientAddress: string;
  penaltyAmountLabel: string;
  connectionStatusLabel: string;
  penaltySetupReady: boolean;
  penaltyReadyConfirmed: boolean;
  confirmFeedbackVisible?: boolean;
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
  onOpenWallet: () => void;
  onConfirm: () => void;
}) {
  const { t } = useI18n();
  if (selectedMode !== 'penalty') return null;
  const penaltyPalette = getModePalette('penalty');

  return (
    <motion.section variants={variants}>
      <GlassCard elevation="hero" surface="hero" tone="penalty" accentGlow className="space-y-5">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">{t('modes.penalty.eyebrow')}</p>
          <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-foreground">{t('modes.penalty.title')}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t('modes.penalty.description')}</p>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[1.4rem] border border-border/70 bg-background/65 px-4 py-4">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">{t('modes.penalty.walletLabel')}</p>
            <p className="mt-2 text-sm font-black text-foreground">{walletLabel || t('modes.penalty.walletMissing')}</p>
            <p className="mt-1 text-xs text-muted-foreground">{albyReady ? t('modes.penalty.walletReady') : t('modes.penalty.walletMissingStatus')}</p>
          </div>
          <div className="rounded-[1.4rem] border border-border/70 bg-background/65 px-4 py-4">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">{t('modes.penalty.recipientLabel')}</p>
            <p className="mt-2 text-sm font-black text-foreground">{recipientName}</p>
            <p className="mt-1 text-xs text-muted-foreground">{recipientAddress}</p>
          </div>
          <div className="rounded-[1.4rem] border border-border/70 bg-background/65 px-4 py-4">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">{t('modes.penalty.penaltyLabel')}</p>
            <p className="mt-2 text-lg font-black tracking-[-0.03em] text-foreground">{penaltyAmountLabel}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t('modes.penalty.penaltyPerTrigger')}</p>
          </div>
          <div className="rounded-[1.4rem] border border-border/70 bg-background/65 px-4 py-4">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">Verbindungstest</p>
            <p className="mt-2 text-lg font-black tracking-[-0.03em] text-foreground">{connectionStatusLabel}</p>
            <p className="mt-1 text-xs text-muted-foreground">Pflichtschritt vor der Aktivierung des Strafmodus.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={onOpenWallet} className={cn('rounded-2xl px-4 py-3 text-sm font-bold', penaltyPalette.button)}>{t('modes.penalty.openWallet')}</button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!penaltySetupReady}
            className={cn(
              'inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold disabled:opacity-35',
              penaltyReadyConfirmed ? tonePalettes.success.button : penaltyPalette.badge,
            )}
          >
            {penaltyReadyConfirmed ? <Check size={16} /> : <Banknote size={16} />}
            {penaltyReadyConfirmed ? t('modes.penalty.confirmed') : t('modes.penalty.confirm')}
          </button>
          <InlineConfirmationBadge visible={Boolean(confirmFeedbackVisible)} label="Bestätigt" />
        </div>

        <ModeStrictAddonBlock
          mode="penalty"
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

        <div className={cn('rounded-[1.4rem] border px-4 py-4 text-sm', penaltySetupReady && recipientVerified ? 'surface-success text-success' : 'border-border/70 bg-background/65 text-muted-foreground')}>
          {penaltySetupReady
            ? 'Wallet, Live-Test, Empfänger und Strafbetrag sind bereit. Nach der Bestätigung kann der Strafmodus live gehen.'
            : 'Für den Strafmodus fehlen noch Wallet-Setup, Live-Test, verifizierter Empfänger oder ein Betrag in sats.'}
        </div>
      </GlassCard>
    </motion.section>
  );
}
