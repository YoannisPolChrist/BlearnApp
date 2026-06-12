# Card Browser + Structured Search + Filtered-Deck-Lite Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deliver Blearn''s card-management trilogy (Card Browser, structured search with saved queries, Filtered-Deck-Lite) so learners can inspect, target, and temporarily reshuffle cards without leaving the Learn hub.

**Architecture:** Layer a card-query domain module on top of the existing learning entities (`LearningDeck`, `LearningNote`, `LearningCard`, `ReviewLog`, `LearningPreset`) defined in `src/lib/learning.ts:23-120`, expose persistent slices in `src/store/useLearningStore.ts:1`, and surface new React routes/components that mirror Anki''s Card Browser (`AnkiDroid/src/main/java/com/ichi2/anki/CardBrowser.kt:112`), SearchRequest (`AnkiDroid/src/main/java/com/ichi2/anki/browser/search/SearchRequest.kt:30`), SavedSearches (`AnkiDroid/src/main/java/com/ichi2/anki/browser/search/SavedSearches.kt:32,50`), and FilteredDeckOptions (`AnkiDroid/src/main/java/com/ichi2/anki/filtered/FilteredDeckOptionsState.kt:48`). Query evaluation runs inside a pure domain package using `sql.js`, and sync is plumbed through the cloud adapters in `src/lib/learningCloudSync.ts:15` and `src/services/firebaseLearningSyncService.ts:134`.

**Tech Stack:** React 18 + TypeScript, Zustand 5 + persist middleware, Tailwind/Radix UI, sql.js, date-fns, ts-fsrs, Firebase Firestore, Vitest + Testing Library.

---

## Target State
- **Data Model:** Extend `useLearningStore` to own three new slices: (a) `cardBrowser` (active deck filter, search text, sort order, multi-select state, `CardBrowserRow` cache), (b) `cardQueries` (list of named `SavedSearch` plus recent ad-hoc structured queries), and (c) `filteredDeckLite` (definitions, run history, and the currently staged filtered queue). These slices persist via the same IndexedDB storage (`learningStoreStorage` in `src/store/useLearningStore.ts:29`) and sync through `LearningCloudState` so multiple devices agree.
- **Query Model:** Borrow Anki''s `SearchRequest` idea (`AnkiDroid/.../browser/search/SearchRequest.kt:30`) by representing a structured search as `{ text, filters, joiner }`. Parse user input into an AST, translate to SQL-compatible predicates, and run them over an in-memory table composed from `LearningNote` + `LearningCard` join data. Support deck/tag/state/flag filters in v1, then extend to intervals/due ranges similar to Anki''s `CardState` enum (`AnkiDroid/.../browser/search/CardState.kt:1`).
- **UI Surfaces:**
  - `/learn/browser`: responsive two-pane table with deck list, structured filters, per-card actions (open note, suspend, reschedule). The toolbar mirrors Anki''s `CardBrowserSearchView` while fitting Blearn''s QuickAction style.
  - `/learn/browser/search`: modal/drawer holding the structured builder and saved-search list, inspired by `SavedBrowserSearchesDialogFragment` but tailored to mobile.
  - `/learn/filtered`: Filtered-Deck-Lite builder with two search slots max, preview counts, and CTA to create/run deck; integrates with Learn hub for review entry.
  - Learn hub (`src/pages/Learn.tsx:1`) adds CTA chips for "Browser", "Saved Searches", and "Filtered Deck" so features stay discoverable.
- **Incremental Delivery:**
  1. Ship read-only Card Browser with basic search text + deck filter; no structural filters yet.
  2. Layer structured search builder + saved searches; persist queries and enable multi-term filtering.
  3. Add Filtered-Deck-Lite builder that consumes the same query DSL to create throwaway review queues feeding `useLearnReviewSession`.
  4. Deepen Card Browser with bulk ops (suspend, tag edits) and Filtered Deck with dual search streams/custom delays similar to `FilteredDeckOptionsState` fields (`filter1State`, `filter2State`, `delay*`).
