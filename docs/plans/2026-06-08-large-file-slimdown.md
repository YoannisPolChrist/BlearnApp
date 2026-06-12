# Large File Slimdown Plan

Date: 2026-06-08

## Goal

Slim production files above 500 lines without intentional behavior changes. Public imports stay compatible through thin facades while implementation code is moved into clearer module areas. Blocking, learning, assignment, unlock, sync, and native policy behavior must remain covered by the existing regression tests.

## Baseline Checklist

Current files above 500 lines at the start of this refactor:

- [ ] `src/lib/learning.ts` - 1928 lines
- [ ] `src/pages/AppSettings.tsx` - 1357 lines
- [ ] `src/services/firebaseLearningSyncService.ts` - 1338 lines
- [ ] `src/components/modes/ModesSections.tsx` - 1330 lines
- [ ] `src/hooks/useLearnReviewSession.ts` - 1149 lines
- [ ] `src/pages/Stats.tsx` - 1126 lines
- [ ] `src/pages/Modes.tsx` - 1080 lines
- [ ] `src/test/androidOverlaySuccess.test.tsx` - 940 lines
- [ ] `src/stores/appStore.slices.ts` - 807 lines
- [ ] `src/modules/learning/import/ankiImport.ts` - 757 lines
- [ ] `src/test/modesUiSmoke.test.tsx` - 716 lines
- [ ] `src/test/firebaseLearningSyncService.test.ts` - 713 lines
- [ ] `src/components/stats/ChartPrimitives.tsx` - 709 lines
- [ ] `src/test/helpers/appStore.shared.ts` - 692 lines
- [ ] `src/test/useManualLearningCloudSync.test.tsx` - 661 lines
- [ ] `src/hooks/useLearningCloudSync.ts` - 656 lines
- [ ] `src/test/learning.test.ts` - 655 lines
- [ ] `src/stores/useLearningStore.ts` - 645 lines
- [ ] `src/test/learnReviewUi.test.tsx` - 607 lines
- [ ] `src/test/learningCloudSync.test.ts` - 600 lines
- [ ] `src/test/learningCloudSyncRuntime.test.tsx` - 586 lines
- [ ] `src/modules/learning/session/sessionController.ts` - 584 lines
- [ ] `src/components/ui/sidebar.tsx` - 583 lines
- [ ] `src/modules/learning/sync/learningCloudSync.ts` - 580 lines
- [ ] `src/test/appSettings.test.tsx` - 571 lines

## Phase 1: Safety Baseline

- Status 2026-06-08: done.
- Keep this file as the live checklist for the refactor.
- Before each larger cut, run the affected Vitest files plus `npm run build`.
- Do not start Android emulators. Native unit tests may run when needed.
- Do not change persisted learning store shape, Firestore layout, native blocking policy, overlay handoff, unlock semantics, or review scheduling behavior.

## Phase 2: Learning Core Split

- Status 2026-06-09: done. Public facade and internal domain/review/import/stats split are in place.
- Move the existing public learning entry point behind a thin compatibility facade.
- Keep `@/lib/learning` imports working.
- Move behavior into `src/modules/learning/*` and then split internally by domain, review, import, stats, assignment, and migration responsibilities.
- Verification:
  - `src/test/learning.test.ts`
  - `src/test/learningStore.test.ts`
  - `src/test/learningAssignments.test.ts`
  - `src/test/templateImport.test.ts`
  - `src/test/learnReviewUi.test.tsx`

## Phase 3: Learn Review Flow Split

- Status 2026-06-09: public facade done; scope-revision, typed-answer, completion/emotion, and blocked navigation/handoff logic extracted. Remaining hook orchestration is still above 500 lines.
- Keep `useLearnReviewSession` as a stable public hook.
- Extract implementation areas for bootstrap, blocked-flow handoff, typed answer, emotion completion, review persistence, unlock, and reopen.
- Keep the return shape consumed by `LearnReview.tsx` unchanged.
- Verification:
  - `src/test/learnReviewUi.test.tsx`
  - `src/test/androidOverlaySuccess.test.tsx`
  - `src/test/appBlockingFallback.test.tsx`

