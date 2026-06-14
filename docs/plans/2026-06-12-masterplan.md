# Blearn Masterplan: Zuverlässiges Blocking + funktionierendes Vokabellernen

Datum: 2026-06-12
Basis: Vollanalyse des Repos `YoannisPolChrist/BlearnApp` (Commit 2b32c09), Testlauf (424 ✓ / 8 ✗), Build-Verifikation (✓), Abgleich mit `docs/Optimierungs-Audit-v2.md`, `docs/plans/2026-06-08-vocab-learning-fahrplan.md` und `docs/project-memory.md`.

---

## Leitprinzip

Blearn hat zwei Kernversprechen, die beide zu 100 % halten müssen:

1. **Blocking-Versprechen:** Eine blockierte App/Website wird zuverlässig abgefangen, der Nutzer wird durch den vorgesehenen Flow (Lernen / Atmen / Check-in / Penalty) geführt, und nur ein erfolgreicher Abschluss schaltet frei – exakt für die konfigurierte Dauer, exakt für das eine Ziel.
2. **Lern-Versprechen:** Vokabelstände gehen niemals verloren, Karten erscheinen exakt nach dem FSRS-Zeitplan wieder, und das Lernen im Blocking-Overlay fühlt sich sofort und flüssig an – auch bei 5000-Karten-Decks auf schwachen Geräten.

Jede Phase unten zahlt auf eines dieser Versprechen ein. Reihenfolge = Priorität.

---

## Aktueller Zustand (verifiziert am 2026-06-12)

### Was funktioniert
- `npm run build` läuft fehlerfrei durch (22 s, Chunks sauber gesplittet).
- 424 von 433 Tests bestehen.
- Native Blocking-Pipeline ist architektonisch solide: `ScreenTimeAccessibilityService` → `OverlayPresenter` → `OverlayHandoffCoordinator` → `BlockingOverlayActivity` → React-Route, mit Stale-State-Resets, Cooldowns und idempotenten Route-Ready-Meldungen.
- DNS-VPN-Pfad (`BlearnVpnService` + `DnsDecisionEngine` + `DnsPacketCodec`) forwarded erlaubte Queries korrekt, beantwortet blockierte mit synthetischen Responses und nutzt `protect()` gegen Routing-Schleifen.
- Strict Lock via Device Admin inkl. Reconcile-Alarm ist implementiert.
- FSRS via `ts-fsrs` mit Learning Steps, Presets, Featured Decks (Top-5000-Listen).
- Getypte Unlock-Keys (`app:<id>` / `website:<id>` / `search:<id>`) sind umgesetzt – die im Project Memory dokumentierte Kollisionsschwäche ist behoben.
- `suspended` als Card-State existiert; Review-Session-Slice enthält Undo-Ansätze.
- Phase 1 des Vokabel-Fahrplans (Monster-Dateien aufbrechen) ist erledigt: `learning.ts` und `useLearnReviewSession.ts` sind nur noch Re-Export-Stubs, `Modes.tsx` ist von 1128 auf 489 Zeilen geschrumpft.
- Firestore-Rules sind korrekt restriktiv (nur `/users/{uid}/**` für den eigenen Auth-User, Rest deny-all).

### Was kaputt oder riskant ist
- **[KRITISCH] Repo unvollständig:** `.gitignore` enthält die globalen Muster `AndroidManifest.xml` und `res/` (vermutlich Überbleibsel eines APK-Dump-Aufräumens). Folge: `android/app/src/main/AndroidManifest.xml` und der gesamte `res/`-Ordner sind **nicht im Repository**. Ein frischer Clone kann nicht gebaut werden, und jede Manifest-/Ressourcen-Änderung wird stillschweigend nie committet.
- **[KRITISCH] 8 fehlschlagende Tests**, alle in `src/test/learningCloudSyncRuntime.test.tsx` (Account-Isolation, Debounced-Save, Baseline-Cache, Mutation-Cursor). Der Cloud-Sync ist der einzige rote Bereich der Suite – und genau der Bereich, den das Audit v2 als architektonisch fragil identifiziert ("Full-State-Sync"-Fehler, 1-MiB-Firestore-Grenze, O(N log N)-Merges).
- **[HOCH] Lern-Store-Architektur:** `cards[]`, `notes[]`, `reviewLogs[]` als riesige Arrays in Zustand + IndexedDB-JSON-Persist. Pro Review wird das komplette Array kopiert; bei 5000-Karten-Decks drohen RAM-Spitzen und ANRs genau dann, wenn das Blocking-Overlay schnell sein muss.
- **[HOCH] Blocking ist Erkennung + Abdeckung, kein harter Block:** Eine blockierte App ist kurz im Vordergrund sichtbar, bevor das Overlay greift. Auf aggressiven OEM-ROMs (MIUI/Xiaomi – das verifizierte Testgerät ist ein 22101320G!) killt Battery-Optimization den Accessibility-Service und das VPN gern im Hintergrund.
- **[MITTEL] Pseudo-FSRS-Optimizer:** `optimizer.ts` verschiebt nur `desiredRetention` um ±0.01 statt die 17 `w`-Gewichte zu trainieren.
- **[MITTEL] Repo-Hygiene:** `johannes_http.html` (Domain-Parking-Junk), `vitest.config.ts.timestamp-*.mjs`, `dist/` teilweise eingecheckt, `.git` ist 260 MB groß.
- **[NIEDRIG] `AppSettings` verspricht laut Project Memory Sync-Umfang, der nicht implementiert ist** (Unlocks/Assignments syncen nicht) – Copy muss zur Realität passen oder die Realität zur Copy.

### Tiefenbefunde zu den gemeldeten Bugs (2026-06-12, Code-verifiziert)

**Bug 1 – "Vokabeln werden nicht gespeichert":**
- `src/lib/persistStorage.ts` schreibt bei jeder Store-Änderung den **kompletten** serialisierten Learning-Store als ein JSON asynchron nach IndexedDB (mit localStorage-Fallback und Quota-Prune). Die Writes werden zwar in `pendingStorageWrites` getrackt, aber es existiert **kein Flush-Barrier bei App-Pause/Hintergrundwechsel** – die `visibilitychange`-Handler in den Hooks dienen anderen Zwecken.
- Genau im Blocking-Szenario wird die WebView ständig pausiert/zerstört (`BlockingOverlayActivity.onDestroy`, OEM-Kills). Ein In-Flight-IndexedDB-Write, der den Prozess-Tod nicht überlebt = verlorenes Review. Je größer das Deck, desto länger die Serialisierung, desto größer das Verlustfenster.
- Konsequenz: Phase 2.2 (Write-ahead) ist nicht "nice to have", sondern der direkte Fix für diesen Bug – ergänzt um einen Pause-Flush (neu: 2.6).

**Bug 2 – "Cloud-Sync funktioniert nicht":**
- Unter `src/modules/learning/sync/` existiert bereits eine **halb fertige Delta-Sync-Schicht**: `mutationLog.ts` (Mutation-Einträge mit clientId/sequence), `deltaSync.ts`, Cursor-Vergleichslogik (`SyncCursor`, `isNewerCursor`), `conflictResolution.ts`. Die 8 roten Tests (`Mutation-Cursor`, `Baseline-Cache`, `Debounced Save`, `Legacy-Metadata-Fallback`…) testen exakt diese neue Schicht.
- Der Sync hängt also **zwischen zwei Architekturen**: alte Full-State-Signatur-Welt und neue Mutation-Log-Welt. Halb migrierte Sync-Schichten erzeugen genau das beobachtete Verhalten (mal synct es, mal nicht, Account-Wechsel verhält sich unvorhersehbar).
- Konsequenz: Phase 3 heißt nicht "Delta-Sync neu bauen", sondern "die begonnene Migration zu Ende führen und die alte Schicht abschalten" – plus sichtbares Sync-Status-UI mit Retry (neu: 3.6).

**Bug 3 – "Nach abgebrochenem Blockierflow komme ich nicht zurück zur App":**
- Abbruch-Mechanik heute: `onBackPressed`/Abort → `BlockingFlowState.dismiss` → `finishAndRemoveTask()`. Darunter liegt aber **die blockierte App wieder im Vordergrund**, der Accessibility-Service triggert nach nur 1,5 s `OVERLAY_COOLDOWN_MS` erneut → Overlay-Schleife, aus der weder Launcher noch Blearn-Hauptapp erreichbar wirken.
- Zweite Falle: Stale-Schutz in `PendingNavigationStore` greift nur für die Stage `handoff_complete` (30-s-Schwelle). Eine in anderer Stage hängengebliebene Pending-Navigation kann beim nächsten normalen Öffnen von Blearn konsumiert werden und den Nutzer direkt wieder in einen Blocking-Flow routen – ohne dass eine Blockierung anstand ("ich komme nicht in meine App").
- Dritte Falle: In `useOverlayDismissGuard` werden Fehler von `dismissBlockingOverlay` nur per `console.warn` geschluckt – schlägt der native Dismiss fehl, bleibt der Overlay-/Handoff-Zustand inkonsistent und es gibt keinen Selbstheilungspfad.
- Konsequenz: Es fehlt ein definierter **Abbruch-Vertrag** (wohin navigiert ein Abbruch? wie lange wird der Re-Trigger unterdrückt?) und ein **garantierter Notausgang**. Neu als Phase 1.6/1.7.

