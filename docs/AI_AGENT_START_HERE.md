# AI Agent Start Here

Last updated: 2026-06-16

This is the short, high-signal entry point for any AI agent working on Blearn.
Read this first, then follow the linked deeper docs only for the area you touch.

## 1. Product North Star

Blearn is not just an app blocker. It is a commitment device that turns an automatic distracting app open into a short conscious pause, reflection, learning, breathing, or payment decision.

Success means the real Android blocking flow works on a device:

1. Android detects a blocked target.
2. Native overlay appears.
3. Overlay hands off to the right React flow.
4. User completes the intervention.
5. Unlock is granted for the right target and duration.
6. Overlay host is dismissed.
7. Target app/site/search is reopened only when intended.

## 2. Mandatory Read Order

For every implementation session:

1. Read `AGENTS.md`.
2. Read this file.
3. Read `docs/project-memory.md`.
4. Read the latest plan in `docs/plans/` by `LastWriteTime`.
5. If touching Android blocking, read `docs/blocking-overlay-tldr.md` and `docs/blocking-overlay-handover-for-agents.md`.
6. If touching Learn mode, read `docs/learn-mode-handover-for-agents.md`.

Do not rely on old chat summaries without checking the current repository state.

## 3. Non-Negotiable Rules

- Never use `adb uninstall`, `pm clear`, app data wipes, or storage-clearing commands unless the user explicitly requests data deletion.
- When installing on Android, preserve local data and vocabulary with `adb install -r`. Add `-t` only if a debug/test build requires it.
- Never implement Android blocking by force-stopping apps or sending HOME redirects. Follow the Overlay & Handoff architecture.
- Do not silently revert unrelated work in a dirty worktree.
- Do not treat a successful TypeScript build as enough for blocking work. Real success requires device-level trigger, handoff, completion, dismiss, and optional reopen consistency.
- Do not make UI claims about sync, unlocks, or background behavior unless the backing implementation really exists.

## 4. Current State Snapshot

As of 2026-06-16, the active GitHub branch for the current work is:

- `fix/masterplan-phase0-bugfixes`
- Latest pushed commit: `8812367 feat(app): publish latest blocking and stats refinements`
- Previous pushed fix: `2cddd9a fix(blocking): keep unlock success CTA responsive`

Recent important changes:

- Native overlay and React intervention entrances were animated without delaying handoff.
- Blocked Learn flow shows the unlock vocabulary counter in the top-right Learn header.
- The old separate Learn unlock progress bar was removed.
- The final blocked Learn success screen no longer waits for emotion/stat tracking writes.
- The final unlock success screen no longer loads installed app icons, avoiding `getInstalledApps()` bridge and base64-icon work on the latency-critical CTA path.
- Stats UI was cleaned up; old Android runtime / active app / last updated noise was removed.
- Emotion and vocabulary tracking received regression tests.

Known local/worktree caveat:

- Performance trace artifacts under `.codex-artifacts/` are local evidence, not app source.
- Generated Capacitor Gradle line-ending changes can appear after sync/build; do not commit them unless the content actually changed.

## 5. Architecture In 90 Seconds

React owns configuration and learning state. Android owns foreground detection and native overlay presentation.

Key path:

1. User configures Modes in `src/pages/Modes.tsx`.
2. React stores blocking state in `src/store/useAppStore.ts`.
3. Learn assignments and review state live in `src/store/useLearningStore.ts`.
4. React builds the native policy in `src/lib/nativePolicy.ts`.
5. Android reads the policy in `PolicySnapshotReader.java`.
6. Accessibility detection runs in `ScreenTimeAccessibilityService.java`.
7. Native overlay renders through `OverlayPresenter.java`.
8. Pending route handoff goes through `PendingNavigationStore.java`, `BlockingOverlayActivity.java`, and `src/hooks/useNativePendingNavigation.ts`.
9. React flow completes and reports/dismisses through `src/lib/nativeRouteHandoff.ts` and `src/hooks/useOverlayDismissGuard.ts`.

## 6. Learn Blocking Rules

- Learn mode is a counted-card unlock gate.
- `hard`, `good`, and `easy` can count as unlock credit.
- `again` does not count as credit.
- Wrong cards in unlock sessions are re-queued so the user cannot fall into a dead end.
- The emotion check-in is part of the blocked Learn completion flow, but unlock success must not wait on slow analytics/stat persistence.
- Do not move durability-critical review writes behind optional async work.

## 7. Sync Truth

Firebase sync is intentionally scoped to learning/vocabulary data.

Synced:

- decks
- notes
- cards
- review logs
- presets
- active deck

Not synced:

- blocking modes
- blocked targets
- temporary unlocks
- penalty state
- device permissions
- local Android enforcement state

If UI says something syncs across devices, verify the backing path first.

## 8. Verification Expectations

Pick checks based on touched area. Common commands:

```powershell
npx tsc --noEmit --pretty false
npm test -- src/test/learnReviewUi.test.tsx src/test/androidOverlaySuccess.test.tsx
npm run build
npx cap sync android
cd android
.\gradlew.bat assembleDebug
adb install -r app\build\outputs\apk\debug\app-debug.apk
```

For Android blocking changes, prefer device evidence over assumptions. At minimum verify:

- policy was synced
- overlay appears
- handoff route is consumed
- completion grants the right target unlock
- overlay dismisses once
- target reopen behavior matches the mode

## 9. Where To Add Future Memory

Use this split:

- `docs/AI_AGENT_START_HERE.md`: compact onboarding facts any agent needs immediately.
- `docs/project-memory.md`: durable architecture, source-of-truth, caveats, and chronological high-signal history.
- `docs/plans/YYYY-MM-DD-*.md`: execution plans and prioritization.
- `$CODEX_HOME/automations/*/memory.md`: automation-specific run logs, measurements, and transient evidence.

Keep this file short. Move deep detail to `project-memory.md` or a focused handover doc.
