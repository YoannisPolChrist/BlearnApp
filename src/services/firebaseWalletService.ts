/**
 * Firebase Wallet Service
 *
 * Dual mode: works locally when Firebase is not configured and switches to
 * Cloud Functions when the backend is available.
 */

import {
  assertFirebaseWritesEnabled,
  FUNCTIONS_BASE_URL,
  ensureFirebaseAuth,
  getFirebaseAuth,
  isFirebaseConfigured,
} from '@/lib/firebase';

export interface WalletData {
  balance: number;
  stripeCustomerId: string | null;
  accountabilityPartner: {
    name: string;
    email: string;
    iban: string;
    notifyOnPenalty: boolean;
  } | null;
}

export interface Transaction {
  id: string;
  type: 'deposit' | 'penalty' | 'withdrawal';
  amount: number;
  description: string;
  timestamp: { seconds: number };
  targetApp?: string;
  notificationSent?: boolean;
}

function buildFunctionUrl(endpoint: string): string {
  const base = FUNCTIONS_BASE_URL.replace(/\/+$/, '');
  const cleanEndpoint = endpoint.replace(/^\/+/, '');
  return `${base}/${cleanEndpoint}`;
}

async function parseJsonResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  const payload = await response.json().catch(() => null);
  if (payload && typeof payload === 'object') {
    return payload as T;
  }

  throw new Error(fallbackMessage);
}

async function getAuthToken(): Promise<string> {
  const auth = await ensureFirebaseAuth();
  if (!auth?.currentUser) {
    throw new Error('Nicht eingeloggt. Bitte zuerst anmelden.');
  }

  return auth.currentUser.getIdToken();
}

async function authedFetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const token = await getAuthToken();

  let response: Response;
  try {
    response = await fetch(buildFunctionUrl(endpoint), {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
  } catch (error) {
    throw new Error(
      error instanceof Error && error.message.trim()
        ? error.message
        : `Netzwerkfehler bei ${endpoint}`,
    );
  }

  if (!response.ok) {
    const errorPayload = await response.clone().json().catch(async () => {
      const text = await response.clone().text().catch(() => '');
      return { error: text || 'Unbekannter Fehler' };
    });

    throw new Error(
      typeof errorPayload.error === 'string' && errorPayload.error.trim()
        ? errorPayload.error
        : `Fehler bei ${endpoint}`,
    );
  }

  return response;
}

export function isFirebaseReady(): boolean {
  if (!isFirebaseConfigured()) return false;
  const auth = getFirebaseAuth();
  return !!auth?.currentUser;
}

export { isFirebaseConfigured };

export async function fetchWallet(): Promise<{ wallet: WalletData; transactions: Transaction[] }> {
  const response = await authedFetch('getWallet', { method: 'GET' });
  const payload = await parseJsonResponse<Partial<{ wallet: WalletData; transactions: Transaction[] }>>(
    response,
    'Wallet-Daten konnten nicht gelesen werden',
  );

  return {
    wallet: {
      balance: typeof payload.wallet?.balance === 'number' ? payload.wallet.balance : 0,
      stripeCustomerId:
        typeof payload.wallet?.stripeCustomerId === 'string' ? payload.wallet.stripeCustomerId : null,
      accountabilityPartner: payload.wallet?.accountabilityPartner ?? null,
    },
    transactions: Array.isArray(payload.transactions) ? payload.transactions : [],
  };
}

export async function initiateDeposit(amount: number): Promise<void> {
  assertFirebaseWritesEnabled('Firebase-Zahlungen');
  if (!Number.isFinite(amount) || amount < 1 || amount > 500) {
    throw new Error('Betrag muss zwischen 1€ und 500€ liegen');
  }

  const response = await authedFetch('createCheckoutSession', {
    method: 'POST',
    body: JSON.stringify({ amount }),
  });

  const { url } = await parseJsonResponse<{ url?: unknown }>(
    response,
    'Keine Checkout-URL erhalten',
  );

  if (typeof url === 'string' && url.trim()) {
    window.location.href = url;
    return;
  }

  throw new Error('Keine Checkout-URL erhalten');
}

export async function processFirebasePenalty(
  targetApp: string,
  blockType: 'app' | 'website' | 'search',
  penaltyAmountSats: number,
): Promise<{ success: boolean; newBalance: number; transactionId: string }> {
  assertFirebaseWritesEnabled('Firebase-Zahlungen');
  if (!targetApp.trim()) {
    throw new Error('Ziel-App oder Zielseite fehlt.');
  }

  if (!Number.isFinite(penaltyAmountSats) || penaltyAmountSats <= 0) {
    throw new Error('Der Strafbetrag muss groesser als 0 sein.');
  }

  const response = await authedFetch('processPenalty', {
    method: 'POST',
    body: JSON.stringify({ targetApp, blockType, penaltyAmountSats }),
  });

  return parseJsonResponse(response, 'Die Firebase-Strafe konnte nicht verarbeitet werden.');
}

export async function updateFirebasePartner(
  partner: WalletData['accountabilityPartner'],
): Promise<void> {
  assertFirebaseWritesEnabled('Firebase-Zahlungen');
  await authedFetch('updateAccountabilityPartner', {
    method: 'POST',
    body: JSON.stringify({ partner }),
  });
}
