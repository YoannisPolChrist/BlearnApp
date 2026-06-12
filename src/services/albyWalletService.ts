import { LN, SATS } from '@getalby/sdk/lnclient';
import { NWCClient } from '@getalby/sdk/nwc';

export type AlbyBudgetRenewal = 'daily' | 'weekly' | 'monthly';

export interface AlbyConnectionConfig {
  walletLabel: string;
  nwcConnectionUri: string;
  budgetSats: number;
  budgetRenewal: AlbyBudgetRenewal;
  expirationDate?: string;
}

export interface AlbyConnectionTestResult {
  success: boolean;
  testedAt: number;
  walletAlias?: string;
  walletLightningAddress?: string;
  balanceSats?: number;
  budgetTotalSats?: number | null;
  budgetUsedSats?: number | null;
  budgetRemainingSats?: number | null;
  budgetRenewsAt?: number | null;
  budgetRenewal?: string | null;
  error?: string;
}

export interface AlbyPenaltyResult {
  success: true;
  paymentReference: string;
  sentAt: number;
  preimage: string;
  feesPaidSats: number;
  amountSats: number;
}

export interface AlbyPenaltySignalInput {
  amountSats: number;
  targetApp: string;
  blockType: 'app' | 'website' | 'search';
  recipientName: string;
  recipientLightningAddress: string;
  connection: AlbyConnectionConfig;
}

export type LightningRecipientValidationStatus = 'unverified' | 'verified' | 'invalid';

