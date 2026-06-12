import {
  processAlbyPenalty,
  testAlbyConnection as runAlbyConnectionTest,
} from '@/services/albyWalletService';
import {
  isPenaltyAmountConfigured,
  isPenaltySetupReady,
} from '@/lib/penaltyRuntime';
import type { AppState } from '@/store/appStore.types';
import {
  type AppStoreSlice,
  applyModeState,
  createIdleAlbyConnectionTestState,
  createPenaltyTransactionId,
  getPenaltyBlockLabel,
  getPenaltyTransactionAmountSats,
  mapAlbyConnectionTestResult,
  normalizeAccountabilityPartner,
  toPenaltyBlockType,
} from '@/store/appStore.shared';

export const createPenaltySlice: AppStoreSlice<Partial<AppState>> = (set, get) => ({
  penaltyAmountSats: null,
  penaltyEnabled: false,
  penaltyTransactions: [],
  accountabilityPartner: null,
  albyConnection: null,
  albyConnectionTest: createIdleAlbyConnectionTestState(),
  setPenaltyAmountSats: (amountSats) =>
    set((state) => {
      const normalizedAmountSats = isPenaltyAmountConfigured(amountSats) ? Math.round(amountSats) : null;
      return applyModeState(state, {
        penaltyAmountSats: normalizedAmountSats,
        penaltyEnabled: state.penaltyEnabled && isPenaltySetupReady({
          ...state,
          penaltyAmountSats: normalizedAmountSats,
        }),
      });
    }),
  setPenaltyEnabled: (enabled) => {
    if (!enabled) {
      set((state) => applyModeState(state, { penaltyEnabled: false }));
      return;
    }

    set((state) => applyModeState(state, {
      penaltyEnabled: isPenaltySetupReady(state),
    }));
  },
  testAlbyConnection: async () => {
    set((state) => applyModeState(state, {
      albyConnectionTest: {
        ...state.albyConnectionTest,
        status: 'testing',
        lastError: undefined,
      },
      penaltyEnabled: state.penaltyEnabled && isPenaltySetupReady({
        ...state,
        albyConnectionTest: {
          ...state.albyConnectionTest,
          status: 'testing',
          lastError: undefined,
        },
      }),
    }));

    const result = await runAlbyConnectionTest(get().albyConnection);
    const nextConnectionTest = mapAlbyConnectionTestResult(result);

    set((state) => applyModeState(state, {
      albyConnectionTest: nextConnectionTest,
      penaltyEnabled: state.penaltyEnabled && isPenaltySetupReady({
        ...state,
        albyConnectionTest: nextConnectionTest,
      }),
    }));

    return nextConnectionTest;
  },
  setAccountabilityPartner: (partner) => {
    const normalizedPartner = normalizeAccountabilityPartner(partner);
    set((state) => applyModeState(state, {
      accountabilityPartner: normalizedPartner,
      penaltyEnabled: state.penaltyEnabled && isPenaltySetupReady({
        ...state,
        accountabilityPartner: normalizedPartner,
      }),
    }));
  },
  setAlbyConnection: (connection) =>
    set((state) => {
      const nextConnectionTest = createIdleAlbyConnectionTestState();

      return applyModeState(state, {
        albyConnection: connection,
        albyConnectionTest: nextConnectionTest,
        penaltyEnabled: state.penaltyEnabled && isPenaltySetupReady({
          ...state,
          albyConnection: connection,
          albyConnectionTest: nextConnectionTest,
        }),
      });
    }),
  deductPenalty: async (targetApp, blockType) => {
    const state = get();
    const normalizedBlockType = toPenaltyBlockType(blockType);

    if (!state.penaltyEnabled) {
      throw new Error('Der Strafmodus ist gerade nicht aktiv.');
    }

    if (!isPenaltySetupReady(state) || !state.albyConnection || !state.accountabilityPartner || !isPenaltyAmountConfigured(state.penaltyAmountSats)) {
      set((current) => applyModeState(current, { penaltyEnabled: false }));
      throw new Error('Der Strafmodus ist noch nicht vollstaendig eingerichtet.');
    }
    const txId = createPenaltyTransactionId();
    const amountSats = Math.round(state.penaltyAmountSats);
    const tx = {
      id: txId,
      timestamp: Date.now(),
      amountSats,
      type: 'penalty' as const,
      description: `Strafe: ${getPenaltyBlockLabel(normalizedBlockType)} "${targetApp}" genutzt`,
      targetApp,
      blockType: normalizedBlockType,
      deliveryStatus: 'processing' as const,
      deliveryAttempts: 1,
    };

    set((current) => ({
      penaltyTransactions: [tx, ...current.penaltyTransactions].slice(0, 200),
    }));

    try {
      const result = await processAlbyPenalty({
        amountSats,
        targetApp,
        blockType: normalizedBlockType,
        recipientName: state.accountabilityPartner.name,
        recipientLightningAddress: state.accountabilityPartner.lightningAddress,
        connection: state.albyConnection,
      });
      set((current) => ({
        penaltyTransactions: current.penaltyTransactions.map((transaction) =>
          transaction.id === txId
            ? {
                ...transaction,
                deliveryStatus: 'sent',
                remoteReference: result.paymentReference,
                sentAt: result.sentAt,
                feesPaidSats: result.feesPaidSats,
                notificationSent: true,
                lastDeliveryError: undefined,
              }
            : transaction,
        ),
      }));

      return {
        transactionId: txId,
        paymentReference: result.paymentReference,
        sentAt: result.sentAt,
        amountSats,
        feesPaidSats: result.feesPaidSats,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Die Strafzahlung ist fehlgeschlagen.';

      set((current) => ({
        penaltyTransactions: current.penaltyTransactions.map((transaction) =>
          transaction.id === txId
            ? {
                ...transaction,
                deliveryStatus: 'failed',
                lastDeliveryError: message,
              }
            : transaction,
        ),
      }));

      throw new Error(message);
    }
  },
  getTotalPenalties: () => {
    const { penaltyTransactions } = get();
    return penaltyTransactions
      .filter((transaction) => transaction.type === 'penalty')
      .reduce((sum, transaction) => sum + getPenaltyTransactionAmountSats(transaction), 0);
  },
  getWeeklyPenalties: () => {
    const { penaltyTransactions } = get();
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return penaltyTransactions
      .filter((transaction) => transaction.type === 'penalty' && transaction.timestamp > weekAgo)
      .reduce((sum, transaction) => sum + getPenaltyTransactionAmountSats(transaction), 0);
  },
});
