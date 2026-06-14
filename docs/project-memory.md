# Project Memory

Date: 2026-04-03

This file is the current high-signal memory for the Blearn app. It is meant to help future work start from the actual current architecture instead of stale assumptions.

## North Star

- Blearn exists to turn impulsive distraction into a conscious focus and learning moment.
- The product goal is not "hard block everything at any cost", but "interrupt the reflex, route the user through a meaningful flow, and only then allow an intentional decision".
- The UX goal is that blocking feels protective, calm, and coherent.
- The technical goal is that Android blocking stays reliable end-to-end: detect, cover, hand off, complete, dismiss, and reopen only when intended.

## 0. Current Execution Anchor

- Start from [`docs/plans/2026-04-03-blocking-sync-integrity.md`](C:\Users\psjoh\Desktop\Personal\Coding\Apps\Blearn-App\docs\plans\2026-04-03-blocking-sync-integrity.md) before touching blocking, sync, auth, or settings copy.
- The repo currently has four linked priorities, not one isolated bug:
  - blocking handoff and strict semantics must be stable on-device
  - `Modes` must feel immediate and reliable again
  - account/sync behavior must match what the UI claims
  - every new session must inherit the same project memory and direction
- Treat any UI that promises background behavior without a real backing path as a product bug, not a copy nit.

## 1. Recent 2026-04-03 Notes

- The latest user direction is broader than the original blocking-only plan. In addition to blocking/strict/performance, this round must also cover:
  - true account-backed sync expectations
  - emotion/statistics integrity
  - end-to-end registration reliability
  - an audit for UI-only controls or copy that imply backend work where none actually happens
- Current verified repo truth:
  - emotions, check-ins, and app stats are tracked locally in the app store and power the Stats UI
  - those app-level progress values are not part of the active Firebase learning cloud sync
  - the active learning cloud sync serializes learning entities, browser/search state, and filtered-deck-lite state, but not `assignments`, `unlockGrants`, or `gateRule`
  - `AppSettings` currently claims that vocabulary, reviews, and unlocks can stay in sync across devices, which overstates the implemented sync scope
  - email/password sign-up exists in the auth store, but current test coverage is mostly mocked UI/store wiring rather than true Firebase integration evidence
  - a separate `src/services/learningSyncService.ts` exists with APIs like `assignDeckToTarget`, `createUnlockGrant`, `getDevicePolicy`, and `syncClientState`, but it is not part of the active sync path and should not silently diverge from the Firestore-based direction

## 2. Recent 2026-03-22 Notes

- Android overlay reliability was hardened. Key files: `BlockingTriggerDecision.java`, `ScreenTimeAccessibilityService.java`, `OverlayPresenter.java`, `ScreenTimePlugin.java`. Stale `handoff_in_progress` / stale overlay state should now be reset and the overlay re-shown instead of silently suppressing future blocks.
- Native diagnostics were expanded. `getMonitoringStatus()` now exposes `handoffInProgress`, `overlayVisible`, `pendingTargetId`, and `lastTriggerAt`. Shared native clear-state lives in `BlockingFlowState.java`.
- Manual overrides are persisted natively in `ManualOverrideStore.java` and are distinct from normal success unlocks.
- Unlock windows are intended to stay per target, not global. Each app / website / search target keeps its own timer; tests around `unlockedTargets` and native policy snapshots were updated to protect this.
- Firebase learning sync remains per-user under `/users/{uid}/...`, but active deck selection is now latest-wins across devices via `activeDeckUpdatedAt`. Account-switch guards were added so one user's local vocab state does not bleed into another account on the same device.
- `AppSettings` permission auto-open was fixed so the permissions dialog does not pop every time `Settings` opens before readiness checks finish.
- `Breathing` screen sizing was made responsive. The sphere scene no longer relies on hard `340px/400px` sizes; `BreathingSphere3D.tsx` and the `Breathing.tsx` suspense fallback now scale to viewport width.
- Final Android E2E note: accessibility overlays are hard to fully automate. `uiautomator` / `adb input` are unreliable for tapping the overlay CTA, so final confirmation of the first native blockscreen still benefits from a real manual device tap.
- Open unresolved UX bug from the latest chat: the `Modes` save flow may still show "Die aktuellen Einstellungen sind bereits aktiv. Aendere etwas, wenn du erneut speichern willst." when saving an app. Next debugging target should be `src/pages/Modes.tsx` around save-state derivation and any native monitoring-status gating that may incorrectly treat a real save attempt as no-op.

## 3. Core Blocking Architecture

The blocking system is a coordinated React + native Android handoff, not a pure OS-level hard block.

High-level flow:

1. The user configures blocked targets and mode assignments in `Modes`.
2. React stores the configuration in Zustand stores.
3. React builds a native `policy_snapshot` and syncs it to Android.
4. Android detects a blocked foreground target.
5. Android shows a native overlay first.
6. The overlay launches the matching Blearn flow.
7. React marks the route as ready.
8. Native overlay state is cleared.
9. After success or abort, the overlay host is dismissed and the target may be reopened.

Important consequence:

- Blocking currently works by detection + interception + handoff.
- It is not a kernel-level or launcher-level denylist.
- A blocked app or browser may briefly become foreground before Blearn covers it.

## 4. Source Of Truth

### App-level blocking state

Stored in `src/store/useAppStore.ts`.

This store owns:

- `blockedApps`
- `blockedAppModes`
- `blockedWebsites`
- `blockedWebsiteModes`
- `blockedSearchTerms`
- `blockedSearchTermModes`
- `unlockedTargets`
- derived `activeModes`

Mode derivation happens via `src/lib/targetModes.ts` and `deriveEffectiveBlockingTargets(...)` in `src/lib/effectiveBlockingTargets.ts`.

### Learn gate state

Stored in `src/store/useLearningStore.ts`.

This store owns:

- decks, notes, cards, review logs
- global `gateRule`
- per-target Learn `assignments`
- Learn `unlockGrants`

Per-target Learn assignments are keyed by:

- `targetId`
- `targetType`

and contain:

- `deckId`
- `sessionCreditsRequired`
- `requiredCorrectReviews`
- `unlockDurationMinutes`
- `enabled`

## 5. Modes Save Path

The `Modes` screen is the point where user-facing blocking config becomes enforcement config.

Main file:

- `src/pages/Modes.tsx`

What happens on save:

1. Local draft values are committed.
2. Blocking targets are written into `useAppStore`.
3. Learn assignments are rebuilt per target for every Learn-assigned app/website/search term.
4. Learn gate rule is updated.
5. A fresh native device snapshot is built.
6. `syncPolicies(...)` sends the snapshot to Android.
7. In strict mode, a foreground recheck may immediately trigger the blocking flow for the currently open app.

Important design truth:

- Learn rules are not only global.
- The `Modes` save path stamps the selected Learn card count and unlock duration into each active Learn target assignment.

## 6. Native Policy Snapshot Contract

Built in:

- `src/lib/nativePolicy.ts`

The native snapshot contains:

- `activeModes`
- `blockedPackages`
- `blockedDomains`
- `blockedSearchTerms`
- `unlockedTargets`
- `targets[]`

Each `targets[]` entry carries:

- `id`
- `type`
- `mode`
- `deckId`
- `requiredCorrectReviews`
- `unlockDurationMinutes`
- `enabled`

This is the main contract between React and Android enforcement.

## 7. Android Enforcement Paths

### 7.1 Accessibility path

Main file:

- `android/app/src/main/java/app/blearn/mobile/ScreenTimeAccessibilityService.java`

Responsibilities:

- listens to accessibility events
- resolves the foreground package
- reads `policy_snapshot`
- checks manual overrides
- matches app targets directly by package name
- matches website/search targets by observed UI text in conservative allowlisted packages
- shows the native blocking overlay

Matching helpers:

- `TargetMatcher.java`
- `ObservedTextCollector.java`
- `PolicySnapshotReader.java`
- `PolicySnapshot.java`

Important behavior:

- App targets are matched by package id.
- Website/search targets are matched by observed text only in supported browser/search packages.
- Duplicate triggers are suppressed by cooldown and handoff state checks.

### 7.2 VPN / DNS website path

Main file:

- `android/app/src/main/java/app/blearn/mobile/BlearnVpnService.java`

Responsibilities:

- blocks configured domains at DNS level
- uses the current policy snapshot for website rules
- may open the same overlay/intervention handoff path when a blocked domain is hit

Important behavior:

- Website blocking is not only UI-text based.
- DNS-level matching exists in parallel.
- The intervention overlay is only surfaced when the foreground app looks like a supported browser/search package and the device is interactive.

## 8. Native Overlay + Handoff Lifecycle

Key files:

- `OverlayPresenter.java`
- `OverlayHandoffCoordinator.java`
- `PendingNavigationLauncher.java`
- `PendingNavigationStore.java`
- `BlockingOverlayActivity.java`
- `InterventionRouteBuilder.java`

Lifecycle:

1. Native match found.
2. `OverlayPresenter` renders the accessibility overlay.
3. User presses the primary action.
4. A `PendingNativeNavigation` is written to preferences.
5. `BlockingOverlayActivity` is launched.
6. React consumes the pending route and navigates there.
7. React reports route-ready.
8. Native clears pending state and hides the overlay.

Coordinator stages:

- `IDLE`
- `OVERLAY_VISIBLE`
- `LAUNCHING`
- `WAITING_FOR_ROUTE_READY`
- `STALLED`

Important behavior:

- Stale handoffs are reset instead of silently accumulating.
- Pending navigation is persisted synchronously.
- The overlay can fall back to a manual launch state if route-ready does not come back in time.

## 9. React Overlay Runtime

Key files:

- `src/App.tsx`
- `src/hooks/useNativePendingNavigation.ts`
- `src/lib/nativeRouteHandoff.ts`
- `src/hooks/useOverlayDismissGuard.ts`

Responsibilities:

- consume the native pending route
- navigate to the blocking route
- hold a fallback loading shell during the handoff
- tell Android when the route is actually ready
- dismiss the overlay exactly once