## Phase 4: Sync Service Split

- Status 2026-06-09: done. Public facade and internal Firestore transport/metadata/entity/mutation/cursor/service split are in place.
- Keep `src/services/firebaseLearningSyncService.ts` as the public facade.
- Move Firestore transport, snapshot/bucket writes, mutation/cursor handling, and metadata subscribe code under `src/modules/learning/sync/firestore`.
- Preserve the sync data model and public API:
  - `loadLearningCloudState`
  - `saveLearningCloudState`
  - `pullLearningCloudMutations`
  - `applyLearningCloudMutations`
  - `subscribeToLearningCloudMetadata`
- Verification:
  - both Firebase sync service tests
  - `src/test/learningCloudSyncRuntime.test.tsx`
  - `src/test/useManualLearningCloudSync.test.tsx`

## Phase 5: Modes, Settings, Stats UI Split

- Status 2026-06-09: `ModesSections.tsx`, `AppSettings.tsx`, and `Stats.tsx` split. `Modes.tsx` has presentation/model helpers extracted but remains above 500 lines as a container/orchestrator.
- Split `ModesSections.tsx` into mode chooser, target lists, strict, learn, and penalty sections.
- Split `AppSettings.tsx` into account/cloud, permissions, learning, blocking, and appearance sections.
- Split `Stats.tsx` into learning stats, emotion stats, usage stats, and shared stat primitives.
- Keep `Modes.tsx` as orchestration. Save logic stays in `src/modules/modes`.
- Verification:
  - `src/test/modesUiSmoke.test.tsx`
  - `src/test/appSettings.test.tsx`
  - `src/test/stats.test.tsx`
  - `src/test/useNativeSync.test.tsx`

## Phase 6: Test Harness Cleanup

- After production files are slimmed, extract shared test harnesses and fixtures.
- Preserve test names and scenarios.
- Target Android overlay, Modes smoke, Firebase sync, and Learn review tests first.

## 2026-06-08 Implementation Notes

Completed in the first refactor slice:

- `src/lib/learning.ts` is now a thin compatibility facade.
- `src/hooks/useLearnReviewSession.ts` is now a thin compatibility facade.
- `src/services/firebaseLearningSyncService.ts` is now a thin compatibility facade.
- The former `useLearnReviewSession` implementation now delegates deck/card/review-log scope revision calculation to `src/modules/learning/session/hooks/useLearningSessionScopeRevisions.ts`.

Verified after the slice:

- `npm test -- src/test/learning.test.ts src/test/learningStore.test.ts src/test/learningAssignments.test.ts src/test/templateImport.test.ts src/test/learnReviewUi.test.tsx`
- `npm test -- src/test/firebaseLearningSyncService.test.ts src/test/learningCloudSyncRuntime.test.tsx src/test/useManualLearningCloudSync.test.tsx`
- `npm test -- src/test/learnReviewUi.test.tsx`
- `npm run build`

Remaining high-priority implementation files above the target after this slice:

- `src/modules/learning/core/learningCore.ts`
- `src/modules/learning/sync/firestore/firebaseLearningSyncServiceImpl.ts`
- `src/modules/learning/session/hooks/useLearnReviewSessionImpl.ts`
- `src/pages/AppSettings.tsx`
- `src/components/modes/ModesSections.tsx`
- `src/pages/Stats.tsx`
- `src/pages/Modes.tsx`

Parallel worker split started after the first slice:

- Learning Core worker: owns `src/modules/learning/core`, `domain`, `review`, `import`, and `stats`.
- Firebase Sync worker: owns `src/modules/learning/sync/firestore`.
- Learn Review worker: owns `src/modules/learning/session/hooks`.
- UI worker: owns Modes/Settings/Stats UI files and new UI section files.

## 2026-06-09 Implementation Notes

Completed additional production slimdown:

- `src/pages/AppSettings.tsx` is now a settings container with sections under `src/components/settings` and helpers under `src/modules/settings`.
- `src/pages/Stats.tsx` is now a stats container with sections under `src/components/stats` and data modules under `src/modules/stats`.
- `src/pages/Modes.tsx` now delegates active unlocks, strict lock screen, confirm dialogs, and mode page model helpers.
- `src/modules/learning/session/hooks/useLearnReviewSessionImpl.ts` now delegates blocked navigation / native unlock handoff to `useLearnReviewBlockedNavigation`.

