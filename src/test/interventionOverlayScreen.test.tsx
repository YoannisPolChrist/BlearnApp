import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import InterventionOverlayScreen from '@/components/InterventionOverlayScreen';

describe('InterventionOverlayScreen', () => {
  it('keeps the overlay compact while preserving the primary actions', () => {
    const onPrimaryAction = vi.fn();
    const onClose = vi.fn();

    render(
      <InterventionOverlayScreen
        open
        blockedTarget="YouTube"
        blockType="website"
        mode="learn"
        unlockDurationMinutes={12}
        onPrimaryAction={onPrimaryAction}
        onClose={onClose}
      />,
    );

    expect(screen.getByText('Learn vor Freigabe')).toBeInTheDocument();
    expect(screen.getByText('YouTube')).toBeInTheDocument();
    expect(screen.getByText('Website blockiert')).toBeInTheDocument();
    expect(screen.getAllByText('12 Min frei')).toHaveLength(1);
    expect(screen.queryByText('Learn-Bereich')).not.toBeInTheDocument();
    expect(screen.queryByText('Freigabe fuer')).not.toBeInTheDocument();
    expect(screen.queryByText(/Danach bleibt der Zugriff/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Learn starten' }));
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));

    expect(onPrimaryAction).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps legacy strict entry screens on the reflection tone and CTA copy', () => {
    render(
      <InterventionOverlayScreen
        open
        blockedTarget="Instagram"
        blockType="app"
        mode="strict"
        unlockDurationMinutes={8}
        onPrimaryAction={vi.fn()}
      />,
    );

    expect(screen.getByText('Reflexion vor Freigabe')).toBeInTheDocument();
    expect(screen.getByText('Reflexion starten')).toBeInTheDocument();
    expect(screen.getByTestId('intervention-root')).toHaveAttribute('data-intervention-tone', 'reflection');
  });

  it('keeps lock entry screens on the violet strict tone', () => {
    render(
      <InterventionOverlayScreen
        open
        blockedTarget="Instagram"
        blockType="app"
        mode="lock"
        onPrimaryAction={vi.fn()}
      />,
    );

    expect(screen.getByText('App bleibt blockiert')).toBeInTheDocument();
    expect(screen.getByTestId('intervention-root')).toHaveAttribute('data-intervention-tone', 'strict');
  });
});
