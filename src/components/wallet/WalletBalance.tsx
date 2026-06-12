import { motion, type Variants } from 'framer-motion';
import { Activity, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/store/useAppStore';
import { isAlbyReady } from '@/services/albyWalletService';
import GlassCard from '@/components/GlassCard';
import { InfoPopover } from '@/components/ui/InfoPopover';
import { showSuccessFeedback } from '@/lib/successFeedback';
import { APPROX_EURO_REFERENCE_COPY, formatApproxEuro, formatSats } from '@/lib/view-models/wallet';

interface Props {
  variants: Variants;
}

export default function WalletBalance({ variants }: Props) {
  const { albyConnection, albyConnectionTest, testAlbyConnection } = useAppStore();
  const albyReady = isAlbyReady(albyConnection);

  const handleTestConnection = async () => {
    const result = await testAlbyConnection();

    if (result.status === 'passed') {
      showSuccessFeedback({
        eyebrow: 'Strafkonto',
        title: 'Live-Test bestanden',
        description: 'Deine Alby-Verbindung wurde erfolgreich live geprüft.',
      });
      return;
    }

    toast.error(result.lastError || 'Verbindungstest fehlgeschlagen.');
  };

  return (
    <motion.div variants={variants}>
      <GlassCard className="mb-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="mb-1 flex items-center gap-2 text-muted-foreground">
              <Activity size={16} />
              <span className="text-xs font-bold uppercase tracking-widest">Verbindungsstatus</span>
            </div>
            <p className="text-4xl font-bold text-foreground">
              {albyConnectionTest.status === 'passed' ? 'Live' : albyConnectionTest.status === 'testing' ? 'Teste...' : 'Offen'}
            </p>
          </div>
          <InfoPopover
            title="Verbindungstest"
            description={`Hier siehst du den letzten Live-Status deiner NWC-Verbindung inklusive Budget- und Balance-Hinweisen in sats und mit grober EUR-Einordnung. ${APPROX_EURO_REFERENCE_COPY}`}
          />
        </div>

        <div className="mt-4 responsive-card-grid">
          <div className="rounded-2xl bg-background/70 px-4 py-4">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">Wallet</p>
            <p className="mt-2 text-sm font-bold text-foreground">
              {albyConnectionTest.walletAlias || albyConnection?.walletLabel || 'Noch nicht verbunden'}
            </p>
          </div>
          <div className="rounded-2xl bg-background/70 px-4 py-4">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">Balance</p>
            <p className="mt-2 text-sm font-bold text-foreground">
              {albyConnectionTest.status === 'passed' ? formatSats(albyConnectionTest.balanceSats) : 'Unbekannt'}
            </p>
            {albyConnectionTest.status === 'passed' ? (
              <p className="mt-1 text-xs text-muted-foreground">ca. {formatApproxEuro(albyConnectionTest.balanceSats)}</p>
            ) : null}
          </div>
          <div className="rounded-2xl bg-background/70 px-4 py-4">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">Budget</p>
            <p className="mt-2 text-sm font-bold text-foreground">
              {albyConnectionTest.status === 'passed'
                ? albyConnectionTest.budgetRemainingSats !== null && albyConnectionTest.budgetRemainingSats !== undefined
                  ? `${formatSats(albyConnectionTest.budgetRemainingSats)} frei`
                  : 'Vom Wallet verwaltet'
                : 'Noch nicht getestet'}
            </p>
            {albyConnectionTest.status === 'passed' && albyConnectionTest.budgetRemainingSats !== null && albyConnectionTest.budgetRemainingSats !== undefined ? (
              <p className="mt-1 text-xs text-muted-foreground">ca. {formatApproxEuro(albyConnectionTest.budgetRemainingSats)}</p>
            ) : null}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => {
              void handleTestConnection();
            }}
            disabled={!albyReady || albyConnectionTest.status === 'testing'}
            className="btn-press rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground disabled:opacity-40"
          >
            {albyConnectionTest.status === 'testing' ? 'Teste Verbindung...' : 'Verbindung testen'}
          </button>

          {albyConnectionTest.status === 'passed' ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-success/20 bg-success/10 px-3 py-1 text-[10px] font-bold text-success">
              <CheckCircle2 size={12} />
              Live-Test bestanden
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-3 py-1 text-[10px] font-bold text-muted-foreground">
              {albyReady ? 'Live-Test ausstehend' : 'Setup offen'}
            </span>
          )}
        </div>

        {albyConnectionTest.lastError ? (
          <div className="mt-4 rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {albyConnectionTest.lastError}
          </div>
        ) : null}
      </GlassCard>
    </motion.div>
  );
}
