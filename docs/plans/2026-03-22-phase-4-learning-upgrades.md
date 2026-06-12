# Phase 4 Learn Template & Deck Options Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deliver a learn template previewer, evolve the basic/cloze pipeline, and unlock per-deck review controls (bury siblings, steps, review-ahead) so Blearn mirrors the parts of Anki that keep reviewers confident.

**Architecture:** Extend the existing `learning.ts` domain layer (`LearningNote`, `LearningPreset`, schedulers) and expose the new capabilities via `Zustand` stores plus React screens (`LearnStudio`, `LearnReview`, `Modes`). Template rendering logic will be centralized so both preview and review reuse it, following Anki’s `TemplatePreviewerViewModel` flow (`AnkiDroid/.../TemplatePreviewerViewModel.kt:45`). Deck settings will clone/assign presets per deck while keeping FSRS math untouched.

**Tech Stack:** React 18 + TypeScript, Zustand, ts-fsrs, IndexedDB persistence, Vitest, Playwright (UI smoke), Vite build tooling.

---

## Short-Term Track – Schlank portierbar in Phase 4

### Task 1: Template Previewer MVP

**Files:**
- Modify: `src/lib/learning.ts:23-213, 849-918, 1315-1461`
- Modify: `src/lib/ankiImport.ts:248-319`
- Create: `src/hooks/useTemplatePreview.ts`
- Create: `src/components/learn/TemplatePreviewPanel.tsx`
- Modify: `src/components/learn/LearnStudioDialog.tsx:24-347`
- Modify: `src/pages/LearnStudio.tsx:24-347`
- Create: `src/test/templatePreview.test.tsx`

**Step 1: Write the failing test**

```ts
// src/test/templatePreview.test.tsx
import { buildManualCardPreview } from '@/lib/learning';

it('renders cloze previews with underscores and typed-answer flag', () => {
  const preview = buildManualCardPreview({
    type: 'cloze',
    front: 'Ich {{c1::lerne}} schnell',
    back: 'lerne',
    clozeText: 'Ich {{c1::lerne}} schnell',
  });
  expect(preview.front).toContain('_____');
  expect(preview.requiresTypedAnswer).toBe(true);
});
```

**Step 2: Run the new unit test and watch it fail**

Run: `npm run test -- templatePreview` → expect failure (`buildManualCardPreview is not defined`).

**Step 3: Implement shared preview helpers**

- In `src/lib/learning.ts`, add `buildManualCardPreview` + `resolveNoteForPreview` near other template helpers, reusing `renderClozeValue` from `src/lib/ankiImport.ts:248-319`.
- Ensure the helper mirrors Anki’s ephemeral card creation in `TemplatePreviewerViewModel` (AnkiDroid/src/main/java/com/ichi2/anki/previewer/TemplatePreviewerViewModel.kt:45-151) by returning both front/back text and typed-answer metadata.

**Step 4: Add a dedicated preview hook**

- Create `src/hooks/useTemplatePreview.ts` that consumes manual form state (`front`, `back`, `clozeText`, `type`) from `LearnStudioDialog` and debounces computation (`useMemo` + `useDeferredValue`).
- Include an imperative API (`refreshPreview`) to support future integrations (import wizard or card browser).

**Step 5: Build the reusable preview panel**

- Implement `TemplatePreviewPanel` with tabs for “Front / Back” and a typed-answer badge similar to Anki’s card tabs (TemplatePreviewerFragment in AnkiDroid/src/main/java/com/ichi2/anki/previewer/TemplatePreviewerFragment.kt:32-120).
- Provide props for `preview`, `isDirty`, `onRefresh`, `loading`.

**Step 6: Wire the preview into Learn Studio**

- In `src/components/learn/LearnStudioDialog.tsx` and `src/pages/LearnStudio.tsx`, mount the panel next to the composer form.
- Track validation errors so empty manual decks show a skeleton state.
- Follow Anki’s UX cue of “Fill Empty Fields” toggles by adding a switch for stripping blank replacements later (stub the handler for now).

**Step 7: Add UI regression coverage**

```ts
// src/test/templatePreview.test.tsx (extend with RTL)
render(<TemplatePreviewPanel preview={preview} ... />);
expect(screen.getByText('Front')).toHaveClass('data-active');
expect(screen.getByText('Typed Answer aktiviert')).toBeVisible();
```

**Step 8: Re-run targeted and full learn suites**

`npm run test -- templatePreview learnStudio learning` → expect green.

**Step 9: Commit**

`git add src/lib/learning.ts src/lib/ankiImport.ts src/hooks/useTemplatePreview.ts src/components/learn/TemplatePreviewPanel.tsx src/components/learn/LearnStudioDialog.tsx src/pages/LearnStudio.tsx src/test/templatePreview.test.tsx && git commit -m "feat: add learn template previewer"`

---

### Task 2: Basic/Cloze Evolution (multi cloze + typed-answer parity)

