import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TemplatePreviewPanel } from '@/components/learn/TemplatePreviewPanel';
import { buildManualCardPreview } from '@/lib/learning';

describe('template preview', () => {
  it('builds cloze previews with underscores and typed-answer metadata', () => {
    const preview = buildManualCardPreview({
      type: 'cloze',
      front: 'Ich {{c1::lerne}} schnell',
      back: 'lerne',
      clozeText: 'Ich {{c1::lerne}} schnell',
    });

    expect(preview.front).toContain('_____');
    expect(preview.requiresTypedAnswer).toBe(true);
    expect(preview.expectedAnswer).toBe('lerne');
    expect(preview.clozeOccurrences).toHaveLength(1);
  });

  it('renders the preview panel with front/back tabs and refresh action', () => {
    const onRefresh = vi.fn();
    const preview = buildManualCardPreview({
      type: 'cloze',
      front: 'Ich {{c1::lerne}} schnell',
      back: 'lerne',
      clozeText: 'Ich {{c1::lerne}} schnell',
    });

    render(<TemplatePreviewPanel preview={preview} isDirty onRefresh={onRefresh} />);

    expect(screen.getByText('Antwort eintippen aktiv')).toBeInTheDocument();
    expect(screen.getByText('Entwurf')).toBeInTheDocument();
    expect(screen.getByText('Ich _____ schnell')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Front' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Back' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Aktualisieren' }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});
