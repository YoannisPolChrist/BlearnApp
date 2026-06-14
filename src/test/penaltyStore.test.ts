import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AlbyConnectionTestResult, AlbyPenaltyResult } from '@/services/albyWalletService';

type AppStore = typeof import('@/store/useAppStore').useAppStore;

const processAlbyPenaltyMock = vi.fn<(input: unknown) => Promise<AlbyPenaltyResult>>();
const testAlbyConnectionMock = vi.fn<(input: unknown) => Promise<AlbyConnectionTestResult>>();

const validConnection = {
  walletLabel: 'Blearn Strafkonto',
  nwcConnectionUri: 'nostr+walletconnect://wallet.example?relay=wss://relay.example&secret=test-secret',
  budgetSats: 5000,
  budgetRenewal: 'daily' as const,
};

const verifiedPartner = {
  name: 'Alex',
  lightningAddress: 'alex@getalby.com',
  normalizedLightningAddress: 'alex@getalby.com',
  validationStatus: 'verified' as const,
  notifyOnPenalty: true,
};

const successfulConnectionTest: AlbyConnectionTestResult = {
  success: true,
  testedAt: 1_710_000_000_000,
  walletAlias: 'Blearn Wallet',
  walletLightningAddress: 'blearn@getalby.com',
  balanceSats: 42_000,
  budgetTotalSats: 5000,
  budgetUsedSats: 125,
  budgetRemainingSats: 4875,
  budgetRenewsAt: 1_710_086_400_000,
  budgetRenewal: 'daily',
};

async function loadStore(persistedState?: Record<string, unknown>) {
  window.localStorage.clear();

  if (persistedState) {
    window.localStorage.setItem(
      'mindful-usage-storage',
      JSON.stringify({
        state: persistedState,
        version: 0,
      }),
    );
  }

  vi.resetModules();
  processAlbyPenaltyMock.mockReset();
  testAlbyConnectionMock.mockReset();

  vi.doMock('@/services/albyWalletService', async () => {
    const actual = await vi.importActual<typeof import('@/services/albyWalletService')>(
      '@/services/albyWalletService',
    );

    return {
      ...actual,
      processAlbyPenalty: processAlbyPenaltyMock,
      testAlbyConnection: testAlbyConnectionMock,
    };
  });

  const { useAppStore } = await import('@/store/useAppStore');
  await useAppStore.persist.rehydrate();

  return useAppStore;
}

async function primePenaltySetup(useAppStore: AppStore, amountSats = 500) {
  testAlbyConnectionMock.mockResolvedValue(successfulConnectionTest);

  useAppStore.getState().setAlbyConnection(validConnection);
  useAppStore.getState().setAccountabilityPartner(verifiedPartner);
  useAppStore.getState().setPenaltyAmountSats(amountSats);

  await useAppStore.getState().testAlbyConnection();
  useAppStore.getState().setPenaltyEnabled(true);
}

afterEach(() => {
  window.localStorage.clear();
  vi.doUnmock('@/services/albyWalletService');
  vi.resetModules();
});

