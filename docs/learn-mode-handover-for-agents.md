# Learn Mode Handover For Agents

Date: 2026-03-12

## Goal

This note summarizes what is structurally better in the Android app's Learn mode and what should be treated as open issues before using it as the reference for future Learn work.

The focus here is not the visual design. The focus is:

- button behavior
- module boundaries
- Learn gate flow
- handoff back to the blocked target

## What Is Good In This Learn Setup

### 1. The Learn hub is intentionally thin

Files:

- `src/pages/Learn.tsx`
- `src/components/learn/LearnDeckLibraryDialog.tsx`
- `src/components/learn/LearnTemplatesDialog.tsx`
- `src/components/learn/LearnStudioDialog.tsx`

Why this is good:

- The main Learn page is only a launcher.
- Deck library, templates, and studio each live in their own module.
- The user does not need to parse a giant all-in-one Learn page.
- The button roles are very clear:
  - `Bibliothek` = choose or start a deck
  - `Templates` = import starter packs
  - `Studio` = create or import content

This structure should be preserved as the Android Learn mode continues to evolve.

### 2. The review flow is a dedicated session, not just a form page

File:

- `src/pages/LearnReview.tsx`

Why this is good:

- The screen is built around one active review session.
- Deck, queue, timer, required-correct count, answer mode, and success state all belong to the same surface.
- This makes the Learn gate feel like a real interruption flow instead of a detached settings page.

Important module-level strengths:

- clear separation between session state and store state
- explicit success state dialog
- explicit resume action back to the target
- typed-answer handling lives inside the session flow, not spread across unrelated components

### 3. Native handoff primitives are clearer than older fallback flows

Files:

- `src/services/screenTimeService.ts`
- `src/plugins/ScreenTimePlugin.ts`

Why this is good:

- `openGate(...)` explicitly opens the Learn gate for a target.
- `openTarget(...)` explicitly returns the user to the blocked target after success.

This is one of the main reasons the Android Learn mode feels better wired.

This contract should stay explicit instead of drifting back toward more implicit overlay completion behavior.

### 4. The policy snapshot carries Learn assignment data close to enforcement

File:

- `src/lib/nativePolicy.ts`

Why this is good:

- `targets[]` carries:
  - `id`
  - `type`
  - `mode`
  - `deckId`
  - `requiredCorrectReviews`
  - `unlockDurationMinutes`
  - `enabled`

That makes the native side less dependent on reconstructing Learn behavior from separate stores.

This is a strong structural pattern and should be kept.

## Open Problems In This Android Project

### 1. Text encoding is broken in many Learn files

Examples:

- `src/pages/LearnReview.tsx`
- `src/components/learn/LearnDeckLibraryDialog.tsx`
- `src/components/learn/LearnStudioDialog.tsx`

Observed symptoms:

- `WÃ¤hle`
- `FÃ¤llig`
- `Ãœbersetzung`
- `SchlieÃŸen`

This is not just cosmetic:

- it makes the product feel unstable
- it makes reviews and prompts harder to trust
- it should be fixed before using these files as a source for copy or UX text

### 2. Unlock grants still collide by target id only

File:

- `src/store/useLearningStore.ts`

Problem:

- `registerUnlockGrant(...)` stores `targetType`
- but the filtering and lookup still use only `targetId`
- `getUnlockGrant(targetId)` also ignores `targetType`

Why this is a real bug:

- `website:youtube.com` and `search:youtube.com` can collide
- one target can overwrite or shadow the other
- the store is not fully aligned with the per-target model

This should be changed so grants are always keyed by:

- `targetType`
- `targetId`

### 3. Assignment access is partly typed, but the API surface is still inconsistent

File:

- `src/store/useLearningStore.ts`

Current state:

- `upsertAssignment(...)` uses `targetId + targetType`
- `getAssignmentForTarget(...)` allows `targetType` to be omitted
- `removeAssignment(...)` also allows `targetType` to be omitted

Why this is risky:

- the data model wants exact target identity
- optional target type makes accidental broad deletes and ambiguous lookups possible

Recommendation:

- require `targetType` everywhere for assignment lookup and removal
- keep the API strict and consistent

### 4. LearnTemplates import feedback is slightly misleading

File:

- `src/components/learn/LearnTemplatesDialog.tsx`

Problem:

- after `importTemplateDeck(...)`, the code checks whether the template is now imported
- if yes, it shows the success toast
- else it shows "already present"

Why this is weak:

- the success condition is inferred from state after import, not from a precise result flag
- the "already present" branch is effectively a fallback, not a clean explicit outcome

Recommendation:

- return a clearer import result from the store, for example:
  - `imported`
  - `already-existed`
  - `failed`

### 5. The module structure is good, but the Learn review file is too large

File:

- `src/pages/LearnReview.tsx`

Problem:

- review session logic
- success handling
- keyboard shortcuts
- edit dialog
- limits dialog
- typed-answer flow
- target resume flow

all live in one large file

Why this matters:

- the architecture is good at the screen level
- but the page component is doing too much internally

Recommended splits:

- `LearnReviewSession`
- `LearnReviewToolbar`
- `LearnReviewSuccessDialog`
- `LearnReviewEditDialog`
- `LearnReviewLimitsDialog`
- `useLearnReviewSession`

## What Future Refactors Should Preserve First

If another agent extends or restructures the Android Learn-mode setup, the priority order should be:

1. Copy the flow contract, not the UI.
2. Keep the thin Learn hub with separate library/templates/studio modules.
3. Keep explicit `openGate(...)` and `openTarget(...)` style behavior.
4. Keep assignment data inside policy `targets[]`.
5. Keep the Learn review as a real session screen.
6. Do not copy the broken text encoding.
7. Fix target-identity handling before reusing unlock-grant logic.

## Suggested Next Work Items

1. Fix UTF-8 / mojibake in Learn-related source files.
2. Make unlock grants strictly keyed by `targetType + targetId`.
3. Make assignment lookup and removal require `targetType`.
4. Refactor `LearnReview.tsx` into smaller session modules.
5. Keep the current module split between hub, library, templates, studio, and review.
