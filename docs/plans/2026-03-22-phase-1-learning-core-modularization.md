# Phase 1 Learning Core Modularization Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Split Blearn's current "mini-Anki core" into stable, testable modules without changing learner-facing behavior, persisted data, or unlock flows.

**Architecture:** Keep the existing learning model and FSRS scheduling logic, but move responsibilities out of the current monolith into focused domain packages. The target shape mirrors Anki's `Collection` + scheduler separation while staying much lighter for Blearn's product scope.

**Tech Stack:** React 18, TypeScript, Zustand 5, ts-fsrs, IndexedDB persistence, Firebase sync adapters, Vitest.

---

## Target State
- `src/modules/learning/domain`
  - Core entities and pure helpers for `LearningDeck`, `LearningNote`, `LearningCard`, `ReviewLog`, presets, and import-safe identifiers.
- `src/modules/learning/review`
  - Scheduling, interval calculation, queue derivation, answer application, due/review helpers.
- `src/modules/learning/import`
  - CSV/JSON/APKG ingestion, row normalization, entity creation, merge/upsert behavior.
- `src/modules/learning/session`
  - Session queue/controller helpers used by React hooks and future reviewer refactors.
- `src/modules/learning/stats`
  - Deck summaries, streak/progress helpers, learn/review metrics.
- `src/modules/learning/store`
  - Zustand slice builders and persistence adapters.
- `src/modules/learning/sync`
  - Shared serialization, cloud merge helpers, and sync-safe state mappers.

## Current Hotspots To Split
- `src/lib/learning.ts`
  - Currently mixes entities, deck creation, FSRS scheduling, queue selection, stats, import utilities, and presets.
- `src/lib/ankiImport.ts`
  - Should become an import adapter layered on top of modular entity builders instead of calling monolithic helpers directly.
- `src/store/useLearningStore.ts`
  - Currently mixes state shape, persistence, assignments, imports, review actions, and selectors.
- `src/hooks/useLearnReviewSession.ts`
  - Should stop owning low-level session logic and consume dedicated review/session services instead.

## Stable APIs To Preserve In Phase 1
- Existing persisted store shape and migrations must remain readable.
- Existing review behavior and FSRS outputs must stay functionally equivalent.
- Existing import entry points and deck template import flows must keep working.
- Existing unlock flows, assignments, and learn counts must remain unchanged.
- Existing tests around learning/import/review should continue passing with minimal fixture churn.

## File Map
- Create `src/modules/learning/domain/entities.ts`
- Create `src/modules/learning/domain/presets.ts`
- Create `src/modules/learning/review/scheduler.ts`
- Create `src/modules/learning/review/queues.ts`
- Create `src/modules/learning/review/reviewActions.ts`
- Create `src/modules/learning/import/buildEntities.ts`
- Create `src/modules/learning/import/mergeDecks.ts`
- Create `src/modules/learning/session/sessionController.ts`
- Create `src/modules/learning/stats/deckStats.ts`
- Create `src/modules/learning/store/slices/baseLearningSlice.ts`
- Create `src/modules/learning/store/slices/importSlice.ts`
- Create `src/modules/learning/store/slices/reviewSlice.ts`
- Create `src/modules/learning/sync/learningSyncMappers.ts`
- Convert `src/lib/learning.ts` into a compatibility barrel during the transition.
- Move `src/lib/ankiImport.ts` toward `src/modules/learning/import/ankiPackage.ts` once call sites are stable.

## Recommended Implementation Order
1. Extract pure entity/preset types and re-export them from `src/lib/learning.ts`.
2. Move scheduler and queue helpers into `review/` with snapshot tests to prove no interval regressions.
3. Extract import builders and merge logic so APKG/CSV/JSON paths all call the same domain entry point.
4. Split Zustand logic into slices while preserving the public store contract.
5. Extract `sessionController` helpers and reduce `useLearnReviewSession.ts` to orchestration glue.
6. Move stats and sync mappers last, then shrink `src/lib/learning.ts` to a thin compatibility layer.

## Risks
- Persisted learning state can break if type moves accidentally change serialized keys.
- Import deduplication and legacy deck IDs are easy to regress while extracting builders.
- FSRS cache/interval math must remain byte-for-byte close enough for existing review tests.
- Sync race conditions may surface if state mappers are partially moved before store boundaries are stable.
- Unlock-related counts can drift if queue and stats extraction happen out of order.

## Verification
- Run focused learning/import/review Vitest suites after each extraction step.
- Compare deck stats and due/review counts before and after the refactor on seeded fixtures.
- Exercise learn review manually to confirm reveal, rating, and continuation still match current behavior.
- Finish with a full build and a narrow regression pass on learn/unlock flows.
