import { useState } from 'react';
import { motion, type Variants } from 'framer-motion';
import { Bell, Mail, Trash2, UserCheck, WalletCards } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore, type AccountabilityPartner } from '@/store/useAppStore';
import {
  isValidLightningAddressSyntax,
  normalizeLightningAddress,
  verifyLightningAddress,
} from '@/services/albyWalletService';
import GlassCard from '@/components/GlassCard';
import { InfoPopover } from '@/components/ui/InfoPopover';
import { Switch } from '@/components/ui/switch';
import { showSuccessFeedback } from '@/lib/successFeedback';

interface Props {
  variants: Variants;
}

const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export default function RecipientConfig({ variants }: Props) {
  const { accountabilityPartner, setAccountabilityPartner } = useAppStore();
  const [editing, setEditing] = useState(!accountabilityPartner);
  const [name, setName] = useState(accountabilityPartner?.name || '');
  const [email, setEmail] = useState(accountabilityPartner?.email || '');
  const [lightningAddress, setLightningAddress] = useState(accountabilityPartner?.lightningAddress || '');
  const [notify, setNotify] = useState(accountabilityPartner?.notifyOnPenalty ?? true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [verifying, setVerifying] = useState(false);

  const recipientVerified = accountabilityPartner?.validationStatus === 'verified';
  const recipientShellClass = recipientVerified
    ? 'border-2 border-success/25 bg-success/5'
    : 'border-2 border-destructive/25 bg-destructive/5';

  const handleSave = async () => {
    const nextErrors: Record<string, string> = {};
    if (!name.trim()) nextErrors.name = 'Name ist erforderlich';
    if (!isValidLightningAddressSyntax(lightningAddress)) {
      nextErrors.lightningAddress = 'Bitte hinterlege eine gültige Lightning-Adresse im Format name@domain.tld.';
    }
    if (email.trim() && !validateEmail(email)) {
      nextErrors.email = 'Ungültige E-Mail-Adresse';
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setVerifying(true);

    try {
      const verification = await verifyLightningAddress(lightningAddress);
      const normalizedAddress = verification.normalizedValue || normalizeLightningAddress(lightningAddress);
      const partner: AccountabilityPartner = {
        name: name.trim(),
        email: email.trim() || undefined,
        lightningAddress: normalizedAddress,
        normalizedLightningAddress: normalizedAddress,
        validationStatus: verification.status,
        validationMessage: verification.reason,
        validatedAt: verification.status === 'verified' ? Date.now() : undefined,
        notifyOnPenalty: notify,
      };

      setErrors({});
      setAccountabilityPartner(partner);
      setEditing(false);

      if (verification.status === 'verified') {
        showSuccessFeedback({
          eyebrow: 'Strafkonto',
          title: 'Empfänger gespeichert',
          description: 'Die Lightning-Adresse wurde gespeichert und verifiziert.',
        });
      } else {
        toast.error(verification.reason || 'Die Lightning-Adresse konnte nicht verifiziert werden.');
      }
    } finally {
      setVerifying(false);
    }
  };

  const handleRemove = () => {
    setAccountabilityPartner(null);
    setName('');
    setEmail('');
    setLightningAddress('');
    setNotify(true);
    setErrors({});
    setEditing(true);
  };

  return (
    <motion.div variants={variants}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Empfänger</p>
          <InfoPopover
            compact
            title="Empfänger"
            description="Wird grün, sobald die Lightning-Adresse bestätigt ist."
          />
        </div>
        <span className={`inline-flex items-center gap-1 text-[10px] font-bold ${
          recipientVerified ? 'text-success' : 'text-destructive'
        }`}>
          {recipientVerified ? 'Verifiziert' : 'Noch nicht verifiziert'}
        </span>
      </div>

      <GlassCard className={`mb-6 ${recipientShellClass}`}>
        {!editing && accountabilityPartner ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                recipientVerified ? 'bg-success/12 text-success' : 'bg-destructive/12 text-destructive'
              }`}>
                <UserCheck size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-foreground">{accountabilityPartner.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {accountabilityPartner.email || 'Keine E-Mail hinterlegt'}
                </p>
              </div>
            </div>

            <div className="rounded-2xl bg-background/65 px-4 py-4">
              <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                <WalletCards size={14} />
                <span className="truncate font-mono">{accountabilityPartner.lightningAddress}</span>
              </div>
              <div className={`mb-3 rounded-xl px-3 py-2 text-xs font-semibold ${
                recipientVerified ? 'surface-success' : 'surface-destructive'
              }`}>
                {recipientVerified
                  ? 'Adresse verifiziert. Dieser Empfänger kann für Strafzahlungen verwendet werden.'
                  : accountabilityPartner.validationMessage || 'Adresse noch nicht verifiziert. Bitte vor echtem Einsatz prüfen.'}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Bell size={14} />
                <span>
                  {accountabilityPartner.notifyOnPenalty
                    ? 'Hinweis bei Strafe aktiv'
                    : 'Keine zusätzliche Benachrichtigung'}
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setEditing(true)}
                className="flex-1 rounded-xl border border-border bg-muted/50 py-2.5 text-sm font-semibold text-foreground"
              >
                Bearbeiten
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handleRemove}
                className="flex items-center justify-center gap-1 rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-2.5 text-sm font-semibold text-destructive"
              >
                <Trash2 size={14} />
              </motion.button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="mb-1 text-xs text-muted-foreground">
              Hinterlege die Lightning-Adresse der Person für spätere Strafzahlungen. Grün wird die Kachel erst nach erfolgreicher Verifikation.
            </p>

            <div>
              <label className="mb-1 block text-xs font-semibold text-foreground">Name</label>
              <input
                type="text"
                placeholder="z. B. Max Mustermann"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              {errors.name ? <p className="mt-1 text-xs text-destructive">{errors.name}</p> : null}
            </div>

            <div>
              <label className="mb-1 flex items-center gap-1 text-xs font-semibold text-foreground">
                <WalletCards size={12} /> Lightning-Adresse
              </label>
              <input
                type="text"
                placeholder="partner@getalby.com"
                value={lightningAddress}
                onChange={(event) => setLightningAddress(event.target.value)}
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              {errors.lightningAddress ? (
                <p className="mt-1 text-xs text-destructive">{errors.lightningAddress}</p>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">
                  Wir prüfen die Adresse gegen den Lightning-Endpunkt der Domain, bevor sie als verifiziert gilt.
                </p>
              )}
            </div>

            <div>
              <label className="mb-1 flex items-center gap-1 text-xs font-semibold text-foreground">
                <Mail size={12} /> E-Mail-Adresse (optional)
              </label>
              <input
                type="email"
                placeholder="partner@beispiel.de"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              {errors.email ? <p className="mt-1 text-xs text-destructive">{errors.email}</p> : null}
            </div>

            <div className="setting-row">
              <div>
                <span className="text-xs font-semibold text-foreground">Hinweis bei Strafe senden</span>
                <p className="text-xs text-muted-foreground">Optionaler Hinweis für den Accountability-Partner.</p>
              </div>
              <Switch checked={notify} onCheckedChange={setNotify} />
            </div>

            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                void handleSave();
              }}
              disabled={verifying}
              className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-60"
            >
              {verifying ? 'Adresse wird verifiziert...' : 'Empfänger speichern & verifizieren'}
            </motion.button>
          </div>
        )}
      </GlassCard>
    </motion.div>
  );
}
