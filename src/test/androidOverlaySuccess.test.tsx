import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { ROUTER_FUTURE_FLAGS } from '@/lib/routerFuture';

const dismissBlockingOverlayMock = vi.fn<() => Promise<void>>();
const abandonPendingNavigationMock = vi.fn<(sessionId?: string) => Promise<void>>();
const grantManualOverrideMock = vi.fn<
  (targetId: string, targetType: 'app' | 'website' | 'search', unlockDurationMinutes?: number) => Promise<unknown>
>();
const openTargetMock = vi.fn<
  (targetId: string, targetType: 'app' | 'website' | 'search') => Promise<void>
>();
const waitForPersistStorageIdleMock = vi.fn<(storageKey: string, timeoutMs?: number) => Promise<void>>();

function LocationSearchProbe() {
  const location = useLocation();
  return (
    <>
      <div data-testid="location">{location.pathname}</div>
      <div data-testid="location-search">{location.search}</div>
    </>
  );
}

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
    BlockingUnlockSuccessScreen: ({
      buttonLabel = 'App freischalten',
      onContinue,
      targetLabel,
      targetType,
      tone,
      unlockDurationMinutes,
    }: {
      buttonLabel?: string;
      onContinue: () => void;
      targetLabel?: string | null;
      targetType: 'app' | 'website' | 'search';
      tone: 'strict' | 'reflection' | 'learn' | 'penalty' | 'normal' | 'breathing';
      unlockDurationMinutes?: number | null;
    }) => (
        <div>
          <div>{targetLabel || 'Freigabe'}</div>
          <div>{unlockDurationMinutes ? `${unlockDurationMinutes} Min frei` : 'Freigabe aktiv'}</div>
          <div data-testid="unlock-success-tone">{tone}</div>
          <div data-testid="unlock-success-target-type">{targetType}</div>
          <button type="button" onClick={onContinue}>
            {buttonLabel}
        </button>
      </div>
    ),
  }));
  vi.doMock('@/components/ui/SuccessAnimation', () => ({
    SuccessAnimation: ({
      visible,
      message,
      subMessage,
      detailMessage,
      onAnimationDone,
    }: {
      visible: boolean;
      message?: string;
      subMessage?: string;
      detailMessage?: string;
      onAnimationDone?: () => void;
    }) =>
      visible ? (
        <div>
          <div>{message}</div>
          {subMessage ? <div>{subMessage}</div> : null}
          {detailMessage ? <div>{detailMessage}</div> : null}
          <button type="button" onClick={onAnimationDone}>
            finish-success
          </button>
        </div>
      ) : null,
  }));
}

