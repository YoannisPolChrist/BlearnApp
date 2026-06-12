import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { ROUTER_FUTURE_FLAGS } from '@/lib/routerFuture';
import WalletPage from '@/pages/Wallet';
import { useAppStore } from '@/store/useAppStore';

vi.mock('@/components/PageTransition', () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/brand/BrandMark', () => ({
  BrandLockup: () => null,
}));

vi.mock('@/components/wallet/AlbyConnectionConfig', () => ({
  default: () => null,
}));

vi.mock('@/components/wallet/PenaltyConfig', () => ({
  default: () => null,
}));

vi.mock('@/components/wallet/RecipientConfig', () => ({
  default: () => null,
}));

vi.mock('@/components/wallet/TransactionHistory', () => ({
  default: () => null,
}));

vi.mock('@/components/wallet/WalletBalance', () => ({
  default: () => null,
}));

vi.mock('@/lib/view-models/wallet', async () => {
  const actual = await vi.importActual<typeof import('@/lib/view-models/wallet')>('@/lib/view-models/wallet');

  return {
    ...actual,
    formatSats: (value: number) => `${value} sats`,
    getWalletStatus: () => ({
      albyReady: false,
      recipientVerified: false,
      connectionTestPassed: false,
      penaltyAmountConfigured: false,
      penaltyReady: false,
      statusTitle: '',
      statusDescription: '',
      walletTitle: '',
      walletDescription: '',
      recipientTitle: '',
      recipientDescription: '',
    }),
  };
});

function resetStore() {
  window.localStorage.clear();
  useAppStore.setState(useAppStore.getInitialState(), true);
}

function renderWalletPage(entry = '/wallet') {
  return render(
    <MemoryRouter future={ROUTER_FUTURE_FLAGS} initialEntries={[entry]}>
      <WalletPage />
      <LocationProbe />
    </MemoryRouter>,
  );
}

function LocationProbe() {
  const location = useLocation();

  return <div data-testid="location-probe">{location.pathname}</div>;
}

async function waitForSetupGuideDialog() {
  await waitFor(() => {
    expect(screen.getByRole('dialog', { name: /strafkonto sicher einrichten/i })).toBeInTheDocument();
  }, { timeout: 5000 });

  return screen.getByRole('dialog', { name: /strafkonto sicher einrichten/i });
}

describe('Wallet setup guide', () => {
  beforeEach(() => {
    resetStore();
  });

  afterEach(() => {
    cleanup();
    resetStore();
    vi.clearAllMocks();
  });

  it('stays dismissed after closing the guide with X', async () => {
    const view = renderWalletPage();

    const dialog = await waitForSetupGuideDialog();
    expect(dialog).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /dialog schlie/i }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /strafkonto sicher einrichten/i })).not.toBeInTheDocument();
    }, { timeout: 5000 });

    view.unmount();
    renderWalletPage();

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /strafkonto sicher einrichten/i })).not.toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('allows closing the penalty setup guide with X and returns to the requested route', async () => {
    renderWalletPage('/wallet?setup=penalty&return=/modes');

    expect(await waitForSetupGuideDialog()).toBeInTheDocument();

    const closeButton = screen.getByRole('button', { name: /dialog schlie/i });
    expect(closeButton).not.toBeDisabled();

    fireEvent.click(closeButton);

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /strafkonto sicher einrichten/i })).not.toBeInTheDocument();
      expect(screen.getByTestId('location-probe')).toHaveTextContent('/modes');
    }, { timeout: 5000 });
  });
});
