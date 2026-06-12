import { memo, useMemo } from 'react';
import { buildAnkiCardHtml, scopeAnkiCss } from '@/lib/ankiHtml';
import { cn } from '@/lib/utils';

interface AnkiRenderedContentProps {
  html?: string;
  textFallback: string;
  templateCss?: string;
  cardClassName?: string;
  scopeId: string;
  className?: string;
}

function AnkiRenderedContentInner({
  html,
  textFallback,
  templateCss,
  cardClassName,
  scopeId,
  className,
}: AnkiRenderedContentProps) {
  const scopeSelector = `[data-anki-scope="${scopeId}"]`;
  const scopedCss = useMemo(
    () => (templateCss ? scopeAnkiCss(templateCss, scopeSelector) : ''),
    [scopeSelector, templateCss],
  );
  const markup = useMemo(() => buildAnkiCardHtml(html, textFallback), [html, textFallback]);

  return (
    <div data-anki-scope={scopeId} className={className}>
      {scopedCss ? <style>{scopedCss}</style> : null}
      <div
        className={cn(
          'anki-render-root [&_.anki-static-section]:mt-4 [&_.anki-static-section]:rounded-[1.1rem] [&_.anki-static-section]:border [&_.anki-static-section]:border-[hsl(var(--mode-learn-border)/0.18)] [&_.anki-static-section]:bg-[hsl(var(--background)/0.75)] [&_.anki-static-section]:p-3 [&_.anki-static-section-title]:mb-2 [&_.anki-static-section-title]:text-[0.72rem] [&_.anki-static-section-title]:font-black [&_.anki-static-section-title]:uppercase [&_.anki-static-section-title]:tracking-[0.14em] [&_.anki-static-section-title]:text-[hsl(var(--mode-learn-foreground)/0.72)] [&_.cloze]:font-black [&_.cloze]:text-primary [&_a]:break-all [&_a]:text-primary [&_h1]:mt-5 [&_h1]:text-[1.5rem] [&_h1]:font-black [&_h1]:leading-tight [&_h2]:mt-4 [&_h2]:text-[1.3rem] [&_h2]:font-black [&_h2]:leading-tight [&_h3]:mt-3 [&_h3]:text-[1.12rem] [&_h3]:font-black [&_hr]:my-4 [&_hr]:border-0 [&_hr]:border-t [&_hr]:border-[hsl(var(--mode-learn-border)/0.24)] [&_img]:mx-auto [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-[1rem] [&_li]:my-1 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_p]:leading-relaxed [&_table]:my-3 [&_table]:w-full [&_table]:border-collapse [&_table]:text-left [&_td]:border [&_td]:border-[hsl(var(--mode-learn-border)/0.24)] [&_td]:px-2 [&_td]:py-1.5 [&_td]:align-top [&_th]:border [&_th]:border-[hsl(var(--mode-learn-border)/0.24)] [&_th]:bg-[hsl(var(--mode-learn-surface)/0.3)] [&_th]:px-2 [&_th]:py-1.5 [&_th]:text-left [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5',
          cardClassName,
        )}
      >
        <div dangerouslySetInnerHTML={{ __html: `<div id="qa">${markup}</div>` }} />
      </div>
    </div>
  );
}

export const AnkiRenderedContent = memo(AnkiRenderedContentInner);