async function loadCheckinPage(options?: { applyMocks?: () => void }) {
  vi.resetModules();
  mockSharedUi();
  dismissBlockingOverlayMock.mockReset();
  abandonPendingNavigationMock.mockReset();
  abandonPendingNavigationMock.mockResolvedValue(undefined);
  grantManualOverrideMock.mockReset();
  openTargetMock.mockReset();
  waitForPersistStorageIdleMock.mockReset();
  waitForPersistStorageIdleMock.mockResolvedValue(undefined);
  options?.applyMocks?.();

  vi.doMock('@/lib/platform', () => ({
    isAndroidPlatform: true,
  }));
  vi.doMock('@/lib/persistStorage', async () => {
    const actual = await vi.importActual<typeof import('@/lib/persistStorage')>('@/lib/persistStorage');
    return {
      ...actual,
      waitForPersistStorageIdle: waitForPersistStorageIdleMock,
    };
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

  const [{ default: CheckinPage }, { useAppStore }] = await Promise.all([
    import('@/pages/Checkin'),
    import('@/store/useAppStore'),
  ]);

  return { CheckinPage, useAppStore };
}

async function loadInterventionPage(options?: { applyMocks?: () => void }) {
  vi.resetModules();
  mockSharedUi();
  dismissBlockingOverlayMock.mockReset();
  abandonPendingNavigationMock.mockReset();
  abandonPendingNavigationMock.mockResolvedValue(undefined);
  grantManualOverrideMock.mockReset();
  waitForPersistStorageIdleMock.mockReset();
  waitForPersistStorageIdleMock.mockResolvedValue(undefined);
  options?.applyMocks?.();

  vi.doMock('@/lib/platform', () => ({
    isAndroidPlatform: true,
  }));
  vi.doMock('@/lib/persistStorage', async () => {
    const actual = await vi.importActual<typeof import('@/lib/persistStorage')>('@/lib/persistStorage');
    return {
      ...actual,
      waitForPersistStorageIdle: waitForPersistStorageIdleMock,
    };
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
  vi.doMock('@/components/InterventionOverlayScreen', () => ({
    default: ({
      blockedTarget,
      closeLabel,
      unlockDurationMinutes,
      penaltyConfirmStep,
      penaltyErrorMessage,
      onPrimaryAction,
      onClose,
    }: {
      blockedTarget?: string | null;
      closeLabel?: string;
      unlockDurationMinutes?: number | null;
      penaltyConfirmStep?: 1 | 2;
      penaltyErrorMessage?: string;
      onPrimaryAction: () => void;
      onClose?: () => void;
    }) => (
      <div>
        <div>{blockedTarget}</div>
        {unlockDurationMinutes ? <div>{`${unlockDurationMinutes} Min frei`}</div> : null}
        <div>step-{penaltyConfirmStep}</div>
        {penaltyErrorMessage ? <div>{penaltyErrorMessage}</div> : null}
        <button type="button" onClick={onPrimaryAction}>
          primary-action
        </button>
        {onClose ? (
          <button type="button" onClick={onClose}>
            {closeLabel || 'close-action'}
          </button>
        ) : null}
      </div>
    ),
  }));

  const [{ default: InterventionPage }, { useAppStore }] = await Promise.all([
    import('@/pages/Intervention'),
    import('@/store/useAppStore'),
  ]);

  return { InterventionPage, useAppStore };
}

async function loadLearnReviewPage(options?: { applyMocks?: () => void }) {
  vi.resetModules();
  mockSharedUi();
  dismissBlockingOverlayMock.mockReset();
  abandonPendingNavigationMock.mockReset();
  abandonPendingNavigationMock.mockResolvedValue(undefined);
  grantManualOverrideMock.mockReset();
  openTargetMock.mockReset();
  waitForPersistStorageIdleMock.mockReset();
  waitForPersistStorageIdleMock.mockResolvedValue(undefined);
  options?.applyMocks?.();

  vi.doMock('@/lib/platform', () => ({
    isAndroidPlatform: true,
  }));
  vi.doMock('@/lib/persistStorage', async () => {
    const actual = await vi.importActual<typeof import('@/lib/persistStorage')>('@/lib/persistStorage');
    return {
      ...actual,
      waitForPersistStorageIdle: waitForPersistStorageIdleMock,
    };
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

  const [{ default: LearnReviewPage }, { useAppStore }, { useLearningStore }] =
    await Promise.all([
      import('@/pages/LearnReview'),
      import('@/store/useAppStore'),
      import('@/store/useLearningStore'),
    ]);

  return { LearnReviewPage, useAppStore, useLearningStore };
}

async function loadBreathingPage(options?: { autoComplete?: boolean }) {
  vi.resetModules();
  mockSharedUi();
  dismissBlockingOverlayMock.mockReset();
  abandonPendingNavigationMock.mockReset();
  abandonPendingNavigationMock.mockResolvedValue(undefined);
  openTargetMock.mockReset();
  let started = false;
  const autoComplete = options?.autoComplete ?? true;

  vi.doMock('@/lib/platform', () => ({
    isAndroidPlatform: true,
  }));
  vi.doMock('@/hooks/useBreathingEngine', () => ({
    useBreathingEngine: ({ onComplete }: { onComplete: () => void }) => ({
      isActive: started,
      currentCycle: 0,
      currentPhaseIndex: 0,
      phaseTimeLeft: 1,
      currentPhase: { type: 'inhale', duration: 1, instruction: 'Ein' },
      progress: 0,
      pattern: { phases: [{ type: 'inhale', duration: 1 }], name: 'Mock', description: 'Mock' },
      start: () => {
        if (started) return;
        started = true;
        if (autoComplete) {
          onComplete();
        }
      },
      reset: vi.fn(),
    }),
  }));
  vi.doMock('@/components/breathing/BreathingScene', () => ({
    BreathingScene: () => null,
  }));

  const { default: BreathingPage } = await import('@/pages/Breathing');
  return { BreathingPage };
}

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
  vi.doUnmock('@/components/PageTransition');
  vi.doUnmock('@/components/GlassCard');
  vi.doUnmock('@/hooks/useNativeRouteReady');
  vi.doUnmock('@/components/blocking/BlockingUnlockSuccessScreen');
  vi.doUnmock('@/components/ui/SuccessAnimation');
  vi.doUnmock('@/components/InterventionOverlayScreen');
  vi.doUnmock('@/hooks/useBreathingEngine');
  vi.doUnmock('@/components/breathing/BreathingScene');
  vi.doUnmock('@/lib/persistStorage');
  vi.doUnmock('@/lib/platform');
  vi.doUnmock('@/services/screenTimeService');
  vi.resetModules();
});

describe('Android overlay success flows', () => {
  it('dismisses the Android host and reopens the target after a strict check-in', async () => {
    const now = Date.UTC(2026, 2, 13, 12, 0, 0);
    vi.spyOn(Date, 'now').mockReturnValue(now);

    const { CheckinPage, useAppStore } = await loadCheckinPage();
    useAppStore.setState(
      {
        ...useAppStore.getInitialState(),
        defaultUnlockDurationMinutes: 99,
      },
      true,
    );

    render(
      <MemoryRouter
        future={ROUTER_FUTURE_FLAGS}
        initialEntries={[
          '/checkin?targetId=YouTube&targetApp=YouTube&blockType=app&overlaySessionId=session-1&unlockDurationMinutes=12&targetLabel=YouTube',
        ]}
      >
        <Routes>
          <Route path="/checkin" element={<CheckinPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('YouTube | 12 Min frei')).toBeInTheDocument();
    fireEvent.change(await screen.findByRole('textbox'), {
      target: { value: 'Ich will kurz ein Video schauen.' },
    });
    expect(screen.getByText(/was möchtest du tun/i)).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: /weiter/i }));
    await screen.findByText(/warum möchtest du das tun/i);
    fireEvent.change(await screen.findByRole('textbox'), {
      target: { value: 'Ich brauche eine kurze Pause.' },
    });
    fireEvent.click(await screen.findByRole('button', { name: /weiter/i }));
    await screen.findByText(/wie fühlst du dich/i);
    fireEvent.click((await screen.findByText(/^Erleichtert$/i)).closest('button') as HTMLButtonElement);
    fireEvent.click((await screen.findByText(/^Zufrieden$/i)).closest('button') as HTMLButtonElement);
    fireEvent.click((await screen.findByText(/^Hoffnungsvoll$/i)).closest('button') as HTMLButtonElement);
    fireEvent.click(await screen.findByRole('button', { name: /weiter zur app|abschlie/i }));

    expect(useAppStore.getState().unlockedTargets['app:youtube']).toBe(now + 12 * 60 * 1000);
    await waitFor(() => expect(grantManualOverrideMock).toHaveBeenCalledWith('YouTube', 'app', 12));
    await waitFor(() => expect(dismissBlockingOverlayMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(openTargetMock).toHaveBeenCalledWith('YouTube', 'app'));
    expect(grantManualOverrideMock.mock.invocationCallOrder[0]).toBeLessThan(dismissBlockingOverlayMock.mock.invocationCallOrder[0]);
    expect(dismissBlockingOverlayMock.mock.invocationCallOrder[0]).toBeLessThan(openTargetMock.mock.invocationCallOrder[0]);
  }, 30_000);

  it('dismisses the overlay only once after the direct reopen flow completes', async () => {
    const { CheckinPage, useAppStore } = await loadCheckinPage();
    useAppStore.setState(
      {
        ...useAppStore.getInitialState(),
        defaultUnlockDurationMinutes: 15,
      },
      true,
    );

    const view = render(
      <MemoryRouter
        future={ROUTER_FUTURE_FLAGS}
        initialEntries={[
          '/checkin?targetId=YouTube&targetType=app&targetLabel=YouTube&overlaySessionId=session-dismiss-once&unlockDurationMinutes=12',
        ]}
      >
        <Routes>
          <Route path="/checkin" element={<CheckinPage />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.change(await screen.findByRole('textbox'), {
      target: { value: 'Kurz schauen.' },
    });
    fireEvent.click(await screen.findByRole('button', { name: /weiter/i }));
    await screen.findByText(/warum möchtest du das tun/i);
    fireEvent.change(await screen.findByRole('textbox'), {
      target: { value: 'Kurz abschalten.' },
    });
    fireEvent.click(await screen.findByRole('button', { name: /weiter/i }));
    await screen.findByText(/wie fühlst du dich/i);
    fireEvent.click((await screen.findByText(/^Erleichtert$/i)).closest('button') as HTMLButtonElement);
    fireEvent.click((await screen.findByText(/^Zufrieden$/i)).closest('button') as HTMLButtonElement);
    fireEvent.click((await screen.findByText(/^Hoffnungsvoll$/i)).closest('button') as HTMLButtonElement);
    fireEvent.click(await screen.findByRole('button', { name: /weiter zur app|abschlie/i }));

    await waitFor(() => expect(dismissBlockingOverlayMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(openTargetMock).toHaveBeenCalledWith('YouTube', 'app'));

    view.unmount();
    await Promise.resolve();

    expect(dismissBlockingOverlayMock).toHaveBeenCalledTimes(1);
  });

  it('reopens the target after a strict check-in even when the session duration falls back to the default', async () => {
    const now = Date.UTC(2026, 2, 13, 12, 30, 0);
    vi.spyOn(Date, 'now').mockReturnValue(now);

    const { CheckinPage, useAppStore } = await loadCheckinPage();
    useAppStore.setState(
      {
        ...useAppStore.getInitialState(),
        defaultUnlockDurationMinutes: 25,
      },
      true,
    );

    render(
      <MemoryRouter
        future={ROUTER_FUTURE_FLAGS}
        initialEntries={[
          '/checkin?targetId=YouTube&targetApp=YouTube&blockType=app&overlaySessionId=session-2&targetLabel=YouTube',
        ]}
      >
        <Routes>
          <Route path="/checkin" element={<CheckinPage />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.change(await screen.findByRole('textbox'), {
      target: { value: 'Ich will kurz schauen, was neu ist.' },
    });
    fireEvent.click(await screen.findByRole('button', { name: /weiter/i }));
    await screen.findByText(/warum möchtest du das tun/i);
    fireEvent.change(await screen.findByRole('textbox'), {
      target: { value: 'Ich brauche eine kleine Pause.' },
    });
    fireEvent.click(await screen.findByRole('button', { name: /weiter/i }));
    await screen.findByText(/wie fühlst du dich/i);
    fireEvent.click((await screen.findByText(/^Erleichtert$/i)).closest('button') as HTMLButtonElement);
    fireEvent.click((await screen.findByText(/^Zufrieden$/i)).closest('button') as HTMLButtonElement);
    fireEvent.click((await screen.findByText(/^Hoffnungsvoll$/i)).closest('button') as HTMLButtonElement);
    fireEvent.click(await screen.findByRole('button', { name: /weiter zur app|abschlie/i }));

    expect(useAppStore.getState().unlockedTargets['app:youtube']).toBe(now + 25 * 60 * 1000);
    await waitFor(() => expect(grantManualOverrideMock).toHaveBeenCalledWith('YouTube', 'app', 25));
    await waitFor(() => expect(dismissBlockingOverlayMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(openTargetMock).toHaveBeenCalledWith('YouTube', 'app'));
  }, 15000);

  it('shows the release card after a penalty payment and does not reopen the target', async () => {
    const now = Date.UTC(2026, 2, 13, 13, 0, 0);
    vi.spyOn(Date, 'now').mockReturnValue(now);

    const { InterventionPage, useAppStore } = await loadInterventionPage();
    const deductPenalty = vi.fn().mockResolvedValue({
      transactionId: 'tx-success',
      paymentReference: 'hash-success',
      sentAt: now,
      amountSats: 500,
      feesPaidSats: 2,
    });

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
          '/intervention?targetId=YouTube&targetType=app&targetLabel=YouTube&mode=penalty&overlaySessionId=session-1&unlockDurationMinutes=12',
        ]}
      >
        <Routes>
          <Route path="/intervention" element={<InterventionPage />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('button', { name: /primary-action/i }));
    fireEvent.click(await screen.findByRole('button', { name: /primary-action/i }));

    await waitFor(() => expect(deductPenalty).toHaveBeenCalledWith('YouTube', 'app'));
    expect(await screen.findByText('YouTube')).toBeInTheDocument();
    expect(screen.getAllByText('12 Min frei').length).toBeGreaterThan(0);
    expect(screen.getByTestId('unlock-success-tone')).toHaveTextContent('penalty');
    expect(screen.getByTestId('unlock-success-target-type')).toHaveTextContent('app');
    expect(useAppStore.getState().unlockedTargets['app:youtube']).toBe(now + 12 * 60 * 1000);

    fireEvent.click(screen.getByRole('button', { name: /app freischalten/i }));
    await waitFor(() => expect(grantManualOverrideMock).toHaveBeenCalledWith('YouTube', 'app', 12));
    await waitFor(() => expect(dismissBlockingOverlayMock).toHaveBeenCalledTimes(1));
  });

  it('waits for persisted penalty success data before dismissing the overlay host', async () => {
    let resolvePersistStorage: (() => void) | null = null;
    const persistStorageIdle = new Promise<void>((resolve) => {
      resolvePersistStorage = resolve;
    });

    const now = Date.UTC(2026, 2, 13, 13, 30, 0);
    vi.spyOn(Date, 'now').mockReturnValue(now);

    const { InterventionPage, useAppStore } = await loadInterventionPage({
      applyMocks: () => {
        waitForPersistStorageIdleMock.mockReturnValueOnce(persistStorageIdle);
      },
    });
    const deductPenalty = vi.fn().mockResolvedValue({
      transactionId: 'tx-persist',
      paymentReference: 'hash-persist',
      sentAt: now,
      amountSats: 500,
      feesPaidSats: 2,
    });

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
          '/intervention?targetId=YouTube&targetType=app&targetLabel=YouTube&mode=penalty&overlaySessionId=session-persist&unlockDurationMinutes=12',
        ]}
      >
        <Routes>
          <Route path="/intervention" element={<InterventionPage />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('button', { name: /primary-action/i }));
    fireEvent.click(await screen.findByRole('button', { name: /primary-action/i }));
    await waitFor(() => expect(deductPenalty).toHaveBeenCalledWith('YouTube', 'app'));

    fireEvent.click(await screen.findByRole('button', { name: /app freischalten/i }));

    await waitFor(() => {
      expect(waitForPersistStorageIdleMock).toHaveBeenCalledWith('mindful-usage-storage', 2500);
    });
    expect(grantManualOverrideMock).not.toHaveBeenCalled();
    expect(dismissBlockingOverlayMock).not.toHaveBeenCalled();

    resolvePersistStorage?.();

    await waitFor(() => expect(grantManualOverrideMock).toHaveBeenCalledWith('YouTube', 'app', 12));
    await waitFor(() => expect(dismissBlockingOverlayMock).toHaveBeenCalledTimes(1));
    expect(waitForPersistStorageIdleMock.mock.invocationCallOrder[0]).toBeLessThan(
      grantManualOverrideMock.mock.invocationCallOrder[0],
    );
    expect(grantManualOverrideMock.mock.invocationCallOrder[0]).toBeLessThan(
      dismissBlockingOverlayMock.mock.invocationCallOrder[0],
    );
  });

  it('shows learn mode on intervention first and opens learn review after the primary action', async () => {
    const { InterventionPage } = await loadInterventionPage();

    render(
      <MemoryRouter
        future={ROUTER_FUTURE_FLAGS}
        initialEntries={[
          '/intervention?targetId=YouTube&targetType=app&targetLabel=YouTube&mode=learn&overlaySessionId=session-learn&unlockDurationMinutes=12&deckId=deck-1',
        ]}
      >
        <Routes>
          <Route path="/intervention" element={<InterventionPage />} />
          <Route path="/learn/review" element={<LocationSearchProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('YouTube')).toBeInTheDocument();
    expect(screen.getAllByText('12 Min frei').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: /primary-action/i }));

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/learn/review');
    });

    const query = screen.getByTestId('location-search').textContent || '';
    expect(query).toContain('targetId=YouTube');
    expect(query).toContain('targetType=app');
    expect(query).toContain('targetLabel=YouTube');
    expect(query).toContain('overlaySessionId=session-learn');
    expect(query).toContain('unlockDurationMinutes=12');
    expect(query).toContain('deckId=deck-1');
  });

  it('shows strict mode on intervention first and opens breathing after the primary action', async () => {
    const { InterventionPage, useAppStore } = await loadInterventionPage();
    useAppStore.setState(
      {
        ...useAppStore.getInitialState(),
        interventionPatternId: 'triangle',
      },
      true,
    );

    render(
      <MemoryRouter
        future={ROUTER_FUTURE_FLAGS}
        initialEntries={[
          '/intervention?targetId=YouTube&targetType=app&targetLabel=YouTube&mode=strict&overlaySessionId=session-strict&unlockDurationMinutes=12',
        ]}
      >
        <Routes>
          <Route path="/intervention" element={<InterventionPage />} />
          <Route path="/breathing" element={<LocationSearchProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('YouTube')).toBeInTheDocument();
    expect(screen.getByText('12 Min frei')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /primary-action/i }));

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/breathing');
    });

    const query = screen.getByTestId('location-search').textContent || '';
    expect(query).toContain('targetId=YouTube');
    expect(query).toContain('targetType=app');
    expect(query).toContain('targetLabel=YouTube');
    expect(query).toContain('overlaySessionId=session-strict');
    expect(query).toContain('unlockDurationMinutes=12');
    expect(query).toContain('patternId=triangle');
    expect(abandonPendingNavigationMock).not.toHaveBeenCalled();
    expect(dismissBlockingOverlayMock).not.toHaveBeenCalled();
  });

  it('accepts the reflection alias on intervention and still routes into breathing', async () => {
    const { InterventionPage, useAppStore } = await loadInterventionPage();
    useAppStore.setState(
      {
        ...useAppStore.getInitialState(),
        interventionPatternId: 'box',
      },
      true,
    );

    render(
      <MemoryRouter
        future={ROUTER_FUTURE_FLAGS}
        initialEntries={[
          '/intervention?targetId=YouTube&targetType=app&targetLabel=YouTube&mode=reflection&overlaySessionId=session-reflection&unlockDurationMinutes=6',
        ]}
      >
        <Routes>
          <Route path="/intervention" element={<InterventionPage />} />
          <Route path="/breathing" element={<LocationSearchProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('YouTube')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /primary-action/i }));

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/breathing');
    });

    const query = screen.getByTestId('location-search').textContent || '';
    expect(query).toContain('mode=reflection');
    expect(query).toContain('overlaySessionId=session-reflection');
    expect(query).toContain('patternId=box');
    expect(abandonPendingNavigationMock).not.toHaveBeenCalled();
    expect(dismissBlockingOverlayMock).not.toHaveBeenCalled();
  });

  it('keeps the abort button available for protected intervention overlays', async () => {
    const { InterventionPage } = await loadInterventionPage();

    render(
      <MemoryRouter
        future={ROUTER_FUTURE_FLAGS}
        initialEntries={[
          '/intervention?targetId=YouTube&targetType=app&targetLabel=YouTube&mode=strict&overlaySessionId=session-abort&unlockDurationMinutes=12',
        ]}
      >
        <Routes>
          <Route path="/intervention" element={<InterventionPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('YouTube')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /abbrechen/i }));

    await waitFor(() => expect(dismissBlockingOverlayMock).toHaveBeenCalledTimes(1));
    expect(openTargetMock).not.toHaveBeenCalled();
  });

  it('keeps website overlay payloads intact through strict check-in and reopens the target', async () => {
    const now = Date.UTC(2026, 2, 13, 16, 0, 0);
    vi.spyOn(Date, 'now').mockReturnValue(now);

    const { CheckinPage, useAppStore } = await loadCheckinPage();
    useAppStore.setState(
      {
        ...useAppStore.getInitialState(),
        defaultUnlockDurationMinutes: 99,
      },
      true,
    );

    render(
      <MemoryRouter
        future={ROUTER_FUTURE_FLAGS}
        initialEntries={[
          '/checkin?targetId=youtube.com&targetType=website&targetLabel=YouTube&overlaySessionId=session-website&unlockDurationMinutes=7',
        ]}
      >
        <Routes>
          <Route path="/checkin" element={<CheckinPage />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.change(await screen.findByRole('textbox'), {
      target: { value: 'Ich will kurz auf die Seite.' },
    });
    fireEvent.click(await screen.findByRole('button', { name: /weiter/i }));
    await screen.findByText(/warum möchtest du das tun/i);
    fireEvent.change(await screen.findByRole('textbox'), {
      target: { value: 'Ich suche etwas Bestimmtes.' },
    });
    fireEvent.click(await screen.findByRole('button', { name: /weiter/i }));
    await screen.findByText(/wie fühlst du dich/i);
    fireEvent.click((await screen.findByText(/^Erleichtert$/i)).closest('button') as HTMLButtonElement);
    fireEvent.click((await screen.findByText(/^Zufrieden$/i)).closest('button') as HTMLButtonElement);
    fireEvent.click((await screen.findByText(/^Hoffnungsvoll$/i)).closest('button') as HTMLButtonElement);
    fireEvent.click(await screen.findByRole('button', { name: /weiter zur app|abschlie/i }));

    expect(useAppStore.getState().unlockedTargets['website:youtube.com']).toBe(now + 7 * 60 * 1000);
    await waitFor(() => expect(grantManualOverrideMock).toHaveBeenCalledWith('youtube.com', 'website', 7));
    await waitFor(() => expect(dismissBlockingOverlayMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(openTargetMock).toHaveBeenCalledWith('youtube.com', 'website'));
  }, 15000);

  it('passes search target metadata through the penalty unlock flow', async () => {
    const now = Date.UTC(2026, 2, 13, 17, 0, 0);
    vi.spyOn(Date, 'now').mockReturnValue(now);

    const { InterventionPage, useAppStore } = await loadInterventionPage();
    const deductPenalty = vi.fn().mockResolvedValue({
      transactionId: 'tx-search',
      paymentReference: 'hash-search',
      sentAt: now,
      amountSats: 500,
      feesPaidSats: 2,
    });

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
          '/intervention?targetId=doomscrolling&targetType=search&targetLabel=Doomscrolling&mode=penalty&overlaySessionId=session-search&unlockDurationMinutes=9',
        ]}
      >
        <Routes>
          <Route path="/intervention" element={<InterventionPage />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('button', { name: /primary-action/i }));
    fireEvent.click(await screen.findByRole('button', { name: /primary-action/i }));

    await waitFor(() => expect(deductPenalty).toHaveBeenCalledWith('doomscrolling', 'search'));
    expect(await screen.findByText('Doomscrolling')).toBeInTheDocument();
    expect(screen.getByText('9 Min frei')).toBeInTheDocument();
    expect(screen.getByTestId('unlock-success-tone')).toHaveTextContent('penalty');
    expect(screen.getByTestId('unlock-success-target-type')).toHaveTextContent('search');

    fireEvent.click(screen.getByRole('button', { name: /app freischalten/i }));
    await waitFor(() => expect(grantManualOverrideMock).toHaveBeenCalledWith('doomscrolling', 'search', 9));
    await waitFor(() => expect(dismissBlockingOverlayMock).toHaveBeenCalledTimes(1));
  }, 15000);

  it('routes lock mode back to the dashboard without exposing a manual override', async () => {
    const now = Date.UTC(2026, 2, 13, 15, 0, 0);
    vi.spyOn(Date, 'now').mockReturnValue(now);

    const { InterventionPage, useAppStore } = await loadInterventionPage();
    useAppStore.setState(
      {
        ...useAppStore.getInitialState(),
        defaultUnlockDurationMinutes: 99,
      },
      true,
    );

    render(
      <MemoryRouter
        future={ROUTER_FUTURE_FLAGS}
        initialEntries={[
          '/intervention?targetId=YouTube&targetType=app&targetLabel=YouTube&mode=lock&overlaySessionId=session-1',
        ]}
      >
        <Routes>
          <Route path="/intervention" element={<InterventionPage />} />
          <Route path="/" element={<LocationSearchProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.queryByRole('button', { name: /manuell freigeben/i })).toBeNull();
    fireEvent.click(await screen.findByRole('button', { name: /primary-action/i }));
    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/');
    });
    await waitFor(() => expect(dismissBlockingOverlayMock).toHaveBeenCalledTimes(1));
  });

  it('uses the session unlock duration in learn review and reopens the target after the CTA', async () => {
    const now = Date.UTC(2026, 2, 13, 14, 0, 0);
    vi.spyOn(Date, 'now').mockReturnValue(now);

    const { LearnReviewPage, useAppStore, useLearningStore } = await loadLearnReviewPage();
    useAppStore.setState(
      {
        ...useAppStore.getInitialState(),
        defaultUnlockDurationMinutes: 99,
      },
      true,
    );
    useLearningStore.setState(useLearningStore.getInitialState(), true);
    useLearningStore.getState().seedStarterDeck();

    const deckId = Object.values(useLearningStore.getState().decks)[0]?.id;
    expect(deckId).toBeTruthy();

    useLearningStore.getState().setGateRule({
      typedAnswerEnabled: false,
      sessionCreditsRequired: 1,
      unlockDurationMinutes: 99,
    });
    useLearningStore.getState().upsertAssignment('YouTube', 'app', deckId!, {
      sessionCreditsRequired: 1,
      unlockDurationMinutes: 99,
    });

    render(
      <MemoryRouter
        future={ROUTER_FUTURE_FLAGS}
        initialEntries={[
          `/learn/review?targetId=YouTube&targetType=app&deckId=${deckId}&overlaySessionId=session-1&unlockDurationMinutes=12&targetLabel=YouTube`,
        ]}
      >
        <Routes>
          <Route path="/learn/review" element={<LearnReviewPage />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('button', { name: /antwort zeigen/i }));
    fireEvent.click(await screen.findByRole('button', { name: /good/i }));
    fireEvent.click(await screen.findByRole('button', { name: /erleichtert/i }));
    fireEvent.click(await screen.findByRole('button', { name: /zufrieden/i }));
    fireEvent.click(await screen.findByRole('button', { name: /hoffnungsvoll/i }));
    fireEvent.click(await screen.findByRole('button', { name: /weiter zur app|abschlie/i }));

    expect(useAppStore.getState().unlockedTargets['app:youtube']).toBe(now + 12 * 60 * 1000);
    expect(screen.queryByRole('button', { name: /app freischalten|zur app/i })).not.toBeInTheDocument();

    await waitFor(() => expect(grantManualOverrideMock).toHaveBeenCalledWith('YouTube', 'app', 12));
    await waitFor(() => expect(dismissBlockingOverlayMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(openTargetMock).toHaveBeenCalledWith('YouTube', 'app'));
  }, 30_000);

  it('waits for app-store persistence before a learn overlay reopens the blocked target', async () => {
    const now = Date.UTC(2026, 2, 13, 14, 15, 0);
    vi.spyOn(Date, 'now').mockReturnValue(now);

    let resolvePersistStorage: (() => void) | null = null;
    const persistStorageIdle = new Promise<void>((resolve) => {
      resolvePersistStorage = resolve;
    });

    const { LearnReviewPage, useAppStore, useLearningStore } = await loadLearnReviewPage({
      applyMocks: () => {
        waitForPersistStorageIdleMock.mockReturnValueOnce(persistStorageIdle);
      },
    });
    useAppStore.setState(
      {
        ...useAppStore.getInitialState(),
        defaultUnlockDurationMinutes: 99,
      },
      true,
    );
    useLearningStore.setState(useLearningStore.getInitialState(), true);
    useLearningStore.getState().seedStarterDeck();

    const deckId = Object.values(useLearningStore.getState().decks)[0]?.id;
    expect(deckId).toBeTruthy();

    useLearningStore.getState().setGateRule({
      typedAnswerEnabled: false,
      sessionCreditsRequired: 1,
      unlockDurationMinutes: 99,
    });
    useLearningStore.getState().upsertAssignment('YouTube', 'app', deckId!, {
      sessionCreditsRequired: 1,
      unlockDurationMinutes: 99,
    });

    render(
      <MemoryRouter
        future={ROUTER_FUTURE_FLAGS}
        initialEntries={[
          `/learn/review?targetId=YouTube&targetType=app&deckId=${deckId}&overlaySessionId=session-persist&unlockDurationMinutes=12&targetLabel=YouTube`,
        ]}
      >
        <Routes>
          <Route path="/learn/review" element={<LearnReviewPage />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('button', { name: /antwort zeigen/i }));
    fireEvent.click(await screen.findByRole('button', { name: /good/i }));
    fireEvent.click(await screen.findByRole('button', { name: /erleichtert/i }));
    fireEvent.click(await screen.findByRole('button', { name: /zufrieden/i }));
    fireEvent.click(await screen.findByRole('button', { name: /hoffnungsvoll/i }));
    fireEvent.click(await screen.findByRole('button', { name: /weiter zur app|abschlie/i }));

    await waitFor(() => {
      expect(waitForPersistStorageIdleMock).toHaveBeenCalledWith('mindful-usage-storage', 2500);
    });
    expect(grantManualOverrideMock).not.toHaveBeenCalled();
    expect(dismissBlockingOverlayMock).not.toHaveBeenCalled();
    expect(openTargetMock).not.toHaveBeenCalled();

    resolvePersistStorage?.();

    await waitFor(() => expect(grantManualOverrideMock).toHaveBeenCalledWith('YouTube', 'app', 12));
    await waitFor(() => expect(dismissBlockingOverlayMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(openTargetMock).toHaveBeenCalledWith('YouTube', 'app'));
  }, 30_000);

  it('shows the unlock duration while the blocked breathing flow is running', async () => {
    const { BreathingPage } = await loadBreathingPage({ autoComplete: false });

    render(
      <MemoryRouter
        future={ROUTER_FUTURE_FLAGS}
        initialEntries={[
          '/breathing?targetId=youtube.com&targetType=website&targetLabel=YouTube&overlaySessionId=session-breathe&unlockDurationMinutes=11&mode=strict',
        ]}
      >
        <Routes>
          <Route path="/breathing" element={<BreathingPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('YouTube | 11 Min frei')).toBeInTheDocument();
  });

  it('preserves the overlay query payload from breathing to checkin', async () => {
    const { BreathingPage } = await loadBreathingPage();

    render(
      <MemoryRouter
        future={ROUTER_FUTURE_FLAGS}
        initialEntries={[
          '/breathing?targetId=youtube.com&targetType=website&targetLabel=YouTube&overlaySessionId=session-chain&unlockDurationMinutes=11&mode=strict',
        ]}
      >
        <Routes>
          <Route path="/breathing" element={<BreathingPage />} />
          <Route path="/checkin" element={<LocationSearchProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/checkin');
    });

    const query = screen.getByTestId('location-search').textContent || '';
    expect(query).toContain('targetId=youtube.com');
    expect(query).toContain('targetType=website');
    expect(query).toContain('blockType=website');
    expect(query).toContain('targetLabel=YouTube');
    expect(query).toContain('targetApp=YouTube');
    expect(query).toContain('overlaySessionId=session-chain');
    expect(query).toContain('unlockDurationMinutes=11');
  });
});
