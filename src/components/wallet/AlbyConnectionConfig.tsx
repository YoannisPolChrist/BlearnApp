import { useMemo, useState } from 'react';
import { motion, type Variants } from 'framer-motion';
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  KeyRound,
  Link2,
  Send,
  ShieldAlert,
  Trash2,
  Wallet2,
} from 'lucide-react';
import { toast } from 'sonner';
import GlassCard from '@/components/GlassCard';
import { InfoPopover } from '@/components/ui/InfoPopover';
import { useAppStore } from '@/store/useAppStore';
import {
  type AlbyBudgetRenewal,
  type AlbyConnectionConfig,
  isAlbyReady,
  isValidNwcConnectionUri,
} from '@/services/albyWalletService';
import { showSuccessFeedback } from '@/lib/successFeedback';

interface Props {
  variants: Variants;
}

const ALBY_GO_URL = 'https://getalby.com/alby-go';
const ALBY_GO_GUIDE_URL = 'https://guides.getalby.com/user-guide/alby-go/connect-send-receive-go';
const ALBY_HUB_CONNECTION_URL = 'https://guides.getalby.com/user-guide/alby-hub/app-connections';

function maskConnection(uri: string): string {
  if (uri.length <= 26) return uri;
  return `${uri.slice(0, 18)}...${uri.slice(-8)}`;
}

function openExternal(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer');
}

