import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BreathingScene, getContinuousOrbitRotation } from '@/components/breathing/BreathingScene';

describe('BreathingScene', () => {
  it('uses the selected tone and reduced-motion override in the unified scene', () => {
    render(
      <BreathingScene
        phase="inhale"
        progress={0.5}
        duration={4}
        isActive
        tone="strict"
        reducedMotion
      />,
    );

    const scene = screen.getByTestId('breathing-scene');

    expect(scene).toHaveAttribute('data-tone', 'strict');
    expect(scene).toHaveAttribute('data-phase', 'inhale');
  });

  it('keeps reflection tone independent from the runtime platform', () => {
    render(
      <BreathingScene
        phase="exhale"
        progress={0.5}
        duration={4}
        isActive
        tone="reflection"
      />,
    );

    const scene = screen.getByTestId('breathing-scene');

    expect(scene).toHaveAttribute('data-tone', 'reflection');
  });

  it('keeps the orbit moving forward when a breathing phase restarts its progress', () => {
    const justBeforePhaseChange = getContinuousOrbitRotation(0, 0.75);
    const startOfNextPhase = getContinuousOrbitRotation(1, 0);

    expect(startOfNextPhase).toBeGreaterThan(justBeforePhaseChange);
    expect(startOfNextPhase - justBeforePhaseChange).toBe(90);
  });
});
