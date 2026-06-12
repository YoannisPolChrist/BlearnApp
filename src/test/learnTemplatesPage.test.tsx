import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import LearnTemplatesPage from '@/pages/LearnTemplates';
import { ROUTER_FUTURE_FLAGS } from '@/lib/routerFuture';
import { useLearningStore } from '@/store/useLearningStore';

function resetLearningStore() {
  window.localStorage.clear();
  useLearningStore.setState(useLearningStore.getInitialState(), true);
  useLearningStore.getState().seedStarterDeck();
}

describe('Learn templates page', () => {
  beforeEach(() => {
    resetLearningStore();
  });

  it('renders the templates route inside the shared page shell', () => {
    const { container } = render(
      <MemoryRouter future={ROUTER_FUTURE_FLAGS} initialEntries={['/learn/templates']}>
        <Routes>
          <Route path="/learn/templates" element={<LearnTemplatesPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(container.querySelector('.app-page')).not.toBeNull();
    expect(screen.getByText(/template dashboard/i)).toBeInTheDocument();
  });
});
