# Robust Review Engine Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deliver a deterministic learn-review pipeline with undoable actions, timer awareness, typed-answer validation, and UX feedback that matches Blearn's strict unlock requirements.

**Architecture:** Introduce a domain-level `ReviewSessionController` that owns queue state, answer pipeline, and history. Persist controller snapshots plus undo stack inside a dedicated `reviewSession` slice on top of `useLearningStore`. Leverage lightweight services (typed-answer evaluator, answer timer, feedback channel) that the React hook composes into the UI.

**Tech Stack:** React 18, TypeScript, Zustand 5 (with slices), framer-motion, date-fns, vitest.

---

## Target State
- One `SessionController` instance per active deck drives prompt/reveal/review state and exposes serializable snapshots for hydration between navigations or overlay resumes.
- Undo/redo limited to the latest counted review, mirroring Anki's reviewer safety net while keeping persistence simple.
- Feedback (undo labels, action toasts, interval previews) emitted through an event channel similar to `ReviewerViewModel.actionFeedbackFlow` so UI stays declarative.
- A `SessionTimer` derived from Anki's `AnswerTimer` handles pause/resume, auto-stop on reveal, and emits ticks for instrumentation without blocking React renders.
- Typed answer gating reuses Anki's `TypeAnswer` parsing ideas, but works on Blearn `LearningNote` data; reveal pipeline enforces `MAX_TYPED_ANSWER_ATTEMPTS`, auto-reveal, and `easy` blocking consistently across controllers and UI.

## File Map & Logic Reorganization
- New files
  - `src/domain/reviewSession/ReviewSessionTypes.ts`: shared types/interfaces, `ReviewSessionSnapshot`, `ReviewCardView`, `ReviewAction`.
  - `src/domain/reviewSession/ReviewSessionController.ts`: pure class with `start`, `reveal`, `grade`, `undo`, `serialize`, queue helpers.
  - `src/domain/reviewSession/TypedAnswerService.ts`: adapter around `shouldRequireTypedAnswer`, `isTypedAnswerCorrect`, normalization helpers.
  - `src/domain/reviewSession/SessionTimer.ts`: hooks-style class wrapping `requestAnimationFrame`, matching the responsibilities of Anki's `AnswerTimer` without Android widgets.
  - `src/services/reviewFeedbackChannel.ts`: tiny mitt-style emitter for `ReviewFeedbackEvent` (undo labels, success/failure copy).
  - `src/hooks/useReviewFeedback.ts`: subscribe to feedback channel, map to toasts/snackbars.
  - `src/components/learn-review/SessionTimer.tsx` + `src/components/learn-review/ReviewToolbar.tsx`: UI for timer, undo button, typed answer status chips.
  - `src/domain/reviewSession/__tests__/ReviewSessionController.test.ts` and `TypedAnswerService.test.ts`.
- Modified files
  - `src/store/useLearningStore.ts`: add `reviewSession` slice (session snapshots, undo stack, timer prefs) plus actions `startReviewSession`, `applyReviewOutcome`, `undoReview`, `markReveal`, `hydrateSessionFromLogs`.
  - `src/store/selectors.ts`: expose `useReviewSessionSummary`, `useReviewSessionActions` mirroring `ReviewerViewModel` flows.
  - `src/hooks/useLearnReviewSession.ts`: slim hook that reads selectors, instantiates controller/timer, and only handles routing/overlay glue; move queue/typed state/handlers out of React state.
  - `src/components/learn-review/*.tsx`: consume new props (timer, undo button, typed answer hints, feedback badges), remove local state.
  - `src/lib/learning/index.ts`: expose queue helpers needed by controller (no behavior change).
- Logic migrating out of `useLearnReviewSession`
  - Deck resolution (`resolveAvailableDeckId`) and session candidate building -> `ReviewSessionController.start` to simplify hooking/testing.
  - React-local state for `reviewQueue`, `typedAnswer`, `revealed`, `attemptCount`, `blockedEasy*`, `countedReviews`, and `overlay success flags` -> persisted inside store slice so timer/feedback can observe.
  - Side effects (`setActiveDeck`, fallback to strict intervention, overlay success gating) -> moved into controller lifecycle methods that dispatch typed events the hook translates into navigation.
  - Interval preview computation -> controller to guarantee same numbers across UI surfaces.
- Logic migrating out of `useLearningStore`
  - `submitReview` remains, but queue advancement and counted review increments move to controller; store exposes `recordReviewLog(log)` and `mutateCard(cardId, updater)` so controller can orchestrate advanced flows.
  - New undo helpers reuse existing `reviewLogs` data (`ReviewResult` already provides `updatedCard` plus `log`). We'll store the prior card snapshot in `reviewHistoryStack` so undo can reapply via `migrateLearningCard`.
  - Unlock grant registration triggered via controller once `sessionCreditsRequired` reached, enabling atomic success transitions and allowing undo to retract counted credits.