- **Sync & Offline:** `LearningCloudState` gains `savedSearches` + `filteredDecks` arrays. `useLearningCloudSync` and the Firestore adapter spread these fields so offline edits merge cleanly via `mergeLearningCloudStates`.

## File Map & Logic Reorganization
- **New domain modules**
  - `src/domain/cardBrowser/CardBrowserTypes.ts`, `CardBrowserSelectors.ts`, `CardBrowserViewModel.ts`.
  - `src/domain/cardSearch/CardQueryTypes.ts`, `CardQueryParser.ts`, `CardQueryEngine.ts` (+ `__tests__/`).
  - `src/domain/filteredDecks/FilteredDeckLiteTypes.ts`, `FilteredDeckLiteService.ts` (+ tests).
- **New UI**
  - `src/pages/LearnBrowser.tsx`, `src/pages/LearnFilteredDeck.tsx`.
  - Component folders `src/components/learn-browser/*` (Toolbar, Table, Inspector, SavedSearchDrawer) and `src/components/filtered-deck-lite/*` (BuilderForm, PreviewCard, RunHistory).
  - Hooks `src/hooks/useCardBrowser.ts`, `src/hooks/useFilteredDeckLite.ts` wiring selectors to UI.
- **Modified files**
  - `src/store/useLearningStore.ts` & `src/store/selectors.ts`: new slices/actions + selectors.
  - `src/lib/learning.ts`: helpers to hydrate `CardBrowserRow`, compute card stats per query, reuse `getDeckLearningStats` pipeline (`src/lib/learning.ts:1430`).
  - `src/lib/learningCloudSync.ts` + `src/hooks/useLearningCloudSync.ts` + `src/services/firebaseLearningSyncService.ts`: include new slices in normalize/load/save paths.
  - `src/pages/Learn.tsx`, `src/App.tsx`, `src/lib/routeLoaders.ts`: add routes + CTAs.
  - `src/hooks/useLearnReviewSession.ts`: allow filtered-deck queue injection via `buildReviewQueue` (`src/lib/learning.ts:1095`).
  - Docs `docs/learn-mode-handover-for-agents.md` to describe new flows after features land.
- **Testing**
  - Domain tests under `src/domain/**/__tests__` for parsers, filters, filtered deck generator.
  - Component tests in `src/components/learn-browser/__tests__` using Testing Library.
  - Optional Playwright smoke for `/learn/browser` filter combos once UI stabilizes.

## Adoptable AnkiDroid Patterns (No libanki)
- `AnkiDroid/src/main/java/com/ichi2/anki/CardBrowser.kt:112`: multi-pane browser with deck selector + toolbar; imitate the separation of view model (search state + deck selection) from UI.
- `AnkiDroid/src/main/java/com/ichi2/anki/browser/search/SearchRequest.kt:30` and `SearchFilters.kt:29`: treat filters as structured data, then convert to backend query; mirror this in `CardQueryParser`/`CardQueryEngine`.
- `AnkiDroid/src/main/java/com/ichi2/anki/browser/search/SavedSearches.kt:32,50`: saved searches stored alongside collection config; Blearn will persist inside the learning store + sync to Firestore.
- `AnkiDroid/src/main/java/com/ichi2/anki/filtered/FilteredDeckOptionsState.kt:48` & `FilteredDeckOptionsViewModel.kt:51`: state machine around filtered decks; reuse ideas like dual filters, `allowEmpty`, and `shouldReschedule` toggles while trimming to "Lite" scope.

### Task 1: Extend learning store with browser/query slices

**Files:**
- Create: `src/domain/cardBrowser/CardBrowserTypes.ts`, `src/domain/cardBrowser/__tests__/cardBrowserSelectors.test.ts`
- Modify: `src/store/useLearningStore.ts`, `src/store/selectors.ts`, `src/lib/learning.ts`, `src/lib/learningCloudSync.ts`, `src/hooks/useLearningCloudSync.ts`, `src/services/firebaseLearningSyncService.ts`
- Test: `src/domain/cardBrowser/__tests__/cardBrowserSelectors.test.ts`

