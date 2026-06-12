import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ROUTER_FUTURE_FLAGS } from '@/lib/routerFuture';
import LearnTemplatesPage from '@/pages/LearnTemplates';
import { getFeaturedDeckTemplates } from '@/lib/learning';
import { useLearningStore } from '@/store/useLearningStore';

const {
  importTemplateDeckMock,
  toastMessageMock,
  toastErrorMock,
  showSuccessFeedbackMock,
} = vi.hoisted(() => ({
  importTemplateDeckMock: vi.fn(),
  toastMessageMock: vi.fn(),
  toastErrorMock: vi.fn(),
  showSuccessFeedbackMock: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    message: toastMessageMock,
    error: toastErrorMock,
  },
}));

vi.mock('@/lib/successFeedback', () => ({
  showSuccessFeedback: showSuccessFeedbackMock,
}));

vi.mock('@/store/selectors', () => ({
  useLearnStudioSummary: () => ({
    decks: [],
    importJobs: [],
  }),
  useLearnStudioActions: () => ({
    importTemplateDeck: importTemplateDeckMock,
  }),
}));

describe('Learn templates content', () => {
  beforeEach(() => {
    importTemplateDeckMock.mockReset();
    toastMessageMock.mockReset();
    toastErrorMock.mockReset();
    showSuccessFeedbackMock.mockReset();
    useLearningStore.setState(useLearningStore.getInitialState(), true);
  });

  it('renders each standard template only once, including Jean Paul 2.0', async () => {
    render(
      <MemoryRouter future={ROUTER_FUTURE_FLAGS}>
        <LearnTemplatesPage />
      </MemoryRouter>,
    );

    expect(await screen.findAllByRole('button', { name: /jetzt hinzuf/i })).toHaveLength(getFeaturedDeckTemplates().length);
    expect(screen.getByRole('heading', { name: 'Jean Paul 2.0' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Jean Paul Spanisch' })).toBeInTheDocument();
    expect(screen.getAllByText('Jean Paul 2.0')).toHaveLength(2);
  });

  it('shows the already-present message when a template import reports an existing deck', async () => {
    const template = getFeaturedDeckTemplates()[0];

    importTemplateDeckMock.mockResolvedValue({
      status: 'already-existed',
      job: {
        id: 'job_existing',
        source: 'template',
        filename: `${template.title}.json`,
        status: 'completed',
        importedDeckIds: ['deck_existing'],
        importedCardCount: 42,
        createdAt: Date.now(),
      },
    });

    render(
      <MemoryRouter future={ROUTER_FUTURE_FLAGS}>
        <LearnTemplatesPage />
      </MemoryRouter>,
    );

    fireEvent.click((await screen.findAllByRole('button', { name: /jetzt hinzuf/i }))[0]);

    await waitFor(() =>
      expect(toastMessageMock).toHaveBeenCalledWith(`${template.title} war bereits vorhanden.`),
    );
    expect(showSuccessFeedbackMock).not.toHaveBeenCalled();
    expect(toastErrorMock).not.toHaveBeenCalled();
  });

  it('lets Jean Paul 2.0 refresh an already imported deck instead of only opening the library', async () => {
    const jeanPaulTemplate = getFeaturedDeckTemplates().find((template) => template.id === 'jean-paul');
    expect(jeanPaulTemplate).toBeTruthy();

    useLearningStore.setState({
      decks: {
        deck_jean_paul_legacy: {
          id: 'deck_jean_paul_legacy',
          name: 'Jean-Paul',
          description: 'Alter Jean-Paul-Import',
          language: 'fr',
          tags: [],
          cardIds: [],
          presetId: 'passive-default',
          sourceTemplateId: 'jean-paul',
          sourceType: 'template',
          createdAt: 1_700_000_000_000,
          updatedAt: 1_700_000_000_000,
        },
      },
    });
    importTemplateDeckMock.mockResolvedValue({
      status: 'imported',
      job: {
        id: 'job_jean_paul_refresh',
        source: 'template',
        filename: 'Jean Paul 2.0.json',
        status: 'completed',
        importedDeckIds: ['deck_jean_paul_legacy'],
        importedCardCount: 3251,
        itemCount: 3251,
        createdAt: Date.now(),
      },
    });

    render(
      <MemoryRouter future={ROUTER_FUTURE_FLAGS}>
        <LearnTemplatesPage />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('button', { name: /jean paul 2\.0 neu laden/i }));

    await waitFor(() => expect(importTemplateDeckMock).toHaveBeenCalledWith('jean-paul'));
    expect(showSuccessFeedbackMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Template aktualisiert',
      }),
    );
  });
});
