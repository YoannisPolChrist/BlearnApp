# Phase 5 Learning Sync, Media, and Background Processing Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade Blearn's learning sync from snapshot-style state replacement to durable mutation-based sync, then add media transport and background workers without rewriting the rest of the learning stack.

**Architecture:** Keep Firebase as the transport/auth layer, but introduce a mutation journal that records deck, card, note, review-log, saved-search, and filtered-deck changes. Devices push local mutations and pull deltas from a cursor, while media files move through a separate hashed asset pipeline.

**Tech Stack:** React 18, TypeScript, Zustand 5, Firebase Auth, Firestore, Firebase Storage, service/background worker infrastructure, Vitest.

---

## Target State
- A local `learningMutations` queue records atomic changes instead of relying on full-state uploads.
- Each device tracks a sync cursor and the last acknowledged mutation timestamp/version.
- Cloud sync uses `pushLearningMutations` and `pullLearningDeltas` style operations rather than whole-snapshot merge.
- Media is stored by content hash and referenced from learning entities instead of being embedded ad hoc.
- Background workers independently handle metadata sync and media upload/download retry.

## Current Anchors
- `src/hooks/useLearningCloudSync.ts`
  - Current orchestration point for learning sync.
- `src/services/firebaseLearningSyncService.ts`
  - Current Firebase adapter that can be evolved toward delta-based operations.
- `src/store/useLearningStore.ts`
  - Source of truth for local changes that must emit mutations.

## New Data Model Pieces
- `LearningMutation`
  - `{ id, deviceId, entityType, entityId, op, payload, createdAt, logicalClock }`
- `LearningSyncCursor`
  - `{ deviceId, lastPulledAt, lastPushedClock, lastAckedMutationId }`
- `LearningMediaAsset`
  - `{ hash, mimeType, size, storagePath, createdAt }`
- `PendingMediaTransfer`
  - `{ assetHash, direction, status, retries, lastError }`

## Recommended Services
- `src/modules/learning/sync/mutationLog.ts`
  - Append/read/ack local mutation journal.
- `src/modules/learning/sync/deltaSync.ts`
  - Pull/push orchestration, merge order, idempotency guards.
- `src/modules/learning/sync/conflictResolution.ts`
  - Entity-level merge rules with review-log append semantics.
- `src/modules/learning/media/mediaRegistry.ts`
  - Asset registration, hash generation, lookup helpers.
- `src/modules/learning/media/mediaTransferQueue.ts`
  - Upload/download queue with retry metadata.
- `src/modules/learning/workers/learningSyncWorker.ts`
  - Background metadata sync runner.
- `src/modules/learning/workers/learningMediaWorker.ts`
  - Background media transfer runner.

## Migration Strategy
1. Add mutation recording locally while keeping snapshot sync as the server truth.
2. Introduce cursors and delta endpoints, but continue writing compatibility snapshots during rollout.
3. Switch read-paths to prefer mutations/deltas once parity checks pass.
4. Add media registry plus Firebase Storage transport for note/card assets.
5. Enable background workers for silent sync and media retries.
6. Retire legacy snapshot-only merge once all active clients support mutation sync.

## Conflict Rules
- Review logs append; never overwrite historical attempts.
- Card scheduling conflicts prefer the newest logical clock, with review-log replay as tie-breaker.
- Deck and saved-search metadata prefer latest-write-wins for user settings.
- Media assets are immutable by hash; references move, blobs do not.

## Small-First Delivery
- MVP sync upgrade:
  - Record mutations for card answers, note edits, deck imports, and filtered-deck changes.
  - Delta pull/push for learning metadata only, no media yet.
- Next step:
  - Add saved searches, browser state, and filtered-deck definitions to mutation sync.
- Later:
  - Add media pipeline, offline retries, and periodic background jobs.

## Risks
- Partial rollout can double-apply changes if mutation acknowledgements are not idempotent.
- Review history corruption is the highest-risk failure mode and must be guarded with append-only semantics.
- Background workers can drain battery or thrash network if retry backoff is weak.
- Media transfer errors can leave note references dangling unless the asset registry is authoritative.

## Verification
- Unit-test idempotent mutation replay and conflict resolution for card reviews.
- Simulate multi-device offline edits and confirm convergence after reconnect.
- Validate that imported decks, review logs, and saved searches survive sync round-trips.
- Add smoke tests for background retry logic and a manual offline/online regression pass.
