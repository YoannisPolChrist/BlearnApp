import { useState } from 'react';
import { RefreshCw, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import type { TemplatePreview } from '@/lib/learning';

export interface TemplatePreviewPanelProps {
  preview: TemplatePreview | null;
  isDirty?: boolean;
  loading?: boolean;
  onRefresh?: () => void;
}

function PreviewBlock({
  label,
  value,
  loading = false,
}: {
  label: string;
  value: string;
  loading?: boolean;
}) {
  return (
    <div className="rounded-[1.5rem] border border-border/70 bg-background/70 p-4 shadow-[0_12px_30px_hsl(var(--foreground)/0.04)]">
      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      {loading ? (
        <div className="mt-3 h-20 animate-pulse rounded-2xl bg-muted/70" />
      ) : (
        <div className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">
          {value || 'Keine Vorschau verfügbar.'}
        </div>
      )}
    </div>
  );
}

export function TemplatePreviewPanel({
  preview,
  isDirty = false,
  loading = false,
  onRefresh,
}: TemplatePreviewPanelProps) {
  const [tab, setTab] = useState<'front' | 'back'>('front');

  if (!preview) {
    return (
      <Card className="overflow-hidden rounded-[1.75rem] border-border/80 bg-[linear-gradient(145deg,hsl(var(--card)/0.98),hsl(var(--primary)/0.08))]">
        <CardHeader className="space-y-3 border-b border-border/70">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-primary/80">Template Preview</p>
              <CardTitle className="mt-2 text-2xl font-black tracking-[-0.04em]">Noch keine Vorschau</CardTitle>
              <CardDescription className="mt-2 max-w-2xl">
                Sobald Front, Back oder Cloze-Text vorhanden sind, erscheint hier die Vorschau für die aktuelle Karte.
              </CardDescription>
            </div>
            <Badge variant="outline" className="rounded-full border-border/70 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.14em]">
              Inaktiv
            </Badge>
          </div>
        </CardHeader>
      </Card>
    );
  }

  const activeLabel = preview.requiresTypedAnswer ? `Cloze #${preview.activeClozeOrdinal || 1}` : 'Basic';

  return (
    <Card className="overflow-hidden rounded-[1.75rem] border-border/80 bg-[linear-gradient(145deg,hsl(var(--card)/0.98),hsl(var(--primary)/0.08))] shadow-[0_18px_52px_hsl(var(--foreground)/0.06)]">
      <CardHeader className="space-y-4 border-b border-border/70">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-primary/80">Template Preview</p>
            <CardTitle className="mt-2 text-2xl font-black tracking-[-0.04em]">Vorschau</CardTitle>
            <CardDescription className="mt-2 max-w-2xl">
              Front und Rückseite werden direkt aus dem aktuellen Composer-Inhalt berechnet.
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Badge
              variant={preview.requiresTypedAnswer ? 'default' : 'outline'}
              className={cn(
                'rounded-full px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.14em]',
                preview.requiresTypedAnswer && 'bg-primary text-primary-foreground',
              )}
            >
              {preview.requiresTypedAnswer ? 'Antwort eintippen aktiv' : 'Antwort eintippen aus'}
            </Badge>
            <Badge variant="outline" className="rounded-full border-border/70 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.14em]">
              {activeLabel}
            </Badge>
            {isDirty ? (
              <Badge variant="secondary" className="rounded-full px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.14em]">
                Entwurf
              </Badge>
            ) : null}
            {onRefresh ? (
              <button
                type="button"
                onClick={onRefresh}
                disabled={loading}
                className="btn-press inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-foreground transition hover:bg-background disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw size={14} />
                Aktualisieren
              </button>
            ) : null}
          </div>
        </div>

        <Tabs value={tab} onValueChange={(value) => setTab(value as 'front' | 'back')} className="w-full">
          <TabsList className="grid w-full max-w-sm grid-cols-2 rounded-2xl bg-muted/70 p-1">
            <TabsTrigger value="front" className="rounded-xl text-sm font-black data-[state=active]:bg-background">
              Front
            </TabsTrigger>
            <TabsTrigger value="back" className="rounded-xl text-sm font-black data-[state=active]:bg-background">
              Back
            </TabsTrigger>
          </TabsList>

          <TabsContent value="front" className="mt-4">
            <PreviewBlock label="Front" value={preview.front} loading={loading} />
          </TabsContent>

          <TabsContent value="back" className="mt-4">
            <PreviewBlock label="Back" value={preview.back} loading={loading} />
          </TabsContent>
        </Tabs>
      </CardHeader>

      <CardContent className="grid gap-3 p-5 sm:grid-cols-2">
        <div className="rounded-[1.25rem] border border-border/70 bg-background/75 p-4">
          <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">
            <Sparkles size={14} />
            Meta
          </div>
          <p className="mt-2 text-sm text-foreground">{preview.clozeOccurrences.length} Cloze-Occurrence(s)</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {preview.expectedAnswer ? `Antwort: ${preview.expectedAnswer}` : 'Keine Eingabeantwort hinterlegt.'}
          </p>
        </div>

        <div className="rounded-[1.25rem] border border-border/70 bg-background/75 p-4">
          <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">
            <Sparkles size={14} />
            Typ
          </div>
          <p className="mt-2 text-sm font-semibold text-foreground">
            {preview.type === 'cloze' ? 'Cloze' : 'Basic'}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {preview.requiresTypedAnswer
              ? 'Die Karte erwartet eine Eingabe im Review.'
              : 'Die Karte läuft ohne Typed-Answer-Prüfung.'}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