---

## Ausführungsplan: 6 Phasen

Regeln (übernommen aus dem bestehenden Fahrplan, weiterhin gültig):
- Pro Phase ein PR-fähiger Stand, `npm run test` und `npm run build` müssen grün sein (Ausnahme: die 8 bekannten Sync-Tests bis Phase 3 abgeschlossen ist).
- Vor jeder Blocking-Änderung Lesepfad einhalten: `project-memory.md` → `blocking-overlay-tldr.md` → `Modes.tsx` → `nativePolicy.ts` → `ScreenTimeAccessibilityService.java` → `useNativePendingNavigation.ts`.
- Kein UI-Copy, das Backend-Verhalten verspricht, das nicht existiert.

---

### Phase 0: Repo-Integrität wiederherstellen (1 Tag, SOFORT)

**Ziel:** Das Repository ist wieder vollständige Source of Truth. Ohne diese Phase ist jede weitere Arbeit auf Sand gebaut.

#### 0.1 Manifest und Ressourcen retten
- Auf dem Rechner mit dem funktionierenden lokalen Stand: `.gitignore` korrigieren. Die Zeilen `AndroidManifest.xml`, `res/`, `META-INF/`, `kotlin/`, `org/`, `resources.arsc` durch gezielte Pfade ersetzen (z. B. `/extracted-apk/` falls der ursprüngliche APK-Dump noch existiert) oder ersatzlos streichen.
- `android/app/src/main/AndroidManifest.xml` und `android/app/src/main/res/**` committen. Vorher prüfen: Welche Permissions stehen drin (`BIND_ACCESSIBILITY_SERVICE`, `SYSTEM_ALERT_WINDOW`, `PACKAGE_USAGE_STATS`, `BIND_VPN_SERVICE`, `BIND_DEVICE_ADMIN`, `FOREGROUND_SERVICE*`, `POST_NOTIFICATIONS`, `RECEIVE_BOOT_COMPLETED`)? Sind alle deklarierten Services/Receiver (`ScreenTimeAccessibilityService`, `BlearnVpnService`, `BlearnDeviceAdminReceiver`, `StrictLockLifecycleReceiver`, `BlockingOverlayActivity`) korrekt exportiert/nicht-exportiert?
- CI-Schutz: ein kleiner Check (Script oder GitHub Action), der fehlschlägt, wenn `android/app/src/main/AndroidManifest.xml` nicht im Git-Index ist.

#### 0.2 Junk entfernen
- `johannes_http.html` löschen (Domain-Parking-Seite, gehört nicht ins Repo).
- `vitest.config.ts.timestamp-*.mjs` löschen und das Muster `vitest.config.ts.timestamp*` in `.gitignore` aufnehmen.
- Prüfen, ob `dist/` getrackt ist (steht in `.gitignore`, liegt aber im Tree) – ggf. `git rm -r --cached dist`.
- Optional: Git-History verschlanken (260 MB `.git`) via `git filter-repo` für versehentlich committete Binärdateien – nur wenn alle Mitarbeiter Bescheid wissen (History-Rewrite).

#### 0.3 Frischer-Clone-Test
- Auf einem Zweitrechner oder in CI: `git clone` → `npm ci` → `npm run build` → `npx cap sync android` → Gradle-Assemble. Muss ohne manuelle Datei-Nachlieferung durchlaufen.

#### Abnahmekriterien Phase 0
- [ ] Frischer Clone baut Debug-APK ohne manuelle Schritte.
- [ ] Manifest + res/ sind im Repo und Änderungen daran erscheinen in `git status`.
- [ ] Keine Junk-/Timestamp-Dateien mehr im Tree.

---

### Phase 1: Blocking-Zuverlässigkeit auf dem Gerät absichern (1–2 Wochen)

**Ziel:** Das Blocking-Versprechen hält auch auf aggressiven OEM-ROMs, nach Reboots, nach App-Updates und bei fehlenden Berechtigungen – und der Nutzer sieht ehrlich, wenn es gerade NICHT hält.

#### 1.1 Permission- und Service-Health-Dashboard ("Schutzstatus")
- Eine zentrale native Statusabfrage (existiert teilweise als `getMonitoringStatus()`) zu einem vollständigen Health-Modell ausbauen: Accessibility verbunden? (inkl. `serviceConnectedAt`/`disconnectedAt`), UsageStats erteilt? Overlay-Permission? VPN aktiv und zuletzt wann ein Paket verarbeitet? Device Admin (nur bei Strict Lock)? Battery-Optimization-Ausnahme erteilt? Benachrichtigungen erlaubt?
- In der App ein einziger, ehrlicher "Schutzstatus"-Indikator (z. B. auf dem Dashboard): grün = alle für die aktive Konfiguration nötigen Pfade laufen; gelb/rot = konkreter Fix-Button pro fehlendem Baustein.
- Wichtig: Der Status muss konfigurationsabhängig sein. Wer nur App-Blocking nutzt, braucht kein VPN-Grün.

#### 1.2 Überleben auf OEM-ROMs (MIUI & Co.)
- `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`-Flow einbauen (Intent + Erklärungsscreen), zusätzlich gerätespezifische Hinweise (MIUI "Autostart" + "Keine Einschränkungen", Samsung "Nicht überwachte Apps") über eine kleine Geräte-Erkennung.
- `RECEIVE_BOOT_COMPLETED`-Receiver verifizieren: Wird nach Reboot der VPN-Dienst-Hinweis gezeigt und der Strict-Lock-Reconcile (`StrictLockLifecycleReceiver`) ausgelöst? Android startet VPNs nicht automatisch neu – nach Reboot muss eine Notification den Nutzer zum Re-Aktivieren führen, und die App muss den Zustand "Schutz unterbrochen seit Reboot" anzeigen statt stillschweigend grün zu bleiben.
- Watchdog: Wenn `monitoring_active=true` aber `accessibility_service_ready=false` länger als N Minuten (via `getServiceDisconnectedAt`), eine hochpriore Notification "Blearn-Schutz ist deaktiviert" posten. Das ist die ehrliche Antwort darauf, dass ein Accessibility-Service vom System oder Nutzer jederzeit beendet werden kann.

#### 1.3 Lücken im Erkennungspfad schließen
- **Settings-Schutz im Strict Mode (optional, klar kommunizieren):** Im Strict-Fenster die System-Settings-App (`com.android.settings`) als blockiertes Ziel behandeln, damit das Deaktivieren der Bedienungshilfe nicht der triviale Ausweg ist. Bewusst als Opt-in ("Hardcore-Modus") bauen – Blearn soll laut North Star schützend wirken, nicht feindselig, und ein Notausstieg (z. B. 60-s-Verzögerungs-Dialog statt Hard-Block) muss existieren.
- **Split-Screen/Picture-in-Picture-Verhalten testen und definieren:** Was passiert, wenn die blockierte App im Split-Screen neben einer erlaubten läuft? Erwartetes Verhalten dokumentieren und per Foreground-Fallback (`resolveForegroundPackageName`) absichern.
- **Browser-Allowlist pflegen:** Die "conservative text allowlist" für Website-/Suchbegriff-Matching gegen die real installierten Browser des Zielpublikums prüfen (Chrome, Firefox, Samsung Internet, Brave, Opera, Edge, MIUI-Browser). Fehlende Pakete ergänzen; DNS-Pfad fängt den Rest.
- **Private DNS / DoH-Realität dokumentieren:** Wenn der Nutzer Private DNS (DoT) oder der Browser DoH nutzt, sieht der VPN-DNS-Pfad die Hostnamen nicht. Erkennen (Private-DNS-Setting auslesen) und im Schutzstatus als Einschränkung anzeigen; Text-Matching im Browser bleibt dann der aktive Pfad.

#### 1.4 Unlock-Semantik härten
- Property-Tests für die Unlock-Matrix: pro Ziel-Typ × Modus (learn/strict/penalty/lock) × (Erfolg/Abbruch/Timeout/manueller Override) muss exakt definiert sein, was freigeschaltet wird, wie lange, und was im nativen Snapshot landet. Die Logik existiert verteilt über `unlockGrants`, `unlockedTargets`, `ManualOverrideStore` – ein einziges Testdokument/Testsuite als Vertrag darüber legen.
- Uhrzeit-Manipulation: Unlock-Abläufe gegen `SystemClock.elapsedRealtime()`-Anker zusätzlich zu Wall-Clock prüfen, damit Datum-Vorstellen keine Dauerfreischaltung erzeugt (mindestens für Strict Lock).

#### 1.5 E2E-Smoke auf echtem Gerät als Checkliste
- Da uiautomator das Overlay nicht zuverlässig tappen kann (dokumentiert): eine manuelle 15-Minuten-Checkliste als `docs/release-smoke-checklist.md` formalisieren: App blockt nach frischem Save; Overlay erscheint < 1 s; Learn-Flow schaltet exakt nach N Karten frei; Unlock läuft nach Ablauf wieder ab; Reboot-Verhalten; Accessibility-Kill-Verhalten; DNS-Block im Chrome.

