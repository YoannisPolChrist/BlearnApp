# Native Blocking & Handoff Architecture

**Status: ACTIVE — vollständig implementiert. Dieses Dokument ist verbindliche Architekturregel.**

Dieses Dokument formalisiert die Architekturentscheidung für Blearms App-Blocking-Mechanik und dient als
verbindliche Leitlinie für alle zukünftigen Agenten und Entwickler.

---

## Kernziel

Blearn wandelt impulsive, ablenkende App-Nutzung in einen bewussten Lern- oder Reflexions-Moment um.
Blocking darf sich **niemals** chaotisch, strafend oder technisch kaputt anfühlen.

> **Explizit verboten**: `am force-stop <package>`, `GLOBAL_ACTION_HOME`-Redirect, Shizuku,
> Root-Rechte oder ADB-Shell-Befehle im Blocking-Pfad. Wer diese Methoden einführt, verstößt
> gegen dieses Architekturdokument.

---

## Die vier Prinzipien

### 1. Protective Sheet (Overlay-First)

Blockierte Apps werden **nicht beendet**. Stattdessen wird sofort ein `TYPE_ACCESSIBILITY_OVERLAY`
via WindowManager über die laufende App gelegt.

**Implementiert in:** `OverlayPresenter.java`

- Vollbild-FrameLayout mit `FLAG_LAYOUT_IN_SCREEN | FLAG_KEEP_SCREEN_ON`
- Touch-Capture auf dem Root-View schützt die App darunter
- Scrim-Farbe variiert nach Modus (learn = dunkelgrün, strict/penalty/lock = dunkelrot, default = dunkelblau)
- Glow-Effekt (24 % Alpha) signalisiert visuell den aktiven Zustand
- `hideInternal()` verwendet `removeViewImmediate` für sofortigen, sauberen Abbau

**Wichtig:** `OverlayPresenter` implementiert `OverlayHandoffCoordinator.OverlayHandle` – der Coordinator
steuert das Overlay, nicht umgekehrt.

---

### 2. Smart Handoff ohne Flackern

Der Übergang overlay → Blearn-Intervention läuft über einen dedizierten **State Machine**:

**Implementiert in:** `OverlayHandoffCoordinator.java` + `OverlayHandoffPolicy.java`

**Zustände:**

| Stage                   | Bedeutung                                               |
|-------------------------|---------------------------------------------------------|
| `IDLE`                  | Kein aktiver Blocking-Flow                              |
| `OVERLAY_VISIBLE`       | Overlay gezeigt, Launcher noch nicht gestartet          |
| `LAUNCHING`             | `BlockingOverlayActivity` wird gestartet                |
| `WAITING_FOR_ROUTE_READY` | Activity läuft, React wartet auf Route-Ready-Signal   |
| `STALLED`               | Route-Ready-Timeout — manuelle Aktion möglich           |

**Suppression-Logik:** `OVERLAY_VISIBLE`, `LAUNCHING` und `WAITING_FOR_ROUTE_READY` unterdrücken
neue Accessibility-Trigger. Nur `STALLED` erlaubt einen neuen Overlay für ein anderes Ziel.

**Timeout-Kaskade:**
- `HANDOFF_TIMEOUT_MS = 2_500ms` → Wechsel zu `STALLED`
- `MAX_TOTAL_TIMEOUT_MS = 9_000ms` → Erzwungener Reset des gesamten Flows

**Persistenz:** `PendingNavigationStore.java` schreibt den Handoff-State via `SharedPreferences`
(commit, nicht apply) – damit übersteht er einen Prozessrestart.

---

### 3. Trennung von Erkennung und Durchsetzung

Erkennung (was ist vorne?) und Blockierentscheidung (soll ich blockieren?) sind sauber getrennt.

**Implementiert in:** `TargetMatcher.java` + `BlockingTriggerDecision.java`

**TargetMatcher:**
- `findAppMatch()` prüft direkt gegen `PolicySnapshot.appTargets`
- `findTextMatch()` prüft URL/Suchtext in Browser/Search-Paketen
- `shouldInspectText()` limitiert Text-Inspektion auf eine sichere Whitelist von Browser-Packages

**BlockingTriggerDecision.decide()** — zentrale Guard-Logik vor jedem `OverlayPresenter.show()`:

| Bedingung                                           | Aktion             |
|-----------------------------------------------------|--------------------|
| Kein aktiver Overlay-State                          | `PROCEED`          |
| Handoff läuft, Pending-Navigation vorhanden         | `SUPPRESS`         |
| Handoff läuft, aber keine Pending-Navigation        | `RESET_AND_PROCEED`|
| Overlay sichtbar, kein Overlay attachiert           | `RESET_AND_PROCEED`|
| Gleicher Target-Key bereits aktiv                   | `SUPPRESS`         |
| Anderer Target-Key sichtbar                         | `RESET_AND_PROCEED`|

---

### 4. Zero "Hacky" Dependencies

- Kein `Shizuku`, kein Root, kein `am force-stop`
- App-Blocking = `AccessibilityService` + `SYSTEM_ALERT_WINDOW` (Overlay)
- Website/Search-Blocking = `BlearnVpnService` (DNS-Filter via `DnsDecisionEngine`)
- Die beiden Methoden sind komplementär, nicht redundant

