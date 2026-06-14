# Blearn — Verbesserungsplan (Team-Review, 2026-06-14)

## Wie dieser Plan entstanden ist

Nach einer Runde Bugfixes (FSRS-Fuzz-Determinismus, Cross-Day-Pacing, Übernacht-Strict-Lock,
Penalty-Doppelzahlung, Undo-Geschwister, Emotions-Chart-Tagesgrenze) wurde ein „Team" aus vier
Rollen-Agenten parallel auf den Code angesetzt — **Produkt/UX**, **Reliability/Security**,
**Performance**, **Lern-Qualität**. Jede Rolle hat ihre Top-Ideen geliefert und musste vorab
benennen, wo eine andere Rolle widersprechen würde. Dieses Dokument ist die **adversariale
Synthese**: erst die Streitpunkte und ihre Auflösung, dann ein priorisierter Fahrplan.

Alle Aussagen sind im Code verankert; Dateipfade stehen an den Initiativen.

---

## Nordstern

Blearn ist ein **Commitment-Device mit Lern-Gate**. Daraus folgen zwei Leitplanken, an denen jede
Idee gemessen wurde:

1. **Der Nutzer ist der Angreifer.** Jede „Bequemlichkeit" muss gegen „kann sie als Umgehung
   missbraucht werden?" geprüft werden. (Reliability gewinnt Konflikte über Lock-Integrität.)
2. **Das Gate muss echtes Lernen zertifizieren, nicht Anwesenheit** — und darf den Nutzer nie in
   eine Sackgasse sperren. (Lern-Qualität + Produkt gewinnen Konflikte über den Lern-Flow.)

Auffälligstes Signal der Review: **Produkt UND Lern-Qualität sind unabhängig auf dieselbe
Nr.-1-Baustelle konvergiert** — die Sackgasse, wenn man eine Vokabel falsch beantwortet. Das ist die
Flaggschiff-Initiative (P0).

---

## Die Streitgespräche (Ideen gegeneinander)

### Debatte 1 — Was passiert bei einer falschen Antwort am Gate?
- **Produkt:** „Garantierte, vorhersehbare Freischaltung. Zähle jede Antwort als Credit, dann drainiert
  die Queue immer." Wäre der einfachste Fix der Sackgasse.
- **Lern-Qualität (Veto):** Das zerstört das Gate — es belohnt Nicht-Erinnern, verfälscht das
  FSRS-Signal und den Optimizer-Input und trainiert Button-Mashing. „Schlimmer als gar kein Gate."
- **Auflösung:** **Re-Queue statt Verwerfen.** Eine falsch beantwortete Karte wandert ans Queue-Ende
  und muss korrekt erinnert werden, um ihren Credit zu verdienen — mit Versuchs-Cap (nach 2 Re-Queues
  wird die Exposition als Credit gewertet, damit kein Frust-Loop entsteht). Vorhersehbarkeit (Produkt)
  kommt über den Fortschrittsbalken, nicht über fixe Länge. **Beide Seiten zufrieden, Lernvertrag
  bleibt intakt.**

### Debatte 2 — Fortschrittsbalken: Motivation vs. Schummel-Anreiz
- **Produkt:** „Zeig ‚2 von 3 richtig → frei'. Die Daten existieren schon, werden nur nie gerendert."
- **Lern-Qualität:** Ein sichtbarer Countdown verleitet zu unehrlichem „Gut" auf nicht-gewussten Karten.
- **Auflösung:** Der Tipp-Modus + `easyRatingBlocked` verhindern „Gut/Einfach" nach falscher Eingabe
  bereits — der Zähler steigt nur bei echter Korrektheit. **Balken kommt, Einwand ist durch bestehende
  Mechanik gedeckt.**

### Debatte 3 — Strict-Lock an monotone Zeit vs. Reise-/Zeitzonen-Falle
- **Reliability:** „‚Uhr vorstellen = sofort entsperrt' ist der kanonische Bypass. Die JS-Schicht
  vertraut überall `Date.now()`."
- **Produkt:** „Ein Reisender über Zeitzonen wird fälschlich eingesperrt."
- **Auflösung:** Failure-Mode ist **„Lock halten, nie verlängern"**; der 20h-Cap begrenzt den
  Worst-Case auf eine überlange Session, die sich über die monotone Uhr trotzdem selbst löst —
  strikt sicherer als heute. **Wichtig:** nativ existiert bereits `StrictLockClockGuard.java`; die
  Initiative ist, sicherzustellen, dass die **JS/WebView-Schicht den nativen Guard nicht
  unterlaufen** kann (siehe P1-A).