describe('penalty store', () => {
  it('only enables penalty mode after wallet, recipient, sats amount, and live connection test are ready', async () => {
    const useAppStore = await loadStore();

    useAppStore.getState().setPenaltyEnabled(true);
    expect(useAppStore.getState().penaltyEnabled).toBe(false);

    useAppStore.getState().setAlbyConnection(validConnection);
    useAppStore.getState().setPenaltyEnabled(true);
    expect(useAppStore.getState().penaltyEnabled).toBe(false);

    useAppStore.getState().setAccountabilityPartner(verifiedPartner);
    useAppStore.getState().setPenaltyEnabled(true);
    expect(useAppStore.getState().penaltyEnabled).toBe(false);

    useAppStore.getState().setPenaltyAmountSats(500);
    useAppStore.getState().setPenaltyEnabled(true);
    expect(useAppStore.getState().penaltyEnabled).toBe(false);

    testAlbyConnectionMock.mockResolvedValue(successfulConnectionTest);
    await useAppStore.getState().testAlbyConnection();
    useAppStore.getState().setPenaltyEnabled(true);
    expect(useAppStore.getState().penaltyEnabled).toBe(true);

    useAppStore.getState().setPenaltyAmountSats(null);
    expect(useAppStore.getState().penaltyEnabled).toBe(false);
  });

  it('stores exactly one sent penalty transaction after a successful live payment', async () => {
    const useAppStore = await loadStore();
    await primePenaltySetup(useAppStore, 700);

    processAlbyPenaltyMock.mockResolvedValue({
      success: true,
      paymentReference: 'hash_live_123',
      sentAt: 1_710_000_123_000,
      preimage: 'preimage-live-123',
      feesPaidSats: 3,
      amountSats: 700,
    });

    const result = await useAppStore.getState().deductPenalty('youtube.com', 'website');
    const transactions = useAppStore.getState().penaltyTransactions;

    expect(result).toEqual({
      transactionId: expect.any(String),
      paymentReference: 'hash_live_123',
      sentAt: 1_710_000_123_000,
      amountSats: 700,
      feesPaidSats: 3,
    });
    expect(processAlbyPenaltyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        amountSats: 700,
        targetApp: 'youtube.com',
        blockType: 'website',
        recipientName: 'Alex',
        recipientLightningAddress: 'alex@getalby.com',
      }),
    );
    expect(transactions).toHaveLength(1);
    expect(transactions[0]).toMatchObject({
      amountSats: 700,
      blockType: 'website',
      deliveryStatus: 'sent',
      feesPaidSats: 3,
      notificationSent: true,
      remoteReference: 'hash_live_123',
      targetApp: 'youtube.com',
      type: 'penalty',
    });
    expect(useAppStore.getState().getTotalPenalties()).toBe(700);
    expect(useAppStore.getState().getWeeklyPenalties()).toBe(700);
  });

  it('marks the transaction as failed and keeps the target locked when payment fails', async () => {
    const useAppStore = await loadStore();
    await primePenaltySetup(useAppStore, 500);

    processAlbyPenaltyMock.mockRejectedValue(new Error('Budget erschopft.'));

    await expect(useAppStore.getState().deductPenalty('com.instagram.android', 'app')).rejects.toThrow(
      'Budget erschopft.',
    );

    const transactions = useAppStore.getState().penaltyTransactions;
    expect(transactions).toHaveLength(1);
    expect(transactions[0]).toMatchObject({
      amountSats: 500,
      blockType: 'app',
      deliveryStatus: 'failed',
      lastDeliveryError: 'Budget erschopft.',
      targetApp: 'com.instagram.android',
      type: 'penalty',
    });
    expect(useAppStore.getState().isTargetUnlocked('com.instagram.android', 'app')).toBe(false);
    expect(useAppStore.getState().getTotalPenalties()).toBe(500);
  });

  it('does not charge twice when a confirmed payment is retried within the idempotency window', async () => {
    const useAppStore = await loadStore();
    await primePenaltySetup(useAppStore, 500);

    processAlbyPenaltyMock.mockResolvedValue({
      success: true,
      paymentReference: 'hash_once',
      sentAt: 1_710_000_500_000,
      preimage: 'preimage-once',
      feesPaidSats: 2,
      amountSats: 500,
    });

    const first = await useAppStore.getState().deductPenalty('com.instagram.android', 'app');
    // Erneuter Aufruf (z.B. nach Remount/erneutem Tap) → KEINE zweite Belastung.
    const second = await useAppStore.getState().deductPenalty('com.instagram.android', 'app');

    expect(processAlbyPenaltyMock).toHaveBeenCalledTimes(1);
    expect(useAppStore.getState().penaltyTransactions).toHaveLength(1);
    expect(second.transactionId).toBe(first.transactionId);
    expect(useAppStore.getState().getTotalPenalties()).toBe(500);
  });

  it('refuses a second charge while one payment is still in flight', async () => {
    const useAppStore = await loadStore();
    await primePenaltySetup(useAppStore, 500);

    let resolvePayment: ((value: AlbyPenaltyResult) => void) | undefined;
    processAlbyPenaltyMock.mockReturnValue(
      new Promise<AlbyPenaltyResult>((resolve) => {
        resolvePayment = resolve;
      }),
    );

    // Erste Zahlung starten (fügt synchron die 'processing'-Transaktion ein und wartet).
    const inFlight = useAppStore.getState().deductPenalty('com.instagram.android', 'app');

    // Zweiter Aufruf währenddessen → abgelehnt, keine zweite Zahlung.
    await expect(useAppStore.getState().deductPenalty('com.instagram.android', 'app')).rejects.toThrow(
      /läuft bereits/,
    );
    expect(processAlbyPenaltyMock).toHaveBeenCalledTimes(1);

    resolvePayment?.({
      success: true,
      paymentReference: 'hash_inflight',
      sentAt: 1_710_000_600_000,
      preimage: 'preimage-inflight',
      feesPaidSats: 1,
      amountSats: 500,
    });
    await inFlight;
    expect(useAppStore.getState().penaltyTransactions).toHaveLength(1);
    expect(useAppStore.getState().penaltyTransactions[0].deliveryStatus).toBe('sent');
  });

  it('does not unlock when the payment returns without a preimage (no confirmation)', async () => {
    const useAppStore = await loadStore();
    await primePenaltySetup(useAppStore, 500);

    processAlbyPenaltyMock.mockResolvedValue({
      success: true,
      paymentReference: 'hash_no_preimage',
      sentAt: 1_710_000_700_000,
      preimage: '',
      feesPaidSats: 0,
      amountSats: 500,
    });

    await expect(useAppStore.getState().deductPenalty('com.tiktok.android', 'app')).rejects.toThrow(
      /nicht bestätigt|Zahlungsbeweis/,
    );

    const transactions = useAppStore.getState().penaltyTransactions;
    expect(transactions).toHaveLength(1);
    expect(transactions[0].deliveryStatus).toBe('failed');
    expect(useAppStore.getState().isTargetUnlocked('com.tiktok.android', 'app')).toBe(false);
  });

  it('does not silently migrate legacy EUR penalty amounts into sats', async () => {
    const useAppStore = await loadStore({
      penaltyEnabled: true,
      penaltyAmount: 25,
      albyConnection: validConnection,
      albyConnectionTest: {
        status: 'passed',
        testedAt: successfulConnectionTest.testedAt,
      },
      accountabilityPartner: verifiedPartner,
    });

    expect(useAppStore.getState().penaltyAmountSats).toBeNull();
    expect(useAppStore.getState().penaltyEnabled).toBe(false);
    expect(useAppStore.getState().albyConnection).toMatchObject(validConnection);
    expect(useAppStore.getState().albyConnectionTest.status).toBe('passed');
    expect(useAppStore.getState().accountabilityPartner).toMatchObject({
      name: 'Alex',
      validationStatus: 'verified',
    });
  });
});
