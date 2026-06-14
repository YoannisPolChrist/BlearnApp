import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';
import { ROUTER_FUTURE_FLAGS } from '@/lib/routerFuture';

// Sicherheitsnetz gegen Doppelbelastung: Ein sehr schneller Doppel-Tap auf
// "Jetzt bezahlen" (Schritt 2) darf `deductPenalty` niemals zweimal starten,
// solange eine Zahlung noch laeuft.

const abandonPendingNavigationMock = vi.fn<(sessionId?: string) => Promise<void>>();
const dismissBlockingOverlayMock = vi.fn<() => Promise<void>>();
const grantManualOverrideMock = vi.fn();
const openTargetMock = vi.fn();
const waitForPersistStorageIdleMock = vi.fn<(storageKey: string, timeoutMs?: number) => Promise<void>>();

function mockSharedUi() {
  vi.doMock('@/components/PageTransition', () => ({
    default: ({ children }: { children: ReactNode }) => <>{children}</>,
  }));
  vi.doMock('@/components/GlassCard', () => ({
    default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  }));
  vi.doMock('@/hooks/useNativeRouteReady', () => ({
    useNativeRouteReady: () => undefined,
  }));
  vi.doMock('@/components/blocking/BlockingUnlockSuccessScreen', () => ({
    BlockingUnlockSuccessScreen: ({ onContinue }: { onContinue: () => void }) => (
      <div>
        <div>release-card</div>
        <button type="button" onClick={onContinue}>
          app freischalten
        </button>
      </div>
    ),
  }));
  // Das echte Overlay deaktiviert den Button bei `penaltyBusy`. Damit der Test
  // den synchronen Ref-Schutz und NICHT nur das `disabled`-Attribut prueft,
  // bleibt der Mock-Button immer klickbar.
  vi.doMock('@/components/InterventionOverlayScreen', () => ({
    default: ({
      penaltyConfirmStep,
      onPrimaryAction,
    }: {
      penaltyConfirmStep?: 1 | 2;
      onPrimaryAction: () => void;
    }) => (
      <div>
        <div>step-{penaltyConfirmStep}</div>
        <button type="button" onClick={onPrimaryAction}>
          primary-action
        </button>
      </div>
    ),
  }));
}

async function loadInterventionPage() {
  vi.resetModules();
  mockSharedUi();
  abandonPendingNavigationMock.mockReset();
  abandonPendingNavigationMock.mockResolvedValue(undefined);
  dismissBlockingOverlayMock.mockReset();
  dismissBlockingOverlayMock.mockResolvedValue(undefined);
  grantManualOverrideMock.mockReset();
  openTargetMock.mockReset();
  waitForPersistStorageIdleMock.mockReset();
  waitForPersistStorageIdleMock.mockResolvedValue(undefined);

  vi.doMock('@/lib/platform', () => ({ isAndroidPlatform: true }));
  vi.doMock('@/lib/persistStorage', async () => {
    const actual = await vi.importActual<typeof import('@/lib/persistStorage')>('@/lib/persistStorage');
    return { ...actual, waitForPersistStorageIdle: waitForPersistStorageIdleMock };
  });
  vi.doMock('@/services/screenTimeService', () => ({
    dismissBlockingOverlay: dismissBlockingOverlayMock,
    abandonPendingNavigation: abandonPendingNavigationMock,
    grantManualOverride: grantManualOverrideMock.mockResolvedValue({
      supported: true,
      active: true,
      granted: true,
      attemptsUsed: 1,
      attemptsRemaining: 2,
      maxAttempts: 3,
    }),
    openTarget: openTargetMock,
  }));

  const [{ default: InterventionPage }, { useAppStore }] = await Promise.all([
    import('@/pages/Intervention'),
    import('@/store/useAppStore'),
  ]);

  return { InterventionPage, useAppStore };
}

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
  vi.doUnmock('@/components/PageTransition');
  vi.doUnmock('@/components/GlassCard');
  vi.doUnmock('@/hooks/useNativeRouteReady');
  vi.doUnmock('@/components/blocking/BlockingUnlockSuccessScreen');
  vi.doUnmock('@/components/InterventionOverlayScreen');
  vi.doUnmock('@/lib/persistStorage');
  vi.doUnmock('@/lib/platform');
  vi.doUnmock('@/services/screenTimeService');
  vi.resetModules();
});

describe('penalty double-tap protection', () => {
  it('only charges once when "Jetzt bezahlen" is tapped twice while a payment is in flight', async () => {
    const { InterventionPage, useAppStore } = await loadInterventionPage();

    // Zahlung bleibt absichtlich offen, damit der zweite Tap waehrend einer
    // laufenden Zahlung eintrifft (echter Race).
    let resolvePayment: ((value: unknown) => void) | null = null;
    const deductPenalty = vi.fn().mockReturnValue(
      new Promise((resolve) => {
        resolvePayment = resolve;
      }),
    );

    useAppStore.setState(
      {
        ...useAppStore.getInitialState(),
        defaultUnlockDurationMinutes: 99,
        penaltyEnabled: true,
        penaltyAmountSats: 500,
        accountabilityPartner: {
          name: 'Alex',
          lightningAddress: 'alex@getalby.com',
          normalizedLightningAddress: 'alex@getalby.com',
          validationStatus: 'verified',
          notifyOnPenalty: true,
        },
        deductPenalty,
      },
      true,
    );

    render(
      <MemoryRouter
        future={ROUTER_FUTURE_FLAGS}
        initialEntries={[
          '/intervention?targetId=YouTube&targetType=app&targetLabel=YouTube&mode=penalty&overlaySessionId=session-double&unlockDurationMinutes=12',
        ]}
      >
        <Routes>
          <Route path="/intervention" element={<InterventionPage />} />
        </Routes>
      </MemoryRouter>,
    );

    // Schritt 1 -> Schritt 2 (keine Zahlung).
    fireEvent.click(await screen.findByRole('button', { name: /primary-action/i }));
    await screen.findByText('step-2');

    // Doppel-Tap in Schritt 2: beide Klicks treffen ein, bevor die Zahlung
    // aufgeloest ist.
    const payButton = await screen.findByRole('button', { name: /primary-action/i });
    fireEvent.click(payButton);
    fireEvent.click(payButton);

    await waitFor(() => expect(deductPenalty).toHaveBeenCalledTimes(1));

    // Auch nach dem Aufloesen darf es bei genau einer Belastung bleiben.
    resolvePayment?.({
      transactionId: 'tx-double',
      paymentReference: 'hash-double',
      sentAt: Date.now(),
      amountSats: 500,
      feesPaidSats: 2,
    });

    await screen.findByText('release-card');
    expect(deductPenalty).toHaveBeenCalledTimes(1);
  });
});