#### 1.6 Abbruch-Vertrag: Jeder Ausgang des Blocking-Flows ist definiert (Fix für Bug 3)
- **Den Vertrag erst aufschreiben, dann implementieren.** Für jeden Ausgangsweg muss in einer Tabelle stehen: (a) wohin der Nutzer navigiert wird, (b) was mit der Pending-Navigation passiert, (c) wie lange das Ziel re-trigger-unterdrückt ist. Ausgangswege: Erfolg, expliziter Abbruch-Button, Back-Geste, Home-Geste/`onUserLeaveHint`, Recents-Swipe, Prozess-Tod, Timeout.
- **Abbruch navigiert IMMER zum Launcher, nie zurück in die blockierte App.** Bei explizitem Abbruch/Back: vor `finishAndRemoveTask()` einen `Intent(ACTION_MAIN, CATEGORY_HOME)` feuern. Damit landet der Nutzer auf dem Homescreen statt in der blockierten App, die sofort wieder triggern würde.
- **Abbruch-Suppression statt 1,5-s-Cooldown:** Nach einem Abbruch das betroffene Ziel für eine kurze, definierte Spanne (z. B. 30 s, in `ManualOverrideStore` oder einem eigenen Suppression-Store nativ persistiert) nicht erneut triggern. Das bricht die Overlay-Schleife, ohne das Blocking auszuhöhlen: Wer die App wirklich öffnen will, steht nach 30 s wieder vor dem Flow. Wichtig: Suppression ist KEIN Unlock – sie gilt nur dem Re-Trigger-Loop direkt nach Abbruch.
- **Stale-Schutz auf alle Stages ausweiten:** `PendingNavigationStore` bekommt eine TTL für *jede* Stage (nicht nur `handoff_complete`): eine Pending-Navigation, die älter als z. B. 2 Minuten ist, wird beim Konsumieren verworfen und geloggt statt ausgeführt. Beim normalen App-Start (Launcher-Intent, kein Overlay-Bootstrap) werden verwaiste Pending-Navigationen grundsätzlich verworfen – Blearn normal zu öffnen darf nie in einen Blocking-Flow führen, den kein aktueller Trigger angefordert hat.
- **Dismiss-Fehler selbstheilend machen:** Schlägt `dismissBlockingOverlay` fehl (heute nur `console.warn` in `useOverlayDismissGuard`), nach kurzem Backoff einmal retryen; schlägt auch das fehl, nativ einen `BlockingFlowState.reset(..., "dismiss_failed_recovery")` erzwingen. Inkonsistente Overlay-Zustände dürfen sich nie über den nächsten Trigger hinaus halten.

#### 1.7 Garantierter Notausgang ("Escape Hatch")
- Im nativen Overlay und in jedem Blocking-Screen existiert immer ein erreichbarer Ausweg, der unabhängig vom React-Zustand funktioniert: ein nativer "Zum Startbildschirm"-Pfad (Home-Intent + Dismiss + Abbruch-Suppression). Wenn die WebView hängt, nicht lädt oder crasht (`handleBootstrapFailure`), greift derselbe Pfad automatisch nach Timeout (z. B. 10 s ohne Route-Ready → Overlay zeigt Fallback mit "Zum Startbildschirm").
- Watchdog gegen Trigger-Stürme: Wenn dasselbe Ziel > 3 Trigger in 60 s erzeugt, ohne dass je Route-Ready erreicht wurde, Suppression aktivieren und eine Diagnose-Notification posten ("Blocking-Flow hat ein Problem – tippe für Details"), statt den Nutzer in der Schleife zu lassen.
- Diese Pfade gehören in die Smoke-Checkliste (1.5): Back drücken im Overlay, Home drücken mitten im Lernflow, App aus Recents wischen, Flugmodus mitten im Flow – nach jedem dieser Fälle muss der Nutzer binnen Sekunden handlungsfähig sein (Launcher erreichbar, Blearn normal öffenbar).

#### Abnahmekriterien Phase 1
- [ ] Schutzstatus zeigt für jede Konfiguration korrekt grün/rot mit funktionierenden Fix-Buttons.
- [ ] Nach Reboot und nach Force-Stop erscheint innerhalb von 5 Minuten eine Warn-Notification, wenn Schutz konfiguriert aber inaktiv ist.
- [ ] Unlock-Vertragstests decken alle Modus×Ausgang-Kombinationen ab und sind grün.
- [ ] Smoke-Checkliste auf dem Xiaomi-Testgerät einmal vollständig grün durchlaufen.
- [ ] Abbruch-Vertrag dokumentiert; alle 7 Ausgangswege manuell getestet: Nutzer landet nie in einer Overlay-Schleife und kann Blearn danach normal öffnen.
- [ ] Verwaiste Pending-Navigation (künstlich erzeugt via adb force-stop mitten im Handoff) wird beim nächsten normalen App-Start verworfen, nicht ausgeführt.
- [ ] Trigger-Sturm-Watchdog greift nachweislich (Test: Route-Ready künstlich blockieren).

---### Phase 2: Lern-Performance & Datensicherheit (2–3 Wochen)

**Ziel:** Reviews fühlen sich auch mit 5000-Karten-Decks sofort an, kein Review geht je verloren, und das Blocking-Overlay wartet nie auf den Lern-Store. (Setzt Audit-v2 Abschnitte 2, 3.A, 3.C, 3.D um.)

#### 2.1 Store-Struktur: Arrays → Dictionaries
- `cards`, `notes`, `reviewLogs` in `useLearningStore` von `T[]` auf `Record<string, T>` (+ separat gepflegte Index-Arrays für Reihenfolge, wo nötig) umstellen. `submitReview` ersetzt dann eine Referenz statt 5000 Elemente zu kopieren.
- Selektoren konsequent memoizen; Komponenten dürfen nie das ganze Dictionary abonnieren.
- Migrationsfunktion im Persist-Layer (Version-Bump in zustand/persist), die alte Array-Snapshots verlustfrei konvertiert. Migration mit Fixture-Tests gegen echte exportierte States absichern.

#### 2.2 Write-ahead für Reviews ("kein Review geht verloren")
- Jedes abgeschlossene Review SOFORT und synchron in einen kleinen, separaten Persist-Slot schreiben (Capacitor Preferences oder eigener IndexedDB-Key, append-only), BEVOR der große Store-Persist läuft. Beim App-Start: Pending-Reviews aus dem Slot gegen den Store replayen.
- Das adressiert direkt Audit-Punkt 4.D ("Karte lernt wieder von vorn, weil dueAt-Speichern verpasst wurde") – Crash/Kill zwischen Review und Persist darf nichts mehr kosten.

#### 2.3 Micro-Session für das Blocking-Overlay
- Der Blocking-Lernpfad (`useLearnReviewSessionImpl` / `sessionController`) holt sich beim Öffnen nur die N nötigen fälligen Karten (N = `requiredCorrectReviews`, plus kleiner Puffer) statt den vollen Store-Tree zu hydratisieren.
- Ergebnisse werden über den Write-ahead-Slot (2.2) weggeschrieben; die Freischaltung wird per Promise sofort erteilt, der große Store-Merge läuft asynchron nach.
- Messbar machen: Zeit von "Overlay-CTA getippt" bis "erste Karte interaktiv" als Telemetrie-Logzeile (lokal, Debug), Zielwert < 800 ms auf dem Xiaomi-Testgerät.

#### 2.4 FSRS & schwere Arbeit vom Main-Thread holen
- FSRS-Batch-Berechnungen (Queue-Aufbau, `getCardMemoryState` über viele Karten), Anki-Import-Parsing und der Sync-Worker laufen bereits teils in Workern (`learningSyncWorker.ts` existiert) – verbleibende synchrone Pfade identifizieren (Profiling mit 5000-Karten-Deck) und in Web Worker verlagern. Einzelkarten-Scheduling darf synchron bleiben (ist billig).

#### 2.5 Media-Registry-Review
- Prüfen, dass `mediaRegistry` keine Base64-Blobs in den persistierten JSON-State schreibt; Medien gehören als Dateien ins Capacitor-Filesystem mit Referenz-IDs im State.

#### 2.6 Flush-Garantien: Kein Write stirbt im Hintergrund (Fix für Bug 1)
- **Pause-Flush einbauen:** Auf Capacitor `appStateChange (isActive=false)` und `visibilitychange (hidden)` alle ausstehenden Persist-Writes synchron anstoßen und auf `pendingStorageWrites` warten (die Tracking-Map existiert in `persistStorage.ts` bereits – es fehlt nur der Konsument). Android gewährt beim Pause-Übergang ein kurzes Zeitfenster; das reicht für IndexedDB-Commits, wenn nicht erst das 5000-Karten-JSON serialisiert werden muss – deshalb gehört 2.6 NACH 2.1/2.2 (kleine Writes zuerst).
- **Persist-Reihenfolge nach Kritikalität:** Review-Ergebnisse (Write-ahead-Slot aus 2.2) committen synchron-klein VOR dem großen Store-Snapshot. Der große Snapshot darf verloren gehen – das WAL-Replay stellt ihn wieder her; umgekehrt nie.
- **Recovery beim Start messbar machen:** Beim App-Start loggt der Replay, wie viele Pending-Reviews er wiederhergestellt hat. Taucht hier regelmäßig > 0 auf, ist das ein Frühwarnsignal für Persist-Probleme, bevor Nutzer Datenverlust bemerken.
- **localStorage-Prune-Pfad prüfen:** Der Quota-Prune in `writeLocalStorageValue` darf niemals Review-relevante Daten wegschneiden – verifizieren, was die Prune-Funktion konkret entfernt, und Review-Logs/Card-States davon ausnehmen.