**Files:**
- Modify: `src/lib/ankiImport.ts:248-319, 482-522`
- Modify: `src/lib/learning.ts:37-120, 399-433, 518-559, 646-706, 757-838`
- Modify: `src/store/useLearningStore.ts:52-152, 240-347`
- Modify: `src/hooks/useLearnReviewSession.ts:71-452`
- Modify: `src/components/learn-review/LearnReviewStage.tsx:17-140`
- Modify: `src/components/learn/LearnStudioDialog.tsx:24-347`
- Modify: `src/test/learning.test.ts`
- Modify: `src/test/learnReviewUi.test.tsx`

**Step 1: Add failing extractor tests**

```ts
// src/test/learning.test.ts
import { extractClozeOccurrences } from '@/lib/learning';
it('returns two ords for multi cloze text', () => {
  expect(extractClozeOccurrences('A {{c1::B}} C {{c2::D}}')).toEqual([
    { ord: 1, clozeText: 'A {{c1::B}} C {{c2::D}}', answer: 'B' },
    { ord: 2, clozeText: 'A {{c1::B}} C {{c2::D}}', answer: 'D' },
  ]);
});
```

**Step 2: Run learning tests to see them fail**

`npm run test -- learning` → expect extractor failure.

**Step 3: Implement extraction + note cloning**

- Move the regex logic already in `src/lib/ankiImport.ts:248-319` into reusable helpers (`extractClozeOccurrences`, `renderClozeValue`).
- Update `buildEntitiesFromRows` (`src/lib/learning.ts:646-706`) so each cloze occurrence spawns its own `LearningCard` with a new `clozeOrdinal` field on `LearningCard`.
- Mirror Anki’s approach from `TypeAnswer.updateInfo` (AnkiDroid/src/main/java/com/ichi2/anki/cardviewer/TypeAnswer.kt:83-150) to ensure the correct deletion is targeted.

**Step 4: Persist ordinal metadata**

- Extend `LearningCard` and `LearningNote` types to store `clozeOrdinal` + `fields`.
- Adjust serialization in `createManualCard` (`src/store/useLearningStore.ts:52-124`) to fan out multiple cards when a user inputs several `{{c#::}}` ranges.

**Step 5: Upgrade typed-answer checks**

- Update `shouldRequireTypedAnswer` and `isTypedAnswerCorrect` (`src/lib/learning.ts:519-559`) to use per-card `expectedAnswerMap[ord]`.
- Support the `nc:` modifier (no combining) as noted in Anki’s `TypeAnswer` (lines 102-125) so German ß/ä handling matches toggles.

**Step 6: Teach the review session about ordinals**

