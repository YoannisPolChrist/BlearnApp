import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ROUTER_FUTURE_FLAGS } from '@/lib/routerFuture';
import BottomNav from '@/components/BottomNav';

vi.mock('@/hooks/useI18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

describe('BottomNav', () => {
  it('stays hidden on blocking routes', () => {
    const { container } = render(
      <MemoryRouter future={ROUTER_FUTURE_FLAGS} initialEntries={['/intervention?overlaySessionId=session-1']}>
        <BottomNav />
      </MemoryRouter>,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('renders on primary app routes and marks nested learn pages as active', () => {
    render(
      <MemoryRouter future={ROUTER_FUTURE_FLAGS} initialEntries={['/learn/templates']}>
        <BottomNav />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('bottom-nav-shell')).toHaveClass('bottom-nav-shell');
    expect(screen.getByText('nav.focus')).toBeInTheDocument();
    expect(screen.getByText('nav.modes')).toBeInTheDocument();
    const learnButton = screen.getByRole('button', { name: 'nav.learn' });
    expect(learnButton).toHaveAttribute('aria-current', 'page');
    expect(learnButton.className).toMatch(/bg-primary\/10/);
    expect(screen.getByText('nav.stats')).toBeInTheDocument();
    expect(screen.getByText('nav.settings')).toBeInTheDocument();
  });
});