#### 2.7 Chaos-Test-Harness: Datenverlust reproduzierbar machen
- Ein kleines adb-Skript-Set (`scripts/chaos/`), das die echten Verlust-Szenarien automatisiert: (a) Review beantworten → sofort `adb shell am force-stop`, (b) Review beantworten → Home → 10 s warten → Kill, (c) Review im Blocking-Overlay → Overlay via Back schließen → Kill, (d) Flugmodus an → 3 Reviews → Kill → Flugmodus aus → Start.
- Nach jedem Szenario prüft ein Verifikationsschritt (App-Start + Export oder Debug-Endpoint): Sind alle Reviews da? Stimmt `dueAt`?
- Diese Szenarien sind die Abnahme-Grundlage für 2.2/2.6 und laufen vor jedem Release als Pflichtprogramm.

#### Abnahmekriterien Phase 2
- [ ] Review-Submit bei 5000-Karten-Deck: keine sichtbare UI-Verzögerung (< 50 ms Main-Thread-Block, gemessen).
- [ ] Kill der App (adb force-stop) unmittelbar nach einem Review: Review ist nach Neustart vorhanden, Karte erscheint zum korrekten dueAt.
- [ ] Overlay → erste Karte interaktiv < 800 ms auf dem Testgerät.
- [ ] Persist-Migration konvertiert einen echten Alt-State verlustfrei (Fixture-Test).
- [ ] Alle 4 Chaos-Szenarien (2.7) laufen 10× hintereinander ohne ein einziges verlorenes Review durch.
- [ ] Pause-Flush ist messbar: nach `appStateChange(false)` sind binnen 1 s keine Pending-Writes mehr offen (Debug-Log).

---

### Phase 3: Cloud-Sync fertigstellen – die begonnene Delta-Migration zu Ende führen (2–3 Wochen)

**Ziel:** Die 8 roten Tests werden grün, Sync skaliert über die 1-MiB-Firestore-Grenze hinaus, Account-Wechsel kann nie Vokabeldaten vermischen oder verlieren – und der Nutzer SIEHT jederzeit, ob und wann zuletzt erfolgreich gesynct wurde.

**Wichtige Lageänderung gegenüber dem Audit v2:** Die Delta-Sync-Schicht existiert bereits in Teilen (`src/modules/learning/sync/mutationLog.ts`, `deltaSync.ts`, `conflictResolution.ts`, Cursor-Logik in `syncTypes.ts`). Das Repo steckt mitten in der Migration von der Full-State-Signatur-Welt zur Mutation-Log-Welt – und genau dieser Zwischenzustand ist die wahrscheinlichste Ursache für das unzuverlässige Sync-Verhalten im Alltag. Phase 3 heißt daher: **eine der beiden Welten gewinnt, die andere wird abgeschaltet.**

#### 3.1 Erst die roten Tests verstehen, dann bauen
- Die 8 Failures in `learningCloudSyncRuntime.test.tsx` (Account-Backup/Restore, No-Merge bei neuem Account, Debounced Save, Baseline-Cache, Mutation-Cursor, Legacy-Metadata-Fallback, Signature-Mismatch-Save) einzeln triagieren: Welche testen die neue Mutation-Log-Welt, welche die alte Signatur-Welt, und wo widersprechen sich die beiden? Ergebnis als kurzes Triage-Dokument festhalten, bevor Architekturarbeit beginnt.
- Inventar erstellen: Welche Code-Pfade schreiben heute tatsächlich nach Firestore (Bootstrap, Debounced Save, Flush-bei-Blocking-Review, Worker-Queue), und welche davon nutzen schon Mutation-Log/Cursor vs. noch Signaturen?

#### 3.2 Delta-Sync-Modell konsequent durchziehen (Anki-USN-Prinzip)
- Das vorhandene Mutation-Log zur einzigen Quelle für Uploads machen: Jede lokale Änderung erzeugt einen `SyncMutationEntry` (clientId + sequence existieren schon); Upload = alle Einträge nach dem letzten bestätigten Cursor, als Firestore-Batch-Writes (≤ 500 Docs/Batch), eine Subcollection pro Entitätstyp unter `/users/{uid}/learning/{type}/{id}` statt eines Monolith-Dokuments.
- Download: Query `where(updatedAt > cursor)` pro Subcollection.
- Konflikt: Last-Writer-Wins pro Entität via vorhandener `conflictResolution.ts`, mit Sonderregel für ReviewLogs (append-only, nie überschreiben) und `activeDeckUpdatedAt` (bestehende Latest-Wins-Logik beibehalten).
- Die Signatur-/Hash-Mechanik (`getLearningCloudStateSignature`, `visitLearningCloudSignature`) und `mergeLearningCloudStates` verlassen den Hot Path vollständig; höchstens als seltener Konsistenz-Check hinter einem manuellen "Daten prüfen"-Button.
- **Sync-Durabilität an Phase 2 koppeln:** Das Mutation-Log wird Teil des Write-ahead-Slots (2.2) – eine Mutation, die lokal committed ist, kann den Prozess-Tod überleben und wird beim nächsten Start hochgeladen. Offline-First by construction.

#### 3.3 Migration & Koexistenz
- Bestehende Cloud-States (Monolith-Dokument) einmalig in die Subcollection-Struktur migrieren; Legacy-Lesefallback für eine Übergangsversion behalten (einer der roten Tests deckt genau diesen Fallback ab – er wird zum Migrationspfad).
- Den toten `src/services/learningSyncService.ts` (laut Project Memory nicht im aktiven Pfad) löschen oder explizit als künftige API markieren – keine zwei halbwahren Sync-Schichten.
- Nach Abschluss: alte Signatur-Codepfade LÖSCHEN, nicht auskommentieren. Tote Sync-Pfade sind die Wurzel des aktuellen Problems.

#### 3.4 Account-Isolation als harte Garantie
- Lokale Daten werden pro `uid` namespaced persistiert (Persist-Key enthält uid bzw. "anonymous"). Account-Wechsel = Persist-Swap, niemals In-Place-Merge. Die bestehenden Account-Switch-Guards darauf umstellen; die 3 Account-Isolation-Tests müssen ohne Mock-Tricks grün werden.

#### 3.5 Ehrliche Sync-Copy
- `AppSettings`-Texte an den realen Sync-Umfang anpassen: Vokabeln/Reviews/Decks syncen; Blocking-Konfiguration, Unlocks und Assignments sind gerätelokal. Falls Unlock-Sync gewünscht ist → eigener, späterer Plan; nicht per Copy versprechen.

#### 3.6 Sichtbarer Sync-Status + robuste Fehlerbehandlung (Fix für Bug 2 aus Nutzersicht)
- **Sync-Status-UI:** Klein, aber ehrlich – in Learn/Settings: "Zuletzt synchronisiert: vor 2 Min ✓" / "Sync ausstehend (3 Änderungen)" / "Sync fehlgeschlagen – erneut versuchen". Ein stiller Sync, der heimlich scheitert, ist aus Nutzersicht identisch mit "Sync funktioniert nicht".
- **Retry mit Backoff:** Fehlgeschlagene Uploads (Netz weg, Firestore-Fehler) bleiben im Mutation-Log und werden mit exponentiellem Backoff erneut versucht – beim App-Start, bei Netz-Rückkehr (`Network`-Plugin-Listener) und periodisch im Vordergrund. Kein Fehler wird nur nach `console.warn` geschluckt.
- **Fehler kategorisieren:** Auth abgelaufen → Re-Login-Prompt; Quota/Rules-Fehler → Diagnose-Hinweis; Netzfehler → stiller Retry. Jede Kategorie hat einen definierten Nutzerpfad.
- **Sync-Konsistenz-Selbsttest:** Debug-Funktion "Sync prüfen", die lokale Entity-Counts/Checksummen gegen die Cloud vergleicht und Abweichungen meldet – das Diagnose-Werkzeug für künftige Bug-Reports.