### Debatte 4 — Penalty: Zahlung garantieren vs. bei Netzfehler nicht aussperren
- **Reliability:** „Freischalten bei fehlgeschlagener Zahlung = kein Commitment-Device. Gate strikt
  auf bestätigtes Preimage."
- **Produkt:** „Nutzer rastet aus, wenn ein Netz-Blip ihn hinter einer bezahlten Freigabe einsperrt."
- **Auflösung:** Strikte Preimage-Gating **plus klare „Zahlung ausstehend — erneut versuchen"-UX**
  (kein Dead-End), plus Startup-Reconciliation für `processing`-Transaktionen. Retry statt Bypass.

### Debatte 5 — Performance-Abkürzungen vs. Korrektheit/Durability
- **Performance:** Inkrementeller Index statt Full-Rebuild; Persist debouncen; Sync-Signatur lazy;
  Queue-Build dedupen.
- **Reliability/Lern-Qualität:** „Full-Rebuild ist offensichtlich korrekt"; „debounced Persist riskiert
  Review-Verlust"; „gecachte Queue könnte veraltet sein."
- **Auflösung:** Das **WAL ist die Durability-Garantie** (synchron, vor dem Snapshot) — der große
  Persist-Snapshot war nie die erste Verteidigungslinie, also darf er debounced werden (mit
  Pause-/visibilitychange-Flush). Caches invalidieren über Referenz-/Revisions-Wechsel (passiert bei
  jedem Review). Full-Rebuild bleibt als Debug-Invariante. **Perf-Gewinne ohne Korrektheitsverlust.**

---

## Priorisierter Fahrplan

Legende — Aufwand: S/M/L · Wirkung: 1–5.

### P0 — Unlock-Loop-Integrität (Flaggschiff; Konvergenz Produkt × Lern-Qualität)

> Die Sackgasse: Die Unlock-Queue wird auf **exakt** `sessionCreditsRequired` zugeschnitten
> (`buildUnlockSessionQueueFromCandidates` → `.slice(0, desiredCount)`, `queues.ts`), und
> `candidateIds = [...queue]` lässt dem Refill in `sessionController.grade()` nichts zum Nachladen.
> Ein Credit zählt nur bei korrekt & nicht-„again" (`getUnlockCredit`, `scheduler.ts`). Also: jede
> falsche Antwort ist ein nie einholbarer Credit → `countedReviews < sessionCreditsRequired` am Ende →
> kein Unlock; der Nutzer landet auf einem fehler-betitelten Empty-State (inkl. **Debug-Panel**,
> `LearnReviewEmptyState.tsx:40-49`) und kommt nur durch Verlassen & Neu-Betreten raus.

**P0.1 — Queue von Credits entkoppeln (über-provisionieren).** `desiredCount = sessionCreditsRequired
+ Puffer` bzw. nicht slicen (Cap = Kandidatenpool); `candidateIds` nicht mehr auf die Queue kollabieren.
Der bestehende `grade()`-Refill übernimmt das Weiterlaufen. — Aufwand S/M · Wirkung 5 ·
Dateien: `src/modules/learning/review/queues.ts`, `src/modules/learning/session/sessionSnapshotFactory.ts`.

**P0.2 — Falsche Karte re-queuen (Lapse-Requeue) mit Versuchs-Cap.** Bei `again`/falsch im Unlock-Flow
die Karte N Positionen nach hinten schieben statt verwerfen; nach 2 Re-Queues Credit gewähren (Exposition
zählt) und FSRS als near-term Lapse planen lassen. — Aufwand M · Wirkung 5 ·
Dateien: `sessionController.ts` (`grade()`), `useLearnReviewReviewActions.ts`.

**P0.3 — Ehrlicher Recovery-Screen + Fortschrittsbalken.** Den Zustand „Queue leer, Credits fehlen"
explizit erkennen und „Fast geschafft — N von M richtig, noch K Karten" mit „Weiter lernen"-CTA zeigen;
oben im Blocked-Flow einen schlanken Fortschrittsbalken aus dem bereits berechneten `progressPercent`/
`countedReviews`/`sessionCreditsRequired` rendern. — Aufwand S/M · Wirkung 5 ·
Dateien: `useLearnReviewDerivedState.ts`, `LearnReview.tsx`, `LearnReviewPageHeader`, `lib/view-models/learn.ts`.

