# Blocking Overlay TL;DR

Stand: 2026-03-20

- Hauptthema ist aktuell der Android-Blockierfluss.
- Sollverhalten: blockierte App oeffnen -> Blearn erscheint als Overlay/Pflaster -> passender Blearn-Flow -> Blearn verschwindet nach Erfolg oder Abbruch wieder.
- Der native vorgeschaltete Overlay-Pfad ist wieder aktiv in `android/app/src/main/java/app/blearn/mobile/ScreenTimeAccessibilityService.java`.
- Der native Dismiss-Pfad raeumt jetzt sauber auf in:
  - `android/app/src/main/java/app/blearn/mobile/ScreenTimePlugin.java`
  - `android/app/src/main/java/app/blearn/mobile/BlockingOverlayActivity.java`
- React-Abbruch-/Erfolgspfade wurden nachgezogen in:
  - `src/pages/Checkin.tsx`
  - `src/pages/Intervention.tsx`
  - `src/hooks/useLearnReviewSession.ts`
  - `src/components/InterventionOverlayScreen.tsx`
  - `src/pages/Breathing.tsx`
- Wichtige Tests:
  - `src/test/androidOverlaySuccess.test.tsx`
  - `src/test/useNativePendingNavigation.test.tsx`
  - `src/test/appBlockingFallback.test.tsx`
- Verifiziert:
  - `npm test -- --run src/test/androidOverlaySuccess.test.tsx src/test/useNativePendingNavigation.test.tsx src/test/appBlockingFallback.test.tsx`
  - `android\\.\\gradlew testDebugUnitTest`
  - `npm run build`
- Wichtigster offener Punkt: echten Android-Emulator-End-to-End-Check fuer Overlay-Erscheinen, Success und Abbruch fahren.
