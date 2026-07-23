import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LearnReviewActions } from '@/components/learn-review/LearnReviewActions';
import { tonePalettes } from '@/lib/semanticTones';

describe('LearnReviewActions', () => {
  it('keeps the blocked typed-answer flow to one stacked reveal action', () => {
    render(
      <LearnReviewActions
        attemptMessage={null}
        canUndo={false}
        intervalPreviews={null}
        onCheckTypedAnswer={() => undefined}
        onRevealAnswer={() => undefined}
        onReview={() => undefined}
        onTypedAnswerChange={() => undefined}
        onUndoReview={() => undefined}
        reduceInterfaceMotion
        requiresTypedAnswer
        isBlockedFlow
        revealed={false}
        typedAnswer=""
        typedCorrect={null}
      />,
    );

    const typedAnswerInput = screen.getByPlaceholderText('Antwort eingeben');
    expect(typedAnswerInput.className).toContain('h-14');
    expect(typedAnswerInput).not.toHaveAttribute('maxLength');
    expect(screen.getByRole('button', { name: 'Lösung zeigen' }).className).toContain('w-full');
    expect(screen.queryByRole('button', { name: 'Antwort prüfen' })).not.toBeInTheDocument();
  });

  it('renders partial typed-answer feedback with the warning palette even when the answer counts as correct', () => {
    render(
      <LearnReviewActions
        attemptMessage="Das war fast richtig."
        canUndo
        intervalPreviews={null}
        onCheckTypedAnswer={() => undefined}
        onRevealAnswer={() => undefined}
        onReview={() => undefined}
        onTypedAnswerChange={() => undefined}
        onUndoReview={() => undefined}
        reduceInterfaceMotion
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

  it('keeps every rating available after an unrecognized typed answer', () => {
    render(
      <LearnReviewActions
        attemptMessage="Falsch."
        canUndo={false}
        intervalPreviews={{ again: '10m', hard: '10m', good: '10m', easy: '10m' }}
        onCheckTypedAnswer={() => undefined}
        onRevealAnswer={() => undefined}
        onReview={() => undefined}
        onTypedAnswerChange={() => undefined}
        onUndoReview={() => undefined}
        reduceInterfaceMotion
        requiresTypedAnswer
        revealed
        typedAnswer="incorrect"
        typedAnswerMatchKind="incorrect"
        typedCorrect={false}
      />,
    );

    for (const rating of ['again', 'hard', 'good', 'easy']) {
      expect(screen.getByRole('button', { name: new RegExp(rating, 'i') })).not.toHaveAttribute('aria-disabled');
    }
    expect(screen.queryByText(/Nur Nochmal möglich/)).not.toBeInTheDocument();
  });
});
