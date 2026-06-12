# Android Performance Notes

Date: 2026-06-11
Device: Xiaomi 22101320G, Android 14, 1080x2400 @ 440 dpi
Package: app.blearn.mobile
Build: debug, versionName 1.0, versionCode 1
Install time checked on device: 2026-06-11 05:45:50

## Scope

This is an observation-only pass. No performance fixes were implemented in this pass.

Focused checks:

- Launch app on the connected physical phone.
- Capture startup timing with Android ActivityManager.
- Capture memory snapshot with dumpsys meminfo.
- Capture frame stats with dumpsys gfxinfo.
- Inspect logcat for app-owned repeated work, warnings, and errors.
- Check largest packaged assets.
- Take a short idle CPU sample with simpleperf.

## Measurements

### Startup

- Activity: app.blearn.mobile/.MainActivity
- LaunchState: WARM
- TotalTime: 1236 ms
- WaitTime: 1252 ms

Interpretation:

- Warm startup is acceptable for a debug WebView/Capacitor build.
- It is not excellent. Release/profileable builds should be measured separately before making final user-facing claims.

### Frames After Startup

Initial gfxinfo after launch:

- Total frames rendered: 29
- Janky frames: 7 (24.14%)
- 50th percentile frame time: 23 ms
- 90th percentile frame time: 300 ms
- Slow UI thread: 4
- Slow bitmap uploads: 1
- Slow issue draw commands: 6

Idle gfxinfo after reset and 10 seconds:

- Total frames rendered: 0
- Janky frames: 0

Interpretation:

- The app becomes visually quiet while idle, which is good.
- Startup has visible jank risk. Some of this may be normal WebView/debug-build warmup, but the 300 ms p90 frame time is worth improving if users feel the first screen stutters.

### Memory

First snapshot soon after launch:

- TOTAL PSS: 386 MB
- TOTAL RSS: 519 MB
- Java Heap: 16.5 MB PSS
- Native Heap: 34.3 MB PSS
- Graphics: 51.5 MB PSS
- WebViews: 1
- Activities: 1

Later idle snapshot:

- TOTAL PSS: 199 MB
- TOTAL RSS: 313 MB
- Java Heap: 23.5 MB PSS
- Native Heap: 20.7 MB PSS
- Graphics: 51.0 MB PSS
- WebViews: 1
- Activities: 1

Interpretation:

- One Activity and one WebView are healthy.
- Idle memory settles to a reasonable range for a WebView app.
- The first snapshot is inflated by mapped APK/code/assets shortly after launch. It should be watched, but it does not by itself prove a leak.

### Idle CPU

dumpsys cpuinfo snapshot:

- app.blearn.mobile: 0%
- Device total at capture: 18%

Simpleperf idle sample:

- Duration: about 8 seconds
- Samples: 213, none lost
- No clear first-party CPU hotspot dominated the profile.
- Most samples were Android runtime, WebView, kernel, and Capacitor bridge/runtime work.

Interpretation:

- Raw idle CPU does not look high in this short sample.
- However, logcat shows recurring bridge work that should not be running this frequently during normal idle.

## Main Finding

### Native pending-navigation polling is too aggressive in idle

Observed on device logcat while the app sat idle:

- `ScreenTime.consumePendingNavigation()` is called about every 250 ms.
- Native logs repeatedly report `consume_pending_navigation_empty`.
- Capacitor logs show a new bridge callback each time.
- Console logs also emit `[object Object]` and `undefined` around each poll.

Likely source:

- `src/hooks/useNativePendingNavigation.ts`
- `VISIBLE_IDLE_CONSUME_POLL_MS = 250`
- `scheduleIdleRetry()` keeps a fast retry loop alive while the document is visible.

Why it matters:

- Four native bridge calls per second in normal idle is unnecessary work.
- It creates log noise, bridge traffic, and possible battery cost.
- It may hide real problems in logcat.
- It may contribute to startup/foreground jank on slower devices.

Important product constraint:

- The fix must not break Android blocking handoff. The app still needs fast pickup when Android launches Blearn from a native overlay.
- A safer design is event/intent driven or staged polling, not simply deleting the consume loop.

Candidate fix direction:

- On initial app foreground/resume, poll quickly only for a very short window.
- If no pending navigation exists, back off to a slower interval.
- Prefer `peekPendingNavigation()` plus native status checks on focus/resume.
- Trigger immediate consume from native route-ready / app resume / explicit handoff signals.
- Reduce or gate runtime logging in normal idle.

## Asset Size Notes

Largest bundled learning assets:

- `public/learn-templates/jean-paul.json`: 28.44 MB
- `public/learn-templates/jean-paul-spanish.json`: 1.30 MB
- `public/learn-templates/italian-top-5000.json`: 0.68 MB
- `public/learn-templates/arabic-top-5000.json`: 0.65 MB
- `public/learn-templates/french-top-5000.json`: 0.49 MB
- `public/learn-templates/spanish-top-5000.json`: 0.48 MB

APK:

- `android/app/build/outputs/apk/debug/app-debug.apk`: about 13.65 MB

Interpretation:

- APK compression keeps installed package size acceptable despite the large Jean Paul JSON.
- The 28 MB Jean Paul file is still the largest performance risk during import or if accidentally parsed eagerly.
- Current startup evidence does not prove it is parsed on launch, but this should stay protected by code review/tests.

Candidate fix direction:

- Keep large templates lazy-loaded only when the user imports or refreshes them.
- Consider shipping large templates as compressed JSON and decompressing on demand.
- Consider chunked import for Jean Paul so parsing and card creation do not block the UI thread.

## What Looks OK

- The app installs and launches on the physical phone.
- The installed package is the expected `app.blearn.mobile`.
- Idle rendering is quiet after startup.
- One Activity and one WebView are active, which is expected for this architecture.
- Idle CPU snapshot is not alarming.
- No crash was observed in the checked log window.

## What Needs Attention

1. Fast idle native polling in `useNativePendingNavigation`.
2. Startup jank after launch, especially if it is user-visible.
3. Verbose runtime logs during normal idle.
4. Large Jean Paul JSON import path should be kept lazy and probably made chunked/compressed later.
5. Measurements are from a debug build. A release/profileable build should be measured for final performance judgement.

## Recommended Next Steps

1. Fix the pending-navigation idle loop with staged backoff while preserving fast handoff after native overlay launch.
2. Add regression tests around the polling cadence so blocking remains reliable.
3. Reinstall and re-measure on the phone:
   - logcat should no longer show bridge calls every 250 ms in normal idle.
   - blocking handoff should still consume pending navigation immediately when launched from native.
   - startup frame stats should improve or at least not regress.
4. Then profile Jean Paul import specifically as a separate focused flow.

