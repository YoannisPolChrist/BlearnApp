# Performance Baseline

Use this checklist before and after Phase 1 refactors.

## Commands

```bash
npm run build
npm run lint
npm run test
```

## Manual checks

- Cold start on `/`
- First navigation to `/modes`
- First navigation to `/learn`
- First navigation to `/wallet`
- Open large dialogs in Learn, Wallet, and Settings
- Change mode, wallet, and learning state while watching React DevTools Profiler

## What to record

- Initial production chunk sizes
- Home-route first render profile
- Route transition profile for `/modes`, `/learn`, and `/wallet`
- Whether unrelated screens rerender after wallet or learning mutations

## Phase 1 guardrail

If a refactor does not reduce startup or first-navigation work, do not generalize it further.
