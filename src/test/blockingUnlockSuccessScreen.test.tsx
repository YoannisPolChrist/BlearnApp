import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BlockingUnlockSuccessScreen } from '@/components/blocking/BlockingUnlockSuccessScreen';

describe('BlockingUnlockSuccessScreen', () => {
  it('renders the simple unlock layout with target, duration, and shared button copy', () => {
    const onContinue = vi.fn();

    render(
      <BlockingUnlockSuccessScreen
        onContinue={onContinue}
        targetId="youtube.com"
        targetLabel="YouTube"
        targetType="website"
        tone="strict"
        unlockDurationMinutes={12}
      />,
    );

    expect(screen.getByText('YouTube')).toBeInTheDocument();
    expect(screen.getByText('12 Min frei')).toBeInTheDocument();

    const button = screen.getByRole('button', { name: 'App freischalten' });
    fireEvent.click(button);

    expect(onContinue).toHaveBeenCalledTimes(1);
  });
});