Verified after the 2026-06-09 slice:

- `npx tsc --noEmit --pretty false`
- `npm test -- src/test/modesUiSmoke.test.tsx src/test/appSettings.test.tsx src/test/stats.test.tsx src/test/useNativeSync.test.tsx`
- `npm test -- src/test/learnReviewUi.test.tsx src/test/androidOverlaySuccess.test.tsx src/test/appBlockingFallback.test.tsx`
- `npm test -- src/test/modesUiSmoke.test.tsx`
- `npm run build`

Integration audit after the 2026-06-09 slice:

- Public facades are still stable:
  - `src/lib/learning.ts`
  - `src/hooks/useLearnReviewSession.ts`
  - `src/services/firebaseLearningSyncService.ts`
  - `src/components/modes/ModesSections.tsx`
- Internal learning core and Firestore modules do not import back through their public facades.
- `ModeId` moved to `src/modules/modes/modeTypes.ts` so Modes domain modules no longer depend on the Modes UI facade.
- `src/test/useNotificationScheduler.test.tsx` now reads decks through `Object.values(...)`, matching the persisted record-shaped learning store.

Verified during the integration audit:

- `npx tsc --noEmit --pretty false`
- `npm test` - 421 passed, 1 skipped
- `npm run build`
- `cd android && .\gradlew testDebugUnitTest`

Remaining production files above 500 lines after this slice:

- `src/pages/Modes.tsx`
- `src/modules/learning/session/hooks/useLearnReviewSessionImpl.ts`
- `src/store/appStore.slices.ts`
- `src/lib/ankiImport.ts`
- `src/components/charts/ChartPrimitives.tsx`
- `src/store/appStore.shared.ts`
- `src/hooks/useLearningCloudSync.ts`
- `src/store/useLearningStore.ts`
- `src/modules/learning/session/sessionController.ts`
- `src/components/ui/sidebar.tsx`
- `src/lib/learningCloudSync.ts`
- `src/services/screenTimeService.ts`
- `src/pages/Index.tsx`

## 2026-06-10 Implementation Notes

Completed additional safe slimdown:

- `src/pages/Index.tsx` now delegates the blocked-app list dialog to `src/components/dashboard/BlockedAppsDialog.tsx`.
- Dashboard mode label derivation moved to `src/modules/dashboard/dashboardModeLabels.ts`.
- `src/services/screenTimeService.ts` now delegates normalization helpers and accessibility runtime readiness checks to `src/services/screenTimeNormalization.ts`.
- `src/components/charts/ChartPrimitives.tsx` now delegates chart math/types to `src/components/charts/chartPrimitiveUtils.ts` and donut/radar rendering to `src/components/charts/DonutRadarCharts.tsx`.
- Test time isolation was hardened in `src/test/setup.ts`, `src/test/appIntroFlow.test.tsx`, and `src/test/modesUiSmoke.test.tsx` so leaked `Date.now` spies cannot make Android accessibility readiness look fresh in later tests.

Integration findings:

- The Intro permissions flow still distinguishes Android permission granted from accessibility service runtime readiness.
- The Modes save path still rejects stale accessibility reconnect windows and preserves Learn assignment/card-count behavior.
- Chart public imports remain compatible through `src/components/charts/ChartPrimitives.tsx`.
- `screenTimeService` still exposes the same public normalization/readiness helpers while keeping native plugin calls in the service facade.
- Subagents were attempted for Learning/Blocking and Sync/Store side-audits, but both errored on usage limits and produced no patch or finding. The checks above were completed locally instead.

Verified after the 2026-06-10 slice:

- `npx tsc --noEmit --pretty false`
- `npm test -- src/test/dashboardPage.test.tsx src/test/appIntroFlow.test.tsx src/test/modesUiSmoke.test.tsx src/test/screenTimeService.test.ts src/test/screenTimeServiceUnsupported.test.ts src/test/useNativeSync.test.tsx src/test/nativePolicy.test.ts src/test/stats.test.tsx`
- `npm test` - 421 passed, 1 skipped
- `npm run build`
- `cd android && .\gradlew testDebugUnitTest`

