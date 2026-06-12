import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LearnPage from '@/pages/Learn';
import { ROUTER_FUTURE_FLAGS } from '@/lib/routerFuture';
import { useLearningStore } from '@/store/useLearningStore';

function resetLearningStore() {
  window.localStorage.clear();
  useLearningStore.setState(useLearningStore.getInitialState(), true);
  useLearningStore.getState().seedStarterDeck();
}

describe('Learn page', () => {
  beforeEach(() => {
    resetLearningStore();
  });

  it('uses the simplified learn hub copy and removes extra cards', async () => {
    render(
      <MemoryRouter future={ROUTER_FUTURE_FLAGS} initialEntries={['/learn']}>
        <LearnPage />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Learn Mode' })).toBeInTheDocument();
    expect(screen.getByText('Vokabeln Verwalten')).toBeInTheDocument();
    expect(screen.getByText(/Bibliothek, Templates und Cloud-Sync/i)).toBeInTheDocument();
    expect(screen.getByText('Jetzt Vokabeln lernen')).toBeInTheDocument();
    expect(screen.getByText(/^Templates$/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sync/i })).toBeInTheDocument();
    expect(screen.queryByText('Temporaere Lernstapel')).not.toBeInTheDocument();
    expect(screen.queryByText(/^Starter$/)).not.toBeInTheDocument();
    expect(screen.queryByText('Starter Vokabeln')).not.toBeInTheDocument();
  });
});