## Adoptable AnkiDroid Patterns (No libanki)
- `AnkiDroid/src/main/java/com/ichi2/anki/ui/windows/reviewer/ReviewerViewModel.kt`: model event flows (`MutableSharedFlow` for undo labels, `AutoAdvance` separation). We'll port the idea by emitting typed events from `ReviewSessionController` instead of mutating React state directly.
- `AnkiDroid/src/main/java/com/ichi2/anki/reviewer/AnswerTimer.kt`: decouple timer UI from scheduling. Implement a JS-friendly `SessionTimer` with `start(cardId)`, `stop()`, `pause()`, `resume()` and `limitReached` callbacks.
- `AnkiDroid/src/main/java/com/ichi2/anki/previewer/TypeAnswer.kt`: parse `[[type:]]` directives, normalize answers, and compare with accent-stripping. We'll reuse regex + locale hints but feed on Blearn notes (no libanki), wrapping it inside `TypedAnswerService`.

### Task 1: Scaffold Review Session domain controller
**Files:**
- Create: `src/domain/reviewSession/ReviewSessionTypes.ts`, `src/domain/reviewSession/ReviewSessionController.ts`
- Modify: `src/lib/learning/index.ts`
- Test: `src/domain/reviewSession/__tests__/ReviewSessionController.test.ts`

**Step 1: Define types**
Create `ReviewSessionTypes.ts` with `ReviewSessionConfig`, `ReviewSessionSnapshot`, `ReviewQueueItem`, `ReviewSessionEvent`, ensuring serialization (no functions). Include fields for `deckId`, `queue`, `currentCardId`, `revealed`, `typedAnswer`, `attempts`, `history`, and `status`.

**Step 2: Implement controller skeleton**
Add `class ReviewSessionController` with constructor `(config, learningDeps)` and public methods `hydrate(snapshot)`, `start(cards, reviewLogs)`, `reveal()`, `submitTypedAnswer(text)`, `grade(rating)`, `undo()`, `serialize()`. Use queue helpers from `lib/learning` and make methods return `{ snapshot, events }` to decouple side effects.

```ts
export class ReviewSessionController {
  constructor(private readonly deps: ControllerDeps) {}
  reveal(now = Date.now()): ControllerResult {
    if (!this.state.currentCardId) return this.result();
    this.state = { ...this.state, revealed: true, attemptMessage: null };
    return this.result({ type: 'REVEALED', at: now });
  }
}
```

**Step 3: Move queue + progress math**
Shift logic from `useLearnReviewSession` (`resolveAvailableDeckId`, `buildUnlockSessionCandidateIds`, `buildUnlockSessionQueue`, `buildLearnReviewProgress`) into controller helper methods. Delete duplicates from hook later.

**Step 4: Emit events for overlay + unlock**
Add controller events `SESSION_COMPLETED`, `REQUEST_UNLOCK`, `REQUEST_STRICT_FALLBACK` mirroring the `handleFallbackToStrictIntervention` logic. Tests should assert that finishing `sessionCreditsRequired` triggers `SESSION_COMPLETED` with deckId/count.

**Step 5: Unit tests**
Use vitest to cover queue hydration, reveal gating, rating transitions, and event emission. Command: `npm run test -- src/domain/reviewSession/__tests__/ReviewSessionController.test.ts`.

### Task 2: Extend learning store with reviewSession slice + undo
**Files:**
- Modify: `src/store/useLearningStore.ts`, `src/store/selectors.ts`
- Create: `src/store/reviewSessionSlice.ts`
- Test: `src/store/__tests__/reviewSessionSlice.test.ts`

**Step 1: Split slice**
Refactor `useLearningStore` to import `createReviewSessionSlice`, and merge with existing state. Slice stores `sessionSnapshot`, `reviewHistoryStack`, `overlayState`, `timerPrefs`.

**Step 2: Persist snapshot + history**
Extend `persist.partialize` to include new slice fields. Update `merge` logic so stale sessions are dropped if `activeDeckUpdatedAt` changes.

**Step 3: Implement actions**
Add actions `startReviewSession(deckId, config)`, `applyControllerResult(result)`, `undoLastReview()`, `setTimerVisibility`, `recordFeedbackEvent`. These actions will call into controller helpers and update `reviewLogs` via existing reducers.

**Step 4: Wire selectors**
Expose `useReviewSessionSummary`/`useReviewSessionActions` for the hook. Include derived data (progress, interval previews) from controller snapshot instead of recomputing in React.

**Step 5: Tests**
Write vitest verifying snapshot persistence, undo stack pop/push, and `registerUnlockGrant` integration. Run `npm run test -- src/store/__tests__/reviewSessionSlice.test.ts`.