Remaining files above 500 lines after this slice:

- `src/test/androidOverlaySuccess.test.tsx` - 940 lines
- `src/pages/Modes.tsx` - 873 lines
- `src/modules/learning/session/hooks/useLearnReviewSessionImpl.ts` - 833 lines
- `src/store/appStore.slices.ts` - 807 lines
- `src/lib/ankiImport.ts` - 757 lines
- `src/test/modesUiSmoke.test.tsx` - 725 lines
- `src/test/firebaseLearningSyncService.test.ts` - 713 lines
- `src/store/appStore.shared.ts` - 692 lines
- `src/test/useManualLearningCloudSync.test.tsx` - 661 lines
- `src/hooks/useLearningCloudSync.ts` - 656 lines
- `src/test/learning.test.ts` - 655 lines
- `src/store/useLearningStore.ts` - 645 lines
- `src/test/learnReviewUi.test.tsx` - 607 lines
- `src/test/learningCloudSync.test.ts` - 600 lines
- `src/test/learningCloudSyncRuntime.test.tsx` - 586 lines
- `src/modules/learning/session/sessionController.ts` - 584 lines
- `src/components/ui/sidebar.tsx` - 583 lines
- `src/lib/learningCloudSync.ts` - 580 lines
- `src/test/appSettings.test.tsx` - 571 lines

## 2026-06-10 Continued Implementation Notes

Completed next production slimdown slice:

- `src/pages/Modes.tsx` now delegates save/warning UI to `src/components/modes/ModesSavePanel.tsx`.
- Modes page definitions, block tabs, initial draft setup, draft controls, active unlock derivation, computed view data, runtime issue messages, debug logging, and store selection moved into focused modules under `src/modules/modes`.
- `src/modules/learning/session/hooks/useLearnReviewSessionImpl.ts` now delegates learning hydration, active deck data derivation, and deferred review-write flushing to focused hooks.

Behavior preserved:

- Modes save flow still writes Learn assignment card counts and unlock duration through the existing persistence path.
- Strict add-on lock state still prevents editing active strict-addon windows.
- Learn review still keeps direct sessions stable while review logs change underneath it.
- Blocked Learn overlay success, fallback-to-strict, dismiss, and reopen paths continue through the same public hook return shape.

Verified after this slice:

- `npx tsc --noEmit --pretty false`
- `npm test -- src/test/modesUiSmoke.test.tsx src/test/learnReviewUi.test.tsx src/test/androidOverlaySuccess.test.tsx src/test/appBlockingFallback.test.tsx`
- `npm run build`

Remaining files above 500 lines after this slice:

- `src/test/androidOverlaySuccess.test.tsx` - 940 lines
- `src/store/appStore.slices.ts` - 807 lines
- `src/lib/ankiImport.ts` - 757 lines
- `src/modules/learning/session/hooks/useLearnReviewSessionImpl.ts` - 754 lines
- `src/test/modesUiSmoke.test.tsx` - 725 lines
- `src/test/firebaseLearningSyncService.test.ts` - 713 lines
- `src/store/appStore.shared.ts` - 692 lines
- `src/test/useManualLearningCloudSync.test.tsx` - 661 lines
- `src/hooks/useLearningCloudSync.ts` - 656 lines
- `src/test/learning.test.ts` - 655 lines
- `src/store/useLearningStore.ts` - 645 lines
- `src/test/learnReviewUi.test.tsx` - 607 lines
- `src/test/learningCloudSync.test.ts` - 600 lines
- `src/pages/Modes.tsx` - 595 lines
- `src/test/learningCloudSyncRuntime.test.tsx` - 586 lines
- `src/modules/learning/session/sessionController.ts` - 584 lines
- `src/components/ui/sidebar.tsx` - 583 lines
- `src/lib/learningCloudSync.ts` - 580 lines
- `src/test/appSettings.test.tsx` - 571 lines