export default function AlbyConnectionConfigCard({ variants }: Props) {
  const { albyConnection, setAlbyConnection, accountabilityPartner } = useAppStore();
  const [editing, setEditing] = useState(!albyConnection);
  const [walletLabel, setWalletLabel] = useState(albyConnection?.walletLabel || 'Blearn Strafkonto');
  const [nwcConnectionUri, setNwcConnectionUri] = useState(albyConnection?.nwcConnectionUri || '');
  const [budgetSats, setBudgetSats] = useState(String(albyConnection?.budgetSats || 5000));
  const [budgetRenewal, setBudgetRenewal] = useState<AlbyBudgetRenewal>(albyConnection?.budgetRenewal || 'weekly');
  const [expirationDate, setExpirationDate] = useState(albyConnection?.expirationDate || '');
  const [error, setError] = useState('');

  const setupPayload = useMemo(() => {
    const recipientLine = accountabilityPartner?.lightningAddress
      ? `Empfänger: ${accountabilityPartner.name} <${accountabilityPartner.lightningAddress}>`
      : 'Empfänger: noch nicht hinterlegt';

    return [
      'Blearn -> Alby Go Setup',
      `Wallet-Label: ${walletLabel || 'Blearn Strafkonto'}`,
      `Budget: ${budgetSats || '5000'} sats`,
      `Erneuerung: ${budgetRenewal}`,
      expirationDate ? `Ablaufdatum: ${expirationDate}` : 'Ablaufdatum: optional',
      recipientLine,
      'Danach das NWC-Secret in Blearn einfügen.',
    ].join('\n');
  }, [accountabilityPartner, budgetRenewal, budgetSats, expirationDate, walletLabel]);

  const handleSave = () => {
    const parsedBudget = Number(budgetSats);
    if (!walletLabel.trim()) {
      setError('Bitte vergib einen Namen für die Verbindung.');
      return;
    }
    if (!isValidNwcConnectionUri(nwcConnectionUri)) {
      setError('Bitte füge ein gültiges NWC-Secret im Format nostr+walletconnect://... ein.');
      return;
    }
    if (!Number.isFinite(parsedBudget) || parsedBudget <= 0) {
      setError('Bitte setze ein sinnvolles Budget in Sats.');
      return;
    }

    const connection: AlbyConnectionConfig = {
      walletLabel: walletLabel.trim(),
      nwcConnectionUri: nwcConnectionUri.trim(),
      budgetSats: parsedBudget,
      budgetRenewal,
      expirationDate: expirationDate || undefined,
    };

    setAlbyConnection(connection);
    setError('');
    setEditing(false);
    showSuccessFeedback({
      eyebrow: 'Strafkonto',
      title: 'Wallet gespeichert',
      description: 'Die Alby-Go-Verbindung ist jetzt in Blearn hinterlegt.',
    });
  };

  const copySetupPayload = async () => {
    try {
      await navigator.clipboard.writeText(setupPayload);
      toast.success('Setup-Daten kopiert');
    } catch {
      toast.error('Konnte die Setup-Daten nicht kopieren');
    }
  };

  const shareSetupPayload = async () => {
    if (!navigator.share) {
      await copySetupPayload();
      return;
    }

    try {
      await navigator.share({
        title: 'Blearn Alby Go Setup',
        text: setupPayload,
      });
    } catch {
      return;
    }
  };

  const copySecret = async () => {
    if (!albyConnection?.nwcConnectionUri) return;
    try {
      await navigator.clipboard.writeText(albyConnection.nwcConnectionUri);
      toast.success('NWC-Secret kopiert');
    } catch {
      toast.error('Konnte das Secret nicht kopieren');
    }
  };

  return (
    <motion.div variants={variants}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Alby Go Verbindung</p>
        <InfoPopover
          compact
          title="Alby Verbindung"
          description="Hier speicherst du nur die Blearn-spezifische Alby-NWC-Verbindung. Nach erfolgreicher Verbindung bleiben nur kompakte Statusinfos sichtbar."
        />
      </div>

      <GlassCard className="mb-6 space-y-4">
        {(editing || !albyConnection) && (
          <div className="rounded-2xl border border-destructive/10 bg-destructive/5 px-4 py-4">
            <p className="text-sm font-semibold text-foreground">Kurzablauf</p>
            <div className="mt-3 responsive-card-grid">
              <div className="rounded-xl bg-background/80 px-3 py-3">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-destructive">1. Öffnen</p>
                <p className="mt-2 text-sm font-semibold text-foreground">Alby oder Hub starten</p>
              </div>
              <div className="rounded-xl bg-background/80 px-3 py-3">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-destructive">2. Verbinden</p>
                <p className="mt-2 text-sm font-semibold text-foreground">NWC für Blearn anlegen</p>
              </div>
              <div className="rounded-xl bg-background/80 px-3 py-3">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-destructive">3. Einfügen</p>
                <p className="mt-2 text-sm font-semibold text-foreground">Secret in Blearn speichern</p>
              </div>
            </div>
          </div>
        )}

        <div className="grid gap-2 sm:grid-cols-2">
          <button
            onClick={() => openExternal(ALBY_GO_URL)}
            className="btn-press inline-flex items-center justify-center gap-2 rounded-xl bg-destructive px-4 py-3 text-sm font-bold text-destructive-foreground"
          >
            <ExternalLink size={15} />
            Alby Go öffnen
          </button>
          <button
            onClick={() => openExternal(ALBY_HUB_CONNECTION_URL)}
            className="btn-press inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card/70 px-4 py-3 text-sm font-bold text-foreground"
          >
            <Link2 size={15} />
            Hub-Verbindung anlegen
          </button>
          <button
            onClick={copySetupPayload}
            className="btn-press inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card/70 px-4 py-3 text-sm font-bold text-foreground"
          >
            <Copy size={15} />
            Setup-Daten kopieren
          </button>
          <button
            onClick={shareSetupPayload}
            className="btn-press inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card/70 px-4 py-3 text-sm font-bold text-foreground"
          >
            <Send size={15} />
            Mit Alby teilen
          </button>
        </div>

        <div className="rounded-2xl bg-background/65 px-4 py-4 text-sm text-muted-foreground">
          Offizielle Hilfe:{' '}
          <button
            onClick={() => openExternal(ALBY_GO_GUIDE_URL)}
            className="font-semibold text-destructive underline-offset-2 hover:underline"
          >
            Alby Go Anleitung
          </button>
        </div>

        {!editing && albyConnection ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/12 text-success">
                <CheckCircle2 size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-foreground">{albyConnection.walletLabel}</p>
                <p className="mt-1 break-all text-xs text-muted-foreground">
                  {maskConnection(albyConnection.nwcConnectionUri)}
                </p>
              </div>
            </div>

            <div className="responsive-card-grid">
              <div className="rounded-2xl bg-background/70 px-3 py-3">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">Budget</p>
                <p className="mt-2 text-sm font-bold text-foreground">{albyConnection.budgetSats.toLocaleString('de-DE')} sats</p>
              </div>
              <div className="rounded-2xl bg-background/70 px-3 py-3">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">Erneuerung</p>
                <p className="mt-2 text-sm font-bold text-foreground">{albyConnection.budgetRenewal}</p>
              </div>
              <div className="rounded-2xl bg-background/70 px-3 py-3">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">Status</p>
                <p className="mt-2 text-sm font-bold text-success">
                  {isAlbyReady(albyConnection) ? 'Eingerichtet' : 'Unvollständig'}
                </p>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <button
                onClick={copySecret}
                className="btn-press inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card/70 px-4 py-3 text-sm font-bold text-foreground"
              >
                <Copy size={15} />
                NWC-Secret kopieren
              </button>
              <button
                onClick={() => openExternal(ALBY_GO_URL)}
                className="btn-press inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card/70 px-4 py-3 text-sm font-bold text-foreground"
              >
                <ExternalLink size={15} />
                Zu Alby Go
              </button>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setEditing(true)}
                className="flex-1 rounded-xl border border-border bg-muted/50 py-2.5 text-sm font-semibold text-foreground"
              >
                Bearbeiten
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  setAlbyConnection(null);
                  setEditing(true);
                }}
                className="flex items-center justify-center gap-1 rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-2.5 text-sm font-semibold text-destructive"
              >
                <Trash2 size={14} />
                Entfernen
              </motion.button>
            </div>

            <div className="rounded-2xl border border-success/10 bg-success/5 px-4 py-3 text-sm text-muted-foreground">
              Verbindung gespeichert. Die großen Einrichtungshinweise verschwinden jetzt weitgehend.
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="mb-1 flex items-center gap-1 text-xs font-semibold text-foreground">
                <Wallet2 size={12} /> Name der Verbindung
              </label>
              <input
                type="text"
                value={walletLabel}
                onChange={(event) => setWalletLabel(event.target.value)}
                placeholder="Blearn Strafkonto"
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <div>
              <label className="mb-1 flex items-center gap-1 text-xs font-semibold text-foreground">
                <KeyRound size={12} /> NWC-Secret
              </label>
              <textarea
                value={nwcConnectionUri}
                onChange={(event) => setNwcConnectionUri(event.target.value)}
                placeholder="nostr+walletconnect://..."
                className="min-h-28 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-foreground">Budget in Sats</label>
                <input
                  type="number"
                  min={1}
                  value={budgetSats}
                  onChange={(event) => setBudgetSats(event.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-foreground">Erneuerung</label>
                <select
                  value={budgetRenewal}
                  onChange={(event) => setBudgetRenewal(event.target.value as AlbyBudgetRenewal)}
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="daily">Täglich</option>
                  <option value="weekly">Wöchentlich</option>
                  <option value="monthly">Monatlich</option>
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1 flex items-center gap-1 text-xs font-semibold text-foreground">
                <Link2 size={12} /> Optionales Ablaufdatum
              </label>
              <input
                type="date"
                value={expirationDate}
                onChange={(event) => setExpirationDate(event.target.value)}
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            {error ? (
              <div className="flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                <ShieldAlert size={14} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            ) : null}

            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleSave}
              className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground"
            >
              Alby Go Verbindung speichern
            </motion.button>
          </div>
        )}
      </GlassCard>
    </motion.div>
  );
}
