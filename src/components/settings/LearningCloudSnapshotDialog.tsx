import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Cloud,
  Database,
  LayoutGrid,
  RefreshCw,
  ScrollText,
  ShieldCheck,
} from 'lucide-react';
import {
  getCloudSyncRuntimeStatusTone,
  useCloudSyncRuntimeStore,
  type CloudSyncRuntimeStatus,
} from '@/lib/cloudSyncRuntime';
import type { LearningCloudState } from '@/lib/learningCloudSync';
import type { LearningCloudMeta } from '@/services/firebaseLearningSyncService';
import type { AuthUser } from '@/store/useAuthStore';
import { useAuthStore } from '@/store/useAuthStore';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface LearningCloudSnapshotDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: AuthUser | null;
  locale: string;
}

interface LearningCloudSnapshotData {
  meta: LearningCloudMeta | null;
  state: LearningCloudState | null;
  loadedAt: number;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Cloud-Daten konnten nicht geladen werden.';
}

function formatTimestamp(locale: string, timestamp?: number | null) {
  if (!timestamp || !Number.isFinite(timestamp)) {
    return 'Noch kein Zeitstempel';
  }

  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(timestamp);
}

function stripMarkup(text?: string) {
  if (!text) {
    return '';
  }

  return text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function formatRuntimeStatus(status: CloudSyncRuntimeStatus) {
  switch (status) {
    case 'blocked-firebase-missing':
      return 'Firebase fehlt';
    case 'blocked-writes-disabled':
      return 'Writes aus';
    case 'blocked-signed-out':
      return 'Nicht angemeldet';
    case 'starting':
      return 'Initialisiert';
    case 'ready':
      return 'Bereit';
    case 'error':
      return 'Fehler';
    default:
      return 'Leerlauf';
  }
}

export default function LearningCloudSnapshotDialog({
  open,
  onOpenChange,
  user,
  locale,
}: LearningCloudSnapshotDialogProps) {
  const authReady = useAuthStore((state) => state.authReady);
  const authCapabilities = useAuthStore((state) => state.capabilities);
  const learningSyncRuntime = useCloudSyncRuntimeStore((state) => state.learning);
  const progressSyncRuntime = useCloudSyncRuntimeStore((state) => state.progress);
  const [snapshot, setSnapshot] = useState<LearningCloudSnapshotData | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadSnapshot = useCallback(async () => {
    if (!user?.uid) {
      setSnapshot(null);
      setErrorMessage(null);
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const service = await import('@/services/firebaseLearningSyncService');
      const [meta, state] = await Promise.all([
        service.loadLearningCloudMetadata(user.uid, { source: 'server' }),
        service.loadLearningCloudState(user.uid, { source: 'server' }),
      ]);

      setSnapshot({
        meta,
        state,
        loadedAt: Date.now(),
      });
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    if (!open) {
      return;
    }

    void loadSnapshot();
  }, [open, loadSnapshot]);

  const counts = useMemo(() => ({
    decks: snapshot?.state?.decks.length ?? snapshot?.meta?.deckCount ?? 0,
    notes: snapshot?.state?.notes.length ?? snapshot?.meta?.noteCount ?? 0,
    cards: snapshot?.state?.cards.length ?? snapshot?.meta?.cardCount ?? 0,
    reviews: snapshot?.state?.reviewLogs.length ?? snapshot?.meta?.reviewLogCount ?? 0,
  }), [snapshot]);

  const deckRows = useMemo(() => {
    if (!snapshot?.state) {
      return [];
    }

    return snapshot.state.decks.map((deck) => ({
      id: deck.id,
      name: deck.name,
      language: deck.language || 'de',
      updatedAt: deck.updatedAt || deck.createdAt,
      noteCount: snapshot.state?.notes.filter((note) => note.deckId === deck.id).length ?? 0,
      cardCount: snapshot.state?.cards.filter((card) => card.deckId === deck.id).length ?? 0,
    }));
  }, [snapshot]);

  const vocabPreview = useMemo(() => {
    if (!snapshot?.state) {
      return [];
    }

    const deckNames = new Map(snapshot.state.decks.map((deck) => [deck.id, deck.name]));

    return snapshot.state.notes.slice(0, 6).map((note) => ({
      id: note.id,
      deckName: deckNames.get(note.deckId) || note.deckId,
      front: stripMarkup(note.front || note.frontHtml || ''),
      back: stripMarkup(note.back || note.backHtml || ''),
    }));
  }, [snapshot]);

  const activeDeckName = useMemo(() => {
    if (!snapshot?.state?.activeDeckId) {
      return null;
    }

    return snapshot.state.decks.find((deck) => deck.id === snapshot.state?.activeDeckId)?.name || snapshot.state.activeDeckId;
  }, [snapshot]);

  const lastCloudUpdate = snapshot?.meta?.clientUpdatedAt || snapshot?.meta?.lastMutationAt || null;
  const lastRuntimeSyncAt = Math.max(
    learningSyncRuntime.lastSuccessfulSyncAt || 0,
    progressSyncRuntime.lastSuccessfulSyncAt || 0,
  ) || null;
  const currentRuntimeError = learningSyncRuntime.currentError || progressSyncRuntime.currentError || errorMessage;
  const diagnosticCards = [
    {
      label: 'Firebase configured',
      value: authCapabilities.firebaseConfigured ? 'Ja' : 'Nein',
      tone: authCapabilities.firebaseConfigured ? 'success' : 'warning',
    },
    {
      label: 'Writes enabled',
      value: authCapabilities.firebaseWritesEnabled ? 'Ja' : 'Nein',
      tone: authCapabilities.firebaseWritesEnabled ? 'success' : 'warning',
    },
    {
      label: 'Auth ready',
      value: authReady && user ? 'Angemeldet' : authReady ? 'Bereit' : 'Laedt',
      tone: authReady && user ? 'success' : authReady ? 'muted' : 'warning',
    },
    {
      label: 'Learning sync',
      value: formatRuntimeStatus(learningSyncRuntime.status),
      tone: getCloudSyncRuntimeStatusTone(learningSyncRuntime.status),
    },
    {
      label: 'Progress sync',
      value: formatRuntimeStatus(progressSyncRuntime.status),
      tone: getCloudSyncRuntimeStatusTone(progressSyncRuntime.status),
    },
    {
      label: 'Last runtime sync',
      value: formatTimestamp(locale, lastRuntimeSyncAt),
      tone: lastRuntimeSyncAt ? 'success' : 'muted',
    },
  ] as const;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-hidden rounded-[2rem] border-border bg-background/95 p-0 sm:max-w-4xl">
        <div className="flex max-h-[88vh] flex-col">
          <DialogHeader className="border-b border-border px-5 py-4 sm:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <DialogTitle className="text-2xl font-black tracking-[-0.04em] text-foreground">
                  Cloud-Sicherungsstand
                </DialogTitle>
                <DialogDescription>
                  Konto, Sicherungszeitpunkt und die aktuell in Firebase hinterlegten Lern-Daten.
                </DialogDescription>
              </div>
              <button
                type="button"
                onClick={() => {
                  void loadSnapshot();
                }}
                disabled={loading || !user}
                className="btn-press inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card/70 px-4 py-2 text-xs font-bold text-foreground disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                Aktualisieren
              </button>
            </div>
          </DialogHeader>

          <div className="space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
            <div className="rounded-[1.7rem] border border-border/70 bg-[linear-gradient(145deg,hsl(var(--card)/0.96),hsl(var(--primary)/0.05))] p-5 shadow-[0_20px_55px_hsl(var(--foreground)/0.05)]">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                      <Cloud size={20} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">
                        Konto
                      </p>
                      <p className="mt-1 truncate text-lg font-black text-foreground">
                        {user?.email ?? user?.uid ?? 'Nicht angemeldet'}
                      </p>
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                    Upload und Download laufen immer ueber das aktuell angemeldete Firebase-Konto.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-border/70 bg-background/65 px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">
                      Letzter Cloud-Stand
                    </p>
                    <p className="mt-2 text-sm font-bold text-foreground">
                      {formatTimestamp(locale, lastCloudUpdate)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-background/65 px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">
                      Zuletzt geladen
                    </p>
                    <p className="mt-2 text-sm font-bold text-foreground">
                      {snapshot ? formatTimestamp(locale, snapshot.loadedAt) : 'Noch nicht geladen'}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-background/65 px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">
                      Aktives Deck
                    </p>
                    <p className="mt-2 text-sm font-bold text-foreground">
                      {activeDeckName || 'Keines ausgewaehlt'}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-background/65 px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">
                      Letztes Geraet
                    </p>
                    <p className="mt-2 truncate text-sm font-bold text-foreground">
                      {snapshot?.meta?.updatedByDeviceId || 'Unbekannt'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: 'Decks', value: counts.decks, icon: LayoutGrid },
                { label: 'Vokabeln', value: counts.notes, icon: ScrollText },
                { label: 'Karten', value: counts.cards, icon: Database },
                { label: 'Reviews', value: counts.reviews, icon: ShieldCheck },
              ].map((item) => (
                <div key={item.label} className="rounded-[1.45rem] border border-border/70 bg-card/70 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">
                      {item.label}
                    </p>
                    <item.icon size={16} className="text-primary" />
                  </div>
                  <p className="mt-3 text-2xl font-black tracking-[-0.04em] text-foreground">{item.value}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {diagnosticCards.map((item) => (
                <div key={item.label} className="rounded-[1.45rem] border border-border/70 bg-card/70 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">
                      {item.label}
                    </p>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${
                      item.tone === 'success'
                        ? 'bg-success/10 text-success'
                        : item.tone === 'warning'
                          ? 'bg-warning/10 text-warning'
                          : item.tone === 'destructive'
                            ? 'bg-destructive/10 text-destructive'
                            : 'bg-muted text-muted-foreground'
                    }`}>
                      {item.value}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {currentRuntimeError ? (
              <div className="rounded-[1.5rem] border border-destructive/30 bg-destructive/6 px-4 py-4 text-sm text-foreground">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-destructive">
                  Aktueller Runtime-Fehler
                </p>
                <p className="mt-2 leading-relaxed text-foreground/82">{currentRuntimeError}</p>
              </div>
            ) : null}

            {!currentRuntimeError && !loading && snapshot && counts.decks === 0 && counts.notes === 0 && counts.cards === 0 ? (
              <div className="rounded-[1.5rem] border border-border/70 bg-card/65 px-4 py-5 text-sm text-muted-foreground">
                Fuer dieses Konto liegt aktuell noch kein Lern-Backup in der Cloud.
              </div>
            ) : null}

            <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
              <div className="rounded-[1.6rem] border border-border/70 bg-card/65 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">
                      Decks in der Cloud
                    </p>
                    <p className="mt-1 text-sm font-bold text-foreground">
                      Welche Decks aktuell ueber diesen Account gesichert sind
                    </p>
                  </div>
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-primary">
                    {deckRows.length} Eintraege
                  </span>
                </div>

                <div className="mt-4 space-y-3">
                  {deckRows.length > 0 ? deckRows.map((deck) => (
                    <div key={deck.id} className="rounded-2xl border border-border/70 bg-background/55 px-4 py-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-foreground">{deck.name}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Sprache: {deck.language.toUpperCase()}
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Aktualisiert: {formatTimestamp(locale, deck.updatedAt)}
                        </p>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="rounded-full border border-border/70 bg-card/80 px-3 py-1 text-[11px] font-semibold text-foreground">
                          {deck.noteCount} Vokabeln
                        </span>
                        <span className="rounded-full border border-border/70 bg-card/80 px-3 py-1 text-[11px] font-semibold text-foreground">
                          {deck.cardCount} Karten
                        </span>
                      </div>
                    </div>
                  )) : (
                    <div className="rounded-2xl border border-dashed border-border bg-background/40 px-4 py-4 text-sm text-muted-foreground">
                      Noch keine Deck-Daten in der Cloud sichtbar.
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-5">
                <div className="rounded-[1.6rem] border border-border/70 bg-card/65 p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">
                    Vokabel-Vorschau
                  </p>
                  <p className="mt-1 text-sm font-bold text-foreground">
                    Erste Eintraege aus dem Cloud-Backup
                  </p>

                  <div className="mt-4 space-y-3">
                    {vocabPreview.length > 0 ? vocabPreview.map((note) => (
                      <div key={note.id} className="rounded-2xl border border-border/70 bg-background/55 px-4 py-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">
                          {note.deckName}
                        </p>
                        <p className="mt-2 text-sm font-bold text-foreground">{note.front || '(leer)'}</p>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{note.back || '(leer)'}</p>
                      </div>
                    )) : (
                      <div className="rounded-2xl border border-dashed border-border bg-background/40 px-4 py-4 text-sm text-muted-foreground">
                        Keine Vokabel-Vorschau verfuegbar.
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-[1.6rem] border border-warning/25 bg-warning/6 p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-warning">
                    Sync-Regel
                  </p>
                  <p className="mt-2 text-sm font-bold text-foreground">
                    Der Sync merged pro Eintrag, nicht als komplettes Deck.
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    Decks, Karten, Reviews und die aktive Deck-Auswahl werden ueber Revisionswerte zusammengefuehrt.
                    Dadurch kann z. B. neuer Review-Fortschritt von einem Geraet mit neuen Vokabeln von einem anderen Geraet kombiniert werden.
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    Wichtiger Grenzfall: Die eigentlichen Note-Inhalte haben aktuell kein eigenes updatedAt. Neue oder importierte Vokabeln syncen sauber,
                    aber gleichzeitige Text-Aenderungen derselben vorhandenen Vokabel sind noch nicht als echtes newest-wins aufgeloest.
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    Nicht enthalten: App-Blocker, Sperr-Zeitpläne und Freigabe-Einstellungen bleiben gerätespezifisch und werden nicht in der Cloud gespeichert.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
