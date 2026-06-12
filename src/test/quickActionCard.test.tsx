import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type { HTMLAttributes, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { QuickActionCard } from '@/components/ui/QuickActionCard';

vi.mock('@/components/GlassCard', () => ({
  default: ({ children, interactive, tilt, accentGlow, motionPreset, ...props }: HTMLAttributes<HTMLDivElement> & {
    children: ReactNode;
    interactive?: boolean;
    tilt?: boolean;
    accentGlow?: boolean;
    motionPreset?: string;
  }) => (
    <div data-testid="glass-card" {...props}>
      {children}
    </div>
  ),
}));

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => false,
}));

describe('QuickActionCard', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exposes keyboard semantics for activation', () => {
    const onClick = vi.fn();
    const DummyIcon = (() => null) as unknown as LucideIcon;

    render(
      <QuickActionCard
        icon={DummyIcon}
        title="Schnellaktion"
        description="Direkt starten"
        onClick={onClick}
      />,
    );

    const card = screen.getByTestId('glass-card');
    expect(card).toHaveAttribute('role', 'button');
    expect(card).toHaveAttribute('tabindex', '0');

    fireEvent.keyDown(card, { key: 'Enter' });
    fireEvent.keyDown(card, { key: ' ' });

    expect(onClick).toHaveBeenCalledTimes(2);
  });
});