**P0.4 — „Freigegeben ✓"-Lüge fixen + Debug-Panel entfernen.** Den Erfolgs-Branch strikt an
`countedReviews >= sessionCreditsRequired` binden; das an Endnutzer ausgelieferte Debug-`<div>` löschen
(Diagnose-Felder stattdessen als `console.warn`/Telemetrie-Breadcrumb). — Aufwand S · Wirkung 4 ·
Dateien: `LearnReview.tsx`, `LearnReviewEmptyState.tsx`, `useLearnReviewDerivedState.ts`.

> **Umsetzungs-Hinweis (aus den zwei Agenten-Traces):** Produkt verortete den Endzustand im Empty-State,
> Lern-Qualität bei „Freigegeben ✓". Ursache ist `blockedFlowExhausted`, das `candidateIds.length === 0`
> verlangt — was nie eintritt, weil `candidateIds` nie gekürzt wird. **Erster Schritt: den tatsächlich
> gerenderten Branch per Repro bestätigen**, dann P0.1–P0.4 zusammen umsetzen (sie hängen am selben
> Zustandsübergang).

---

### P1 — Sicherheit, Geld, Kern-Performance

**P1-A — Strict-Lock: native monotone Zeit als alleinige Autorität.** Die JS-Schicht
(`strictLockUntil`, `useStrictLockExpirySync`, `clampStrictLockEnd`, der native Snapshot-Epoch in
`buildDevicePolicySnapshot`) vergleicht überall gegen `Date.now()`. Nativ existiert bereits
`StrictLockClockGuard.java`. **Sicherstellen, dass der native Guard die Freigabe allein bestimmt** und
die WebView ihn nicht via `forceReleaseLock` + Wallclock unterlaufen kann; Aktivierung als
`(wallStart, elapsedRealtimeStart, remainingMs)` persistieren, Freigabe nur wenn Wall- UND Monotonzeit
übereinstimmen, sonst „Lock halten". — Aufwand L · Wirkung 5 · Risiko: Reise/DST → Failure-Mode
„halten, nie verlängern" + 20h-Cap. · Dateien: `modeSlice.ts`, `useStrictLockExpirySync.ts`,
`lib/strictLockLimits.ts`, `lib/nativePolicy.ts`, `android/.../StrictLockClockGuard.java`.
**Erster Schritt:** prüfen, ob die WebView heute eigenständig entsperren kann (Repro: Systemuhr im Lock
vorstellen) — Erkenntnis gegen project-memory §A1-Zusatz abgleichen.

**P1-B — Defense-in-Depth: Blocking-Mutationen gegen den HAUPT-Strict-Lock sperren.** `toggleBlockedApp`,
`setBlockedAppsMode`, `setBlockSchedule`/`removeBlockSchedule`, `replaceBlockingState` sind nur gegen
*Addon*-Locks geschützt, nicht gegen `strictLockUntil` (scope `full`). `setStrictSchedule` (`modeSlice.ts`)
zeigt bereits das korrekte Store-Level-Muster. Gemeinsamen `isMainStrictLockActive`-Guard ergänzen, der
**schwächende** Aktionen (Entfernen/Relaxen) im Lock kurzschließt, Verstärken erlaubt. — Aufwand S ·
Wirkung 4 · Dateien: `src/store/appStoreSlices/blockingSlice.ts`.

**P1-C — Penalty-Idempotenz über Mount/Crash hinaus.** Der `paymentInFlightRef`-Fix deckt nur denselben
Mount ab; Remount/Retry/Prozess-Tod mitten in der Zahlung kann doppelt zahlen (echtes Geld, irreversibel).
Idempotenz-Key aus `(targetId, blockType, amountSats, grober Zeit-Bucket)`; `inFlight`-Transaktion **vor**
`await processAlbyPenalty` im Store festhalten; zweiten `deductPenalty` mit gleichem Key ablehnen;
`processing`-Transaktionen beim Start reconcilen. — Aufwand M · Wirkung 5 ·
Dateien: `src/store/appStoreSlices/penaltySlice.ts`, `src/pages/Intervention.tsx`, `albyWalletService.ts`.