- In `useLearnReviewSession` and `LearnReviewStage`, surface the ordinal (for debug) and show multiple blanks sequentially.
- Add subtle UI cues (badge “Cloze #2”) mimicking Anki’s template tabs.

**Step 7: Refresh manual composer UX**

- `LearnStudioDialog` should auto-fill `expectedAnswer` when the user types `{{c1::...}}`. Provide a “Split into multiple cards” preview row referencing Task 1’s hook.

**Step 8: Expand unit + UI tests**

- Extend `src/test/learning.test.ts` for `clozeOrdinal`.
- Update `src/test/learnReviewUi.test.tsx` to mount a multi-cloze card and assert the typed answer flow toggles “Again” block.

**Step 9: Run suites + commit**

`npm run test -- learning learnReviewUi && git commit -am "feat: support multi cloze + typed answers"` (after staging changes).

---

### Task 3: Per-Deck Review Settings + Bury/Steps/Review-Ahead UI

**Files:**
- Modify: `src/lib/learning.ts:85-210, 849-918, 1200-1461`
- Modify: `src/store/useLearningStore.ts:75-210, 347-620`
- Modify: `src/components/modes/ModesSections.tsx:816-1110`
- Modify: `src/pages/LearnReview.tsx:24-170`
- Create: `src/components/learn/DeckOptionsDrawer.tsx`
- Create: `src/hooks/useDeckPresetEditor.ts`
- Modify: `src/test/learning.test.ts`
- Modify: `src/test/modesUiSmoke.test.tsx`

**Step 1: Extend type + migration tests**

```ts
// src/test/learning.test.ts
it('migrates presets with custom reviewAheadHours', () => {
  const preset = migrateLearningPreset({ id: 'deckA', reviewAheadHours: 48, burySiblings: false });
  expect(preset.reviewAheadHours).toBe(48);
  expect(preset.burySiblings).toBe(false);
});
```

**Step 2: Move reviewAheadHours into presets**

- Add `reviewAheadHours` to `LearningPreset` (default 24) and remove it from `GateRule` to keep per-deck semantics aligned with Anki’s `DeckConfig.New.bury`/`Rev.delays` toggles (`libanki/.../DeckConfig.kt:70-134`).
- Update `getReviewAheadCards` + `buildUnlockSessionCandidateIds` to read from the deck’s resolved preset instead of the global gate rule.

**Step 3: Add store actions for preset CRUD**

- Implement `upsertPreset`, `assignPresetToDeck`, and `updatePresetField` inside `useLearningStore`.
- Ensure the optimizer still batches per preset id (update `submitReview` accordingly).

**Step 4: Create preset editor hook**

- `useDeckPresetEditor` should wrap form state, validation (min/max for steps), and optimistic updates so components don’t poke the store directly.

**Step 5: Build Deck Options Drawer**

- Component lists toggles/inputs for:
  - `newCardsPerDay`, `maxReviewsPerDay`
  - `learningStepsMinutes`, `relearningStepsMinutes` (chips)
  - `burySiblings` toggle (copy text from Anki’s Deck Options)
  - `reviewAheadHours` slider
- Reuse `@radix-ui` `Dialog` already used in `LearnStudioDialog` for consistent visuals.

**Step 6: Integrate drawer triggers**

- Add a “Deck Optionen” button beside `LearnReviewPage` header.
- Provide entry points inside `ModesSections` so blocking assignments can link to a preset quickly.

**Step 7: Test behavior**

```ts
// src/test/modesUiSmoke.test.tsx
user.click(screen.getByText('Deck Optionen'));
await user.type(screen.getByLabelText('Neue Karten/Tag'), '5');
expect(useLearningStore.getState().getResolvedPresetForDeck(deckId).newCardsPerDay).toBe(5);
```

**Step 8: Documentation stub**

- Add a short section to `docs/project-memory.md` summarizing how presets can now be edited per deck.

**Step 9: Regression + commit**

`npm run test -- learning modesUiSmoke && git commit -am "feat: add per-deck review settings drawer"` after staging.

---

## Später Fortgeschritten (Folgt auf MVP)

### Task 4: Full Template Previewer parity (multi templates, fill-empty, media)

**Files:** `src/lib/learning.ts`, `src/hooks/useTemplatePreview.ts`, `src/components/learn/TemplatePreviewPanel.tsx`, `src/services/mediaService.ts`, `src/test/templatePreview.test.tsx`, reference `AnkiDroid/.../TemplatePreviewerPage.kt:36-120`.

**Step 1:** Extend tests to cover multiple card templates per notetype (basic/reverse, image occlusion).

**Step 2:** Introduce a `LearningNotetype` model (fields, templates) mirroring Anki’s `NotetypeJson` used by `TemplatePreviewerViewModel`.

**Step 3:** Load and cache `mediaUrl` previews (respecting the size constraints already in `ankiImport.ts`) so preview shows inline media like Anki’s TemplatePreviewer.

**Step 4:** Implement a tab strip for templates + cloze ords with keyboard shortcuts (borrow logic from `TemplatePreviewerFragment`).

**Step 5:** Add snapshot tests to verify fill-empty toggles replace `{{field}}` gaps with placeholder text.

### Task 5: Typed Answer macros + answer diff visualization

**Files:** `src/lib/learning.ts`, `src/lib/ankiImport.ts`, `src/hooks/useLearnReviewSession.ts`, `src/components/learn-review/*`, tests, reference `AnkiDroid/.../cardviewer/TypeAnswer.kt:37-210`.

**Step 1:** Parse `{{type:Field}}` and `{{type:nc:Field}}` markers when importing or composing templates, storing `TypeAnswerConfig` per card.

**Step 2:** Update review UI to render an `<input>` in place (matching Anki’s JavaScript widget at `AnkiDroid/src/main/assets/scripts/ankidroid-reviewer.js`) instead of the current side panel text field.

**Step 3:** Add answer diff rendering (green/red spans) similar to `TypeAnswer.filterAnswer`.

**Step 4:** Provide settings toggles (“Auto focus typed answer”, “Use input tag”) under Deck Options drawer.

**Step 5:** Cover with RTL + Vitest snapshots.

### Task 6: Advanced Deck Options + FSRS tuning

**Files:** `src/lib/learning.ts`, `src/store/useLearningStore.ts`, `src/components/learn/DeckOptionsDrawer.tsx`, `docs/firebase-learning-sync.md`, tests; reference `libanki/.../DeckConfig.kt` for parity.

**Step 1:** Add expert-only controls (Hard factor, FSRS `w` parameters) gated behind an “Advanced” accordion.

**Step 2:** Support deck option inheritance (parent deck vs child) similar to `DeckOptionsDestination` (AnkiDroid/src/main/java/com/ichi2/anki/pages/DeckOptionsDestination.kt:31-66).

**Step 3:** Persist per-deck step profiles (new/relearning) and allow export/import via JSON so presets travel with backups.

**Step 4:** Add Playwright coverage to ensure bury siblings and review-ahead toggles affect queue order (compare lengths of `dueSelection` vs `reviewAheadSelection`).

**Step 5:** Update documentation and migration scripts so existing decks inherit sensible defaults without data loss.

---

Plan ready for execution. Choose the short-term tasks first for Phase 4; advanced tasks slot in once MVP proves stable.
