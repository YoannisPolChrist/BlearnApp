# Blocking reliability, startup calm, and performance evidence

Date: 2026-07-13
Status: Draft
Goal: Make the Android blocking path faster to diagnose and more robust without changing a user's chosen intervention, Tip-Modus semantics, or cloud-sync scope.
Scope: Startup permission-prompt diagnosis, bounded local handoff timings, stale-handoff recovery, and a progressive-disclosure design for the Modes editor.
Non-goals: Changing the Tip-Modus, uploading modes or temporary unlocks, external analytics, changing target-selection rules, or changing normal blocking/unlock behavior.
Risks: Treating a short accessibility-service reconnect as a missing permission would create a noisy prompt; diagnostic timing must stay local and bounded; hiding mode controls must not make any option unreachable.
Verification: Targeted unit/UI tests, TypeScript, Android unit build for native changes, and a manual physical-device check of start, trigger, route-ready, completion, and dismiss.

## 1. Establish the real startup condition before changing permission UX

- Inspect the device's Android accessibility setting, `ScreenTimePlugin.getMonitoringStatus()`, and the watchdog notification state when the prompt appears.
- Keep `checkPermissions()` as the authority for whether the Android permission was granted. Do not send the user back to Android settings merely because the accessibility service is reconnecting.
- If the issue is the onboarding dialog rather than a real permission loss, never auto-open it after a completed/dismissed onboarding; leave an explicit entry point in Settings.

## 2. Make blocking performance evidence local and actionable

- Reuse the existing bounded native `recentBlockingEvents` log instead of adding third-party analytics or uploading behavior data.
- Record only lifecycle timestamps needed to calculate trigger-to-overlay, overlay-to-route-ready, and route-ready-to-dismiss timings. Cap retained events and never include typed answers or card content.
- Surface diagnostics only when a flow fails or is slow; do not add persistent dashboard noise.

## 3. Harden stale handoff recovery without changing normal unlock behavior

- Verify every non-complete pending-navigation stage has a TTL and is cleared before a normal app launch can consume it.
- Keep the existing retry/reset dismissal recovery. Add regression tests for stale-stage cleanup and repeated-start stability.
- Preserve Overlay & Handoff. No force-stop, HOME redirect, new blocking policy, or target-unlock behavior change belongs in this work.

## 4. Reduce Mode-editor density with progressive disclosure

- Keep the existing values and save behavior, but group each mode into: targets, intervention settings, and advanced protection/settings.
- Default to the one group needed next; show a short value summary for collapsed groups. Every control remains available in one tap.
- First implement after the blocking/startup reliability checks so visual work does not hide a real runtime issue.

## 5. Sync contract

- Keep cloud sync focused on decks, notes, cards, and review logs. Modes, device permissions, temporary unlocks, and enforcement state remain device-local.
- Validate that the existing learning cloud runtime uploads and restores vocabulary/reviews before changing sync architecture or user-facing claims.
