import { motion, type Variants } from 'framer-motion';
import { CheckCircle2, Clock3, Minus, Plus, TrendingDown, TriangleAlert } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import GlassCard from '@/components/GlassCard';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);
const formatSats = (amountSats: number) => `${amountSats.toLocaleString('de-DE')} sats`;

const formatDate = (ts: number) => {
  const d = new Date(ts);
  return (
    d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' }) +
    ' ' +
    d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
  );
};

interface Props {
  variants: Variants;
}

function getStatusChip(transaction: ReturnType<typeof useAppStore.getState>['penaltyTransactions'][number]) {
  if (transaction.type !== 'penalty') return null;

  if (transaction.deliveryStatus === 'sent') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-1 text-[10px] font-bold text-success">
        <CheckCircle2 size={11} />
        Gesendet
      </span>
    );
  }

  if (transaction.deliveryStatus === 'processing') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-2 py-1 text-[10px] font-bold text-warning">
        <Clock3 size={11} />
        Verarbeitung
      </span>
    );
  }

  if (transaction.deliveryStatus === 'failed') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-1 text-[10px] font-bold text-destructive">
        <TriangleAlert size={11} />
        Fehler
      </span>
    );
  }

  return null;
}

function formatTransactionAmount(transaction: ReturnType<typeof useAppStore.getState>['penaltyTransactions'][number]) {
  if (typeof transaction.amountSats === 'number') {
    return formatSats(transaction.amountSats);
  }

  if (typeof transaction.amount === 'number') {
    return formatCurrency(transaction.amount);
  }

  return formatSats(0);
}

export default function TransactionHistory({ variants }: Props) {
  const { penaltyTransactions } = useAppStore();

  return (
    <motion.div variants={variants}>
      <p className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Transaktionen</p>
      {penaltyTransactions.length === 0 ? (
        <GlassCard className="text-center">
          <p className="text-sm text-muted-foreground">Noch keine Transaktionen</p>
        </GlassCard>
      ) : (
        <div className="space-y-2">
          {penaltyTransactions.slice(0, 20).map((tx) => (
            <GlassCard key={tx.id} className="flex items-center gap-3">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                  tx.type === 'deposit' ? 'bg-success/10' : tx.type === 'penalty' ? 'bg-destructive/10' : 'bg-muted/50'
                }`}
              >
                {tx.type === 'deposit' ? (
                  <Plus size={16} className="text-success" />
                ) : tx.type === 'penalty' ? (
                  <TrendingDown size={16} className="text-destructive" />
                ) : (
                  <Minus size={16} className="text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-semibold text-foreground">{tx.description}</p>
                  {getStatusChip(tx)}
                </div>
                <p className="text-xs text-muted-foreground">{formatDate(tx.timestamp)}</p>
                {tx.lastDeliveryError ? (
                  <p className="mt-1 text-[11px] text-destructive">{tx.lastDeliveryError}</p>
                ) : null}
              </div>
              <p className={`text-sm font-bold ${tx.type === 'deposit' ? 'text-success' : 'text-destructive'}`}>
                {tx.type === 'deposit' ? '+' : '-'}
                {formatTransactionAmount(tx)}
              </p>
            </GlassCard>
          ))}
        </div>
      )}
    </motion.div>
  );
}
