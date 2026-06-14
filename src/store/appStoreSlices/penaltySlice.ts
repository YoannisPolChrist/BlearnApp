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

// Zeitfenster, in dem eine laufende/bestätigte Zahlung für dasselbe Ziel+Betrag
// als "dieselbe" gilt und nicht erneut ausgelöst wird (Idempotenz, Plan P1-C).
const PENALTY_IDEMPOTENCY_WINDOW_MS = 2 * 60 * 1000;

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
    const amountSats = Math.round(state.penaltyAmountSats);
    const now = Date.now();

    // Idempotenz (Plan P1-C): Eine bereits laufende ('processing') oder gerade
    // bestätigte ('sent') Zahlung für dasselbe Ziel+Betrag innerhalb des Fensters
    // wird NICHT erneut ausgelöst. Anders als der Per-Mount-Ref überlebt dieser
    // Schutz Remount/Crash, weil die 'processing'-Transaktion persistiert ist.
    const duplicate = state.penaltyTransactions.find((transaction) =>
      transaction.type === 'penalty'
      && transaction.targetApp === targetApp
      && transaction.blockType === normalizedBlockType
      && getPenaltyTransactionAmountSats(transaction) === amountSats
      && (transaction.deliveryStatus === 'processing' || transaction.deliveryStatus === 'sent')
      && now - transaction.timestamp < PENALTY_IDEMPOTENCY_WINDOW_MS,
    );
    if (duplicate) {
      if (duplicate.deliveryStatus === 'sent' && duplicate.preimage) {
        // Bereits bezahlt & bestätigt → dasselbe Ergebnis zurückgeben (ermöglicht
        // die Freischaltung erneut, ohne ein zweites Mal zu belasten).
        return {
          transactionId: duplicate.id,
          paymentReference: duplicate.remoteReference ?? '',
          sentAt: duplicate.sentAt ?? duplicate.timestamp,
          amountSats,
          feesPaidSats: duplicate.feesPaidSats ?? 0,
        };
      }
      throw new Error('Für dieses Ziel läuft bereits eine Strafzahlung. Bitte einen Moment warten.');
    }

    const txId = createPenaltyTransactionId();
    const tx = {
      id: txId,
      timestamp: now,
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

      // Preimage-Gate (Plan P1-D): Nur mit gültigem Lightning-Preimage (Zahlungs-
      // beweis) gilt die Zahlung als bestätigt und schaltet frei. Ohne Preimage
      // wird NICHT freigeschaltet — der untenstehende catch markiert die
      // Transaktion dann als 'failed' (keine Freigabe ohne bestätigte Zahlung).
      if (!result.preimage) {
        throw new Error('Die Strafzahlung wurde nicht bestätigt (kein Zahlungsbeweis). Bitte erneut versuchen.');
      }

      set((current) => ({
        penaltyTransactions: current.penaltyTransactions.map((transaction) =>
          transaction.id === txId
            ? {
                ...transaction,
                deliveryStatus: 'sent',
                remoteReference: result.paymentReference,
                preimage: result.preimage,
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
