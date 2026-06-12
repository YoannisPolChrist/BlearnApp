# Optimierungs-Audit v2: Blearn vs. Anki Architecture

## 1. Architektureller Vergleich

* **Anki-Architektur (`ankitects/anki`)**:
  * **Core Engine**: Rust (`rslib`). Alle Logik rund um Scheduling (FSRS), Datenbank-Operationen (SQLite), Datenstrukturen und Synchronisation ist komplett in Rust geschrieben. Resultat: Nahezu native Performance auf allen Plattformen, perfektes Memory-Management durch Rust.
  * **Datenbank**: Echtes SQLite. Speichert Decks, Notizen, Karten und Logs performant. Es werden immer nur die Karten ins Memory geladen, die gerade fällig sind (`SELECT due`).
  * **Sync**: Binäre Delta-Synchronisation (überträgt nur diffs).
  * **Scheduling**: Nutzt den hochpräzisen FSRS (Free Spaced Repetition Scheduler).

* **Blearn-Architektur (`Blearn-App`)**:
  * **Core Engine**: TypeScript auf einem JavaScript-Main-Thread (in der WebView). Zustand für das Memory-Management.
  * **Datenbank**: IndexedDB JSON-Storage über `zustand/middleware/persist`. Die komplette Bibliothek (oft tausende Cards, Notes und Reviews) wird als riesiges JSON vom Storage ins RAM geladen, wo React/Zustand residiert. 
  * **Sync**: Queue-basierter Ansatz mit `learningSyncWorkerQueue` (vermutlich zu Firebase).
  * **Scheduling**: Auch FSRS! Blearn verwendet `ts-fsrs`. Dies ist ein großer Architektur-Erfolg, der SM-2 weit voraus ist.

---

## 2. Kritische Flaschenhälse (Warum der Native Android Blockierpfad instabil sein könnte)

Im React.js Code treten signifikante Race Conditions und RAM-Spitzen auf, die auf leistungsschwächeren Android-Phones das Overlay crashen lassen:

> [!WARNING]
> **Performance-Flaschenhals: "Giant JSON Memory" & Array-Kopien (Anti-Pattern)**
> Der Zustand-Store (`useLearningStore`) speichert `cards[]`, `notes[]` und `reviewLogs[]` als riesige Arrays. 
> Jedes Mal, wenn ein Review in `reviewSlice.ts` abgesendet wird (`submitReview`), führt Blearn folgendes aus: `const nextCards = [...state.cards]`.
> Bei großen Decks (wie dem integrierten "Spanish Top 5000" mit 5000 Einträgen) kopiert der GC zehntausende Zeilen im Array *pro beantworteter Vokabel* neu in den Speicher.

> [!CAUTION]
> **Synchrones Scheduling blockiert die UI**
> FSRS-Berechnungen, Datenverschiebungen und vor allem der Offline-Optimizer (`optimizeLearningPreset`, falls genutzt) blockieren den Web-Thread. Ein hängender Web-Thread verhindert ein flüssiges Rendering der Buttons – der User klickt evtl. mehrfach. Native Overlays interpretieren Freezes oft als ANR (Application Not Responding) und killen die App, was zu haengenden Overlays und kaputten Bedienungshilfen führt. Dies verstößt gegen das UX-Ziel: "Blocking muss sich schützend und robust anfühlen".

> [!WARNING]
> **Warum die Synchronisation bisher fehlschlägt (Der "Full-State-Sync" Fehler)**
> Blearn versucht in `learningCloudSync.ts` via `getLearningCloudStateSignature` einen Hash über das komplette State-Deployment aller Vokabeln, Logs und Decks zu bilden. 
> 1. Die Funktion `visitLearningCloudSignature` durchläuft manuell rekursiv *jede einzelne Eigenschaft* aller Daten. Bei tausenden Karten dauert das zu lange und zwingt den JS-Worker in einen Timeout oder RAM-Out-of-Memory.
> 2. Das Resultat wird als `LearningCloudState` komplett hochgeladen (oft über die Firebase 1-MiB Document-Grenze!).
> 3. Der Konflikt-Resolver `mergeLearningCloudStates` baut das komplette Array in `O(N log N)` bei jedem Sync neu. Anki macht das niemals auf diese Art.

---

## 3. Konkrete Optimierungspotenziale & Handlungsanweisungen für Blearn

Um die Zuverlässigkeit von Blearn auf Anki-Niveau zu bringen, insbesondere bei großen Decks, müssen wir von der reinen JSON-Store-Architektur weg.

### A. Persistenz auf SQLite umstellen oder Capacitor-Storage optimieren
* **Problem**: IndexedDB JSON-Drops sind ineffizient und fehleranfällig bei App-Crashes.
* **Lösung**: `sql.js` ist in der `package.json` bereits vorhanden! Am performantesten wäre eine Migration der `LearningCard`, `LearningNote` und `ReviewLog` aus Zustand heraus in einen Capacitor SQLite-Plugin-Speicher. Das native Overlay kann dann viel schneller reagieren.
* **Fallback (Wenn Migration zu groß ist)**: 
  Zustand von Arrays (`cards: LearningCard[]`) auf Dictionaries umbauen (`cards: Record<string, LearningCard>`). Arrays zwingen bei Update/Find-Schleifen zu `O(n)` Time-Complexity, Dictionaries haben `O(1)` – und noch wichtiger: Wir können In-Place Mutation per "Immer" machen oder nur eine Referenz austauschen, statt 5000 Array-Elemente beim Review zu shiften.

