# Blocked Learn: speed, typed answer, and mobile UX

Date: 2026-07-13
Status: Draft
Goal: Make the first blocked Learn card feel immediate, make typed answers match the visible headword fairly, and make the mobile intervention feel calm and deliberate.
Scope: Native overlay/activity entrance, blocked Learn bootstrap hot path, typed-answer semantics, and the typed-answer controls/layout in the blocked flow.
Non-goals: Changing the Overlay & Handoff lifecycle, changing unlock policy, force-stopping or sending the user HOME, or redesigning the normal (non-blocked) Learn workflow beyond shared components required for correctness.
Risks: A prettier animation must not delay route-ready; answer extraction from arbitrary imported Anki HTML can be ambiguous; current typed-answer files have uncommitted changes and must be reconciled rather than overwritten.
Verification: Focused unit/UI tests, TypeScript, production build, Android unit build, then an on-device install with `adb install -r` and a manual blocked-app flow.

## Product contract

- Blocking still follows Overlay & Handoff: native overlay first, pending route handoff, React route-ready, then exactly-once cleanup.
- The native visual entrance should communicate a protective pause immediately; it must never hide a slow bootstrap by adding a fixed delay.
- In typed mode, the expected answer is the answer-side headword: the first prominent bold term after the Anki answer boundary, not an arbitrary collection of translations, examples, or metadata. The imported `expectedAnswer` field is not trusted for basic cards because it commonly contains the entire back side.
- A typed answer counts when the complete normalized input of at least three characters occurs contiguously anywhere in that headword. For headwords shorter than three letters, require the complete normalized headword. Accent and punctuation normalization remains tolerant.
- On phone-sized screens, the answer field and actions are vertically stacked with one clear primary action. In the blocked typed flow, the visible button is only `Loesung zeigen`; matching feedback is evaluated without a separate `Antwort pruefen` button (including IME/Enter support where applicable).

## Plan

1. Establish a baseline before changing behavior.
   - Trace `OverlayPresenter.java`, `BlockingOverlayActivity.java`, `useNativePendingNavigation.ts`, and the Learn route from native click to `reportFirstCardInteractive()`.
   - Capture at least three device timings for non-typed and typed blocked Learn sessions. Use existing latency instrumentation, adding narrowly scoped marks only if the current trace cannot distinguish WebView, hydration, queue creation, and first interactive card.
   - Treat the existing 800 ms first-card target as the product budget; do not count a loading shell as success.

2. Remove duplicated blocked-session initialization work before polishing the loading state.
   - In `useLearnReviewSessionRequirements.ts`, `useLearnReviewDerivedState.ts`, `useLearnReviewSessionBootstrap.ts`, `useActiveLearningDeckData.ts`, and `queues.ts`, calculate the blocking queue/scope once per stable deck revision and pass the immutable result through bootstrap and view derivation.
   - Avoid re-normalizing cards, rebuilding candidate queues, hashing every entity, or copying full card/review-log collections while the first card is becoming interactive. Preserve correct invalidation after a review and retain the existing resume/requeue behavior.
   - Confirm that typed-answer enablement changes neither the queue nor the blocking handoff route; it should only change the active-card interaction surface.

3. Define and implement one explicit headword resolver for typed answers.
   - Add a domain-level resolver near `typedAnswer.ts` that, for basic cards, finds the first non-empty `<strong>`/`<b>` in the answer-side `backHtml` (after `hr#answer` where present). Do not accept the generic basic-card `expectedAnswer` fallback. If no explicit headword can be recovered safely, disable typed gating for that card instead of testing against a full explanation.
   - Keep cloze/directive behavior explicit and separate: directives use their declared target, cloze uses its expected answer, and neither is accidentally processed as a basic-card headword.
   - Replace the current all-token / prefix-count algorithm with a normalized contiguous-substring match against that one resolved headword. Exact full-headword input remains `exact`; a valid three-or-more-character in-word match is `partial`; anything else is `incorrect`. Normalize Unicode accents/case/punctuation without splitting apostrophized words such as `aujourd'hui`.
   - Restore the intended scope of `typedAnswerMaxWords` (whether it gates eligibility or is retired from this path) instead of silently leaving a now-unused setting. Reinstate the learning contract that an incorrect typed response cannot earn `good`/`easy` credit or unlock progress. Add focused tests for French headwords, multi-line backs, bold HTML, accents, short words, false positives from example sentences, directives, and incorrect-answer credit blocking.

4. Simplify and resize the blocked typed-answer surface for phones.
   - Update `LearnReviewActions.tsx`, with supporting state only in `useLearnReviewTypedAnswerFlow.ts` / `sessionController.ts` as needed.
   - Below the `sm` breakpoint, render the input as a full-width, larger touch target above the single full-width `Loesung zeigen` action. Remove the inline `Antwort pruefen` button and excess status chrome from the blocked typed path; retain keyboard accessibility and clear feedback.
   - Keep regular review grading and non-blocked Learn behavior intact unless a shared, tested component improvement is clearly beneficial. Validate against the actual 360--430 px viewport rather than desktop responsive assumptions.

5. Improve the native-to-Blearn visual handoff without touching enforcement semantics.
   - In `OverlayPresenter.java`, refine the existing scrim/glow/card entrance into a short, coordinated motion sequence with reduced-motion-safe static fallback; do not postpone `runPrimaryAction` or route-ready.
   - In `BlockingOverlayActivity.java`, build the native continuation shell immediately rather than after the current fixed 300 ms delay, then give it a short entrance and calm mode-coloured pulse. Keep it only until the first Learn card is actually interactive (with a bounded route-ready fallback), not merely until navigation begins; it must be cancellable in every failure/dismiss path and add no icon decode or I/O on the critical path.
   - Do not introduce force-stop, HOME redirects, or any change to `BlockingTriggerDecision`, overlay suppression, or target reopening policy.

6. Verify behavior and regression safety.
   - Add/update tests in `src/modules/learning/session/__tests__/typedAnswerService.test.ts`, `src/test/learning.test.ts`, `src/test/learnReviewUi.test.tsx`, `src/test/learnReviewActions.test.tsx`, and native overlay tests where animation lifecycle is testable.
   - Run `npx tsc --noEmit --pretty false`, the focused typed-answer/Learn UI/overlay tests, `npm run build`, `npx cap sync android`, and `android\\.\\gradlew.bat testDebugUnitTest assembleDebug`.
   - Install only with `adb install -r`; manually verify a blocked app for both typed and non-typed Learn: overlay appears, route opens, first card is usable, answer matches the French headword, solution reveal works, success dismisses once, and target reopening remains correct.

## Decision to confirm before UI implementation

The spoken description contains both "untereinander" and "nebeneinander" for the phone layout. This plan uses the stronger phone-first interpretation: input above the single action (vertical), because the present three-column row is visibly cramped. If the desired layout is horizontal instead, only step 4 changes.

## Separate architecture follow-up

The audit found an existing `ACTION_MAIN` / `CATEGORY_HOME` abort redirect in `BlockingOverlayActivity.java`. It conflicts with the repository's no-HOME-redirect rule. It is deliberately excluded from this UX/performance patch to keep the behavior change reviewable, but should be corrected in a dedicated Overlay & Handoff fix before any broad blocking-flow refactor.