**Step 1: Define domain types**
Create `CardBrowserTypes.ts` with the derived row and state:
```ts
export interface CardBrowserRow {
  cardId: string;
  noteId: string;
  deckId: string;
  front: string;
  back: string;
  tags: string[];
  state: LearningCardState;
  dueAt: number;
  intervalDays: number;
  easeFactor: number;
  lapses: number;
  suspended: boolean;
}
export interface CardBrowserState {
  selectedDeckId?: string;
  searchText: string;
  sortBy: 'due' | 'interval' | 'state';
  sortDirection: 'asc' | 'desc';
  selectedCardIds: string[];
  savedSearchId?: string;
}
```

**Step 2: Add slices + actions**
Inside `useLearningStore.ts`, extend the persisted state to include `cardBrowser`, `savedSearches`, and `filteredDeckLite` arrays. Provide actions like `setCardBrowserState`, `upsertSavedSearch`, `deleteSavedSearch`, `queueFilteredDeckRun`. Keep updates immutable to stay compatible with `subscribeWithSelector`. Update tests in `src/store/useLearningStore.test.ts` (if it exists) or create coverage in the new domain test file.

**Step 3: Derive selectors**
Implement memoized selectors in `src/store/selectors.ts` (e.g., `useCardBrowserSummary`, `useSavedSearches`). Compose `CardBrowserRow[]` by joining notes + cards via helper `buildCardBrowserRows(cards, notes)` added to `src/lib/learning.ts`. Unit test the selectors by hydrating the store with fixtures and asserting row counts, sort orders, and selection toggles.

**Step 4: Cloud sync plumbing**
Augment `LearningCloudState` (`src/lib/learningCloudSync.ts:15`) to include `savedSearches` + `filteredDecks`. Update `normalizeLearningCloudState`, `mergeLearningCloudStates`, and the Firestore adapter (`src/services/firebaseLearningSyncService.ts:134,188`) to read/write the new collections. Extend `useLearningCloudSync.ts` to load/write the added fields when copying between store and remote. Add tests around `normalizeLearningCloudState` to ensure ordering stays deterministic.

**Step 5: Verify persistence + sync**
Write Vitest cases that serialize store state, rehydrate, and ensure slices survive. Mock Firestore calls (using spies) to assert payloads include the new arrays. Run `npx vitest src/domain/cardBrowser/__tests__/cardBrowserSelectors.test.ts --runInBand` and ensure PASS.

### Task 2: Implement structured card query engine

**Files:**
- Create: `src/domain/cardSearch/CardQueryTypes.ts`, `CardQueryParser.ts`, `CardQueryEngine.ts`, `__tests__/cardQueryParser.test.ts`, `__tests__/cardQueryEngine.test.ts`
- Modify: `src/domain/cardBrowser/CardBrowserViewModel.ts`, `src/store/useLearningStore.ts`, `src/lib/learning.ts`
- Test: the new parser/engine specs

**Step 1: Model the query**
Define `CardQuery`, `CardQueryFilter`, `SavedSearch` types plus helper enums mirroring Anki''s `SearchFilters` (`AnkiDroid/.../SearchFilters.kt:29`). Include fields for decks, tags, card states, flags, due range. Implement serialization so saved searches can store the structured object as JSON.

**Step 2: Build parser utilities**
In `CardQueryParser.ts`, turn user-friendly builder selections into `CardQuery`. Include a lightweight text parser for inline tokens (e.g., `tag:foo is:suspended`) similar to Anki''s search shorthand. Add unit tests ensuring combinations like `deck:"A" tag:grammar state:review` round-trip.

**Step 3: Execute queries**
Use `sql.js` to hydrate an in-memory table with columns derived from `CardBrowserRow`. `CardQueryEngine.run(query, rows)` should emit filtered + sorted card IDs. Start with AND-joined clauses (text contains, deck match, tag inclusion, state). Document how to extend to OR joins by referencing `SearchJoiner` logic from Anki. Provide a pure fallback filter (array filter) for environments where WebAssembly is unavailable.