---

## Vollständiger Flow (Referenz)

```
Accessibility-Event kommt an
  │
  ├── TargetMatcher → PolicyMatch?
  │     ├── nein → hideOverlayIfIdle() → done
  │     └── ja  →
  │
  ├── snapshot.isUnlocked()? (nur non-lock)
  │     ├── ja  → hideOverlayIfIdle() → done
  │     └── nein →
  │
  ├── OVERLAY_COOLDOWN_MS (1500ms) aktiv?
  │     └── ja  → suppress → done
  │
  ├── BlockingTriggerDecision.decide()
  │     ├── SUPPRESS → done
  │     ├── RESET_AND_PROCEED → BlockingFlowState.reset() → weiter
  │     └── PROCEED → weiter
  │
  └── showBlockingOverlay(match)
        │
        OverlayPresenter.show()
          │
          ├── WindowManager.addView() → Overlay über die geblockte App
          ├── OverlayHandoffCoordinator.registerOverlay()
          ├── showLaunchingState() → Scrim dunkel / Alpha 1.0
          └── onPrimaryAction.run()
                │
                openIntervention(match)
                  │
                  PendingNavigationStore.save()
                    │
                    PendingNavigationLauncher.open()
                      │
                      OverlayHandoffCoordinator.beginLaunch()  → Stage: LAUNCHING
                        │
                        BlockingOverlayActivity startet
                          │
                          ├── scheduleBlockingSplash() (300ms delay)
                          ├── super.load() → Capacitor WebView lädt
                          └── React: useNativePendingNavigation → navigiert zur Route
                                │
                                BlockingFlowState.completeRouteReady()
                                  │
                                  ├── PendingNavigationStore.completeActiveHandoff()
                                  ├── OverlayHandoffCoordinator.completeRouteReady() → Stage: IDLE
                                  └── BlockingOverlayActivity.notifyRouteReady() → hideBlockingSplash()
```

---

## Grace Period — Entscheidung

**Frage:** Soll es eine Grace Period geben (z.B. 5 Sekunden), bevor der Overlay triggert?

**Entscheidung: NEIN — kein Grace Period im Standard-Flow.**

**Begründung:**
- Das Produktziel ist die *bewusste Unterbrechung*. Eine Grace Period würde den Nutzer trainieren,
  Apps schnell zu benutzen bevor der Block greift — kontraproduktiv.
- Der `OVERLAY_COOLDOWN_MS` (1500ms) in `ScreenTimeAccessibilityService` ist ausreichend,
  um accidentelle Trigger durch OS-Events beim App-Wechsel zu verhindern.
- Eine Grace Period ist eine Nutzer-konfigurierbare Einstellung, nicht ein Architekturdefault.
  Wenn sie in Zukunft gewünscht ist, gehört sie in den `PolicyTarget`-Konfigurationsraum,
  nicht in die Accessibility-Trigger-Logik.

---

## Bestehende Tests

Alle kritischen Entscheidungsklassen haben Unit-Tests unter
`android/app/src/test/java/app/blearn/mobile/`:

| Test-Datei                       | Was wird getestet                                      |
|----------------------------------|--------------------------------------------------------|
| `BlockingTriggerDecisionTest.java` | Alle 7 Pfade von `decide()` inklusive suppress/reset |
| `OverlayHandoffPolicyTest.java`   | Stage-Suppression + Replace-Logik                    |
| `TargetMatcherTest.java`          | App-, Website- und Search-Matching                    |
| `PendingNavigationStoreTest.java` | Queue, consume, abandon, dismiss, dedup-Logik         |

---

## Anti-Patterns (verboten)

```java
// VERBOTEN: Hard-Kill
ShizukuRunner.executeCommand("am force-stop " + packageName, ...);

// VERBOTEN: Home-Redirect im Blocking-Pfad
service.performGlobalAction(GLOBAL_ACTION_HOME);

// VERBOTEN: Overlay ohne Coordinator-Registrierung
windowManager.addView(root, layoutParams); // ohne registerOverlay()

// VERBOTEN: Blocking-Entscheidung ohne BlockingTriggerDecision
if (isBlocked) { showOverlay(); } // direkt, ohne Guard
```

---

## Referenz-Dateien

**Android Enforcement:**
- `ScreenTimeAccessibilityService.java` — Accessibility-Event-Eingang
- `OverlayPresenter.java` — Overlay-Lifecycle
- `OverlayHandoffCoordinator.java` — Handoff-State-Machine
- `OverlayHandoffPolicy.java` — Stage-Regeln (suppression, replacement)
- `BlockingTriggerDecision.java` — Guard vor jedem Overlay-Start
- `TargetMatcher.java` — Matching-Logik
- `PendingNavigationStore.java` — Handoff-Persistenz
- `PendingNavigationLauncher.java` — Activity-Start + Coordinator-Koordination
- `BlockingOverlayActivity.java` — Blearn-Host für den Interventions-Flow
- `BlockingFlowState.java` — Koordination zwischen Store und Coordinator

**React Runtime:**
- `src/hooks/useNativePendingNavigation.ts`
- `src/lib/nativeRouteHandoff.ts`
- `src/hooks/useOverlayDismissGuard.ts`
- `src/App.tsx`