## 2026-06-10 Further Implementation Notes

Completed another focused production slimdown:

- `src/pages/Modes.tsx` now delegates the page render tree to `src/components/modes/ModesPageView.tsx`.
- `src/pages/Modes.tsx` was reduced below 500 lines and keeps only the Modes orchestration, draft state, save wiring, and strict-lock redirect shell.
- `src/modules/learning/session/hooks/useLearnReviewSessionImpl.ts` now delegates:
  - derived card/progress/view-model state to `useLearnReviewDerivedState`
  - session bootstrap/snapshot creation to `useLearnReviewSessionBootstrap`
  - review/undo/next actions to `useLearnReviewReviewActions`
  - session requirement derivation to `useLearnReviewSessionRequirements`
  - no-deck blocked-flow fallback to `useLearnReviewStrictFallback`
- `src/modules/modes/useModesDraftControls.ts` no longer returns the unused `setExpandedApp: undefined` placeholder.

Behavior preserved:

- Modes save still writes Learn assignment card counts and unlock duration through the existing save path.
- Strict foreground recheck, stale-accessibility rejection, and recent reconnect acceptance remain covered.
- Learn review still keeps direct sessions stable while review logs change underneath it.
- Blocked Learn overlay success, strict fallback, dismiss, and reopen paths still go through the existing public hook return shape.

Verified after this slice:

- `npx tsc --noEmit --pretty false`
- `npm test -- src/test/modesUiSmoke.test.tsx src/test/learnReviewUi.test.tsx src/test/androidOverlaySuccess.test.tsx src/test/appBlockingFallback.test.tsx`

Current line counts for the touched large production files:

- `src/pages/Modes.tsx` - 489 lines
- `src/modules/learning/session/hooks/useLearnReviewSessionImpl.ts` - 491 lines
- `src/components/modes/ModesPageView.tsx` - 215 lines

## 2026-06-10 Store Slice Implementation Notes

Completed a focused app-store production slimdown:

- `src/store/appStore.slices.ts` is now a thin facade that re-exports the existing public slice creators.
- App-store slice implementations moved into focused modules under `src/store/appStoreSlices`:
  - `modeSlice.ts`
  - `blockingSlice.ts`
  - `engagementSlice.ts`
  - `preferencesSlice.ts`
  - `penaltySlice.ts`

Behavior preserved:

- Public imports from `src/store/appStore.slices.ts` still expose the same `createModeSlice`, `createEngagementSlice`, `createBlockingSlice`, `createPreferencesSlice`, and `createPenaltySlice` names.
- Blocking targets, strict add-on lock rules, app unlock keys, native runtime issue state, preferences, profile engagement stats, and penalty transaction behavior were moved without intentional logic changes.
- No learning sync, learning store, native Android, or test files were edited in this slice.

Verified after this slice:

- `npx tsc --noEmit --pretty false`
- `npm test -- src/test/nativePolicy.test.ts src/test/useAppStoreBehavior.test.ts src/test/modesUiSmoke.test.tsx`
- `npm test -- src/store/useAppStore.test.ts`
- `npm run build`

Current line counts for the touched store files:

- `src/store/appStore.slices.ts` - 5 lines
- `src/store/appStoreSlices/blockingSlice.ts` - 319 lines
- `src/store/appStoreSlices/modeSlice.ts` - 219 lines
- `src/store/appStoreSlices/penaltySlice.ts` - 197 lines
- `src/store/appStoreSlices/engagementSlice.ts` - 112 lines
- `src/store/appStoreSlices/preferencesSlice.ts` - 52 lines

Next production targets suggested by audit:

- `src/store/useLearningStore.ts` - move browser and filtered-deck-lite helpers into learning modules.
- `src/modules/learning/session/sessionController.ts` - split snapshot creation and pure transitions while keeping the controller facade.

## 2026-06-10 Learning Cloud Hook Implementation Notes

Completed a focused learning-cloud runtime slimdown:

