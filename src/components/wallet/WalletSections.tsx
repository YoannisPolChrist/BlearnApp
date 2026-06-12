import { AlertTriangle, CircleCheckBig, Info, TrendingDown } from 'lucide-react';
import type { Variants } from 'framer-motion';
import { motion } from 'framer-motion';
import GlassCard from '@/components/GlassCard';

interface WalletSummarySectionProps {
  penaltyReady: boolean;
  albyReady: boolean;
  recipientVerified: boolean;
  walletStatusTitle: string;
  walletStatusDescription: string;
  walletTitle: string;
  walletDescription: string;
  recipientTitle: string;
  recipientDescription: string;
}

export function WalletSummarySection({
  penaltyReady,
  albyReady,
  recipientVerified,
  walletStatusTitle,
  walletStatusDescription,
  walletTitle,
  walletDescription,
  recipientTitle,
  recipientDescription,
}: WalletSummarySectionProps) {
  return (
    <div className="responsive-card-grid">
      <GlassCard className={penaltyReady ? 'surface-success' : 'surface-destructive'}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">Status</p>
            <p className="mt-2 text-lg font-black text-foreground">{walletStatusTitle}</p>
            <p className="mt-2 text-sm text-muted-foreground">{walletStatusDescription}</p>
          </div>
          {penaltyReady ? (
            <CircleCheckBig className="shrink-0 text-success" size={24} />
          ) : (
            <AlertTriangle className="shrink-0 text-destructive" size={24} />
          )}
        </div>
      </GlassCard>

      <GlassCard className={albyReady ? 'surface-success' : 'surface-destructive'}>
        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">Eigenes Konto</p>
        <p className="mt-2 text-lg font-black text-foreground">{walletTitle}</p>
        <p className="mt-2 text-sm text-muted-foreground">{walletDescription}</p>
      </GlassCard>

      <GlassCard className={recipientVerified ? 'surface-success' : 'surface-destructive'}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">Empfänger</p>
            <p className="mt-2 text-lg font-black text-foreground">{recipientTitle}</p>
            <p className="mt-2 text-sm text-muted-foreground">{recipientDescription}</p>
          </div>
          <Info className="shrink-0 text-muted-foreground" size={18} />
        </div>
      </GlassCard>
    </div>
  );
}

interface WalletMetricsSectionProps {
  weeklyPenaltyLabel: string;
  totalPenaltyLabel: string;
}

export function WalletMetricsSection({ weeklyPenaltyLabel, totalPenaltyLabel }: WalletMetricsSectionProps) {
  return (
    <div className="responsive-card-grid">
      <GlassCard className="text-center">
        <TrendingDown size={18} className="mx-auto mb-1 text-destructive" />
        <p className="text-lg font-bold text-foreground">{weeklyPenaltyLabel}</p>
        <p className="text-xs text-muted-foreground">Diese Woche</p>
      </GlassCard>
      <GlassCard className="text-center">
        <TrendingDown size={18} className="mx-auto mb-1 text-destructive/60" />
        <p className="text-lg font-bold text-foreground">{totalPenaltyLabel}</p>
        <p className="text-xs text-muted-foreground">Gesamt Strafen</p>
      </GlassCard>
    </div>
  );
}

interface WalletAlertStackProps {
  variants: Variants;
  penaltyEnabled: boolean;
  albyReady: boolean;
  recipientVerified: boolean;
  connectionTestPassed: boolean;
  penaltyAmountConfigured: boolean;
  penaltyReady: boolean;
}

export function WalletAlertStack({
  variants,
  penaltyEnabled,
  albyReady,
  recipientVerified,
  connectionTestPassed,
  penaltyAmountConfigured,
  penaltyReady,
}: WalletAlertStackProps) {
  return (
    <>
      {penaltyEnabled && !connectionTestPassed ? (
        <motion.div variants={variants}>
          <div className="flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-destructive" />
            <p className="text-xs text-destructive">
              Die Wallet-Verbindung wurde noch nicht live getestet. Ohne Test bleibt der Strafmodus blockiert.
            </p>
          </div>
        </motion.div>
      ) : null}

      {penaltyEnabled && !albyReady ? (
        <motion.div variants={variants}>
          <div className="flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-destructive" />
            <p className="text-xs text-destructive">
              Dein Wallet ist noch nicht vollständig verbunden. Darum bleibt der Strafmodus blockiert.
            </p>
          </div>
        </motion.div>
      ) : null}

      {penaltyEnabled && !recipientVerified ? (
        <motion.div variants={variants}>
          <div className="flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-destructive" />
            <p className="text-xs text-destructive">
              Der Empfänger ist noch nicht verifiziert. Bitte prüfe die Lightning-Adresse, bevor Strafzahlungen aktiv werden.
            </p>
          </div>
        </motion.div>
      ) : null}

      {!penaltyAmountConfigured ? (
        <motion.div variants={variants}>
          <div className="flex items-start gap-3 rounded-xl border border-destructive/10 bg-destructive/5 px-4 py-3">
            <Info size={16} className="mt-0.5 shrink-0 text-destructive" />
            <div className="text-xs text-muted-foreground">
              <span className="font-bold text-foreground">Noch offen:</span> Lege einen Strafbetrag in sats fest. Die Kachel zeigt dir dann zusätzlich eine grobe EUR-Einordnung nach fixer Faustregel.
            </div>
          </div>
        </motion.div>
      ) : null}

      {!penaltyReady ? (
        <motion.div variants={variants}>
          <div className="flex items-start gap-3 rounded-xl border border-destructive/10 bg-destructive/5 px-4 py-3">
            <Info size={16} className="mt-0.5 shrink-0 text-destructive" />
            <div className="text-xs text-muted-foreground">
              <span className="font-bold text-foreground">Kurzlogik:</span> Erst Wallet speichern, dann live testen, Empfänger verifizieren und zuletzt den Betrag in sats festlegen, damit die Anzeige beide Einordnungen zeigen kann.
            </div>
          </div>
        </motion.div>
      ) : null}
    </>
  );
}
