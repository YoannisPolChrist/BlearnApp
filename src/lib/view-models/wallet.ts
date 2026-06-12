import { isAlbyReady } from '@/services/albyWalletService';
import { isVerifiedAccountabilityPartner, type AccountabilityPartner, type AlbyConnectionTestState } from '@/store/useAppStore';
import type { AlbyConnectionConfig } from '@/services/albyWalletService';

const APPROX_EUR_PER_SAT = 0.001;
export const APPROX_EURO_REFERENCE_COPY = 'Faustregel: 1.000 sats ~ 1 EUR.';
const euroFormatter = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 3,
});

function normalizeSats(amountSats: number | null | undefined) {
  return typeof amountSats === 'number' && Number.isFinite(amountSats)
    ? Math.max(Math.round(amountSats), 0)
    : 0;
}

export function formatSats(amountSats: number | null | undefined) {
  return `${normalizeSats(amountSats).toLocaleString('de-DE')} sats`;
}

export function formatApproxEuro(amountSats: number | null | undefined) {
  return euroFormatter.format(normalizeSats(amountSats) * APPROX_EUR_PER_SAT);
}

export function formatSatsWithApproxEuro(amountSats: number | null | undefined) {
  return `${formatSats(amountSats)} · ca. ${formatApproxEuro(amountSats)}`;
}

export function getWalletStatus(options: {
  penaltyAmountSats: number | null;
  penaltyEnabled: boolean;
  accountabilityPartner: AccountabilityPartner | null;
  albyConnection: AlbyConnectionConfig | null;
  albyConnectionTest: AlbyConnectionTestState;
}) {
  const albyReady = isAlbyReady(options.albyConnection);
  const recipientVerified = isVerifiedAccountabilityPartner(options.accountabilityPartner);
  const connectionTestPassed = options.albyConnectionTest.status === 'passed';
  const penaltyAmountConfigured = typeof options.penaltyAmountSats === 'number' && options.penaltyAmountSats > 0;
  const penaltyReady = albyReady && recipientVerified && connectionTestPassed && penaltyAmountConfigured;

  let statusTitle = 'Setup noch offen';
  let statusDescription = 'Verbinde zuerst dein eigenes Wallet. Danach prüfst du die Verbindung live in Blearn.';

  if (penaltyReady) {
    statusTitle = options.penaltyEnabled ? 'Strafkonto live' : 'Strafkonto bereit';
    statusDescription = options.penaltyEnabled
      ? 'Wallet, Live-Test, Empfänger und Strafbetrag sind aktiv. Echte Strafzahlungen können jetzt gesendet werden und die UI zeigt dazu eine grobe EUR-Einordnung nach fixer Faustregel.'
      : 'Wallet, Live-Test, Empfänger und Strafbetrag sind bereit. Du kannst den Strafmodus jetzt aktivieren und die grobe EUR-Orientierung bleibt sichtbar.';
  } else if (albyReady && !connectionTestPassed) {
    statusTitle = 'Verbindung testen';
    statusDescription = 'Die NWC-Verbindung ist gespeichert, aber noch nicht live bestätigt.';
  } else if (albyReady && connectionTestPassed && !recipientVerified) {
    statusTitle = 'Empfänger fehlt noch';
    statusDescription = 'Dein Wallet ist verbunden und live getestet. Als Nächstes braucht es noch einen verifizierten Empfänger.';
  } else if (albyReady && connectionTestPassed && recipientVerified && !penaltyAmountConfigured) {
    statusTitle = 'Strafbetrag festlegen';
    statusDescription = 'Wallet, Test und Empfänger sind bereit. Jetzt fehlt nur noch ein Strafbetrag in sats mit grober EUR-Orientierung nach fixer Faustregel.';
  }

  return {
    albyReady,
    recipientVerified,
    connectionTestPassed,
    penaltyAmountConfigured,
    penaltyReady,
    statusTitle,
    statusDescription,
    walletTitle: albyReady ? 'Verbunden' : 'Noch nicht verbunden',
    walletDescription: connectionTestPassed
      ? 'Die NWC-Verbindung wurde in Blearn live geprüft.'
      : albyReady
        ? 'Die Verbindung ist gespeichert. Führe als Nächstes den Live-Test aus.'
        : 'Ohne gültige Alby-Verbindung bleibt das Setup unvollständig.',
    recipientTitle: recipientVerified
      ? 'Verifiziert'
      : options.accountabilityPartner
        ? 'Noch nicht verifiziert'
        : 'Noch nicht hinterlegt',
    recipientDescription: recipientVerified
      ? 'Die Zieladresse wurde bestätigt und kann für echte Zahlungen verwendet werden.'
      : options.accountabilityPartner?.validationMessage || 'Diese Kachel bleibt rot, bis eine gültige Lightning-Adresse verifiziert wurde.',
  };
}
