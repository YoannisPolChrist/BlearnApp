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