**P1-D — Unlock strikt auf bestätigtes Preimage gaten.** `handlePenaltySuccess`/`unlockTarget` erst nach
bestätigtem `preimage` (liefert `processAlbyPenalty` bereits); bei Fehler klare „Zahlung ausstehend —
erneut versuchen"-UX statt stillem Free-Unlock oder Dead-End. — Aufwand M · Wirkung 4 ·
Dateien: `src/pages/Intervention.tsx`, `penaltySlice.ts`. (Bündeln mit P1-C.)

**P1-E — `submitReview`-Hot-Path entlasten.** Pro Grade: Klon von `cards`+`reviewLogs` (bis 5000),
O(n)-Min-Suche für die Eviction, zweiter O(n)-Scan für `getRelevantReviewCount`, kompletter
`buildLearningStoreIndexes`-Neuaufbau, doppeltes `migrateLearningCard`. Eviction über inkrementellen
Oldest-Pointer; Review-Count über den bestehenden `reviewLogIndicesByDeckId`-Index; Index via
`prependLearningReviewLogIndex` inkrementell fortschreiben; Re-Migration überspringen, wenn schon
normalisiert. Full-Rebuild bleibt Debug-Invariante. — Aufwand M · Wirkung 4 ·
Dateien: `src/modules/learning/store/slices/reviewSlice.ts`, `src/modules/learning/store/helpers.ts`.

**P1-F — Persist-Snapshot debouncen.** Zustand-Persist serialisiert den ganzen partialisierten Store
(cards/notes/bis 5000 reviewLogs) bei *jedem* `set` nach IndexedDB — mehrere MB JSON pro Interaktion,
genau wenn die erste Karte malen soll. Trailing-Debounce (~250–500 ms) + Force-Flush auf
Pause/visibilitychange; das synchrone WAL bleibt die Durability-Garantie. — Aufwand M · Wirkung 4 ·
Dateien: `src/store/useLearningStore.ts` (Persist-Storage-Wrapper), `lib/persistStorage.ts`.

---

### P2 — Latenz, Lern-Qualität, UX-Politur

**P2-A — Erste-Karte-Latenz: dreifachen Queue-Build deduplizieren.** Beim Blocked-Open läuft der
Full-Deck-Scan 3× (`useLearnReviewSessionRequirements`, `useLearnReviewSessionBootstrap`,
`useActiveLearningDeckData`); `getUnlockSessionScope` cached nur die Normalisierung, nicht Due-Scan/Sort/
Pacing-Count. Vollständiges Candidate-Id-Ergebnis cachen (Key inkl. grobem Zeit-Bucket + Preset/Gate-Revision)
bzw. das Ergebnis der Requirements-Hook in den Bootstrap durchreichen. — Aufwand M · Wirkung 4 (direkt auf
<800 ms-Budget) · Dateien: `queues.ts`, `useLearnReviewSessionRequirements.ts`, `useLearnReviewSessionBootstrap.ts`.

**P2-B — Scope-Revision-Hash verbilligen.** `useLearningSessionScopeRevisions` FNV-hasht bei *jedem* Grade
jede Karte (5000 → ~10k `Math.imul`) nur zur Change-Detection. Stattdessen `(count, max(getCardRevision))`
wie die Cloud-Signatur (`getFastArraySignature`) — Revisions sind monoton, Kollision praktisch unmöglich.
— Aufwand S · Wirkung 3 · Dateien: `useLearningSessionScopeRevisions.ts`.

**P2-C — Sync-Dirtiness lazy + Versions-Gate.** `getLearningCloudStateSignature` läuft pro Mutation 2×
(next+prev) über alle Entities, obwohl der 1200 ms-Debounce sie verwirft. Signatur in den Debounce-Callback
verlegen; optionaler monotoner „mutation version"-Zähler als billiges Gate, Signatur bleibt Source-of-Truth.
— Aufwand S · Wirkung 3 · Dateien: `useLearningCloudSync.ts`, `sync/signature.ts`.

**P2-D — `isTargetUnlocked` rein machen.** Der Getter ruft `set()` (Prune abgelaufener Einträge) während
Render/Native-Sync — Zustand-Foot-Gun, kann Re-Sync-Loops/Tearing auslösen. Getter rein lassen; Prune in
explizite `pruneExpiredUnlocks()`-Action per Timer/Effect (wie `useStrictLockExpirySync`);
`normalizeUnlockedTargets` kann fürs Native-Payload ohne Store-Mutation filtern. — Aufwand S · Wirkung 3 ·
Dateien: `src/store/appStoreSlices/blockingSlice.ts`, `lib/nativePolicy.ts`.

