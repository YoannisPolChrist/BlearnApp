import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Download, Play, Sparkles } from 'lucide-react';
import GlassCard from '@/components/GlassCard';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export interface LearnDeckLibraryItem {
  id: string;
  name: string;
  description: string;
  language: string;
  totalCards: number;
  dueNowCount: number;
  dueCount: number;
  overdueCount: number;
  newLeftToday: number;
  reviewsLeftToday: number;
  desiredRetention: number;
  optimizerStatus: 'collecting' | 'scheduled' | 'ready';
  reviewsBetweenNewCards: number;
  reviewMixLabel: string;
}

interface LearnDeckLibraryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  decks: LearnDeckLibraryItem[];
  activeDeckId?: string;
  onSelectDeck: (deckId: string) => void;
  onStartLearning?: (deckId: string) => void;
  onExportDeck?: (deckId: string) => void;
  onReviewMixChange?: (deckId: string, reviewsBetweenNewCards: number) => void;
  title?: string;
  description?: string;
}

const REVIEW_MIX_OPTIONS = [5, 10, 15, 20];

export default function LearnDeckLibraryDialog({
  open,
  onOpenChange,
  decks,
  activeDeckId,
  onSelectDeck,
  onStartLearning,
  onExportDeck,
  onReviewMixChange,
  title = 'Bibliothek',
  description = 'Aktives Deck wählen, Session starten oder Paket wechseln.',
}: LearnDeckLibraryDialogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showScrollHint, setShowScrollHint] = useState(false);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;

    const updateScrollHint = () => {
      if (!scrollRef.current) return;
      const remaining = scrollRef.current.scrollHeight - scrollRef.current.scrollTop - scrollRef.current.clientHeight;
      setShowScrollHint(remaining > 12);
    };

    updateScrollHint();
    node.addEventListener('scroll', updateScrollHint);
    window.addEventListener('resize', updateScrollHint);
    return () => {
      node.removeEventListener('scroll', updateScrollHint);
      window.removeEventListener('resize', updateScrollHint);
    };
  }, [decks.length, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-hidden rounded-[2rem] border-border bg-background/95 p-0 sm:max-w-4xl">
        <div className="flex h-full max-h-[85vh] flex-col">
          <DialogHeader className="border-b border-border px-5 py-4 sm:px-6">
            <DialogTitle className="text-2xl font-black tracking-[-0.04em] text-foreground">{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          <div className="relative flex-1 overflow-y-auto px-5 py-5 sm:px-6" ref={scrollRef}>
            {decks.length > 0 ? (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {decks.map((deck) => {
                  const isActive = deck.id === activeDeckId;

                  return (
                    <GlassCard
                      key={deck.id}
                      elevation={isActive ? 'hero' : 'raised'}
                      highlight={isActive}
                      interactive
                      className="h-full p-3.5"
                    >
                      <div className="flex h-full flex-col gap-2.5">
                        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="break-words text-base font-black tracking-[-0.03em] text-foreground">{deck.name}</p>
                              {isActive ? <span className="premium-pill">Aktiv</span> : null}
                            </div>
                            <p className="mt-1.5 line-clamp-2 break-words text-xs leading-relaxed text-foreground/72">{deck.description}</p>
                          </div>
                          <span className="premium-pill self-start">{deck.language.toUpperCase()}</span>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          <div className="rounded-[1rem] bg-background/70 px-2.5 py-2.5">
                            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">Karten</p>
                            <p className="mt-1.5 text-xl font-black tracking-[-0.05em] text-foreground">{deck.totalCards}</p>
                          </div>
                          <div className="rounded-[1rem] bg-primary/8 px-2.5 py-2.5">
                            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-primary/80">Due now</p>
                            <p className="mt-1.5 text-xl font-black tracking-[-0.05em] text-primary">{deck.dueNowCount}</p>
                          </div>
                          <div className="rounded-[1rem] bg-success/8 px-2.5 py-2.5">
                            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-success/80">Status</p>
                            <p className="mt-1.5 text-sm font-black tracking-[-0.03em] text-foreground">
                              {deck.optimizerStatus === 'ready' ? 'Bereit' : deck.dueNowCount > 0 ? 'Fällig' : 'Geplant'}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                          <div className="rounded-[1rem] bg-background/65 px-2.5 py-2">
                            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground">Overdue</p>
                            <p className="mt-1 text-sm font-black text-foreground">{deck.overdueCount}</p>
                          </div>
                          <div className="rounded-[1rem] bg-background/65 px-2.5 py-2">
                            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground">Neu heute</p>
                            <p className="mt-1 text-sm font-black text-foreground">{deck.newLeftToday}</p>
                          </div>
                          <div className="rounded-[1rem] bg-background/65 px-2.5 py-2">
                            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground">Reviews</p>
                            <p className="mt-1 text-sm font-black text-foreground">{deck.reviewsLeftToday}</p>
                          </div>
                          <div className="rounded-[1rem] bg-background/65 px-2.5 py-2">
                            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground">Retention</p>
                            <p className="mt-1 text-sm font-black text-foreground">{Math.round(deck.desiredRetention * 100)}%</p>
                          </div>
                        </div>

                        <div className="rounded-[1.1rem] border border-border/70 bg-background/68 px-3 py-3">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">
                                Neue Mischung
                              </p>
                              <p className="mt-1 text-sm font-black tracking-[-0.03em] text-foreground">
                                {deck.reviewMixLabel}
                              </p>
                              <p className="mt-1 text-[11px] leading-relaxed text-foreground/68">
                                Eine neue Karte nach {deck.reviewsBetweenNewCards} Wiederholungen.
                              </p>
                            </div>
                            <span className="rounded-full border border-border/70 bg-card/75 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-foreground/78">
                              Anki-Stil
                            </span>
                          </div>

                          {onReviewMixChange ? (
                            <ToggleGroup
                              type="single"
                              value={String(deck.reviewsBetweenNewCards)}
                              onValueChange={(value) => {
                                if (!value) {
                                  return;
                                }
                                onReviewMixChange(deck.id, Number(value));
                              }}
                              variant="outline"
                              size="sm"
                              className="mt-3 flex-wrap justify-start gap-2"
                              aria-label={`Neue Karten Mischung für ${deck.name}`}
                            >
                              {REVIEW_MIX_OPTIONS.map((value) => (
                                <ToggleGroupItem
                                  key={value}
                                  value={String(value)}
                                  className="min-w-[3.9rem] flex-1 rounded-[0.95rem] border-border/75 bg-background/86 px-0 text-[11px] font-black tracking-[0.01em] data-[state=on]:border-primary/60 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground sm:flex-none"
                                  aria-label={`1 neue Karte nach ${value} Wiederholungen`}
                                >
                                  1:{value}
                                </ToggleGroupItem>
                              ))}
                            </ToggleGroup>
                          ) : null}
                        </div>

                        <div className="mt-auto flex flex-col gap-2 sm:flex-row">
                          <button
                            onClick={() => {
                              onSelectDeck(deck.id);
                              onOpenChange(false);
                            }}
                            className={`btn-press w-full rounded-[1.1rem] px-3.5 py-2.5 text-sm font-bold ${isActive ? 'bg-card text-foreground' : 'bg-primary text-primary-foreground'}`}
                          >
                            {isActive ? 'Aktives Deck' : 'Deck wählen'}
                          </button>
                          {onStartLearning ? (
                            <button
                              onClick={() => {
                                onSelectDeck(deck.id);
                                onOpenChange(false);
                                onStartLearning(deck.id);
                              }}
                              className="btn-press inline-flex w-full items-center justify-center gap-1.5 rounded-[1.1rem] bg-muted px-3.5 py-2.5 text-sm font-bold text-foreground/72"
                            >
                              <Play size={14} />
                              Lernen
                            </button>
                          ) : null}
                          {onExportDeck ? (
                            <button
                              onClick={() => onExportDeck(deck.id)}
                              className="btn-press inline-flex w-full items-center justify-center gap-1.5 rounded-[1.1rem] border border-border bg-card/70 px-3.5 py-2.5 text-sm font-bold text-foreground sm:w-auto"
                            >
                              <Download size={14} />
                              Export
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </GlassCard>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-[1.75rem] border border-dashed border-border bg-background/50 px-5 py-10 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Sparkles size={20} />
                </div>
                <p className="mt-4 text-sm font-semibold text-foreground">Noch keine Decks in der Bibliothek</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Starte mit einem Template oder importiere eigene Vokabeln, dann erscheint hier deine Auswahl.
                </p>
              </div>
            )}
            {showScrollHint ? (
              <div className="pointer-events-none absolute inset-x-0 bottom-2 flex flex-col items-center">
                <div className="h-14 w-full bg-gradient-to-t from-background via-background/95 to-transparent" />
                <div className="mt-[-10px] inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/95 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground shadow-lg">
                  <ChevronDown size={14} />
                  Scrollen
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
