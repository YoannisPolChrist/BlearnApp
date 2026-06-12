import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { createElement, type ReactNode } from 'react';
import { ROUTER_FUTURE_FLAGS } from '@/lib/routerFuture';

const openTargetMock = vi.fn<(targetId: string, targetType: 'app' | 'website' | 'search') => Promise<void>>();
const dismissOnceMock = vi.fn<() => Promise<boolean>>();
const waitForPersistStorageIdleMock = vi.fn<(storageKey: string, timeoutMs?: number) => Promise<void>>();

function isSelectionCount(node: Element | null, count: number) {
  return node?.tagName === 'P' && new RegExp(`${count} von max\\. 5 gew(?:ählt|aehlt|Ã¤hlt)`, 'i').test(node.textContent ?? '');
}

async function loadCheckinPage(options?: { applyMocks?: () => void }) {
  vi.resetModules();
  openTargetMock.mockReset();
  dismissOnceMock.mockReset();
  waitForPersistStorageIdleMock.mockReset();
  dismissOnceMock.mockResolvedValue(true);
  waitForPersistStorageIdleMock.mockResolvedValue(undefined);
  options?.applyMocks?.();

  vi.doMock('framer-motion', () => {
    const motionElement = new Proxy(
      {},
      {
        get: (_, tag: string) =>
          ({ children, ...props }: { children?: ReactNode; [key: string]: unknown }) => {
            const {
              animate: _animate,
              exit: _exit,
              initial: _initial,
              layout: _layout,
              transition: _transition,
              whileHover: _whileHover,
              whileTap: _whileTap,
              ...domProps
            } = props;

            return createElement(tag, domProps, children);
          },
      },
    );

    return {
      AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
      motion: motionElement,
      useReducedMotion: () => true,
    };
  });
  vi.doMock('@/components/PageTransition', () => ({
    default: ({ children }: { children: ReactNode }) => <>{children}</>,
  }));
  vi.doMock('@/hooks/useNativeRouteReady', () => ({
    useNativeRouteReady: () => undefined,
  }));
  vi.doMock('@/hooks/useOverlayDismissGuard', () => ({
    useOverlayDismissGuard: () => ({
      dismissOnce: dismissOnceMock,
    }),
  }));
  vi.doMock('@/lib/persistStorage', async () => {
    const actual = await vi.importActual<typeof import('@/lib/persistStorage')>('@/lib/persistStorage');
    return {
      ...actual,
      waitForPersistStorageIdle: waitForPersistStorageIdleMock,
    };
  });
  vi.doMock('@/components/blocking/BlockingUnlockSuccessScreen', () => ({
    BlockingUnlockSuccessScreen: ({
      onContinue,
      targetLabel,
    }: {
      onContinue: () => void;
      targetLabel?: string | null;
    }) => (
      <div>
        <div>{targetLabel}</div>
        <button type="button" onClick={onContinue}>
          continue-to-target
        </button>
      </div>
    ),
  }));
  vi.doMock('@/components/ui/SuccessAnimation', () => ({
    SuccessAnimation: () => null,
  }));
  vi.doMock('@/components/ui/SuccessTileAnimation', () => ({
    SuccessTileAnimation: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  }));
  vi.doMock('@/lib/platform', () => ({
    isAndroidPlatform: true,
  }));
  vi.doMock('@/services/screenTimeService', () => ({
    grantManualOverride: vi.fn().mockResolvedValue({
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

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.doUnmock('@/components/PageTransition');
  vi.doUnmock('@/hooks/useNativeRouteReady');
  vi.doUnmock('@/hooks/useOverlayDismissGuard');
  vi.doUnmock('@/lib/persistStorage');
  vi.doUnmock('@/components/blocking/BlockingUnlockSuccessScreen');
  vi.doUnmock('@/components/ui/SuccessAnimation');
  vi.doUnmock('@/components/ui/SuccessTileAnimation');
  vi.doUnmock('framer-motion');
  vi.doUnmock('@/lib/platform');
  vi.doUnmock('@/services/screenTimeService');
  vi.resetModules();
});

describe('CheckinPage', () => {
  it('uses the blue reflection tone on the default check-in flow', async () => {
    const { CheckinPage, useAppStore } = await loadCheckinPage();
    useAppStore.setState(useAppStore.getInitialState(), true);

    render(
      <MemoryRouter future={ROUTER_FUTURE_FLAGS} initialEntries={['/checkin']}>
        <Routes>
          <Route path="/checkin" element={<CheckinPage />} />
        </Routes>
      </MemoryRouter>,
    );

    const continueButton = screen.getByRole('button', { name: /weiter/i });
    expect(continueButton.className).toContain('mode-reflection');
    expect(continueButton.className).not.toContain('mode-strict');
  });

  it('allows completing the emotion step with one emotion and caps the selection at five', async () => {
    const { CheckinPage, useAppStore } = await loadCheckinPage();
    useAppStore.setState(useAppStore.getInitialState(), true);

    render(
      <MemoryRouter
        future={ROUTER_FUTURE_FLAGS}
        initialEntries={['/checkin?targetId=com.instagram.android&targetType=app&targetLabel=Instagram&overlaySessionId=session-emotions']}
      >
        <Routes>
          <Route path="/checkin" element={<CheckinPage />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByPlaceholderText(/social media/i), {
      target: { value: 'Instagram checken' },
    });
    fireEvent.click(screen.getByRole('button', { name: /weiter/i }));
    await screen.findByText(/warum/i);

    fireEvent.change(screen.getByPlaceholderText(/grund/i), {
      target: { value: 'Ich suche Ablenkung' },
    });
    fireEvent.click(screen.getByRole('button', { name: /weiter/i }));
    await screen.findByRole('heading', { name: /wie f(?:ü|ue|Ã¼)hlst du dich/i });

    fireEvent.click(screen.getByRole('button', { name: /erleichtert/i }));

    await waitFor(() => {
      expect(screen.getByText(/1 von max\. 5 gew(?:ählt|aehlt|Ã¤hlt)/i, { selector: 'p' })).toBeInTheDocument();
    });

    const finishButton = screen.getByRole('button', { name: /weiter zur app/i });
    await waitFor(() => {
      expect(finishButton).not.toBeDisabled();
    });

    fireEvent.click(screen.getByRole('button', { name: /neugierig/i }));
    fireEvent.click(screen.getByRole('button', { name: /angespannt/i }));
    fireEvent.click(screen.getByRole('button', { name: /besorgt/i }));
    fireEvent.click(screen.getByRole('button', { name: /hoffnungsvoll/i }));
    fireEvent.click(screen.getByRole('button', { name: /dankbar/i }));

    await waitFor(() => {
      expect(screen.getByText(/5 von max\. 5 gew(?:ählt|aehlt|Ã¤hlt)/i, { selector: 'p' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /weiter zur app/i }));

    await waitFor(() => {
      expect(openTargetMock).toHaveBeenCalledWith('com.instagram.android', 'app');
    });
    expect(screen.queryByRole('button', { name: /continue-to-target/i })).not.toBeInTheDocument();
  }, 20000);

  it('waits for app-store persistence before dismissing the overlay and reopening the blocked app', async () => {
    let resolvePersistStorage: (() => void) | null = null;
    const persistStorageIdle = new Promise<void>((resolve) => {
      resolvePersistStorage = resolve;
    });
    const { CheckinPage, useAppStore } = await loadCheckinPage({
      applyMocks: () => {
        waitForPersistStorageIdleMock.mockReturnValueOnce(persistStorageIdle);
      },
    });
    useAppStore.setState(useAppStore.getInitialState(), true);

    render(
      <MemoryRouter
        future={ROUTER_FUTURE_FLAGS}
        initialEntries={['/checkin?targetId=com.instagram.android&targetType=app&targetLabel=Instagram&overlaySessionId=session-checkin']}
      >
        <Routes>
          <Route path="/checkin" element={<CheckinPage />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByPlaceholderText(/social media/i), {
      target: { value: 'Instagram checken' },
    });
    fireEvent.click(screen.getByRole('button', { name: /weiter/i }));
    await screen.findByText(/warum/i);

    fireEvent.change(screen.getByPlaceholderText(/grund/i), {
      target: { value: 'Ich suche Ablenkung' },
    });
    fireEvent.click(screen.getByRole('button', { name: /weiter/i }));
    await screen.findByRole('heading', { name: /wie f(?:ü|ue|Ã¼)hlst du dich/i });

    fireEvent.click(screen.getByRole('button', { name: /erleichtert/i }));
    fireEvent.click(screen.getByRole('button', { name: /weiter zur app/i }));

    await waitFor(() => {
      expect(waitForPersistStorageIdleMock).toHaveBeenCalledWith('mindful-usage-storage', 2500);
    });
    expect(dismissOnceMock).not.toHaveBeenCalled();
    expect(openTargetMock).not.toHaveBeenCalled();

    resolvePersistStorage?.();

    await waitFor(() => {
      expect(dismissOnceMock).toHaveBeenCalledTimes(1);
      expect(openTargetMock).toHaveBeenCalledWith('com.instagram.android', 'app');
    });
  }, 20000);

  it('still reopens the blocked app when overlay dismissal fails once', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { CheckinPage, useAppStore } = await loadCheckinPage({
      applyMocks: () => {
        dismissOnceMock.mockRejectedValueOnce(new Error('dismiss failed'));
      },
    });
    useAppStore.setState(useAppStore.getInitialState(), true);

    render(
      <MemoryRouter
        future={ROUTER_FUTURE_FLAGS}
        initialEntries={['/checkin?targetId=com.instagram.android&targetType=app&targetLabel=Instagram&overlaySessionId=session-checkin']}
      >
        <Routes>
          <Route path="/checkin" element={<CheckinPage />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByPlaceholderText(/social media/i), {
      target: { value: 'Instagram checken' },
    });
    fireEvent.click(screen.getByRole('button', { name: /weiter/i }));
    await screen.findByText(/warum/i);

    fireEvent.change(screen.getByPlaceholderText(/grund/i), {
      target: { value: 'Ich suche Ablenkung' },
    });
    fireEvent.click(screen.getByRole('button', { name: /weiter/i }));
    await screen.findByRole('heading', { name: /wie f(?:ü|ue|Ã¼)hlst du dich/i });

    fireEvent.click(screen.getByRole('button', { name: /erleichtert/i }));
    fireEvent.click(screen.getByRole('button', { name: /weiter zur app/i }));

    await waitFor(() => {
      expect(dismissOnceMock).toHaveBeenCalledTimes(1);
      expect(openTargetMock).toHaveBeenCalledWith('com.instagram.android', 'app');
    });
    expect(warnSpy).toHaveBeenCalledWith('Blocking overlay dismiss failed:', expect.any(Error));
  }, 20000);
});