export interface LightningRecipientVerificationResult {
  normalizedValue: string;
  status: LightningRecipientValidationStatus;
  reason?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function createNwcClient(connection: AlbyConnectionConfig): NWCClient {
  return new NWCClient({
    nostrWalletConnectUrl: normalizeNwcConnectionUri(connection.nwcConnectionUri),
  });
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  return fallback;
}

function getBudgetTotals(budget: unknown) {
  if (!isRecord(budget)) {
    return {
      totalBudget: null,
      usedBudget: null,
      renewsAt: null,
      renewalPeriod: null,
    };
  }

  const totalBudget = readNumber(budget.total_budget);
  const usedBudget = readNumber(budget.used_budget);
  const renewsAt = readNumber(budget.renews_at);
  const renewalPeriod = readString(budget.renewal_period);

  return {
    totalBudget,
    usedBudget,
    renewsAt,
    renewalPeriod,
  };
}

export function normalizeNwcConnectionUri(value: string): string {
  return value.trim();
}

export function normalizeLightningAddress(value: string): string {
  return value.trim().replace(/^lightning:/i, '').toLowerCase();
}

export function isValidLightningAddressSyntax(value: string): boolean {
  const normalized = normalizeLightningAddress(value);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
}

export function isValidNwcConnectionUri(value: string): boolean {
  const normalized = normalizeNwcConnectionUri(value);
  return /^nostr\+walletconnect:\/\/.+/i.test(normalized);
}

export function isAlbyReady(connection: AlbyConnectionConfig | null | undefined): boolean {
  if (!connection) return false;
  const walletLabel = typeof connection.walletLabel === 'string' ? connection.walletLabel.trim() : '';
  const nwcConnectionUri =
    typeof connection.nwcConnectionUri === 'string' ? connection.nwcConnectionUri : '';

  return Boolean(walletLabel) && isValidNwcConnectionUri(nwcConnectionUri);
}

export async function verifyLightningAddress(value: string): Promise<LightningRecipientVerificationResult> {
  const normalizedValue = normalizeLightningAddress(value);

  if (!isValidLightningAddressSyntax(normalizedValue)) {
    return {
      normalizedValue,
      status: 'invalid',
      reason: 'Bitte nutze eine gueltige Lightning-Adresse im Format name@domain.tld.',
    };
  }

  const [localPart, domain] = normalizedValue.split('@');

  try {
    const response = await fetch(`https://${domain}/.well-known/lnurlp/${encodeURIComponent(localPart)}`, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      return {
        normalizedValue,
        status: 'invalid',
        reason: 'Die Lightning-Adresse konnte auf dem Zielserver nicht bestätigt werden.',
      };
    }

    const payload = await response.json().catch(() => null);
    if (!isRecord(payload)) {
      return {
        normalizedValue,
        status: 'invalid',
        reason: 'Die Lightning-Adresse liefert keine gueltige Antwort.',
      };
    }

    if (payload?.status === 'ERROR') {
      return {
        normalizedValue,
        status: 'invalid',
        reason: readString(payload.reason) || 'Die Lightning-Adresse wurde vom Zielserver abgelehnt.',
      };
    }

    const callback = readString(payload.callback) || '';
    if (payload?.tag !== 'payRequest' || !/^https?:\/\//.test(callback)) {
      return {
        normalizedValue,
        status: 'invalid',
        reason: 'Die Lightning-Adresse liefert keinen gueltigen Zahlungsendpunkt.',
      };
    }

    return {
      normalizedValue,
      status: 'verified',
    };
  } catch {
    return {
      normalizedValue,
      status: 'invalid',
      reason: 'Die Lightning-Adresse konnte gerade nicht verifiziert werden. Bitte prüfe Domain und Schreibweise.',
    };
  }
}

export async function testAlbyConnection(connection: AlbyConnectionConfig | null | undefined): Promise<AlbyConnectionTestResult> {
  const testedAt = Date.now();

  if (!isAlbyReady(connection)) {
    return {
      success: false,
      testedAt,
      error: 'Bitte speichere zuerst eine gueltige NWC-Verbindung.',
    };
  }

  const client = createNwcClient(connection);

  try {
    const [info, balance, budget] = await Promise.all([
      client.getInfo(),
      client.getBalance(),
      client.getBudget().catch(() => null),
    ]);
    const { totalBudget, usedBudget, renewsAt, renewalPeriod } = getBudgetTotals(budget);

    return {
      success: true,
      testedAt,
      walletAlias: info.alias,
      walletLightningAddress: info.lud16,
      balanceSats: balance.balance,
      budgetTotalSats: totalBudget,
      budgetUsedSats: usedBudget,
      budgetRemainingSats:
        totalBudget !== null && usedBudget !== null ? Math.max(totalBudget - usedBudget, 0) : null,
      budgetRenewsAt: renewsAt,
      budgetRenewal: renewalPeriod,
    };
  } catch (error) {
    return {
      success: false,
      testedAt,
      error: getErrorMessage(
        error,
        'Die Alby-Verbindung konnte nicht geprüft werden. Bitte prüfe Secret, Budget und Internetverbindung.',
      ),
    };
  } finally {
    client.close();
  }
}

export async function processAlbyPenalty(input: AlbyPenaltySignalInput): Promise<AlbyPenaltyResult> {
  if (!isAlbyReady(input.connection)) {
    throw new Error('Die Alby-Verbindung ist unvollständig.');
  }

  const normalizedRecipient = normalizeLightningAddress(input.recipientLightningAddress || '');
  if (!isValidLightningAddressSyntax(normalizedRecipient)) {
    throw new Error('Die Zieladresse für die Strafzahlung ist ungültig.');
  }

  const amountSats = Math.round(Number(input.amountSats));
  if (!Number.isFinite(amountSats) || amountSats <= 0) {
    throw new Error('Der Strafbetrag muss größer als 0 sats sein.');
  }

  const client = new LN(normalizeNwcConnectionUri(input.connection.nwcConnectionUri));

  try {
    const payment = await client.pay(normalizedRecipient, SATS(amountSats));

    return {
      success: true,
      paymentReference: payment.invoice.paymentHash,
      sentAt: Date.now(),
      preimage: payment.preimage,
      feesPaidSats: payment.fees_paid,
      amountSats,
    };
  } catch (error) {
    throw new Error(
      getErrorMessage(
        error,
        'Die Strafzahlung konnte nicht über Alby gesendet werden.',
      ),
    );
  } finally {
    client.close();
  }
}