### Task 3: Typed answer + reveal pipeline service
**Files:**
- Create: `src/domain/reviewSession/TypedAnswerService.ts`, `src/domain/reviewSession/__tests__/TypedAnswerService.test.ts`
- Modify: `src/hooks/useLearnReviewSession.ts`, `src/components/learn-review/LearnReviewStage.tsx`

**Step 1: Port parser**
Implement regex `const typeRe = /\[\[type:(.+?)]]/g` mirroring Anki's `typeAnsRe`. Provide `extractTypeDirectives(note)` returning expected answer metadata.

**Step 2: Normalize + compare**
Add `normalizeAnswer(text, { combining })` using `Intl.Segmenter` or fallback to `text.normalize('NFKD')`. Enforce word limit clamp and use `localeCompare` for diacritics. Service should return `{ correct: boolean, attemptsLeft, message }`.

**Step 3: Integrate with controller**
Controller uses service to decide `requiresTypedAnswer`, track `attemptCount`, block `easy` rating, and issue `AUTO_REVEAL` event when attempts exhausted. Remove this logic from React hook entirely.

**Step 4: Update UI**
`LearnReviewStage` + `LearnReviewActions` now read message text + typed status via snapshot props, no local `useState`. Add typed locales to input (use `lang` attr) if service returns hints.

**Step 5: Tests**
Cover scenarios (correct on first try, failure after max attempts, `easy` blocked). Run `npm run test -- src/domain/reviewSession/__tests__/TypedAnswerService.test.ts`.

### Task 4: Timer + feedback flow inspired by Anki
**Files:**
- Create: `src/domain/reviewSession/SessionTimer.ts`, `src/services/reviewFeedbackChannel.ts`, `src/hooks/useReviewFeedback.ts`, `src/components/learn-review/SessionTimer.tsx`
- Modify: `src/hooks/useLearnReviewSession.ts`, `src/components/learn-review/LearnReviewHeader.tsx`

**Step 1: Implement SessionTimer**
Copy the responsibilities from `AnswerTimer.kt`: `setup(card, preset)`, `pause`, `resume`, `stop`, `onLimit`. Use `requestAnimationFrame` and store `limitMs` from gate rule/preset.

**Step 2: Feedback channel**
Create a mitt-like emitter with events `feedback`, `undoLabel`, `redoLabel`, `toast`. Controller dispatches `events` to channel; `useReviewFeedback` hook subscribes and drives `<Sonner />` toasts.

**Step 3: Hook timer to controller events**
When controller emits `CARD_CHANGED`, call `sessionTimer.setup`. On `REVEALED`, stop timer if deck config sets `stopTimerOnAnswer`. On `PAUSE_REQUESTED` (app background), persist `elapsed` to store.

**Step 4: UI components**
Add `SessionTimer` readout under header (progress ring + formatted seconds). `ReviewToolbar` hosts Undo + Feedback badges, mirroring `ReviewerViewModel.undoLabelFlow`.

**Step 5: Tests**
Write timer tests with fake timers verifying pause/resume, `limitReached` callback. Run `npm run test -- src/domain/reviewSession/__tests__/SessionTimer.test.ts`.

### Task 5: Rewire React hook + page to controller outputs
**Files:**
- Modify: `src/hooks/useLearnReviewSession.ts`, `src/pages/LearnReview.tsx`, `src/components/learn-review/*.tsx`
- Test: `src/pages/__tests__/LearnReviewPage.test.tsx`

**Step 1: Simplify hook**
Replace local `useState` fields with selectors: `const { snapshot, actions } = useReviewSessionSummary()`. Instantiate controller via `useMemo` and feed `snapshot` + `actions`. Keep only navigation side effects (search params, overlay route) inside hook.

**Step 2: Route-driven session bootstrap**
In hook `useEffect`, call `actions.startSession({ targetId, deckId, ... })` when search params change, letting controller handle queue. Remove manual `useMemo` filters; rely on store selectors.

**Step 3: Wire handlers**
`handleReveal`, `handleReview`, `handleUndo`, `handleTypedInput` delegate to controller actions. Hook listens to feedback channel for `SESSION_COMPLETED` event to navigate/unlock.

**Step 4: Update components**
`LearnReviewPage` receives `timer`, `undoLabel`, `feedback` props. Add new `<SessionTimer />` and `Undo` button near header, display typed answer hints from snapshot. Remove conditional logic now centralized in controller.

**Step 5: Render tests**
Add React Testing Library test that mounts `LearnReviewPage`, simulates typed answer, reveal, rating, and asserts UI updates via snapshot. Run `npm run test -- src/pages/__tests__/LearnReviewPage.test.tsx`.