**Step 4: Wire engine into store**
Expose a derived selector that takes `CardBrowserState` + `CardQuery` + `CardBrowserRow[]` and returns the final visible list. Keep query evaluation outside React by memoizing on `(rowsSignature, querySignature)`. Add integration tests verifying that toggling filters updates counts predictably.

**Step 5: Test suite**
Run `npx vitest "src/domain/cardSearch/__tests__/*.test.ts"`. Ensure failure cases (invalid syntax) bubble descriptive errors so the UI can display them.

### Task 3: Ship Card Browser UI (MVP then deepening)

**Files:**
- Create: `src/pages/LearnBrowser.tsx`, `src/components/learn-browser/CardBrowserToolbar.tsx`, `CardBrowserTable.tsx`, `CardInspectorDrawer.tsx`, `src/hooks/useCardBrowser.ts`
- Modify: `src/App.tsx`, `src/lib/routeLoaders.ts`, `src/pages/Learn.tsx`
- Test: `src/components/learn-browser/__tests__/CardBrowserTable.test.tsx`

**Step 1: Hook route + loader**
Add lazy loader entries in `routeLoaders.ts` and `<Route path="/learn/browser" element={<LearnBrowser />} />` in `App.tsx`. Update `Learn` quick actions to include a "Browser" card that pushes to the new route.

**Step 2: Build hook + view model**
`useCardBrowser.ts` should pull selectors (`useCardBrowserSummary`) and expose derived props: filtered rows, deck chips, current query summary, selection handlers. Keep heavy logic outside the component tree for predictable renders.

**Step 3: Compose UI**
In `LearnBrowser.tsx`, mirror the hero/toolbar style from Learn hub. `CardBrowserToolbar` hosts search input, deck dropdown, and a button that opens the structured search drawer (Task 4). `CardBrowserTable` renders paginated rows with columns (Front, Back, Deck, Due, State). Include keybinding support for reveal/reschedule later, but start with read-only row preview toggled via `CardInspectorDrawer`.

**Step 4: Tests + lint**
Create RTL tests to ensure deck filter + search text narrow results. Snapshot test table header to catch regressions. Run `npx vitest src/components/learn-browser/__tests__/CardBrowserTable.test.tsx`.

**Step 5: Deepening stub**
Leave TODO comments (with references to this plan) for bulk actions + tag editing so future work knows where to extend once structured search lands.

### Task 4: Structured search builder + saved searches

**Files:**
- Create: `src/components/learn-browser/StructuredSearchDrawer.tsx`, `SavedSearchList.tsx`, `SavedSearchForm.tsx`
- Modify: `src/hooks/useCardBrowser.ts`, `src/store/useLearningStore.ts` (saved search actions), `src/store/selectors.ts`
- Test: `src/components/learn-browser/__tests__/StructuredSearchDrawer.test.tsx`

**Step 1: Drawer shell**
Build a Radix Dialog that lists current filters, provides dropdowns for deck/tag/state, and surfaces a text token input. Use the parser from Task 2 to validate live; surface errors inline.

**Step 2: Saved search CRUD**
Expose `upsertSavedSearch`, `deleteSavedSearch`, and `applySavedSearch` actions. UI should allow users to select a saved query (loads filters) or long-press to delete. Mirror Anki''s behavior where picking a saved search either runs immediately or seeds the builder (Anki `SavedSearches.kt:50`).

**Step 3: Persistence + telemetry**
Hook builder submission to store saved searches (capped to, say, 50 items). Add analytics events if needed (future). Ensure saved searches sync through Firestore (already handled in Task 1/Step 4). Tests should stub store actions and assert that pressing "Save" stores normalized queries.

**Step 4: Gradual enhancement**
Stage 1: limit builder to AND logic, deck/tag/state filters.
Stage 2: add exclusion filters (`-tag:foo`), due-range sliders, cards vs notes toggle similar to Anki''s `CardsOrNotes` toggle.

**Step 5: Test**
Run `npx vitest src/components/learn-browser/__tests__/StructuredSearchDrawer.test.tsx`.

