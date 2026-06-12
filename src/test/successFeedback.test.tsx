import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SuccessFeedbackHost } from '@/components/ui/SuccessFeedbackHost';
import { showSuccessFeedback } from '@/lib/successFeedback';

describe('SuccessFeedbackHost', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('renders a success payload and calls onDone after the animation window', async () => {
    const onDone = vi.fn();

    render(<SuccessFeedbackHost />);

    act(() => {
      showSuccessFeedback({
        title: 'Gespeichert',
        description: 'Deine Änderungen sind aktiv.',
        detail: 'Wallet aktualisiert',
        durationMs: 120,
        onDone,
      });
    });

    expect(screen.getByText('Gespeichert')).toBeInTheDocument();
    expect(screen.getByText('Deine Änderungen sind aktiv.')).toBeInTheDocument();
    expect(screen.getByText('Wallet aktualisiert')).toBeInTheDocument();
    expect(screen.getByTestId('success-feedback-host')).toHaveAttribute('data-feedback-layout', 'compact');
    expect(screen.getByText('Gespeichert').closest('[data-feedback-variant="compact"]')).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(320);
    });

    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('replaces the currently visible success payload when a new one is dispatched', async () => {
    render(<SuccessFeedbackHost />);

    act(() => {
      showSuccessFeedback({
        title: 'Erster Erfolg',
        durationMs: 500,
      });
    });

    expect(screen.getByText('Erster Erfolg')).toBeInTheDocument();

    act(() => {
      showSuccessFeedback({
        title: 'Zweiter Erfolg',
        durationMs: 500,
      });
    });

    expect(screen.getByText('Zweiter Erfolg')).toBeInTheDocument();
    expect(screen.queryByText('Erster Erfolg')).not.toBeInTheDocument();
    expect(screen.getAllByRole('status')).toHaveLength(1);
  });
});