#### Abnahmekriterien Phase 3
- [ ] Komplette Testsuite grün (433/433, keine skips außer dem bestehenden).
- [ ] 6000-Karten-Deck synct ohne Firestore-Fehler; Netzwerklast pro Folge-Sync < 100 kB bei 20 geänderten Karten.
- [ ] Zwei Geräte, ein Account: Review auf Gerät A erscheint nach Sync korrekt terminiert auf Gerät B.
- [ ] Account A → Account B → Account A auf einem Gerät: keine Vermischung, kein Verlust (automatisierter Test).
- [ ] Offline-Szenario: 10 Reviews im Flugmodus → App-Kill → Start → Netz an → alle 10 erscheinen in der Cloud und auf Gerät B.
- [ ] Sync-Status-UI zeigt nachweislich alle drei Zustände korrekt (✓ / ausstehend / fehlgeschlagen mit Retry-Button).
- [ ] Kein Sync-Codepfad mehr, der `getLearningCloudStateSignature` im Hot Path nutzt (grep-verifiziert).

---

### Phase 4: Lern-Qualität auf Anki-Niveau (2 Wochen, parallel zu 3 möglich)

**Ziel:** Die im Audit (Abschnitt 4) und Fahrplan (Phasen 2 & 5) identifizierten fehlenden Kernfeatures, priorisiert nach Lernwirkung.

#### 4.1 Review-Undo fertigstellen (Audit 4.B)
- `reviewSessionSlice` enthält Undo-Ansätze – vervollständigen: letztes Review zurückrollen stellt Card-State, FSRS-Memory-State, ReviewLog UND Unlock-Zähler der laufenden Session wieder her. UI: Undo-Button im Review-Screen + im Blocking-Lernflow.

#### 4.2 Suspend & Bury durchziehen (Audit 4.C)
- `suspended` existiert als State – sicherstellen, dass Scheduler/Queues ihn überall respektieren, UI-Aktionen (Karte aussetzen/heute begraben) im Card Browser und im Review-Screen anbieten, `burySiblings` als Deck-Setting (zusammen mit 4.4).

#### 4.3 Echte FSRS-Gewichtsoptimierung (Audit 4.A)
- `optimizer.ts` von der ±0.01-Retention-Heuristik auf echtes Training der `w`-Parameter heben. Pragmatischer Weg: den Optimizer aus `ts-fsrs`/fsrs-rs-Ökosystem in einem Web Worker über die ReviewLogs laufen lassen (Schwellen existieren schon: ≥300 Reviews, ≥14 aktive Tage). Ergebnis als Preset-Vorschlag mit "Übernehmen"-Dialog, nie stillschweigend.

#### 4.4 Fahrplan-Phase-5-Features in Reihenfolge
- 5.2 Per-Deck-Settings (`newCardsPerDay`, `maxReviewsPerDay`, `burySiblings`) → wirkt täglich.
- 5.4 Session-Resume (Crash/Abbruch → Session fortsetzbar; baut direkt auf dem Write-ahead aus 2.2 auf).
- 5.1 Multi-Cloze (`{{c1::…}} {{c2::…}}` → separate Karten).
- 5.3 Card Browser ausbauen (Module `card-search`/`browser` existieren bereits – Suche, Filter, Per-Card-Aktionen inkl. Suspend/Bury aus 4.2).

#### 4.5 Lern-UX-Reste aus Fahrplan Phase 2 prüfen
- Status von 2.1–2.5 (Mojibake, Learn-Hub, Session-Zusammenfassung, Feedback, Typed-Answer) gegen den aktuellen Code verifizieren und offene Punkte abschließen. (Stichprobe: Modes/AppSettings/Stats sind bereits aufgebrochen → Fahrplan Phase 4 ist erledigt; Phase 2-Status ist unklar und muss kurz auditiert werden.)

#### Abnahmekriterien Phase 4
- [ ] Undo stellt nach versehentlichem "Easy" den exakten Vorzustand wieder her (inkl. FSRS-State, Test vorhanden).
- [ ] Suspendierte Karten erscheinen in keiner Queue und in keinem Blocking-Lernflow.
- [ ] Optimizer berechnet auf einem echten Review-Log andere `w`-Parameter als die Defaults und verbessert die Log-Loss-Metrik auf Holdout-Reviews.
- [ ] Per-Deck-Limits greifen nachweislich (Test: zwei Decks, unterschiedliche Limits).

---

### Phase 4b: Flüssigkeit – die App fühlt sich überall sofort an (1–2 Wochen, nach 2, parallel zu 3/4)

**Ziel:** Nicht nur das Overlay, sondern jede Interaktion hat ein messbares Performance-Budget. "Flüssig" wird von einem Gefühl zu einer geprüften Zahl.

#### 4b.1 Performance-Budgets festschreiben (auf dem Xiaomi-Referenzgerät, Release-Build)
- Kaltstart bis interaktives Dashboard: < 2,5 s. Warmstart: < 1 s.
- Routenwechsel (Tab/Navigation): < 200 ms bis sichtbarer Inhalt, keine weißen Frames.
- Overlay-Trigger → erste Karte interaktiv: < 800 ms (aus Phase 2.3).
- Review-Antwort-Tap → nächste Karte sichtbar: < 100 ms.
- Modes-Save → "gespeichert"-Feedback: < 500 ms (Native-Sync läuft asynchron weiter).
- Diese Zahlen kommen in `docs/performance-baseline.md` (existiert bereits – erweitern) und werden bei jedem Release gegen gemessene Werte geprüft.

#### 4b.2 Startpfad entschlacken
- Store-Hydration profilen: Beim Kaltstart darf NICHT erst das komplette Learning-JSON deserialisiert werden, bevor das Dashboard rendert. Dashboard rendert mit Skeleton aus einem kleinen Meta-Slice (Deck-Namen, Counts), die volle Hydration läuft nebenher (baut auf 2.1 auf).
- Lazy-Route-Splitting verifizieren (ist via `lazy(routeLoaders...)` angelegt): Bundle-Analyse fahren (`vite build --mode analyze` o. ä.), Vendor-Chunks prüfen – `vendor-misc` mit 462 kB ist ein Kandidat zum Aufteilen; Firebase nur laden, wenn Auth/Sync wirklich gebraucht wird.
- Capacitor-WebView-Warmup: Prüfen, ob die `BlockingOverlayActivity` eine bereits warme WebView-Instanz nutzen kann (geteilter Prozess) statt kalt zu booten – das ist der größte Hebel für die Overlay-Latenz.

#### 4b.3 Render-Jank eliminieren
- React-Profiler-Session über die Top-Flows (Review, Modes, Stats, Learn-Hub): Komponenten, die bei jedem Store-Update neu rendern, mit gezielten Selektoren/`memo` beruhigen (Dictionaries aus 2.1 machen das erst möglich).
- Lange Listen (Card Browser, Deck-Listen, Stats-Tabellen) virtualisieren (`@tanstack/react-virtual` o. ä.) – niemals 5000 DOM-Knoten.
- Animations-Audit: `framer-motion`/`animejs`-Animationen auf `transform`/`opacity` beschränken (GPU-Pfad), keine Layout-Animationen in Listen; Breathing-Sphere (Three.js) darf außerhalb des Breathing-Screens nicht gemountet bleiben.
- `requestAnimationFrame`-Jank-Messung in Debug-Builds: dropped-frames-Zähler pro Screen loggen, Screens > 5 % dropped Frames werden Tickets.

#### 4b.4 Wahrgenommene Geschwindigkeit
- Optimistische UI überall, wo nativ/asynchron gearbeitet wird: Review-Antwort wechselt sofort die Karte (Persist läuft im Hintergrund, WAL sichert), Modes-Save zeigt sofort Erfolg (Native-Snapshot-Sync asynchron mit Fehler-Toast bei echtem Fehlschlag).
- Skeletons statt Spinner für Dashboard/Stats/Learn-Hub; keine layout-shiftenden Ladezustände.
- Haptik (leichtes Tick bei Review-Antwort, Erfolg bei Unlock) – billig, großer Gefühlseffekt.

#### Abnahmekriterien Phase 4b
- [ ] Alle Budgets aus 4b.1 auf dem Referenzgerät im Release-Build gemessen und eingehalten.
- [ ] Bundle: kein Initial-Chunk > 250 kB gzip außer Framework-Vendor; Firebase lädt nachweislich lazy.
- [ ] Card Browser scrollt mit 5000 Karten butterweich (Virtualisierung, < 5 % dropped Frames).
- [ ] Review-Tap → nächste Karte < 100 ms, 20× in Folge gemessen.

---

### Phase D: Design-Overhaul – schöner, schlichter, kompakter, weniger Text (1,5–2 Wochen, parallel ab Phase 2 möglich)

**Ziel:** Blearn sieht aus wie ein ruhiges, hochwertiges Fokus-Werkzeug – nicht wie eine App, die sich selbst erklären muss. Diese Phase ist als eigenständiges Briefing für einen Design-/Implementierungs-Agenten geschrieben: Sie enthält Ist-Befund, Designrichtung, harte Regeln und messbare Abnahme. Der Agent darf innerhalb der Regeln gestalterisch entscheiden, aber nicht die Regeln selbst aufweichen.

