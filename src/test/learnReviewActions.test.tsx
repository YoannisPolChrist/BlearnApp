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
});
