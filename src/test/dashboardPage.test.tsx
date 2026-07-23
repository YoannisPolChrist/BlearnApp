import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ROUTER_FUTURE_FLAGS } from '@/lib/routerFuture';
import IndexPage from '@/pages/Index';
import * as screenTimeService from '@/services/screenTimeService';
import { useAppStore } from '@/store/useAppStore';
import { useLearningStore } from '@/store/useLearningStore';
import { useModeDraftStore } from '@/store/useModeDraftStore';

vi.mock('@/components/ThemeToggle', () => ({
  default: () => <div data-testid="theme-toggle" />,
}));

vi.mock('@/services/screenTimeService', async () => {
  const actual = await vi.importActual<typeof import('@/services/screenTimeService')>('@/services/screenTimeService');

  return {
    ...actual,
    getTodayUsage: vi.fn().mockResolvedValue({
      totalScreenTimeMs: 72 * 60 * 1000,
      entries: [],
    }),
    formatScreenTime: vi.fn().mockReturnValue('1h 12m'),
    getInstalledApps: vi.fn().mockResolvedValue([
      {
        appId: 'com.google.android.youtube',
        label: 'YouTube',
        packageName: 'com.google.android.youtube',
        appName: 'YouTube',
      },
      {
        appId: 'com.instagram.android',
        label: 'Instagram',
        packageName: 'com.instagram.android',
        appName: 'Instagram',
      },
    ]),
    isNative: false,
  };
});

function resetStores() {
  window.localStorage.clear();
  useAppStore.setState(useAppStore.getInitialState(), true);
  useLearningStore.setState(useLearningStore.getInitialState(), true);
  useModeDraftStore.setState(useModeDraftStore.getInitialState(), true);
}

function renderDashboard() {
  render(
    <MemoryRouter future={ROUTER_FUTURE_FLAGS}>
      <IndexPage />
    </MemoryRouter>,
  );
}

describe('dashboard page', () => {
  beforeEach(() => {
    resetStores();
    useAppStore.setState({
      blockedApps: ['com.google.android.youtube', 'com.instagram.android'],
      blockedAppModes: {
        'com.google.android.youtube': 'strict',
        'com.instagram.android': 'learn',
      },
      blockedWebsites: ['youtube.com'],
      blockedWebsiteModes: {
        'youtube.com': 'strict',
      },
      blockedSearchTerms: ['reddit'],
      blockedSearchTermModes: {
        reddit: 'penalty',
      },
    });
  });

  it('shows the simplified dashboard copy without a duplicate blocked-app card', async () => {
    renderDashboard();

    expect(await screen.findByText('1h 12m', {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByText('Bildschirmzeit')).toBeInTheDocument();
    expect(screen.queryByText('Aus Reflex wird eine bewusste Entscheidung.')).not.toBeInTheDocument();
    expect(screen.queryByText('Vokabeln lernen')).not.toBeInTheDocument();
    expect(screen.getAllByText('Modi anpassen').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Hier steuerst du deine Blocklisten.').length).toBeGreaterThan(0);
    expect(screen.queryByText('Heute im Fokus')).not.toBeInTheDocument();
    expect(screen.queryByText('Blockierte Ziele')).not.toBeInTheDocument();
    expect(screenTimeService.getInstalledApps).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /blockierte apps/i })).not.toBeInTheDocument();
  });
});