#### D.0 Ist-Befund (Code-verifiziert, 2026-06-12)
- **Token-Basis ist gut:** shadcn/Tailwind mit sauberem HSL-Variablen-System in `src/index.css` (background/primary/accent/success/warning/destructive + `--surface-hero`), `--radius: 1rem`. Fonts: Inter (sans) + Playfair Display (serif). Palette: warmes Creme (`43 24% 97%`), Petrol-Primary (`190 78% 28%`), Gold-Akzent (`40 56% 52%`).
- **Problem 1 – Texthypertrophie (messbar):** Strings > 80 Zeichen pro Komponentenordner: `modes/` 57, `settings/` 49, `wallet/` 39, `setup/` 35, `learn/` 20. Beispiele aus dem echten UI: "Diese Kachel bleibt rot, bis die Lightning-Adresse technisch bestätigt wurde. Erst dann gilt sie als sicher genug für echte Strafzahlungen." – das ist Dokumentation im Interface, kein Interface.
- **Problem 2 – Genericness-Risiko:** Warmes Creme + Serif-Display ist exakt einer der drei meistgesehenen KI-Default-Looks. Die Palette ist nicht falsch, aber sie trägt aktuell keine Blearn-Identität.
- **Problem 3 – Dichte:** Cards mit Titel + Description + Hinweistext + Badge stapeln sich; Settings/Modes sind lange Scroll-Strecken, obwohl die eigentliche Entscheidung pro Abschnitt klein ist (ein Toggle, eine Auswahl).

#### D.1 Designrichtung (das Briefing)
- **Ein Satz als Nordstern:** Blearn ist der ruhige Moment zwischen Impuls und Handlung. Das Design verkörpert das: viel Ruhe (Fläche, Luft, wenige Worte), ein einziger bewusster Akzentmoment pro Screen.
- **Palette behalten, schärfen statt ersetzen:** Das Creme/Petrol/Gold-System bleibt (Wiedererkennung, Token-Migration billig), aber: Gold wird zum reinen Erfolgs-/Belohnungsakzent (Unlocks, Streaks, abgeschlossene Sessions), Petrol zur einzigen Interaktionsfarbe. Keine Screens, auf denen beide Akzente konkurrieren. Destructive/Warning nur in echten Gefahr-/Warnmomenten.
- **Typografie-Disziplin:** Playfair Display nur noch an maximal einer Stelle pro Screen (Screen-Titel oder die eine große Zahl – nicht beides), nie in Cards, nie unter 24 px. Alles andere Inter. Typescale auf 5 Stufen einfrieren (z. B. 13/15/17/22/28) und als Tailwind-Preset erzwingen – heute existierende Ad-hoc-Größen werden migriert.
- **Signature-Element:** Der Atem-/Fokus-Kreis (existiert als Breathing-Sphere) wird zur visuellen Identität der ganzen App: als reduziertes Ring-Motiv im Fortschritt (Lernsession-Ring statt Balken), im Unlock-Countdown, im App-Icon-Echo auf dem Dashboard. Ein Motiv, überall wiedererkennbar – statt vieler verschiedener Fortschrittsdarstellungen.
- **Kompaktheit als Layoutprinzip:** Listenzeilen statt Cards für alles Konfigurative (Modes-Targets, Settings-Einträge): eine Zeile = Icon + Label + Wert/Toggle, 56 px hoch, Trennlinie statt Card-Rahmen. Cards nur noch für eigenständige Objekte (ein Deck, eine Statistik, ein aktiver Block).

#### D.2 Harte Copy-Regeln ("deutlich weniger Erklärtexte")
- **Budgets, die der Implementierungs-Agent einhalten MUSS:**
  - Screen-Untertitel: max. 1 Zeile (≤ 60 Zeichen) – oder weg.
  - Beschreibung unter einem Control: max. 1 Zeile, nur wenn das Label allein missverständlich wäre. Default: keine.
  - Kein Text, der beschreibt, was die UI sichtbar sowieso zeigt ("Hier siehst du…", "Diese Kachel bleibt rot, bis…" → die Kachel IST rot und hat ein Status-Label, fertig).
  - Erklärungen > 1 Zeile wandern in Progressive Disclosure: ein dezentes ⓘ/"Mehr erfahren" öffnet Sheet/Popover. Erste Nutzung darf einen Einmal-Hinweis zeigen (dismissbar, nie wieder).
  - Buttons benennen die Aktion in 1–3 Wörtern, aktiv ("Speichern", "Deck wählen", "Freischalten") – und behalten denselben Namen im Erfolgs-Toast ("Gespeichert").
  - Fehlertexte: 1 Satz was passiert ist + 1 Aktion ("Sync fehlgeschlagen. Erneut versuchen."). Keine Entschuldigungen, keine Technik-Interna.
- **Messbare Zielwerte (Abnahme):** Strings > 80 Zeichen in `modes/` ≤ 10 (heute 57), `settings/` ≤ 10 (heute 49), `wallet/` ≤ 12 (heute 39), `setup/` ≤ 10 (heute 35). Onboarding/Setup: max. 1 kurzer Satz pro Permission-Schritt + 1 Visual; der Erklär-Vorspann ("Zuerst kurz verstehen, was Blearn für dich macht…") entfällt zugunsten von Show-don't-tell.
- **Ein Glossar als Single Source:** `docs/ui-copy-glossar.md` mit den festen Begriffen (Ziel, Modus, Freischaltung, Lerntor, Strikt, Strafe, Schutzstatus…). Jede Funktion heißt überall exakt gleich – Konsistenz ersetzt Erklärtext.

#### D.3 Screen-Prioritäten für den Agenten (Reihenfolge = Wirkung)
1. **Blocking-Flow-Screens (Intervention, Breathing, Check-in, LearnReview):** Hier zählt Ruhe am meisten. Vollflächig, ein Element im Fokus, Signature-Ring als Fortschritt, null Erklärtext (der Nutzer ist mitten in einer Handlung). Abbruch/Notausgang (Phase 1.6/1.7) als dezenter, aber immer sichtbarer Sekundär-Pfad.
2. **Modes:** Von Card-Stapeln auf kompakte Listenzeilen mit Inline-Werten; Modus-Auswahl als segmentierte Kontrolle statt erklärender Cards; die 57 Langtexte auf ≤ 10 reduzieren. Save-Feedback optimistisch (aus 4b.4).
3. **Dashboard:** Eine Hero-Aussage (Schutzstatus + heutiger Fokus als Ring), darunter maximal 3 kompakte Module. Keine Willkommens-/Erklärprosa.
4. **Settings + Setup/Onboarding:** Listenzeilen, Permission-Schritte mit je 1 Satz + Systemdialog, Wallet-Sektion entschlacken (Status-Chip statt Absätzen).
5. **Learn-Hub + Stats:** Deck-Karten kompakt (Titel, Due-Zahl, Ring), Stats mit den vorhandenen Charts aber halbierter Label-Menge.
- **Arbeitsweise des Agenten:** Pro Screen erst Screenshot/Ist-Aufnahme → Redesign-Skizze gegen D.1/D.2 prüfen → umbauen → Vorher/Nachher-Screenshot in `docs/design/` ablegen. Bestehende shadcn-Komponenten weiterverwenden und über Tokens/Varianten stylen, keine Parallel-Komponentenbibliothek aufbauen.

#### D.4 Technische Leitplanken
- Alle Farb-/Radius-/Schattenänderungen ausschließlich über die CSS-Variablen in `src/index.css` und Tailwind-Preset – kein Hardcoding in Komponenten (heutige Verstöße beim Umbau gleich mitbereinigen).
- Dark Mode: Token-Paar vollständig pflegen; jeder umgebaute Screen wird in beiden Modi abgenommen.
- Touch-Targets ≥ 44 px, Kontrast WCAG AA, `prefers-reduced-motion` respektieren (betrifft Ring-Animationen).
- Keine neuen Abhängigkeiten ohne Not; Animationen über die bestehenden framer-motion-Primitives, nur `transform`/`opacity` (Anschluss an 4b.3).
- Copy-Lint als Wächter: ein kleines Skript (`scripts/copy-budget.mjs`), das Strings > 80 Zeichen pro Ordner zählt und in CI gegen die Zielwerte aus D.2 prüft – damit der Erklärtext nicht zurückwuchert.

#### Abnahmekriterien Phase D
- [ ] Copy-Budget-Skript läuft in CI und alle Zielwerte aus D.2 sind eingehalten.
- [ ] Vorher/Nachher-Screenshots aller 5 Screen-Gruppen liegen in `docs/design/` und wurden in beiden Farbmodi geprüft.
- [ ] Playfair Display kommt pro Screen höchstens einmal vor (grep-/Review-verifiziert); Typescale-Preset ist aktiv und Ad-hoc-Größen sind migriert.
- [ ] Der Signature-Ring ersetzt alle bisherigen Fortschrittsdarstellungen in Lernsession, Unlock-Countdown und Dashboard.
- [ ] Modes/Settings sind als Listenzeilen umgesetzt; ein kompletter Modes-Durchlauf (Ziel hinzufügen → Modus wählen → speichern) kommt ohne einen einzigen Text > 1 Zeile aus.
- [ ] Kein Hardcoded-Hex/HSL in `src/components`/`src/pages` außerhalb der Token-Definitionen (grep-verifiziert).

---

### Phase 5: Härtung, Sicherheit & Release-Reife (1 Woche + laufend)

