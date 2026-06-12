import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { HTMLAttributes, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { MetricCard } from '@/components/ui/MetricCard';

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

describe('MetricCard', () => {
  it('behaves like a keyboard-activatable control when clickable', () => {
    const onClick = vi.fn();
    const DummyIcon = (() => null) as unknown as LucideIcon;

    render(
      <MetricCard
        icon={DummyIcon}
        label="Fortschritt"
        value="12"
        hint="Heute"
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
