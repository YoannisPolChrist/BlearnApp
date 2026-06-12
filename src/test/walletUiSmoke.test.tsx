import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ROUTER_FUTURE_FLAGS } from '@/lib/routerFuture';
import LearnTemplatesPage from '@/pages/LearnTemplates';
import AlbyConnectionConfig from '@/components/wallet/AlbyConnectionConfig';
import PenaltyConfig from '@/components/wallet/PenaltyConfig';
import RecipientConfig from '@/components/wallet/RecipientConfig';
import WalletBalance from '@/components/wallet/WalletBalance';
import { SuccessFeedbackHost } from '@/components/ui/SuccessFeedbackHost';
import { getFeaturedDeckTemplates } from '@/lib/learning';
import { useAppStore } from '@/store/useAppStore';
import { useLearningStore } from '@/store/useLearningStore';
import * as albyWalletService from '@/services/albyWalletService';

vi.mock('@/services/albyWalletService', async () => {
  const actual =
    await vi.importActual<typeof import('@/services/albyWalletService')>(
      '@/services/albyWalletService',
    );
  return {
    ...actual,
    verifyLightningAddress: vi.fn(),
  };
});

const verifyLightningAddressMock = vi.mocked(albyWalletService.verifyLightningAddress);

const validConnectionUri =
  'nostr+walletconnect://pubkey123?relay=wss%3A%2F%2Frelay.getalby.com%2Fv1&secret=secret123';

function resetStores() {
  window.localStorage.clear();
  useAppStore.setState(useAppStore.getInitialState(), true);
  useLearningStore.setState(useLearningStore.getInitialState(), true);
}

describe('wallet and learn template UI smoke', () => {
  beforeEach(() => {
    resetStores();
    verifyLightningAddressMock.mockReset();
  });

  it('imports a learn template from the page and shows the success feedback', async () => {
    const template = getFeaturedDeckTemplates()[0];

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        notes: [
          {
            deck: template.deckNames[0],
            front: 'bonjour',
            back: 'hallo',
            type: 'basic',
            language: template.language,
          },
        ],
      }),
    } as Response);

    render(
      <MemoryRouter future={ROUTER_FUTURE_FLAGS}>
        <SuccessFeedbackHost />
        <LearnTemplatesPage />
      </MemoryRouter>,
    );

    fireEvent.click((await screen.findAllByRole('button', { name: /jetzt hinzuf/i }))[0]);

    expect(
      await screen.findByText(/template hinzugefügt|template hinzugefÃ¼gt/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        new RegExp(
          `${template.title} importiert`,
          'i',
        ),
      ),
    ).toBeInTheDocument();
  }, 10000);

  it('saves the alby connection and shows the save feedback', async () => {
    render(
      <>
        <SuccessFeedbackHost />
        <AlbyConnectionConfig variants={{}} />
      </>,
    );

    fireEvent.change(screen.getByPlaceholderText(/nostr\+walletconnect/i), {
      target: { value: validConnectionUri },
    });
    fireEvent.click(screen.getByRole('button', { name: /alby go verbindung speichern/i }));

    expect(await screen.findByText(/wallet gespeichert/i)).toBeInTheDocument();
  });

  it('verifies and saves the recipient and shows the success feedback', async () => {
    verifyLightningAddressMock.mockResolvedValue({
      status: 'verified',
      normalizedValue: 'alex@getalby.com',
      reason: undefined,
    });

    render(
      <>
        <SuccessFeedbackHost />
        <RecipientConfig variants={{}} />
      </>,
    );

    fireEvent.change(screen.getByPlaceholderText(/max mustermann/i), {
      target: { value: 'Alex' },
    });
    fireEvent.change(screen.getByPlaceholderText(/partner@getalby\.com/i), {
      target: { value: 'alex@getalby.com' },
    });
    fireEvent.click(
      screen.getByRole('button', {
        name: /verifizieren/i,
      }),
    );

    expect(await screen.findByText(/adresse verifiziert/i)).toBeInTheDocument();
  });

  it('runs the wallet live test and shows the test feedback', async () => {
    const testConnectionMock = vi.fn().mockResolvedValue({
      status: 'passed',
      testedAt: Date.now(),
      walletAlias: 'Smoke Wallet',
      balanceSats: 1200,
      budgetTotalSats: 5000,
      budgetUsedSats: 400,
      budgetRemainingSats: 4600,
      budgetRenewsAt: null,
      budgetRenewal: 'weekly',
      lastError: undefined,
    });

    useAppStore.setState({
      albyConnection: {
        walletLabel: 'Smoke Wallet',
        nwcConnectionUri: validConnectionUri,
        budgetSats: 5000,
        budgetRenewal: 'weekly',
      },
      albyConnectionTest: { status: 'idle' },
      testAlbyConnection: testConnectionMock,
    });

    render(
      <>
        <SuccessFeedbackHost />
        <WalletBalance variants={{}} />
      </>,
    );

    fireEvent.click(screen.getByRole('button', { name: /verbindung testen/i }));

    expect(await screen.findByText(/live-test bestanden/i)).toBeInTheDocument();
    expect(testConnectionMock).toHaveBeenCalledTimes(1);
  });

  it('shows sat and euro approximations in the penalty and balance cards', () => {
    useAppStore.setState({
      albyConnection: {
        walletLabel: 'Smoke Wallet',
        nwcConnectionUri: validConnectionUri,
        budgetSats: 5000,
        budgetRenewal: 'weekly',
      },
      albyConnectionTest: {
        status: 'passed',
        testedAt: Date.now(),
        walletAlias: 'Smoke Wallet',
        balanceSats: 1200,
        budgetTotalSats: 5000,
        budgetUsedSats: 400,
        budgetRemainingSats: 4600,
        budgetRenewsAt: null,
        budgetRenewal: 'weekly',
      },
      accountabilityPartner: {
        name: 'Alex',
        lightningAddress: 'alex@getalby.com',
        normalizedLightningAddress: 'alex@getalby.com',
        validationStatus: 'verified',
        notifyOnPenalty: true,
      },
      penaltyAmountSats: 500,
      penaltyEnabled: false,
    });

    render(
      <>
        <PenaltyConfig variants={{}} />
        <WalletBalance variants={{}} />
      </>,
    );

    expect(
      screen.getAllByText((_, element) => (element?.children.length ?? 0) === 0 && (element?.textContent?.includes('ca. 0,50') ?? false)),
    ).toHaveLength(2);
    expect(
      screen.getAllByText((_, element) => (element?.children.length ?? 0) === 0 && (element?.textContent?.includes('ca. 1,20') ?? false)),
    ).toHaveLength(1);
    expect(
      screen.getAllByText((_, element) => (element?.children.length ?? 0) === 0 && (element?.textContent?.includes('ca. 4,60') ?? false)),
    ).toHaveLength(1);
    expect(
      screen.getAllByText((_, element) => (element?.children.length ?? 0) === 0 && (element?.textContent?.includes('ca. 0,10') ?? false)),
    ).toHaveLength(1);
  });
});
