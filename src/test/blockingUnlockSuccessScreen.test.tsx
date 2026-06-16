import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BlockingUnlockSuccessScreen } from '@/components/blocking/BlockingUnlockSuccessScreen';

const installedAppsServiceMock = vi.hoisted(() => ({
  getInstalledApps: vi.fn(),
}));

vi.mock('@/services/screenTimeInstalledApps', () => ({
  getInstalledApps: installedAppsServiceMock.getInstalledApps,
}));

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

  it('does not load installed app icons on the latency-critical success screen', () => {
    render(
      <BlockingUnlockSuccessScreen
        onContinue={vi.fn()}
        targetId="com.google.android.youtube"
        targetLabel="YouTube"
        targetType="app"
        tone="learn"
        unlockDurationMinutes={5}
      />,
    );

    expect(screen.getByRole('button', { name: 'App freischalten' })).toBeInTheDocument();
    expect(installedAppsServiceMock.getInstalledApps).not.toHaveBeenCalled();
  });
});
