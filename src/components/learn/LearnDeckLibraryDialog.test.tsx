import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import LearnDeckLibraryDialog from './LearnDeckLibraryDialog';

describe('LearnDeckLibraryDialog', () => {
  it('shows learned progress and the intended language flags for Jean-Paul decks', () => {
    render(
      <LearnDeckLibraryDialog
        open
        onOpenChange={vi.fn()}
        activeDeckId="french"
        onSelectDeck={vi.fn()}
        decks={[{
          id: 'french',
          name: 'Jean Paul',
          description: 'French vocabulary',
          language: 'de',
          sourceTemplateId: 'jean-paul',
          totalCards: 5000,
          neverLearnedCount: 731,
          reviewsThisWeek: 24,
          activeDaysThisWeek: 4,
          reviewedDaysThisWeek: [true, true, false, true, true, false, false],
          dueNowCount: 18,
          dueCount: 18,
          overdueCount: 2,
          newLeftToday: 10,
          reviewsLeftToday: 100,
          desiredRetention: 0.9,
          optimizerStatus: 'collecting',
          reviewsBetweenNewCards: 15,
          reviewMixLabel: '1:15',
        }, {
          id: 'spanish',
          name: 'Jean Paul Spanisch',
          description: 'Spanish vocabulary',
          language: 'de',
          sourceTemplateId: 'jean-paul-spanish',
          totalCards: 3251,
          neverLearnedCount: 3251,
          reviewsThisWeek: 0,
          activeDaysThisWeek: 0,
          reviewedDaysThisWeek: [false, false, false, false, false, false, false],
          dueNowCount: 0,
          dueCount: 0,
          overdueCount: 0,
          newLeftToday: 20,
          reviewsLeftToday: 200,
          desiredRetention: 0.9,
          optimizerStatus: 'collecting',
          reviewsBetweenNewCards: 15,
          reviewMixLabel: '1:15',
        }]}
      />,
    );

    expect(screen.getAllByText('Nie gelernt')).toHaveLength(2);
    expect(screen.getByText('731')).toBeInTheDocument();
    expect(screen.getByText('85% gestartet')).toBeInTheDocument();
    expect(screen.getByText('24 Wiederholungen')).toBeInTheDocument();
    expect(screen.getByLabelText('4 von 7 Tagen diese Woche aktiv')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Französisch' })).toHaveTextContent('🇫🇷');
    expect(screen.getByRole('img', { name: 'Spanisch' })).toHaveTextContent('🇪🇸');
    expect(screen.getByRole('button', { name: 'Aktives Deck' })).toHaveClass('bg-warning');
  });

  it('removes a deck from the local library only after confirmation', () => {
    const onRemoveDeck = vi.fn();
    vi.stubGlobal('confirm', vi.fn(() => true));

    render(
      <LearnDeckLibraryDialog
        open
        onOpenChange={vi.fn()}
        activeDeckId="french"
        onSelectDeck={vi.fn()}
        onRemoveDeck={onRemoveDeck}
        decks={[{
          id: 'french',
          name: 'Jean Paul',
          description: 'French vocabulary',
          language: 'fr',
          totalCards: 1,
          neverLearnedCount: 0,
          reviewsThisWeek: 0,
          activeDaysThisWeek: 0,
          reviewedDaysThisWeek: [false, false, false, false, false, false, false],
          dueNowCount: 0,
          dueCount: 0,
          overdueCount: 0,
          newLeftToday: 0,
          reviewsLeftToday: 0,
          desiredRetention: 0.9,
          optimizerStatus: 'collecting',
          reviewsBetweenNewCards: 15,
          reviewMixLabel: '1:15',
        }]}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Aus Bibliothek entfernen' }));
    expect(onRemoveDeck).toHaveBeenCalledWith('french');
    vi.unstubAllGlobals();
  });
});
