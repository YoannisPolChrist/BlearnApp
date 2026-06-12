import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LearnReviewStage } from '@/components/learn-review/LearnReviewStage';

describe('LearnReviewStage', () => {
  it('keeps templated front cards in the HTML/template presentation while hidden', () => {
    const { container } = render(
      <LearnReviewStage
        attemptMessage={null}
        answerIsLong={false}
        cardAnswer="house"
        cardAnswerHtml="<div>house</div>"
        cardPrompt="bonjour"
        cardPromptHtml="<span class='accent'>bonjour</span>"
        cardTemplateClass="card card1"
        cardTemplateCss=".card { text-align: left; } .accent { color: rgb(255, 0, 0); }"
        currentCardId="templated-card"
        hasRichTemplateHtml
        mediaAltBack=""
        mediaAltFront=""
        promptIsLong={false}
        reduceInterfaceMotion
        revealed={false}
        requiresTypedAnswer={false}
        typedAnswerMatchKind={null}
        typedCorrect={null}
      />,
    );

    expect(screen.getByText('bonjour')).toBeInTheDocument();

    const scopeRoot = container.querySelector('[data-anki-scope="templated-card-front"]');
    expect(scopeRoot).not.toBeNull();
    expect(scopeRoot?.className).toContain('w-full');
    expect(scopeRoot?.className).not.toContain('font-black');

    const stageLayout = scopeRoot?.parentElement;
    expect(stageLayout?.className).toContain('items-stretch');
    expect(stageLayout?.className).toContain('text-left');
  });

  it('shows wrong typed-answer feedback on the front side', () => {
    render(
      <LearnReviewStage
        attemptMessage="Falsch. 2 Versuche uebrig"
        answerIsLong={false}
        cardAnswer="house"
        cardAnswerHtml="house"
        cardPrompt="bonjour"
        cardPromptHtml="bonjour"
        currentCardId="front-feedback-card"
        hasRichTemplateHtml={false}
        mediaAltBack=""
        mediaAltFront=""
        promptIsLong={false}
        reduceInterfaceMotion
        revealed={false}
        requiresTypedAnswer
        submittedTypedAnswer="wrong"
        typedAnswerMatchKind="incorrect"
        typedCorrect={false}
      />,
    );

    expect(screen.getByText('Falsch. 2 Versuche uebrig')).toBeInTheDocument();
  });

  it('shows almost-right feedback on the back side', () => {
    render(
      <LearnReviewStage
        attemptMessage="Das war fast richtig."
        answerIsLong={false}
        cardAnswer="Haustuer"
        cardAnswerHtml="Haustuer"
        cardPrompt="door"
        cardPromptHtml="door"
        currentCardId="back-feedback-card"
        hasRichTemplateHtml={false}
        mediaAltBack=""
        mediaAltFront=""
        promptIsLong={false}
        reduceInterfaceMotion
        revealed
        requiresTypedAnswer
        submittedTypedAnswer="haus"
        typedAnswerMatchKind="partial"
        typedCorrect={true}
      />,
    );

    expect(screen.getByText('Das war fast richtig.')).toBeInTheDocument();
    expect(screen.getByText('Deine Eingabe: haus')).toBeInTheDocument();
  });
});