Important behavior:

- Pending navigation is consumed single-flight.
- Route-ready notifications are idempotent per `overlaySessionId`.
- Dismiss-once protection is shared across blocking flows.

## 10. Mode-Specific Blocking Flows

### Strict

Route chain:

- `/intervention`
- `/breathing`
- `/checkin`

Main files:

- `src/pages/Intervention.tsx`
- `src/pages/Breathing.tsx`
- `src/pages/Checkin.tsx`

Behavior:

- user gets an intervention screen
- then breathing
- then check-in
- success grants a temporary unlock and dismisses the overlay

### Learn

Main file:

- `src/hooks/useLearnReviewSession.ts`

Behavior:

- Learn is now a fixed counted-card unlock model, not a fractional credit model
- if the mode is configured for 5 cards, every unlock attempt must reach 5 counted cards
- `again` counts as `0`
- `hard`, `good`, and `easy` count as `1`
- due cards, review-ahead cards, and new cards may all participate
- if the deck is too small, cards may repeat within the same unlock session
- unlock is per target, but the deck history remains shared

Important design truth:

- Each blocked Learn target has its own assignment and unlock session requirement.
- The user still studies through one shared deck/study history unless the assignments intentionally point to different decks.

### Penalty

Main file:

- `src/pages/Intervention.tsx`

Behavior:

- penalty targets also enter the intervention flow
- the user can confirm the penalty path
- manual override exists with a limited attempt window

## 11. Unlock Semantics

There are multiple unlock concepts in the project:

### Native / device-level temporary unlocks

- passed via `unlockedTargets` in the native snapshot
- checked inside the Android policy snapshot and DNS engine

### React app store unlocks

- stored in `useAppStore.unlockedTargets`
- used by React flows after success

### Learn unlock grants

- stored in `useLearningStore.unlockGrants`
- keyed by `targetType + targetId`

### Manual overrides

- stored by `ManualOverrideStore.java`
- separate from normal Learn/check-in success unlocks

## 10. Important Caveat: Untyped App Store Unlock Keys

Current caveat:

- `useAppStore.unlockApp(...)` stores unlocks by normalized target id only
- the app store key does not include `targetType`
- the native `unlockedTargets` snapshot also currently behaves mostly like bare target-id unlocks

Consequence:

- a website target and a search target with the same normalized id can theoretically collide
- this is less of a problem for package-based app ids, but it is a real modeling weakness for website/search parity

Future work should strongly consider making app-store unlock keys fully typed:

- `app:<id>`
- `website:<id>`
- `search:<id>`

## 11. Firebase Sync Scope

Firebase is intentionally scoped.

Current design:

- only vocabulary / learning data is synced through Firebase

This includes:

- decks
- notes
- cards
- review logs
- presets
- active deck

Not synced to Firebase:

- blocking modes
- blocked targets
- temporary unlocks
- wallet / penalty state
- general app settings unrelated to learning data

Important consequence:

- PC and phone should share vocabulary progress
- blocking configuration remains device-local unless explicitly changed later

## 12. Android Operational Notes

### Accessibility permission

On many Android versions, sideloaded APKs cannot enable Accessibility immediately.

Typical required manual step:

- open app info
- allow restricted settings
- then enable Accessibility

### Overlay behavior

The current Android flow depends on:

- Accessibility permission
- Usage Stats permission
- VPN permission for website blocking

If those are missing, the policy can be present in state while actual blocking is incomplete on device.

## 13. Existing Project Docs Worth Reading First

- `docs/plans/2026-04-11-native-blocking-architecture.md`
- `docs/blocking-overlay-handover-for-agents.md`
- `docs/blocking-overlay-tldr.md`
- `docs/learn-mode-handover-for-agents.md`
- `docs/firebase-vocab-sync.md`
- `docs/firebase-learning-sync.md`

## 14. Current High-Signal File Map

Blocking config and state:

- `src/pages/Modes.tsx`
- `src/store/useAppStore.ts`
- `src/store/useLearningStore.ts`
- `src/lib/nativePolicy.ts`
- `src/lib/targetModes.ts`

Android enforcement:

- `android/app/src/main/java/app/blearn/mobile/ScreenTimeAccessibilityService.java`
- `android/app/src/main/java/app/blearn/mobile/TargetMatcher.java`
- `android/app/src/main/java/app/blearn/mobile/BlearnVpnService.java`
- `android/app/src/main/java/app/blearn/mobile/DnsDecisionEngine.java`
- `android/app/src/main/java/app/blearn/mobile/ScreenTimePlugin.java`

Overlay handoff:

- `android/app/src/main/java/app/blearn/mobile/OverlayPresenter.java`
- `android/app/src/main/java/app/blearn/mobile/OverlayHandoffCoordinator.java`
- `android/app/src/main/java/app/blearn/mobile/PendingNavigationLauncher.java`
- `android/app/src/main/java/app/blearn/mobile/PendingNavigationStore.java`
- `android/app/src/main/java/app/blearn/mobile/BlockingOverlayActivity.java`
- `src/hooks/useNativePendingNavigation.ts`
- `src/lib/nativeRouteHandoff.ts`
- `src/hooks/useOverlayDismissGuard.ts`
- `src/App.tsx`