**P2-E — Typed-Answer: „partial" als `hard` werten.** Der 3-Buchstaben-Präfix-Treffer gated heute nur
`easy`/`good`; mit `MAX_TYPED_ANSWER_ATTEMPTS=1` failt ein Tippfehler eine eigentlich gewusste Karte. Bei
`matchKind === 'partial'` Credit geben, aber als `hard` planen — passt zur Copy „Das war fast richtig". —
Aufwand S · Wirkung 3 · Dateien: `useLearnReviewReviewActions.ts`, `typedAnswer.ts`, `typedAnswerService.ts`.

**P2-F — Transliterations-/Skript-Fairness.** Featured-Decks enthalten Arabisch/RTL; `normalizeAnswer`
toleriert nur Latein-Umlaute. `shouldRequireTypedAnswer` skript-bewusst machen: Typed-Mode automatisch
deaktivieren (Self-Grade), wenn die erwartete Antwort außerhalb des Eingabe-Skripts liegt — ein Gate, das
man physisch nicht erfüllen kann, ist reine Friktionswand. — Aufwand M · Wirkung 4 ·
Dateien: `typedAnswer.ts`, `domain/entities.ts` (`shouldRequireTypedAnswer`).

**P2-G — Optimizer ehrlich machen.** Der „FSRS-Optimizer" fittet die 19 `w`-Gewichte NICHT — er schubst nur
`desiredRetention` ±0.01 (`optimizer.ts`). Entweder (a) echte ts-fsrs-Parameter-Optimierung über `reviewLogs`
in `preset.fsrsParams` verdrahten (off-hot-path, hinter den bestehenden 300-Review/14-Tage-Guards, im Learning-
Worker) — oder (b) ehrlich zu „Retention-Auto-Tuning" umbenennen. — Aufwand L (a) / S (b) · Wirkung 4 ·
Dateien: `src/modules/learning/stats/optimizer.ts`, `domain/fsrs.ts`, Learning-Worker.

