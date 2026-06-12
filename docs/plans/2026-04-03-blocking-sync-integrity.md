# Blocking-, Sync- und Wahrheits-Reset fuer Blearn

## Summary

- This execution plan combines four linked workstreams: blocking stability, strict semantics, sync/auth truth, and durable agent memory.
- The product goal stays the same: a blocked target should route the user into a calm, direct, intentional Blearn moment, not a laggy or confusing system detour.
- The integrity goal for this round is stricter than "it builds": any visible UI promise must match a real background path, and any account/sync claim must be backed by implemented and verified persistence.

## Core Decisions

- `targetType + ':' + normalizedTargetId` is the canonical target identity everywhere: React stores, native policy snapshots, manual overrides, success handoff, and unlock checks.
- `Strict` is split cleanly:
  - the extra strict toggle is a settings/modes protection companion
  - the full strict lock is the only flow that hard-locks all selected targets for the configured window
- The hard cap for strict lock duration is 20 hours in UI, store logic, and native payloads.
- The active cloud source of truth remains the Firestore-based learning sync path. The unused `learningSyncService.ts` path must not continue as a hidden second sync direction.
- Running per-device unlock timers remain local for now. The UI must not imply account-wide unlock continuity unless it is truly implemented.

## Implementation Blocks

### Block A: Agent Memory And Working Context

- Keep [`docs/project-memory.md`](C:\Users\psjoh\Desktop\Personal\Coding\Apps\Blearn-App\docs\project-memory.md) as the canonical high-signal memory for new sessions.
- Keep [`AGENTS.md`](C:\Users\psjoh\Desktop\Personal\Coding\Apps\Blearn-App\AGENTS.md) pointed at the current memory and plan files before any implementation starts.
- Preserve the rule that success is measured on-device: trigger, handoff, completion, dismiss, and optional reopen must align.

### Block B: Blocking Flow, Strict Semantics, And Native Stability

- Remove remaining per-app/raw-id unlock ambiguity and keep all unlock paths target-typed end to end.
- Make the Android blocking handoff direct: blocked target opens -> overlay -> exact blocking route, with no dashboard flash and no delayed reroute.
- Standardize success/abort:
  - success unlocks only the current target
  - abort dismisses cleanly and returns the user to the previous phone context
- Separate settings protection from full strict lock on the `Modes` side and in native policy generation.
- Keep `Learn` reachable when settings protection is active, while `Modes`/config weakening/stop actions are blocked.
- Reduce unnecessary foreground rechecks and policy writes that make the app feel sticky or delayed.

### Block C: Modes Reliability And Performance

- Make `Modes` interactions feel immediate again: app assignment, toggles, save state, and navigation must react consistently.
- Remove selector and runtime patterns that rebuild unstable snapshots or cause repeated policy sync work.
- Keep per-target unlock durations separate at UI, store, and native snapshot level.

### Block D: Sync, Account, And Data Integrity

- Extend the active learning cloud sync to cover the learn configuration the user expects to travel with the account:
  - `assignments`
  - `gateRule`
- Do not present `unlockGrants` as cross-device state unless that behavior is deliberately implemented later.
- Add a real account-backed progress sync for the user-facing non-learning metrics that currently remain local:
  - check-ins
  - emotion-bearing interactions
  - stats-driving progress signals
- Keep derived counters like `dailyStats` and `commonEmotions` derived from synced event data rather than merged blindly as raw counters.
- Fix the existing learning cloud regression around legacy metadata / mutation cursor fallback before calling sync stable.

### Block E: Registration And UI Truth Audit

- Verify the real registration flow end to end:
  - email/password sign-up creates a Firebase user
  - auth state settles correctly
  - account UI updates correctly
  - sync-ready state is established after sign-in
- Keep Google sign-in verification in scope on Android because account-backed sync depends on it.
- Audit critical UI for false promises or frontend-only no-ops:
  - settings account/sync card
  - manual sync CTA
  - cloud snapshot viewer
  - learn sync language
  - any control that implies native, backend, or cloud persistence
- Every audited surface must end up in one explicit category:
  - truly cloud-backed
  - truly native/local-backed
  - intentionally local-only and labeled as such

## Validation

- Blocking and strict
  - blocked target opens directly into the right overlay flow
  - no dashboard flash
  - success unlocks only the current target
  - abort returns to the previous phone context
  - settings protection blocks settings weakening paths but keeps `Learn` reachable
  - full strict lock blocks all selected targets for the active window
- Sync and account
  - learn entities plus `assignments` and `gateRule` survive account/device transition
  - synced progress data reappears on a second signed-in device
  - the legacy metadata / mutation cursor regression is fixed
  - sign-up and sign-in are proven beyond mocked UI tests
- Performance
  - no React #185 / snapshot loop regressions
  - `Modes` feels immediate again
  - no delayed strict/blocking screens after normal app navigation
- UI truth
  - no copy claims cross-device continuity without real backing data
  - no visible CTA behaves like a backend/native action if it is only a frontend placeholder

## Notes For Implementers

- Prefer behavior-level truth over cosmetic fixes. If a card says "sync", either make it sync or change what it says.
- Do not reintroduce a second sync architecture unless it is explicitly chosen and documented.
- Keep tests close to the user-facing contracts: target-scoped unlocks, strict semantics, account-backed continuity, and no-op detection.