Blocking flows:

- `src/pages/Intervention.tsx`
- `src/pages/Breathing.tsx`
- `src/pages/Checkin.tsx`
- `src/hooks/useLearnReviewSession.ts`
- `src/pages/LearnReview.tsx`

## 15. Recommended Future-Agent Starting Point

If future work touches blocking, start in this order:

1. `docs/project-memory.md`
2. `docs/blocking-overlay-tldr.md`
3. `src/pages/Modes.tsx`
4. `src/lib/nativePolicy.ts`
5. `ScreenTimeAccessibilityService.java`
6. `useNativePendingNavigation.ts`
7. the specific blocking flow page being changed

This should prevent the usual failure mode where someone edits only the React screen and misses the native handoff, or edits only Android and misses the store contract.

## 16. Recent High-Signal Changes (2026-03-22)

- Penalty targets are now runtime-gated, not just configured. `penalty` assignments only count as active blocking targets when penalty is enabled and setup is valid. The filtering flows through `src/lib/effectiveBlockingTargets.ts`, `src/store/useAppStore.ts`, `src/lib/nativePolicy.ts`, `src/hooks/useNativeSync.ts`, and `src/pages/Modes.tsx`.
- Penalty/manual-override unlock success in `src/pages/Intervention.tsx` now uses the shared `BlockingUnlockSuccessScreen` shell instead of a separate generic success animation. Learn/strict success behavior outside that path was intentionally left intact.
- The app tour was hardened. Auto-open now waits for persisted store hydration (`hasHydrated`) and also respects a synchronous dismiss key: `blearn-app-tour-dismissed`. `Skip` and `X` are permanent dismiss until manual reopen from Settings.
- App tour targeting is now more stable: targets were moved onto non-animated wrappers on Dashboard, Modes, and Learn; mobile uses a fixed bottom sheet; desktop uses anchored bubble or a centered fallback card if target resolution stays missing/unstable.
- Verified on 2026-03-22: `src/test/appIntroFlow.test.tsx` passed (10/10), `npm run build` passed, and the Android debug APK installed successfully on the physical Xiaomi device `22101320G` (`app.blearn.mobile`) once MIUI/USB install approval was granted.

## 17. Masterplan-Umsetzung Phase 1–5 + D (2026-06-13)

Fortsetzung der Masterplan-Arbeit aus `docs/plans/2026-06-12-masterplan.md` (begonnen von einem Vor-Agenten). Alle offenen Sub-Agenten-Aufgaben umgesetzt:

- **Strict-Lock gegen Uhr-Manipulation (1.4):** `StrictLockClockGuard.java` verankert das Lock-Ende an `elapsedRealtime` + Boot-Count. `PolicySnapshotReader.read(context, prefs)` nutzt jetzt die korrigierte Zeit; `StrictLockDeviceAdminManager` behält das Admin bei Wall-Clock-Sprung und plant einen Elapsed-Reconcile-Alarm. Wall-Clock-Manipulation kann ein Lock innerhalb der Boot-Session nicht mehr früh beenden.
- **Schutzstatus + Watchdog (1.1–1.3, 1.7):** `ProtectionWatchdog.java` (Trigger-Sturm-Suppression, Accessibility-Down-Notification, Reboot-Handling). `ScreenTimePlugin.getMonitoringStatus` um `usageStatsPermission`/`deviceAdminActive`/`batteryOptimizationExempt`/`notificationsEnabled`/`privateDnsMode`/`vpnInterruptedByBoot` erweitert. Neue Plugin-Methoden `isBatteryOptimizationExempt`/`requestBatteryOptimizationExemption`/`clearVpnBootInterruption`. Konfigurationsabhängiges Health-Modell in `src/modules/protection/protectionHealth.ts` (+8 Tests), Karte `ProtectionStatusCard.tsx` auf dem Dashboard.
- **Phase 2 Rest:** Micro-Session-Latenz-Telemetrie (`session/sessionLatency.ts`, Ziel < 800 ms), Media-Registry hält nie mehr Base64-Blobs (`note-media://`-Referenzen in `mediaRegistry.ts`/`store/helpers.ts`).
- **Phase 3 Rest:** Backoff-Retry + Netz-Rückkehr/Visibility-Listener für fehlgeschlagene Cloud-Saves (`sync/useLearningCloudSaveRetry.ts`, +3 Tests). Status-UI (`SyncStatusBadge`) existierte bereits.
- **Phase 4 Rest:** Echte FSRS-w-Optimierung per Koordinatenabstieg auf Holdout-Log-Loss (`stats/weightOptimizer.ts` + Worker `workers/weightOptimizer.worker.ts`/`learningOptimizerWorker.ts`, +4 Tests), Vorschlag-UI `DeckOptimizerTile.tsx` (übernimmt nur nach Bestätigung). Per-Deck-Settings + Optimizer-Übernahme (`updateDeckPresetSettings`/`applyOptimizedPresetWeights` im reviewSlice, forkt geteilte Presets). Suspend/Bury (`setCardSuspended`/`buryCardUntilTomorrow` + Card-Inspector-Buttons, +4 Tests). Multi-Cloze: eine Karte pro `{{cN::}}`-Lücke via `clozeIndex` (`import/buildEntities.ts`, `import/preview.ts`, +5 Tests). Session-Resume (`session/sessionResumeSlot.ts`, +5 Tests).
- **Modes-Save-Bug "Einstellungen bereits aktiv":** Reaktivierung eines gespeicherten-aber-inaktiven Modus zählt jetzt als Änderung (`needsReactivation` in `useModesActivationState.ts`, `activeModes` durchgereicht). 30/30 modesUiSmoke grün.
- **Phase D:** `SignatureRing.tsx` (Ring-Motiv im Lern-Header statt Zähler-Box), `ListRow.tsx`/`ListRowGroup` als Listenzeilen-Primitive, Strict-Lock-Endzeit-Anzeige ("Gesperrt bis HH:MM", `getEffectiveStrictLockEndTime`). **Offen: Screenshots + vollständiger Modes/Settings-Listenzeilen-Umbau brauchen das Gerät.**
- **Phase 5:** `docs/threat-model.md`, Privacy-Pfad `ObservedTextCollector` code-verifiziert (Text nur in-memory, nie persistiert/geloggt/gesynct), CI `.github/workflows/ci.yml` (lint nicht-blockierend wegen Vorbestand-Debt, Rest blockierend).
- **Verifikation:** Alle Java-Dateien kompilieren (`gradlew compileDebugJavaWithJavac`), `tsc --noEmit` grün, alle neuen Tests grün (30), `check:android-sources`/`check:copy-budget` grün.
- **⚠️ Bekannter Vorbestand-Flake:** `appIntroFlow.test.tsx > does not finish native setup before the accessibility service is really ready` schlägt deterministisch fehl (timing-empfindlicher focus→refetch→waitFor). Verifiziert via `git stash`, dass es **nicht** durch die Session-Änderungen verursacht ist — es regredierte auf dem Branch seit 2026-03-22 (Abschnitt 16). Restliche Voll-Suite-Fehler waren reine Last-Timeouts (zweiter Lauf grün).
- **⚠️ Lint-Vorbestand:** `ModesPageView.tsx` (Props-Passthrough `any`) + `AuthDialog.test.tsx` (4× `any`) — bewusst nicht angefasst (Risiko/Scope); CI-Lint ist `continue-on-error`, bis die Schuld abgebaut ist.

## 18. UX-Fixes + Design-Runde (2026-06-13, Nutzer-Feedback)

- **KRITISCHER Freischalt-Bug behoben:** Der Unlock im Blocking-Flow war hinter einem Pflicht-Emotions-Schritt gegated → Nutzer blieb trotz erfüllter Reviews gesperrt. Jetzt schaltet der Blocking-Flow bei erreichter Review-Zahl SOFORT frei (`useLearnReviewSessionCompletion`-Effekt feuert `finishUnlock` ohne Emotion-Gate). Emotions-Check-in bleibt nur im NICHT-blockierten Lernmodus. Tests in `learnReviewUi.test.tsx` schreiben das fest (`emotionPromptPresent()===false` im Block-Flow).
- **Tip-Modus überarbeitet:** `MAX_TYPED_ANSWER_ATTEMPTS` 3→**1** (ein Fehlversuch deckt sofort auf). Prefix-Schwelle 4→**3** Buchstaben gelten als richtig (`typedAnswer.ts`). Nach falscher/leerer Eingabe sind nur noch **Nochmal + Schwer** wählbar (Gut+Leicht gesperrt: `easyRatingBlocked`-Guard in `useLearnReviewReviewActions` + `LearnReviewActions`-UI).
- **Emotionen:** Liste erweitert + in `CheckinEmotionStep` über alle Kategorien **zufällig gemischt** (Fisher-Yates, stabil pro Mount) gegen die Top-Anklick-Tendenz; Kategorie-Filter = "ordnen".
- **Header-Schild + Karte:** `useProtectionHealth`-Hook geteilt zwischen `ProtectionStatusCard` und neuem `ProtectionShieldButton` (Header, neben ThemeToggle). Im grünen Zustand erscheint NUR das Schild — die Dashboard-Karte zeigt sich erst bei Gelb/Rot.
- **Bottom-Nav** kompakter (min-h 4.25→3.25rem, Icon 20→18, h-10→h-8).
- **Tab-Wechsel-Perf:** `preloadMainTabRoutes()` lädt die 5 Haupt-Tabs im Idle vor (keine weißen Frames).
- **Haptik** (`src/lib/haptics.ts`, Web-Vibration-API, VIBRATE-Permission): Tick bei Review, Erfolg bei Unlock.
- **Strict-Modus verifiziert:** Einstellungen im Fenster unveränderbar (`setStrictSchedule` No-op im Lock), 20h-Cap, Uhr-Guard (Abschnitt 17). **Deinstallation während Strict-Lock ist durch den aktiven Device-Admin bereits effektiv gesperrt** (Android verbietet Uninstall aktiver Device-Admin-Apps; Disable-Warnung in `device_admin_disable_warning`). Threat-Model erlaubt bewusst keinen Hard-Block darüber hinaus.
- **Block-Ende-Copy** entschlackt: nur noch "Freigegeben ✓" / "Freischaltung läuft …" (kein Erklärabsatz, Mojibake raus).
- **Offen:** Geräte-Screenshots der UI-Tweaks (Gerät war beim letzten Deploy abgemeldet); APK assembliert sauber, alle Tests + tsc grün.

