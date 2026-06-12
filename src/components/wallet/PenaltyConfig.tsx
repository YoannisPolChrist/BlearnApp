import { useState } from 'react';
import { motion, type Variants } from 'framer-motion';
import { Coins } from 'lucide-react';
import { isVerifiedAccountabilityPartner, useAppStore } from '@/store/useAppStore';
import { isAlbyReady } from '@/services/albyWalletService';
import GlassCard from '@/components/GlassCard';
import { InfoPopover } from '@/components/ui/InfoPopover';
import { Switch } from '@/components/ui/switch';
import { showSuccessFeedback } from '@/lib/successFeedback';
import { APPROX_EURO_REFERENCE_COPY, formatApproxEuro, formatSats, formatSatsWithApproxEuro } from '@/lib/view-models/wallet';

interface Props {
  variants: Variants;
}

export default function PenaltyConfig({ variants }: Props) {
  const {
    penaltyAmountSats,
    penaltyEnabled,
    setPenaltyAmountSats,
    setPenaltyEnabled,
    albyConnection,
    albyConnectionTest,
    accountabilityPartner,
  } = useAppStore();
  const [customInput, setCustomInput] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  const penaltyPresets = [100, 300, 500, 1000, 2000];
  const penaltyConnectionsReady =
    isAlbyReady(albyConnection)
    && albyConnectionTest.status === 'passed'
    && isVerifiedAccountabilityPartner(accountabilityPartner);
  const penaltyAmountConfigured = typeof penaltyAmountSats === 'number' && penaltyAmountSats > 0;

  const handleCustomAmount = () => {
    const amount = Number.parseInt(customInput.replace(/[^\d]/g, ''), 10);
    if (!Number.isNaN(amount) && amount > 0 && amount <= 1_000_000) {
      setPenaltyAmountSats(amount);
      setCustomInput('');
      setShowCustom(false);
      showSuccessFeedback({
        eyebrow: 'Strafkonto',
        title: 'Betrag gespeichert',
        description: `${formatSatsWithApproxEuro(amount)} ist jetzt dein Strafbetrag.`,
      });
    }
  };

  const handlePresetAmount = (amount: number) => {
    setPenaltyAmountSats(amount);
    showSuccessFeedback({
      eyebrow: 'Strafkonto',
      title: 'Betrag gespeichert',
      description: `${formatSatsWithApproxEuro(amount)} ist jetzt dein Strafbetrag.`,
    });
  };

  const handlePenaltyEnabledChange = (enabled: boolean) => {
    setPenaltyEnabled(enabled);
    showSuccessFeedback({
      eyebrow: 'Strafkonto',
      title: 'Einstellung gespeichert',
      description: enabled
        ? 'Strafgeld ist jetzt aktiv.'
        : 'Strafgeld ist jetzt pausiert.',
    });
  };

  return (
    <motion.div variants={variants}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Strafbetrag</p>
        <InfoPopover
          compact
          title="Wie wirkt der Strafbetrag?"
          description={`Der Betrag definiert, wie viel pro erkanntem Verstoß in sats live an deinen Empfänger gesendet wird. Die EUR-Zahl ist nur eine grobe Orientierung. ${APPROX_EURO_REFERENCE_COPY}`}
        />
      </div>

      <GlassCard className="mb-6 space-y-4">
        <div className="setting-row">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
              <Coins size={18} />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">Strafgeld aktiv</p>
              <p className="text-xs text-muted-foreground">
                {penaltyConnectionsReady
                  ? 'Wallet, Live-Test und verifizierter Empfänger sind bereit.'
                  : 'Erst verfügbar, wenn Wallet, Live-Test und verifizierter Empfänger bereit sind.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={penaltyEnabled}
              onCheckedChange={handlePenaltyEnabledChange}
              disabled={!penaltyConnectionsReady || !penaltyAmountConfigured}
            />
          </div>
        </div>

        <div className="rounded-2xl bg-background/65 px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">Aktuell pro Verstoß</p>
          </div>
          <p className="mt-2 text-2xl font-black text-foreground">
            {penaltyAmountConfigured ? formatSats(penaltyAmountSats) : 'Noch nicht gesetzt'}
          </p>
          {penaltyAmountConfigured ? (
            <p className="mt-1 text-xs text-muted-foreground">ca. {formatApproxEuro(penaltyAmountSats)}</p>
          ) : null}
          <p className="mt-2 text-xs text-muted-foreground">
            Die Speicherung bleibt in sats. Für Menschen zeigt die Kachel zusätzlich eine grobe EUR-Orientierung. {APPROX_EURO_REFERENCE_COPY}
          </p>
        </div>

        <div className="touch-grid">
          {penaltyPresets.map((preset) => (
            <motion.button
              key={preset}
              whileTap={{ scale: 0.97 }}
              onClick={() => handlePresetAmount(preset)}
              className={`rounded-xl px-4 py-3 text-left text-sm font-semibold transition-colors ${
                penaltyAmountSats === preset
                  ? 'bg-primary text-primary-foreground'
                  : 'border border-border bg-muted/50 text-muted-foreground'
              }`}
            >
              <span className="block">{formatSats(preset)}</span>
              <span className="mt-1 block text-[11px] font-medium opacity-75">ca. {formatApproxEuro(preset)}</span>
            </motion.button>
          ))}
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => setShowCustom((value) => !value)}
            className={`rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${
              penaltyAmountConfigured && !penaltyPresets.includes(penaltyAmountSats || 0)
                ? 'bg-primary text-primary-foreground'
                : 'border border-border bg-muted/50 text-muted-foreground'
            }`}
          >
            Eigen
          </motion.button>
        </div>

        {showCustom ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            className="flex flex-col gap-2 sm:flex-row"
          >
            <input
              type="text"
              inputMode="numeric"
              placeholder="z. B. 750"
              value={customInput}
              onChange={(event) => setCustomInput(event.target.value)}
              className="flex-1 rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleCustomAmount}
              className="rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground"
            >
              übernehmen
            </motion.button>
          </motion.div>
        ) : null}

        {!penaltyConnectionsReady ? (
          <div className="rounded-2xl border border-border/70 bg-background/65 px-4 py-4 text-sm text-muted-foreground">
            Verbinde erst Wallet, prüfe die Verbindung live und verifiziere deinen Empfänger. Danach kannst du den Strafmodus aktivieren und den Betrag mit grober EUR-Einordnung bestätigen.
          </div>
        ) : null}
      </GlassCard>
    </motion.div>
  );
}
