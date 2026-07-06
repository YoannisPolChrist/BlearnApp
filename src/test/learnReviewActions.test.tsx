import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LearnReviewActions } from '@/components/learn-review/LearnReviewActions';
import { tonePalettes } from '@/lib/semanticTones';

describe('LearnReviewActions', () => {
  it('renders partial typed-answer feedback with the warning palette even when the answer counts as correct', () => {
    render(
      <LearnReviewActions
        attemptMessage="Das war fast richtig."
        blockedEasyHintVisible={false}
        blockedEasyPulseKey={0}
        easyRatingBlocked={false}
        canUndo
        intervalPreviews={null}
        onCheckTypedAnswer={() => undefined}
        onRevealAnswer={() => undefined}
        onReview={() => undefined}
        onTypedAnswerChange={() => undefined}
        onUndoReview={() => undefined}
        reduceInterfaceMotion
        remainingAttempts={2}
        requiresTypedAnswer
        revealed={false}
        typedAnswer="Freu"
        typedAnswerMatchKind="partial"
        typedCorrect
      />,
    );

    const attemptBadge = screen.getByText('Das war fast richtig.');
    expect(attemptBadge.className).toContain(tonePalettes.warning.badge);
    expect(attemptBadge.className).not.toContain(tonePalettes.success.badge);
  });

  it('disables Schwer, Good, and Easy and shows correct feedback when hardRatingBlocked is true', () => {
    render(
      <LearnReviewActions
        attemptMessage="Falsch."
        blockedEasyHintVisible={true}
        blockedEasyPulseKey={0}
        easyRatingBlocked={true}
        hardRatingBlocked={true}
        canUndo={false}
        intervalPreviews={{ again: '10m', hard: '10m', good: '10m', easy: '10m' }}
        onCheckTypedAnswer={() => undefined}
        onRevealAnswer={() => undefined}
        onReview={() => undefined}
        onTypedAnswerChange={() => undefined}
        onUndoReview={() => undefined}
        reduceInterfaceMotion
        remainingAttempts={0}
        requiresTypedAnswer
        revealed
        typedAnswer="incorrect"
        typedAnswerMatchKind="incorrect"
        typedCorrect={false}
      />,
    );

    expect(screen.getByRole('button', { name: /again/i })).not.toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('button', { name: /hard/i })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('button', { name: /good/i })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('button', { name: /easy/i })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText('Nur Nochmal möglich.')).toBeInTheDocument();
  });

  it('disables only Good and Easy and shows correct feedback when easyRatingBlocked is true but hardRatingBlocked is false', () => {
    render(
      <LearnReviewActions
        attemptMessage="Das war fast richtig."
        blockedEasyHintVisible={true}
        blockedEasyPulseKey={0}
        easyRatingBlocked={true}
        hardRatingBlocked={false}
        canUndo={false}
        intervalPreviews={{ again: '10m', hard: '1d', good: '4d', easy: '8d' }}
        onCheckTypedAnswer={() => undefined}
        onRevealAnswer={() => undefined}
        onReview={() => undefined}
        onTypedAnswerChange={() => undefined}
        onUndoReview={() => undefined}
        reduceInterfaceMotion
        remainingAttempts={2}
        requiresTypedAnswer
        revealed
        typedAnswer="Freu"
        typedAnswerMatchKind="partial"
        typedCorrect
      />,
    );

    expect(screen.getByRole('button', { name: /again/i })).not.toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('button', { name: /hard/i })).not.toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('button', { name: /good/i })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('button', { name: /easy/i })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText('Nur Nochmal oder Schwer möglich.')).toBeInTheDocument();
  });
});