## 19. Stabilisierung nach UX-Runde (2026-06-13)

- **App-Intro-Readiness-Test wieder grün:** `appIntroFlow.test.tsx > does not finish native setup before the accessibility service is really ready` prüft jetzt den echten Ablauf stabil: Accessibility-Permission darf nicht reichen, solange `accessibilityServiceReady` noch false ist; erst ein späterer Focus-/Resume-Refresh mit Runtime-ready macht den Start möglich. Vollsuite ist danach grün.
- **Kurz-Blocking-Sessions + neue Karten:** `buildUnlockSessionCandidateIds` berücksichtigt jetzt kumulative Reviews des Tages, damit bei kurzen Learn-Blocking-Flows eine fällige neue Karte nicht endlos hinter `reviewsBetweenNewCards` verschwindet. Regressionstest in `learning.test.ts` deckt ab, dass nach erreichtem Tages-Mix die owed new card innerhalb der gekappten Unlock-Queue auftaucht.
- **Repo-Artefakte bereinigt:** temporäre Übergabe-Dateien `files.zip` und `files/` wurden aus dem Arbeitsbaum entfernt.
- **Verifikation:** `npm test`, `npx tsc --noEmit`, `npm run build`, `npm run check:copy-budget`, `npm run check:android-sources` und `gradlew compileDebugJavaWithJavac` sind grün. Weiterhin offen bleibt echte Geräteabnahme fuer Blocking/Overlay/VPN/Reboot und der vollständige Modes/Settings-ListRow-Umbau.

## 20. Drei Lern-Bugfixes (2026-06-14)

User-Report: (1) "Schwer"-Karten kommen direkt/im nächsten Flow wieder, (2) die auf den Bewertungs-Buttons angezeigten Zeiten stimmen nicht mit der tatsächlichen Fälligkeit überein, (3) neue Karten werden weiterhin nicht blockflow-übergreifend gezählt.