**Ziel:** Die App ist gegen Manipulation angemessen robust, geht sorgsam mit Daten um und ist releasefähig.

#### 5.1 Bedrohungsmodell ehrlich dokumentieren
- Blearn ist Selbstbindungs-Software: Der "Angreifer" ist der eigene zukünftige Impuls, nicht ein Profi. In `docs/threat-model.md` festhalten, was Blearn garantiert (Reibung + bewusste Entscheidung) und was nicht (Deinstallation, Accessibility deaktivieren, Zweitgerät). Das schützt vor Feature-Wünschen, die in feindseliges Verhalten abrutschen.
- Bekannte Umgehungen mit Reibung versehen statt hart blockieren: Deinstallations-/Deaktivierungsversuch im Strict-Fenster → Verzögerungs-Dialog ("In 60 s fortfahren") + Atemübung anbieten. Kein Festklammern via Device-Admin über das Strict-Fenster hinaus (Play-Store-Policy-Risiko und Nutzervertrauen).

#### 5.2 Datenschutz des Accessibility-Pfads
- `ObservedTextCollector` liest Bildschirmtext in Browser-Apps – das ist hochsensibel. Garantieren und dokumentieren: Text wird nur in-memory gegen die Blockliste gematcht, nie persistiert, nie gesynct, nie geloggt (Release-Build: Debug-Logging ist bereits an `FLAG_DEBUGGABLE` gebunden – verifizieren, dass kein Pfad Text in Prefs/Firestore schreibt). Kurzer Privacy-Abschnitt in der App (Play-Store-Pflicht für Accessibility-Nutzung: prominent disclosure + Begründung).
- Play-Store-Vorbereitung: Accessibility-API-Nutzung muss im Listing deklariert und begründet werden; VPN-Service ebenso. Ohne saubere Deklaration drohen Ablehnungen.

#### 5.3 Release-Build-Hygiene
- Proguard/R8-Regeln gegen die Capacitor-Plugins und Reflection-Pfade testen (Release-APK auf dem Gerät durch die Smoke-Checkliste aus 1.5).
- `google-services.json` im Repo ist für Firebase-Android-Apps üblich und durch die restriktiven Firestore-Rules abgesichert – aber App-Check (Play Integrity) aktivieren, damit nur echte App-Builds die API nutzen.
- Versionierung + CHANGELOG einführen; CI-Pipeline (GitHub Actions): lint, test, build, Debug-APK-Artefakt, Manifest-Präsenz-Check aus 0.1.

#### 5.4 Penalty/Wallet-Pfad auditieren
- `albyWalletService` (Lightning/Bitcoin via Alby SDK) und die Stripe/SendGrid-Cloud-Functions: Secrets liegen korrekt serverseitig. Prüfen: Was passiert bei Wallet-Fehlern mitten im Penalty-Flow? Kein Pfad darf Geld abbuchen, ohne dass der Nutzer den finalen Schritt explizit bestätigt; Fehlerzustände müssen den Block auflösen statt den Nutzer einzusperren.

#### Abnahmekriterien Phase 5
- [ ] `docs/threat-model.md` existiert und ist mit dem North Star konsistent.
- [ ] Verifiziert (Code-Review + Test): beobachteter Bildschirmtext verlässt nie das Gerät und überlebt keinen Prozess.
- [ ] Release-APK besteht die Smoke-Checkliste.
- [ ] CI läuft bei jedem Push: lint + test + build + Manifest-Check.

---

### Phase 6: Messen & Nachschärfen (laufend)

- Lokale (privacy-freundliche, opt-in) Metriken: Overlay-Trigger-Latenz, Handoff-Erfolgsquote (Trigger → Route-Ready), Sync-Dauer, Review-Antwortlatenz. Wöchentlich gegen die Zielwerte aus Phase 1–3 prüfen.
- `docs/project-memory.md` nach jeder Phase aktualisieren (das Dokument ist der größte Architektur-Vorteil dieses Projekts – pflegen!).
- Offenen UX-Bug aus dem Memory abräumen: Modes-Save zeigt fälschlich "Einstellungen bereits aktiv" – Triage in `Modes.tsx` Save-State-Derivation (jetzt nur noch 489 Zeilen, gut machbar).

---

## Empfohlene Reihenfolge & Aufwand (grob)

| Phase | Inhalt | Aufwand | Warum zuerst |
|---|---|---|---|
| 0 | Repo-Integrität (Manifest!) | 1 Tag | Ohne sie ist alles andere gefährdet |
| 1 | Blocking-Zuverlässigkeit + Abbruch-Vertrag & Notausgang | 1,5–2,5 Wochen | Kernversprechen Nr. 1 + Bug 3 (Overlay-Schleife) |
| 2 | Lern-Performance + Write-ahead + Flush + Chaos-Tests | 2–3 Wochen | Kernversprechen Nr. 2 + Bug 1 (verlorene Vokabeln) |
| 3 | Delta-Sync-Migration fertigstellen + Sync-Status-UI | 2–3 Wochen | Bug 2 (Sync), einziger roter Testbereich |
| 4 | Lern-Features (Undo, Optimizer, …) | 2 Wochen | Qualität, parallel zu 3 möglich |
| 4b | Flüssigkeits-Budgets (Start, Jank, Optimistic UI) | 1–2 Wochen | "Flüssig" wird messbar, parallel zu 3/4 |
| D | Design-Overhaul (schlichter, kompakter, weniger Text) | 1,5–2 Wochen | Eigenständiges Agent-Briefing, parallel ab Phase 2 |
| 5 | Härtung & Release | 1 Woche + laufend | Play-Store- und Vertrauensreife |
| 6 | Messen | laufend | Verhindert Rückschritte |

Gesamtrahmen: ca. 10–13 Wochen bei einer Person, deutlich kürzer mit Agent-Unterstützung pro klar geschnittener Phase. Phase D ist bewusst als in sich geschlossenes Briefing formuliert und kann komplett an einen eigenen Design-Agenten delegiert werden, sobald Phase 2.1 (Store-Umbau) nicht mehr aktiv in denselben Dateien arbeitet.

**Bug-zu-Phase-Mapping (Kurzreferenz):**
- "Vokabeln werden nicht gespeichert" → 2.2 (Write-ahead) + 2.6 (Pause-Flush) + 2.7 (Chaos-Tests als Beweis)
- "Cloud-Sync funktioniert nicht" → 3.1–3.3 (Migration fertigstellen) + 3.6 (Status sichtbar, Retry, kein stilles Scheitern)
- "Nach Abbruch komme ich nicht zurück zur App" → 1.6 (Abbruch-Vertrag, Home-Intent, Suppression, Stale-TTL) + 1.7 (Notausgang, Trigger-Sturm-Watchdog)

---

## Umsetzungsstand & offene Agent-Aufgaben (aktualisiert 2026-06-12, zweite Runde)

### ✅ In dieser Umgebung erledigt und test-verifiziert (Branch `fix/masterplan-phase0-bugfixes`, 5 Commits)

| Bereich | Was | Beweis |
|---|---|---|
| Phase 0 | .gitignore-Fix, Junk raus, `check:android-sources`-Wächter | Frischer-Clone-Schutz aktiv |
| Bug 3 | Abort-Suppression-Store, Home-Intent, 2-min-TTL alle Stages, selbstheilender Dismiss | Tests + Code-Review (Java ungebaut, siehe A1) |
| Bug 1 | `flushAllPersistStorage` + Pause-Flush-Hook + Review-WAL (2.2) mit Replay | 11 Tests, Chaos-Skripte (2.7) |
| Phase 3.1 | 8 rote Sync-Tests: Ursache fehlende Test-Hermetik (VITE_FIREBASE_*), gefixt | 444→465 Tests grün, Triage-Doc in docs/audits |
| Phase 3.6 | SyncStatusBadge (✓/busy/Fehler+Retry/abgemeldet) im Learn-Header | 6 Tests |
| Phase 4.1 | Undo: ältester-statt-neuester-Log-Bug + WAL-Resurrection-Bug gefixt | 2 Tests inkl. erzwungenem Replay |
| Phase 4.2 | Suspendierte Karten leckten in Due-Queue/Blocking-Flow → Filter gefixt | 2 Tests (erst rot, dann grün) |
| Phase D.4 | `check:copy-budget`-Ratchet auf Ist-Baseline | CI-fähig |

### ✅ Funktionsprüfung Emotionstracking / Vokabeltracking / Strict-Modus (2026-06-12)

**Emotionstracking — Befund: Pipeline korrekt, war ungetestet.**
Erfassung (Checkin.tsx → addCheckin + addInteraction), Persistenz (Caps: 100 Checkins, begrenzte Interactions im userProfile) und Auswertung (`buildMoodEntries` mit Dedupe zwischen Checkin- und Interaction-Strom, checkin-typ Interactions werden korrekt NICHT doppelt gezählt) arbeiten konsistent. Die nicht-triviale Merge-Logik ist jetzt mit 4 Tests abgesichert (`src/modules/stats/__tests__/emotions.test.ts`).