### B. Sync-Mechanismus radikal auf "Delta-Sync" (wie Anki) umbauen
Um die Sync-Abstürze zu fixen (wichtigster fehlender Baustein) und Firebase Limits (Max 1 MiB pro Doc) zu umgehen:
* Anki nutzt Delta-Sync über Update Sequence Numbers (USN). Das heißt: Keine Hashes (`getLearningCloudStateSignature`) über die ganze Datenbank!
* Jede Card/Note bekommt ein `usn` oder ein generisches `last_synced_at` Flag. 
* Die App lädt an Firebase *nur* Dokumente hoch, bei denen `updatedAt > last_synced_at` ist (Batch-Write mit max 500 Docs).
* Die App lädt von Firebase *nur* die Docs herunter, wo das Firebase-`updatedAt` neuer ist als der letzte Sync.
* **Ergebnis**: Kein Durchwühlen des State-JSONs mehr, Netzwerklast sinkt von Megabytes auf Kilobytes.

### C. Main-Thread entlasten (FSRS & Queue)
* Alles rund um `fsrs(generatorParameters(...))`, `getCardMemoryState` und vor allem das Abarbeiten der Firebase `learningSyncWorkerQueue` zwingend über "Web Workers" (oder im Hintergrund via async Capacitor-Bridge) laufen lassen. Die Block-UI (die sich "schützend" und sofort anfühlen muss), darf unter keinen Umständen auf Queue-Sync oder FSRS-Rechenoperationen warten.

### C. Intelligentes "Lazy Loading" im Overlay (Micro-Sessions)
* **Aktuell**: Wahrscheinlich lädt das Overlay den gesamten Store-Tree aus dem persistenten Cache.
* **Besser (Anki-Style)**: Wenn das App-Overlay sich öffnet, um impulsives Scrollen zu unterbrechen (`android-blockierpfad`), sollte nicht der `useLearningStore` mit allen tausenden Vokabeln aufgebaut werden.
  * Das Overlay holt sich via Mini-Query *nur* 5 - 10 "fällige" Vokabel-Datensätze (eine Art `MicroSession`).
  * Sobald diese beantwortet sind, wird das Resultat asynchron im "Hintergrund" weggeschrieben und das Overlay gibt die App-Nutzung direkt per Promise frei ("saubere Freigabe-Logik").

### D. Offline Media Referenzierung
* **Hinweis**: Falls Audio oder Bilder auf Karten genutzt werden. Niemals in demselben Store als Text persistieren. (Blearn hat ein `mediaRegistry`, was daraufhin reviewed werden sollte, dass Blob-/Base64-Elemente nicht den JSON-String RAM fluten).

---

## 4. Wichtige fehlende Features im Vergleich zu Anki

Nach tieferer Inspektion der Blearn-States (`optimizer.ts` und `reviewSlice.ts`) fehlen vier elementare Dinge, die Anki so mächtig machen:

### A. Echte FSRS-Gewichts-Optimierung (Machine Learning)
**Problem:** In `optimizer.ts` wird die FSRS-Optimierung extrem simplifiziert. Blearn verschiebt aktuell nur die `desiredRetention` um +0.01 oder -0.01 basierend auf der Recall-Rate. 
**Anki-Lösung:** Echtes FSRS (wie Anki es nutzt) berechnet durch einen Gradientenabstieg über hunderte vergangene Reviews die **17 Memory-Decay Gewichte (`w` params)** perfekt für dein individuelles Gehirn. Unsere aktuelle Pseudo-Optimierung lässt das volle Potenzial von FSRS auf der Strecke liegen. Eine echte Optimierung sollte serverseitig oder via Hintergrund-Worker die 17 `w`-Parameter neu berechnen.

### B. Review-Undo Funktion (Rückgängig)
**Problem:** Ein falscher Wisch oder ein unabsichtlicher Klick ("Einfach" gedrückt, obwohl man es nicht wusste) terminiert die FSRS-Karte unweigerlich weit in die Zukunft.
**Anki-Lösung:** Anki protokolliert Stacks und erlaubt ein perfektes Zurückrollen des letzten Reviews (Strg+Z / Schütteln am Handy). Blearns `submitReview` überschreibt das State-Array gnadenlos, ein Revert ist aktuell nicht vorgesehen.

### C. Karten "Bury" (Vergraben) und "Suspend" (Aussetzen)
**Problem:** Vokabeln, auf die man aktuell keine Lust hat, tauchen immer wieder in der Queue auf, bis man sie löscht.
**Anki-Lösung:** Die `suspend` (pausieren) und `bury` (heute überspringen, weil man z.B. eine verwandte Schwester-Karte gelernt hat) Funktionen sind elementar für ein sauberes Deck.

### D. Verlässliche State-Persistenz & Präzises Zeit-Scheduling
**Problem:** Du hast beschrieben, dass Vokabelstände sicher gespeichert und weiterentwickelt werden müssen, sodass eine Karte *wirklich* nach dem genannten Zeitraum wieder auf dem Bildschirm erscheint. In React/JS-Apps auf Android (Capacitor) verschieben sich Timer und Hintergrund-Deltas oft, wenn die App in den Schlafzustand (Doze Mode) versetzt wird. Zudem verpasst die App durch die angesprochenen Sync-Crashes oft das Abspeichern des `dueAt`-Zeitstempels, sodass die Karte wieder von vorn lernt.
**Anki-Lösung:** Anki protokolliert den `dueAt` Timestamp streng in der DB-Tabelle, nutzt "Midnight Rollover" (Tagesverschiebungen) und garantiert das Erscheinen der Karte auf Basis absoluter Unix-Zeitstempel (lokale Uhrzeit-Unabhängigkeit). Blearn muss dieses Kernfeature – dass eine Karte nach exakt z.B. 10 Minuten durch das Blockier-Overlay forciert wird – mit absoluter Robustheit als oberste Prioriät sichern (z.B. Offline-Priorität vor Sync-Priorität).
