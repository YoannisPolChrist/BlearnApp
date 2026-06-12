import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BreathingScene } from '@/components/breathing/BreathingScene';

vi.mock('@/components/BreathingSphere3D', () => ({
  __esModule: true,
  default: ({
    tone,
    reducedMotion,
  }: {
    tone: 'breathing' | 'reflection' | 'strict';
    reducedMotion?: boolean;
  }) => (
    <div
      data-testid="breathing-sphere"
      data-tone={tone}
      data-reduced-motion={String(Boolean(reducedMotion))}
    />
  ),
}));

describe('BreathingScene', () => {
  it('forwards the selected tone and reduced-motion override to the sphere', async () => {
    render(
      <BreathingScene
        phase="inhale"
        duration={4}
        isActive
        tone="strict"
        reducedMotion
      />,
    );

    const sphere = await screen.findByTestId('breathing-sphere');

    expect(sphere).toHaveAttribute('data-tone', 'strict');
    expect(sphere).toHaveAttribute('data-reduced-motion', 'true');
  });

  it('forwards reflection tone to the sphere on non-Android platforms', async () => {
    render(
      <BreathingScene
        phase="exhale"
        duration={4}
        isActive
        tone="reflection"
      />,
    );

    const sphere = await screen.findByTestId('breathing-sphere');

    expect(sphere).toHaveAttribute('data-tone', 'reflection');
  });
});