### Task 5: Filtered-Deck-Lite domain + builder UI

**Files:**
- Create: `src/domain/filteredDecks/FilteredDeckLiteTypes.ts`, `FilteredDeckLiteService.ts`, `__tests__/filteredDeckLiteService.test.ts`, `src/pages/LearnFilteredDeck.tsx`, `src/components/filtered-deck-lite/FilteredDeckForm.tsx`, `FilteredDeckPreview.tsx`
- Modify: `src/store/useLearningStore.ts`, `src/store/selectors.ts`, `src/pages/Learn.tsx`, `src/App.tsx`, `src/lib/learning.ts`
- Test: `src/domain/filteredDecks/__tests__/filteredDeckLiteService.test.ts`

**Step 1: Model filtered deck lite**
Define `FilteredDeckLite` with `{ id, name, query: CardQuery, secondaryQuery?: CardQuery, limit: number, reschedule: boolean, delays?: { again: number; hard: number; good: number }, allowEmpty: boolean, lastRunAt?: number }`. Add array + actions (`saveFilteredDeck`, `deleteFilteredDeck`, `runFilteredDeck`) to the store. Keep history of last few runs for UI.

**Step 2: Service logic**
`FilteredDeckLiteService.run(definition, cards, notes, now)` returns `{ queueCardIds, excludedCardIds }`, using the card query engine for each filter (mirroring `FilterIndex` logic from `FilteredDeckOptionsState.kt:114`). Respect `limit`, `reschedule`, and custom delays (store them on queue so `useLearnReviewSession` can apply). Unit test for: limit truncation, dual filters, allowEmpty false -> throw error.

**Step 3: Builder UI**
`LearnFilteredDeck.tsx` renders two accordions (Filter A mandatory, Filter B optional) similar to Anki''s UI but simplified. Provide preview counts by reusing `FilteredDeckLiteService.preview()`. Offer actions: Save Definition, Run Now (navigates to review overlay with query-run metadata), and Browse (launch `/learn/browser` with the query applied via search params).

**Step 4: Wiring to Learn hub**
Add QuickAction(s) on Learn hub linking to `/learn/filtered`. If a filtered deck run is pending, show a chip with due count.

**Step 5: Tests**
Run domain tests plus component tests for the form. Validate that toggling `reschedule` reveals delay inputs and that invalid queries show inline errors.

### Task 6: Filtered deck runs -> review session integration

**Files:**
- Modify: `src/hooks/useLearnReviewSession.ts`, `src/store/useLearningStore.ts`, `src/lib/learning.ts`, `src/components/learn-review/LearnReviewHeader.tsx`
- Test: `src/hooks/__tests__/useLearnReviewSession.filteredDeck.test.tsx`

**Step 1: Inject queue metadata**
Extend `useLearningStore` to hold `pendingFilteredDeckRun?: { deckId, cardIds, reschedule, delays }`. When a run is triggered (Task 5), push queue IDs + metadata.

**Step 2: Consume in review hook**
Update `useLearnReviewSession` so when a filtered deck run is active it bypasses `buildUnlockSessionQueue` and instead uses the queued IDs. Apply reschedule/custom delay flags when calling `submitReview`. After session completes (or user exits), clear the pending run. Add tests to confirm queue consumption order matches service output.

**Step 3: UX hooks**
Display the active filtered deck name in `LearnReviewPage` header/subtitle. If `allowEmpty=false` and run yields zero cards, show a toast referencing builder page.

**Step 4: Tests**
Add Vitest coverage for the hook scenario plus UI regression tests for the header subtitle change.

---

## Execution Notes
- Keep each milestone deployable: Card Browser read-only first, search builder second, filtered decks third.
- Reuse `docs/plans/2026-03-22-robust-review-engine.md` conventions for referencing this plan inside TODOs/commits.
- After each task, run `npx vitest` and lint (`npx eslint src --ext .ts,.tsx`).
- Update `docs/learn-mode-handover-for-agents.md` once Card Browser MVP is live so future agents know the new surfaces.
