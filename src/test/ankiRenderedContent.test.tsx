import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AnkiRenderedContent } from '@/components/learn-review/AnkiRenderedContent';

describe('AnkiRenderedContent', () => {
  it('renders imported html markup and scopes template css', () => {
    const { container } = render(
      <AnkiRenderedContent
        html={'<div><strong>bonjour</strong><br><span class="cloze">ami</span></div>'}
        textFallback="bonjour ami"
        templateCss=".cloze { color: blue; }"
        cardClassName="card card1"
        scopeId="card-1"
      />,
    );

    expect(screen.getByText('bonjour').tagName).toBe('STRONG');
    expect(container.querySelector('[data-anki-scope="card-1"] .cloze')?.textContent).toBe('ami');
    expect(container.querySelector('[data-anki-scope="card-1"] .card.card1')).not.toBeNull();
    expect(container.querySelector('[data-anki-scope="card-1"] #qa')).not.toBeNull();
    expect(container.querySelector('style')?.textContent).toContain('[data-anki-scope="card-1"] .cloze');
  });

  it('keeps structured headings and tables visible when Anki html relied on hidden script toggles', () => {
    const { container } = render(
      <AnkiRenderedContent
        html={[
          '<div id="buttonsBox"><button>show</button></div>',
          '<div id="showWikt" style="display:none">',
          '<h2>Pronunciation</h2>',
          '<table><tr><th>Form</th><th>Meaning</th></tr><tr><td>mari</td><td>husband</td></tr></table>',
          '</div>',
          '<div id="showExs" style="display:none"><p>Mon mari est ici.</p></div>',
        ].join('')}
        textFallback="mari"
        templateCss=".card { text-align: center; }"
        cardClassName="card card1"
        scopeId="card-2"
      />,
    );

    expect(screen.getByRole('heading', { name: 'Pronunciation' })).toBeInTheDocument();
    expect(screen.getByText('husband')).toBeInTheDocument();
    expect(container.querySelector('[data-anki-scope="card-2"] #showWikt')?.getAttribute('style') ?? '').not.toContain('display:none');
    expect(container.querySelector('[data-anki-scope="card-2"] #showExs')?.getAttribute('style') ?? '').not.toContain('display:none');
    expect(container.querySelector('[data-anki-scope="card-2"] button')).toBeNull();
    expect(screen.getByText('Wiktionary')).toBeInTheDocument();
    expect(screen.getAllByText('Beispiele').length).toBeGreaterThan(0);
  });
});
