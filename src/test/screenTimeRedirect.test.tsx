import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ROUTER_FUTURE_FLAGS } from '@/lib/routerFuture';
import ScreenTimePage from '@/pages/ScreenTime';

describe('ScreenTime redirect', () => {
  it('redirects /screentime to /stats', async () => {
    render(
      <MemoryRouter future={ROUTER_FUTURE_FLAGS} initialEntries={['/screentime']}>
        <Routes>
          <Route path="/screentime" element={<ScreenTimePage />} />
          <Route path="/stats" element={<div>stats-target</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('stats-target')).toBeInTheDocument();
  });
});