**P2-H — Leech-Handling sichtbar & erholbar.** Bei 8 Lapses wird still `suspended`; suspendierte Karten
fallen aus jeder Queue — ein kleines Deck schrumpft so unter `sessionCreditsRequired` (unerfüllbares Gate).
Leeches in einem Nudge sichtbar machen („3 Karten haken — neu formulieren?") und `tag` statt Hard-Suspend als
Default anbieten (`leechAction` unterstützt das bereits). — Aufwand M · Wirkung 3 ·
Dateien: `scheduler.ts`, `presets.ts`, ein Review-Quality-Nudge-UI.

**P2-I — Intervention-Overlay-Ton + Emotions-Skip + A11y.** (1) Overlay mit dem Ziel des Nutzers statt
„Freigabe kostet" eröffnen; harte Optik der Strict-Lock-Screen vorbehalten. (2) „Überspringen/Weiß nicht"
im Emotions-Step (ehrlicher als erzwungene Taps unter Druck). (3) Rating-Grid: Live-Region für die
„blockiert"-Meldung, 44px-Touch-Targets, lesbarere Intervall-Labels. — Aufwand S–M · Wirkung 3 ·
Dateien: `InterventionOverlayScreen.tsx`, `Checkin.tsx`, `useLearnReviewSessionCompletion.ts`, `LearnReviewActions.tsx`.

**P2-J — Penalty „≈ X,XX €" mit Live-Kurs.** Penalty zeigt nur Sats; EUR ist hart 1000 sats ≈ 1 €. Gecachten
Live-Kurs neben den Sats zeigen (opportunistisch aktualisiert, „ca."-Label, Offline-Fallback) — **nie auf dem
kritischen Pfad** (Sats sind die echte Belastung, EUR dekorativ). — Aufwand M · Wirkung 3 ·
Dateien: `lib/view-models/wallet.ts`, `Intervention.tsx`.

---

### P3 — Größere/spätere Wetten

**P3-A — Sync: Tombstones + ack-bewusste Truncation.** LWW löst Delete-vs-Edit heute durch
Wiederbelebung gelöschter Decks/Notes/Cards (Delete trägt keine vergleichbare Revision); `mergeAppendOnlyReviewLogs`
kappt bei `MAX_CLOUD_REVIEW_LOGS` und kann un-synced Logs eines anderen Geräts verdrängen. Tombstones
(gelöschte-Id-Set mit Lösch-Revision, GC nach Max-Offline-Fenster) + Truncation, die nie unter den
`acknowledgedCursor` jedes Clients evictet. — Aufwand L · Wirkung 3 (nur Multi-Device) ·
Dateien: `sync/conflictResolution.ts`, `sync/mutationLog.ts`, `sync/syncTypes.ts`.

**P3-B — WAL-Integrität & Sichtbarkeit.** `reviewWriteAheadLog` ist best-effort localStorage mit stillem
`catch {}` und nur `console.warn` als Frühwarnung (auf dem Gerät unsichtbar). `replayedCount`/`droppedCount`
in den bestehenden `nativeRuntimeIssues`-Kanal heben; O(1)-Checksum/Versions-Guard, der einen korrupten WAL
laut verwirft statt still zu Nichts zu parsen. — Aufwand M · Wirkung 3 ·
Dateien: `src/modules/learning/store/reviewWriteAheadLog.ts`.

**P3-C — Entscheidung: per-App-`blockSchedules`.** Werden persistiert/editiert, aber **nie ans Native
durchgereicht** (`buildDevicePolicySnapshot` lässt sie weg) — wirkungsloses Feature. Entweder ans Native
verdrahten (zeitfenster-basiertes Blocken) **oder** UI+State entfernen, damit nichts Totes suggeriert wird.
— Aufwand S (entfernen) / M (verdrahten) · Wirkung 2 ·
Dateien: `lib/nativePolicy.ts`, `blockingSlice.ts`, Schedule-UI.

---

## Bewusst verworfen / zurückgestellt

- **„Jede Antwort zählt als Credit"** (Debatte 1) — zerstört den Lernvertrag; Re-Queue löst dieselbe
  Sackgasse ehrlich.
- **Store verschlüsseln/signieren, um `strictLockUntil`-Editieren zu verhindern** — Security-by-Obscurity
  gegen einen lokalen Angreifer, der Gerät+Prozess besitzt; korrekte Vertrauensgrenze ist der **native**
  autoritative Lock (P1-A), nicht WebView-Obfuskation. Crash-Risiko (Decrypt-Fehler bricht WAL) übersteigt
  den Nutzen.
- **FSRS/Queue-Build in einen Web-Worker** — der Blocked-Flow braucht die erste Karte synchron; der
  Structured-Clone-Transfer des Multi-MB-Payloads frisst das <800 ms-Budget. Erst Doppel-Arbeit (P2-A) und
  Hot-Path (P1-E) eliminieren — danach ist ein Single-Queue-Build über 5000 Karten wenige ms.
- **Voller Onboarding-Wizard** — Scaffolding existiert; aber die Loop-Friktion trifft *jeden* Unlock von
  *wiederkehrenden* Nutzern. Erst die Loop heilen (P0), dann die Eingangstür.

---

## Empfohlene Reihenfolge

1. **Sprint 1 — „Die Loop heilt sich" (P0 komplett).** Höchste Wirkung, mittlerer Aufwand, zwei Rollen
   konvergiert. Liefert sichtbar bessere Nutzererfahrung sofort. Start: Endzustand-Repro (P0-Hinweis).
2. **Sprint 2 — „Geld & Lock dicht" (P1-A…D).** Sicherheits-/Geld-Risiken; P1-B ist ein S-Quick-Win, P1-C/D
   gehören zusammen, P1-A ist die große Sicherheits-Wette (nativ + JS).
3. **Sprint 3 — „Kern-Performance" (P1-E, P1-F, P2-A, P2-B).** Skaliert die Loop für große Decks; rein
   mechanisch dank vorhandener WAL-/Index-Bausteine.
4. **Laufend — Lern-Qualität & Politur (P2-E…J)** als kleine, unabhängige PRs einstreuen.
5. **Backlog — P3** (Multi-Device-Sync, WAL-Observability, Dead-Feature-Entscheidung), wenn die Roadmap es
   nach vorne zieht.

---

## Quick-Wins zum Sofort-Mitnehmen (alle S)

- P0.4 Debug-Panel raus + „Freigegeben ✓" ehrlich gaten
- P1-B Haupt-Strict-Lock-Guard auf schwächende Blocking-Mutationen
- P2-B Scope-Hash auf `(count, max-revision)`
- P2-D `isTargetUnlocked` rein machen
- P2-E Typed-„partial" → `hard`
- P2-I Emotions-„Überspringen"