- `src/hooks/useLearningCloudSync.ts` now delegates Store read/write, account-switch persistence backup/restore, API lazy loading/test overrides, timer cleanup, cursor extraction, and shared error messaging to `src/modules/learning/sync/learningCloudRuntimeBridge.ts`.
- The debounced local-save effect moved to `src/modules/learning/sync/useLearningCloudLocalSave.ts`.
- The main hook stays responsible for lifecycle gates, bootstrap merge, remote metadata subscription, retry scheduling, and user/account cancellation checks.
- A parallel subagent for `src/lib/learningCloudSync.ts` timed out and was shut down without producing changes; the cloud-state split was completed locally afterward.

Behavior preserved:

- Account switching still backs up local vocabulary per user and restores when switching back.
- Local pending vocabulary changes still flow through the debounced save path.
- Remote mutation cursors and legacy metadata snapshot fallback remain covered.
- Manual learning-cloud sync still suppresses the automatic background sync path.

Verified after this slice:

- `npx tsc --noEmit --pretty false`
- `npm test -- src/test/learningCloudSyncRuntime.test.tsx src/test/useManualLearningCloudSync.test.tsx src/test/learningCloudSync.test.ts`

Current line counts for the touched sync files:

- `src/hooks/useLearningCloudSync.ts` - 489 lines
- `src/modules/learning/sync/learningCloudRuntimeBridge.ts` - 200 lines
- `src/modules/learning/sync/useLearningCloudLocalSave.ts` - 171 lines

## 2026-06-10 Learning Cloud State Contract Notes

Completed the remaining public learning-cloud contract slimdown:

- `src/lib/learningCloudSync.ts` is now a thin public facade that preserves the existing import path.
- The expanded cloud-state contract moved under `src/modules/learning/sync/cloudState`:
  - `learningCloudStateContract.ts` owns normalization and merge behavior.
  - `learningCloudStateTypes.ts` owns browser, filtered-deck-lite, and cloud-state types.
  - `learningCloudStateSignature.ts` owns state signatures and empty-state detection.
- `src/modules/learning/sync/learningCloudState.ts` now remains as a compatibility facade for worker/tests and points at the same expanded cloud-state contract.

Behavior preserved:

- Public imports from `@/lib/learningCloudSync` still expose the same functions and types.
- Learning cloud normalization still includes assignments, gate rule, card browser state, saved card queries, filtered-deck-lite definitions, and filtered-deck-lite runs.
- Sync signatures and empty-state checks remain covered by the cloud sync tests.

Verified after this slice:

- `npx tsc --noEmit --pretty false`
- `npm test -- src/test/learningCloudSync.test.ts src/test/firebaseLearningSyncService.test.ts src/test/learningCloudSyncRuntime.test.tsx src/test/useManualLearningCloudSync.test.tsx`

Current line counts for the touched cloud-state files:

- `src/lib/learningCloudSync.ts` - 19 lines
- `src/modules/learning/sync/cloudState/learningCloudStateContract.ts` - 453 lines
- `src/modules/learning/sync/cloudState/learningCloudStateTypes.ts` - 101 lines
- `src/modules/learning/sync/cloudState/learningCloudStateSignature.ts` - 124 lines

## 2026-06-10 Learning Store Browser/Filtered Deck Notes

Completed a focused learning-store slimdown:

- `src/store/useLearningStore.ts` now keeps its public store/facade role and delegates card-browser plus filtered-deck-lite state/actions to learning modules.
- Store-specific browser state and saved-search normalization moved to `src/modules/learning/browser/cardBrowserStoreState.ts`.
- Store-specific filtered-deck-lite persisted state and run normalization moved to `src/modules/learning/filtered-deck/filteredDeckLiteStoreState.ts`.
- Browser and filtered-deck-lite store actions moved to `src/modules/learning/store/slices/browserFilteredDeckSlice.ts`.

Behavior preserved:

- Public imports from `@/store/useLearningStore` still expose the same store and related types.
- Persisted learning store shape remains unchanged: `cardBrowser`, `savedCardQueries`, `filteredDeckLiteDefinition`, `filteredDeckLiteDefinitions`, and `filteredDeckLiteRuns` are still partialized under the same keys.
- Cloud-sync tests still cover the browser/search/filterdeck state moving through the sync runtime.

Verified after this slice:

- `npx tsc --noEmit --pretty false`
- `npm test -- src/test/learningStore.test.ts src/test/learningCloudSyncRuntime.test.tsx src/test/useManualLearningCloudSync.test.tsx src/test/learningCloudSync.test.ts`
- `npm run build`

Current line counts for the touched learning-store files:

- `src/store/useLearningStore.ts` - 286 lines
- `src/modules/learning/store/slices/browserFilteredDeckSlice.ts` - 293 lines
- `src/modules/learning/browser/cardBrowserStoreState.ts` - 81 lines
- `src/modules/learning/filtered-deck/filteredDeckLiteStoreState.ts` - 100 lines

Remaining files above 500 lines after this slice:

- `src/test/androidOverlaySuccess.test.tsx` - 1052 lines
- `src/test/modesUiSmoke.test.tsx` - 885 lines
- `src/lib/ankiImport.ts` - 858 lines
- `src/test/firebaseLearningSyncService.test.ts` - 796 lines
- `src/store/appStore.shared.ts` - 760 lines
- `src/test/learning.test.ts` - 748 lines
- `src/test/useManualLearningCloudSync.test.tsx` - 719 lines
- `src/test/learnReviewUi.test.tsx` - 713 lines
- `src/test/learningCloudSyncRuntime.test.tsx` - 660 lines
- `src/test/appSettings.test.tsx` - 658 lines
- `src/modules/learning/session/sessionController.ts` - 658 lines
- `src/test/learningCloudSync.test.ts` - 639 lines
- `src/components/ui/sidebar.tsx` - 636 lines
- `src/store/useAuthStore.ts` - 522 lines
- `src/components/setup/AuthDialog.tsx` - 508 lines
- `src/hooks/useNativePendingNavigation.ts` - 506 lines
- `src/test/useNativePendingNavigation.test.tsx` - 505 lines

## 2026-06-10 Session Controller And Sync Seam Notes

Completed another production slimdown and seam correction:

- `src/modules/learning/session/sessionController.ts` now delegates snapshot creation to `src/modules/learning/session/sessionSnapshotFactory.ts`.
- Session-facing learning accessors moved to `src/modules/learning/session/sessionLearningAccessors.ts`.
- Shared card-browser row building/filtering moved from the React hook to `src/modules/learning/browser/cardBrowserRows.ts`.
- `src/hooks/useCardBrowser.ts` and `src/hooks/useFilteredDeckLite.ts` now use that shared browser-row module.

Subagent seam findings resolved:

- The legacy worker import path `src/modules/learning/sync/learningCloudState.ts` now points to the expanded cloud-state contract, so background sync sees assignments, gate rule, browser state, saved searches, and filtered-deck-lite state consistently.
- `src/services/learningBackgroundService.ts` now includes assignments, gate rule, and gate-rule revision in the background sync snapshot.
- `src/hooks/useLearningBackgroundRuntime.ts` now also reads and writes assignments, gate rule, and gate-rule revision when applying background sync results.
- `runFilteredDeckLiteDefinition` now uses the same definition-driven deck/query filtering as the UI preview instead of the current card-browser selected deck.
- `src/test/learningBackgroundRuntime.test.tsx` now has a regression test proving background sync preserves Learn assignments and gate-rule settings.

Verified after this slice:

- `npx tsc --noEmit --pretty false`
- `npm test -- src/test/learnReviewUi.test.tsx src/test/androidOverlaySuccess.test.tsx src/test/appBlockingFallback.test.tsx src/modules/learning/store/__tests__/reviewSession.test.ts`
- `npm test -- src/test/learningSyncWorker.test.ts src/test/learningStore.test.ts src/test/learningCloudSync.test.ts src/test/learningCloudSyncRuntime.test.tsx src/test/useManualLearningCloudSync.test.tsx`
- `npm test -- src/test/learningBackgroundRuntime.test.tsx src/test/learningSyncWorker.test.ts src/test/learningCloudSync.test.ts src/test/learningCloudSyncRuntime.test.tsx`
- `npm test` - 422 passed, 1 skipped
- `npm run build`

Current line counts for the touched production files:

- `src/modules/learning/session/sessionController.ts` - 491 lines
- `src/modules/learning/session/sessionSnapshotFactory.ts` - 139 lines
- `src/modules/learning/session/sessionLearningAccessors.ts` - 45 lines
- `src/modules/learning/sync/learningCloudState.ts` - 19 lines
- `src/modules/learning/browser/cardBrowserRows.ts` - 151 lines

Remaining files above 500 lines after this slice:

- `src/test/androidOverlaySuccess.test.tsx` - 1052 lines
- `src/test/modesUiSmoke.test.tsx` - 885 lines
- `src/lib/ankiImport.ts` - 858 lines
- `src/test/firebaseLearningSyncService.test.ts` - 796 lines
- `src/store/appStore.shared.ts` - 760 lines
- `src/test/learning.test.ts` - 748 lines
- `src/test/useManualLearningCloudSync.test.tsx` - 719 lines
- `src/test/learnReviewUi.test.tsx` - 713 lines
- `src/test/learningCloudSyncRuntime.test.tsx` - 660 lines
- `src/test/appSettings.test.tsx` - 658 lines
- `src/test/learningCloudSync.test.ts` - 639 lines
- `src/components/ui/sidebar.tsx` - 636 lines
- `src/store/useAuthStore.ts` - 522 lines
- `src/components/setup/AuthDialog.tsx` - 508 lines
- `src/hooks/useNativePendingNavigation.ts` - 506 lines
- `src/test/useNativePendingNavigation.test.tsx` - 505 lines

## Final Verification

- `npm test`
- `npm run build`
- `android/.\\gradlew testDebugUnitTest`

## 2026-06-10 Performance Import Notes

Completed a focused startup/bundle performance slice:

- Pure screen-time normalization helpers now live behind `src/services/screenTimeNormalization.ts` and are imported directly by stats, modes, settings, and dashboard view code where no native plugin call is needed.
- `src/services/screenTimeService.ts` remains the public compatibility facade for existing imports and native calls.
- Installed-app lookup moved to `src/services/screenTimeInstalledApps.ts` so the blocking unlock success screen can lazy-load only the tiny app-list helper instead of pulling the whole screen-time service into that async chunk.
- Shared platform error handling moved to `src/services/screenTimePlatformError.ts` to keep the installed-app loader independent and avoid a service cycle.
- Critical blocking routes in `src/lib/routeLoaders.ts` now use dynamic imports like the rest of the app. `preloadCriticalBlockingRoutes()` still warms `/intervention`, `/breathing`, `/checkin`, and `/learn/review` on Android, but those pages are no longer statically bundled into the main app chunk.

Bundle impact from the verified Vite build:

- `screenTimeInstalledApps` chunk: about 355 kB before the clean split, about 0.73 kB after.
- Main `App` chunk: about 355 kB / 101 kB gzip before lazy critical route loaders, about 156 kB / 46 kB gzip after.
- The remaining build warning is the existing `sql.js` wasm URL warning; no new screen-time or route-loader warning was introduced.

Behavior preserved:

- Settings, intro permissions, modes save, native policy sync, stats, Android overlay success, blocking fallback, and Learn review flows stay covered by tests.
- Native blocking route preloading still happens on Android after the app shell mounts.
- The unlock success screen still falls back to the generic app icon if installed-app lookup is unavailable.

Verified after this performance slice:

- `npx tsc --noEmit --pretty false`
- `npm test -- src/test/appSettings.test.tsx src/test/appIntroFlow.test.tsx src/test/modesUiSmoke.test.tsx`
- `npm test -- src/test/screenTimeService.test.ts src/test/screenTimeServiceUnsupported.test.ts src/test/screenTimeServiceBehavior.test.ts src/test/stats.test.tsx src/test/androidOverlaySuccess.test.tsx src/test/useNativeSync.test.tsx src/test/nativePolicy.test.ts`
- `npm test -- src/test/appBlockingFallback.test.tsx src/test/appAndroidOnly.test.tsx src/test/androidOverlaySuccess.test.tsx src/test/learnReviewUi.test.tsx`
- `npm test` - 422 passed, 1 skipped
- `npm run build`