**Vokabeltracking — Befund: 1 Timezone-Bug gefunden und gefixt.**
`countDistinctActiveDays` bucketete Tage in UTC (`toISOString`), während `countReviewsToday` lokale Mitternacht nutzt — Reviews um Mitternacht zählten inkonsistent (betrifft u.a. die Optimizer-Schwelle "≥14 aktive Tage"). Auf `getLocalDateKey` umgestellt, 3 Tests (`trackingUtils.test.ts`). Hinweis für Agent C: `MAX_REVIEW_LOGS`-Eviction in submitReview kürzt historische Tageszählungen by design — bei Langzeit-Statistiken berücksichtigen.

**Strict-Modus — Befund: Anforderung war nur in der UI erfüllt, Store-Enforcement fehlte. Gefixt.**
Anforderung (Aktivierung → Pflicht-Zeitfenster, Einstellungen im Fenster unveränderbar, max. 20 h): Zeitfenster-Pflicht ✓ (Aktivierung nur innerhalb Start/Ende). Das 20-h-Maximum existierte NUR als UI-Validierung (`MAX_STRICT_LOCK_DURATION_HOURS`); der Store akzeptierte bis ~24 h. Und `setStrictSchedule` war während eines laufenden Locks NICHT geschützt (Addon-Konfiguration war es vorbildlich, das Haupt-Fenster nicht). Jetzt: geteilte Limit-Quelle `src/lib/strictLockLimits.ts`, hartes Clamp in `activateStrictLock` UND `activateStrictAddon`, `setStrictSchedule` ist während aktivem Lock ein No-op und nach Ablauf wieder frei. 4 Tests (`strictLockEnforcement.test.ts`).

### ✅ Zweite Umsetzungsrunde erledigt (2026-06-13) — alle Sub-Agenten-Aufgaben

| Bereich | Was | Beweis |
|---|---|---|
| A1 | Gradle-Build aller Java-Dateien grün; Manifest+res bereits committet | `gradlew compileDebugJavaWithJavac` / `assembleDebug` ✓ |
| A1-Zusatz (1.4) | `StrictLockClockGuard` (elapsedRealtime+Boot-Count), `PolicySnapshotReader.read(context,…)`, Elapsed-Reconcile-Alarm | kompiliert; Wall-Clock-Sprung beendet Lock nicht mehr |
| A2 (1.1–1.3, 1.7) | `ProtectionWatchdog` (Trigger-Sturm/Accessibility-Down/Reboot), Health-Felder im Plugin, Battery-Opt-Flow, `ProtectionStatusCard` | `protectionHealth.test.ts` (8) |
| A3 (2.3/2.5) | Micro-Session-Latenz-Log (<800 ms Ziel), Media-Registry ohne Base64-Blobs (`note-media://`) | `mediaRegistry.test.ts` (+Blob-Regression) |
| B (3.6) | Backoff-Retry + Netz-Rückkehr/Visibility-Listener | `useLearningCloudSaveRetry.test.tsx` (3) |
| C (4.3/4.4) | FSRS-w-Optimizer (Koordinatenabstieg/Holdout) im Worker + Vorschlag-UI; Per-Deck-Settings; Suspend/Bury; Multi-Cloze; Session-Resume | weightOptimizer(4)/multiCloze(5)/cardSuspendBury(4)/sessionResumeSlot(5) |
| C | Undo-Button im Blocking-Lernflow (Logik+UI bereits vorhanden, verifiziert) | LearnReviewActions |
| D | SignatureRing (Lern-Header), ListRow-Primitive, Strict-Lock-Endzeit "Gesperrt bis HH:MM" | tsc grün |
| Modes-Bug | "Einstellungen bereits aktiv" → Reaktivierung zählt als Änderung (`needsReactivation`) | modesUiSmoke 30/30 |
| 5 | `docs/threat-model.md`, Privacy-Pfad verifiziert, CI `.github/workflows/ci.yml` | check:android-sources/copy-budget grün |

**🔶 Verbleibt (braucht das physische Gerät / weitere Iteration):**
- Geräte-Smoke-Tests a–d + `scripts/chaos/run-chaos.sh` auf dem Xiaomi `22101320G` (Gerät war während dieser Runde nur kurz verbunden).
- Phase D Vollausbau: Vorher/Nachher-Screenshots in `docs/design/`, vollständiger Modes/Settings-Listenzeilen-Umbau (Primitive `ListRow.tsx` steht bereit), Dark-Mode-Abnahme pro Screen.
- Phase 3 Monolith→Subcollection-Migration (3.2/3.3) + Signatur-Hot-Path-Löschung + Account-Namespacing (3.4): braucht echtes Firestore + Migrationslauf.
- Lint-Vorbestand (`ModesPageView`/`AuthDialog.test`) abbauen. `appIntroFlow` ist seit der Stabilisierung am 2026-06-13 wieder grün.
- **[ALLE] Vor Merge:** `npm run test` && `npm run build` && `npm run check:copy-budget` && `npm run check:android-sources`; `docs/project-memory.md` nach jeder Phase aktualisieren.

### Performance-Update (Runde 3, 2026-06-12)

**Erledigt (4b.2 teilweise, messbar):**
- Alby/Lightning-SDK aus der initialen Ladekette entfernt: war via penaltySlice statisch im App-Store-Importgraph. Jetzt dynamischer Import bei erster Nutzung + eigener `alby`-Chunk. **vendor-misc: 452 kB → 211 kB (gzip 147 → 66,5)**; der 260-kB-Alby-Chunk (82 kB gzip) lädt nur noch bei Wallet-/Penalty-Nutzung. Initialer Kaltstart: ~80 kB gzip leichter.
- sql.js (Anki-Import, inkl. WASM-Loader) aus dem Store-Importgraph gelöst: dynamischer Import im importSlice; liegt jetzt im eigenen Lazy-Chunk `ankiImport` + separatem WASM-Asset.
- Selbstprüfungs-Fix: WAL-Clear-Regel im Pause-Flush präzisiert (Tracker droppt idle Keys; WAL wird jetzt immer geleert, außer der Learning-Flush lief in einen Timeout).

**[AGENT A3 / D — OFFEN, Performance 4b]:**
- `learning-engine` (ts-fsrs, 27 kB gzip) hängt weiter in der initialen Kette via useLearningStore — prüfen ob Store-Hydration ohne FSRS-Import starten kann (4b.2 Startpfad).
- index-CSS 172 kB (24,7 gzip): Tailwind-Purge-Audit.
- Geräte-Messungen (Budgets aus 4b.1): Kaltstart, Overlay→erste Karte, Review-Tap-Latenz — NUR auf dem Gerät messbar.
- Listen-Virtualisierung (Card Browser, 4b.3), React-Profiler-Session, Breathing-Sphere-Mount-Audit.
- Design (Phase D) ist unverändert KOMPLETT offen — nur der Copy-Ratchet existiert. SyncStatusBadge als Copy-Vorbild.

### Design- & Performance-Update (Runde 4, 2026-06-12)

**Phase D — Kern ohne Bilder umgesetzt (D.2 Copy-Redaktion + D.1 Typografie):**
- Copy-Wächter-Messfehler behoben: Tailwind-Klassen, JSX-Fragmente und Template-Code zählten als "Erklärtext". Echte Copy-Last vorher: 52 Strings > 80 Zeichen.
- Vollständige Copy-Redaktion über alle Hotspots (Modes, Setup/Onboarding inkl. App-Tour, Wallet-Seite + -Komponenten, Learn, Settings): 45 Strings nach D.2-Regeln gekürzt — kein "Hier siehst du …", Aktion statt Erklärung, ≤ 80 Zeichen, deutsche Umlaute statt Transliterationen ("Oeffne" → "öffnen"). Ergebnis: Modes 3, Settings 1, Wallet 2, Setup 0, Learn 1, Pages 1. Ratchets final abgesenkt (5/3/4/3/3/4) — Regressionen schlagen ab sofort in CI fehl. 2 Test-Assertions an die neue Copy angepasst.
- Typografie-Disziplin (max. 1 Serif pro Screen): App war fast konform; einzige Doppelnutzung (Pause.tsx) bereinigt.
- **[AGENT D — verbleibt, braucht Gerät/Screenshots]:** Listenzeilen-Umbau Modes/Settings, Signature-Ring, Dark-Mode-Abnahme pro Screen, Vorher/Nachher-Screenshots, D.3-Screenreihenfolge.

**Performance (4b.2, Runde 2):**
- Render-blockierendes Font-@import aus index.css entfernt → paralleles `<link>` + Preconnect in index.html (sequenzielle CSS→@import→Fonts-Kette entfällt beim First Paint).
- **[AGENT A3/D]:** 172-kB-CSS stammt nicht aus Fonts/Data-URLs (geprüft: 0 kB inline) — Tailwind-Utility-Volumen; Audit lohnt erst nach dem Phase-D-Komponentenumbau.

**GitHub-Push:** Aus dieser Umgebung nicht möglich (kein Schreibzugriff; Push-Versuch dokumentiert fehlgeschlagen mangels Credentials — Zugangsdaten werden hier grundsätzlich nicht gehandhabt). Lokal: `git am blearn-fixes-phase0-bugs.patch && git push origin <branch>`.