- **(2) FSRS-Fuzz-Seed deterministisch (Kern-Fix).** `ts-fsrs` (`enable_fuzz: true`) nutzt einen Default-Seed `${review_time_ms}_${reps}_${diff*stab}` — er enthält die Wall-Clock-Millisekunde. Dadurch würfeln die Intervall-Vorschau (`getReviewIntervalPreview`, Render-Zeitpunkt) und das tatsächliche Schreiben (`submitReview` → `buildReviewResult`, Submit-Zeitpunkt) UNTERSCHIEDLICHE Fuzz-Werte → der Button zeigt z.B. "2 Monate", gespeichert wird etwas anderes. Fix in `domain/fsrs.ts:getFsrsScheduler`: eigene `StrategyMode.SEED`-Strategie `stableFuzzSeed`, die nur aus dem Karten-Zustand VOR dem Review seedet (`reps_difficulty*stability`). Fuzz bleibt erhalten (variiert pro Karte), Vorschau == gespeicherte Fälligkeit. Regressionstest in `learning.test.ts` ("keeps the previewed interval identical to the stored interval despite fuzz").
- **(1) "Schwer" kommt wieder** war eine Folge von (2): die angezeigten 2 Monate wurden vorher nicht zuverlässig so gespeichert. Mit dem deterministischen Seed wird eine reife Review-Karte truthful auf ~2 Monate terminiert und ist im nächsten Flow nicht fällig. Zusammen mit dem bestehenden Geschwister-Bury (#20) und der Session-Controller-Garantie (eine bewertete Karte kommt innerhalb der Session nie zurück) erledigt. Lernkarten ("learning"-State) auf "Schwer" bleiben FSRS-typisch in kurzen Lernschritten — by design.
- **(3) Pacing zählt jetzt seit der letzten neuen Karte, nicht ab Mitternacht.** `queues.ts`: neuer `countReviewsSinceLastNewCard` ersetzt den Tageszähler im Pacing. Grund: User lernt kurze Flows (5 Vokabeln) über mehrere Tage; ein an Mitternacht resettender Zähler erreicht nie die 1:15-Schwelle. Jetzt zählt der Counter "wirklich immer mit". Reset bei jeder Neueinführung (`previousState==='new'`), Flood-Schutz `MAX_PACED_NEW_CARDS_PER_SESSION = 2` für importierte Decks mit langer Historie. `countDailyReviewActivity` bleibt nur noch für Tagesbudgets. Tests: Unit (`learning.test.ts` "counts new-card pacing across days and resets after a new card is introduced") + End-to-End über den Live-Store-Pfad (`learningStore.test.ts` "surfaces a new card across short blocking flows … live store path").
- **Verifikation:** `npx tsc --noEmit` grün; gezielte Suites `learning.test.ts`, `learningStore.test.ts`, `cardSuspendBury.test.ts` + `src/modules/learning` (131 Tests) grün. Vollsuite grün bis auf load-bedingte 10s-Timeouts in UI-Smoke-Tests (`checkinPage`, `walletUiSmoke`), die isoliert durchlaufen — nicht scheduling-bezogen.

## 21. Paralleles Agenten-Audit: 5 weitere Bugs (2026-06-14)

Drei worktree-isolierte Audit-Agenten (Learning-Tiefe, Blocking/Strict, Penalty/Stats) parallel laufen lassen; Funde per Cherry-Pick in den Branch integriert (Commits `00f293b`, `a45d5c7`, `5c59ecc`).

- **HIGH — Übernacht-Strict-Lock löste sich nach Mitternacht auf (Umgehungs-Loch).** `useStrictLockExpirySync` + `activateStrictLock`/`activateStrictAddon` berechneten ein 22:00→06:00-Fenster immer relativ zu *heute*; um 02:00 galt `now` als "vor 22:00" → Fenster "beendet" → `forceReleaseLock`. Fix: neuer `src/lib/scheduleWindow.ts` (`resolveScheduleWindow`/`isOutsideScheduleWindow`/`msUntilWindowEnd`) prüft auch das gestern gestartete Fenster. Beim Merge wichtig: der 20h-Cap (`clampStrictLockEnd`, Abschnitt 17) wird jetzt auf das übernacht-korrekte `end` angewandt — beide Anforderungen kombiniert. Tests: `scheduleWindow.test.ts` (8) + `useAppStore.test.ts` Overnight-Aktivierung.
- **HIGH — Penalty-Doppelzahlung durch re-entranten Tap.** `Intervention.tsx`: „Jetzt bezahlen" war nur über `penaltyBusy` (React-State, greift erst beim nächsten Render) abgesichert; schneller Doppeltipp rief `deductPenalty` zweimal → **zwei echte Lightning-Zahlungen**. Fix: synchroner `paymentInFlightRef = useRef`. Test `penaltyDoubleTap.test.tsx`.
- **HIGH — Undo stellte begrabene Multi-Cloze-Geschwister nicht wieder her.** `submitReview` begräbt Geschwister (burySiblings) bis morgen; `revertReviewLog` stellte nur die bewertete Karte her, das Geschwister blieb begraben. Fix: `ReviewLog.buriedSiblingSnapshots` (lokales Undo-Feld, nicht im Sync), Restore nur wenn das Geschwister noch exakt im erzeugten Bury-Zustand ist. Außerdem `handleUndoReview` entfernt die Karte wieder aus `reviewedCardIdsRef` (Counter-Divergenz). Test in `revertReviewLog.test.ts`.
- **MEDIUM — Emotions-Chart Tagesgrenzen-Off-by-one.** `modules/stats/emotions.ts`: `startTime = now - buckets*bucketMs` ließ den heutigen Check-in aus dem Wochen/Monats-Chart fallen und verschob alles um einen Tag. Fix: `now - (buckets-1)*bucketMs`. Test `emotionStatsBuckets.test.ts` (3).
- **Verifikation der Integration:** `npx tsc --noEmit` clean; gezielt 75 Tests über alle drei Domänen + `strictLockEnforcement.test.ts`/`nativePolicy.test.ts` (14) grün.
- **Zur Triage offen (von Agenten gemeldet, nicht gefixt):** (a) per-App-`blockSchedules` werden nie ans Native durchgereicht (`buildDevicePolicySnapshot` lässt sie weg) — wirkungsloses Feature; (b) `setBlockSchedule`/`toggleBlockedApp` sind nicht gegen den *Haupt*-Strict-Lock (`strictLockUntil`) gesperrt, nur gegen Addon-Locks (Defense-in-Depth-Lücke); (c) **Blocked-Flow „completed aber nicht entsperrt"**: bei einer falschen Antwort leert sich die Queue mit `countedReviews < required`, der Emotion-Step entsperrt nicht und `blockedFlowExhausted` greift nicht (candidateIds-Länge nie 0) — User muss Screen verlassen & neu betreten. **Wahrscheinlichster echter Frust-Punkt, Produktentscheidung nötig.** (d) `isTargetUnlocked` mutiert State im Getter (Smell).

## 22. Verbesserungsplan + P0 umgesetzt (2026-06-14)

Vier Rollen-Agenten (Produkt/UX, Reliability/Security, Performance, Lern-Qualität) haben parallel Verbesserungsideen geliefert und gegeneinander gechallengt; Synthese als priorisierter Plan: `docs/plans/2026-06-14-improvement-plan.md`. **Konvergenz von zwei Rollen** auf die Blocked-Flow-Sackgasse (Triage-Punkt (c) oben) → Flaggschiff P0, jetzt implementiert:

- **P0.2 Re-Queue (Kern).** `sessionController.grade()`: im **Unlock-Flow** (`kind==='unlock'`) verlässt eine nicht-korrekt beantwortete Karte die Queue NICHT, sondern wandert ans Ende (neues Snapshot-Feld `requeueCountsByCardId`); nach `MAX_UNLOCK_REQUEUES = 2` zählt die Exposition als Credit (Frust-Loop-Schutz). Dadurch läuft die Queue erst leer, wenn jede Karte einen Credit verdient hat → `countedReviews` erreicht immer das Gate, **Sackgasse mathematisch unmöglich**. Folge-Änderung in `useLearnReviewReviewActions`: `isUnlockCompletion = sessionCompleted && Boolean(targetId)` (kein `>= sessionCreditsRequired`-Gate mehr nötig). Review-/Übungsmodus (kein Gate) unverändert: falsche Karte wird regulär entfernt. Tests: 3 neue in `sessionController.test.ts`.
- **P0.4 Ehrliche Endzustände.** Debug-Panel (Store-Interna an Endnutzer!) aus `LearnReviewEmptyState` entfernt.
- **P0.3 Fortschrittsbalken.** Neue `LearnReviewUnlockProgress`-Komponente zeigt im Blocked-Flow „N/M richtig · noch K" aus den bereits berechneten `countedReviews`/`sessionCardCount`/`progressPercent`.
- **Verifikation:** `tsc` clean, `npm run build` ok; `sessionController.test.ts` (11), `learnReviewUi`/`androidOverlaySuccess`/`appBlockingFallback` (44) + Session-/Review-Suiten (60) grün.
- **P1-B Defense-in-Depth umgesetzt:** `blockingSlice` sperrt während des Haupt-Strict-Locks (`strictLockUntil`) schwächende Mutationen — `toggleBlockedApp` (Entfernen-Branch), `removeBlockedWebsite`/`removeBlockedSearchTerm`, `setBlockSchedule`/`removeBlockSchedule` (Helper `isMainStrictLockActive`, spiegelt `setStrictSchedule`). Stärken (Block hinzufügen) bleibt erlaubt. Test in `useAppStoreBehavior.test.ts`.
- **P1-C/D Penalty-Sicherheit umgesetzt:** `deductPenalty` (`penaltySlice`) ist jetzt store-verankert idempotent — eine laufende ('processing') oder gerade bestätigte ('sent' mit Preimage) Zahlung für dasselbe Ziel+Betrag innerhalb `PENALTY_IDEMPOTENCY_WINDOW_MS = 2min` löst keine zweite aus (überlebt Remount/Crash, anders als der Per-Mount-Ref). Preimage-Gate: ohne gültiges Lightning-Preimage (Zahlungsbeweis aus `processAlbyPenalty`) gilt die Zahlung als nicht bestätigt → Transaktion 'failed', **keine Freischaltung**. Neues Feld `PenaltyTransaction.preimage`. 3 neue Tests in `penaltyStore.test.ts` (confirmed-retry, in-flight, kein-Preimage). Offen als Follow-up: echte Startup-Reconciliation via Alby-Lookup (braucht Wallet-Lookup-by-hash; das 2min-Fenster verhindert bereits dauerhaftes Blockieren).
- **P2-E Typed-Beinahe-Treffer umgesetzt:** `easyRatingBlocked` (in `useLearnReviewDerivedState`) deckt jetzt auch `typedAnswerMatchKind === 'partial'` ab — ein nur knapp (3-Buchstaben-Tippmodus) richtiger Abruf sperrt „Gut"/„Einfach"; nur Nochmal/Schwer. „Schwer" gibt weiterhin Credit, terminiert aber kurz (ehrliches FSRS-Signal). Hinweistexte vereinheitlicht zu „Nur Nochmal oder Schwer möglich." Test erweitert in `learnReviewUi.test.tsx` (partial → good/easy aria-disabled).
- **Performance-Sprint bewusst NICHT blind umgesetzt:** Bei genauem Lesen sitzt jeder Perf-Punkt in korrektheits-kritischem Code mit konkreten Fallen — `submitReview`-Index nutzt APPEND-Semantik (der `prependLearningReviewLogIndex`-Helper ist NICHT äquivalent; zudem Eviction-Shift), und `getCardRevision` enthält `dueAt`, das bei „Nochmal" RÜCKWÄRTS springt → ein billiges `count+max`-Aggregat (P2-B) würde Änderungen verschlucken. Persist-Debounce (P1-F) und Sync-Timing (P2-C) berühren Durability/Sync. **Empfehlung: Performance erst mit Geräte-Profiling angehen** (Bottleneck bestätigen + Verhalten validieren), nicht spekulativ refactoren.
- **Offen (Plan):** P1-A Strict-Lock-Zeitautorität (nativ `StrictLockClockGuard` existiert; prüfen ob JS-Schicht ihn via `Date.now()` unterläuft, L+Gerät); Performance-Hot-Path (mit Profiling); P2-F Transliteration/Arabisch, P2-G Optimizer-Ehrlichkeit, P2-H Leech-Sichtbarkeit.
