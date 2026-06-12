# Blocking Overlay Handover For Agents

Date: 2026-03-20

## Wichtigster Stand

Die aktuell kritischste Baustelle war der Android-Blockierfluss.

Zielverhalten:

- Wenn eine blockierte App geoeffnet wird, soll Blearn zuerst als Pflaster/Overlay erscheinen.
- Danach soll der passende Blearn-Flow starten.
- Nach Erfolg oder Abbruch soll Blearn wieder verschwinden.

## Was jetzt umgesetzt ist

### 1. Das vorgeschaltete native Overlay ist wieder wirklich im Pfad

Datei:

- `android/app/src/main/java/app/blearn/mobile/ScreenTimeAccessibilityService.java`

Wichtig:

- Der Accessibility-Service startet nicht mehr direkt nur die Blocking-Activity.
- Er zeigt jetzt wieder zuerst das native Blocking-Overlay (`OverlayPresenter`) und startet den Flow erst ueber dessen Primary Action.

### 2. Der Dismiss-Pfad ist nativer und robuster

Dateien:

- `android/app/src/main/java/app/blearn/mobile/ScreenTimePlugin.java`
- `android/app/src/main/java/app/blearn/mobile/BlockingOverlayActivity.java`

Wichtig:

- `dismissBlockingOverlay()` raeumt Pending Navigation und Handoff-Status sauber auf.
- `BlockingOverlayActivity` schliesst jetzt auch bei `Back` und bei `onDestroy()` sauber.

### 3. Die React-Flows dismissen nicht mehr nur im Idealfall

Dateien:

- `src/pages/Checkin.tsx`
- `src/pages/Intervention.tsx`
- `src/hooks/useLearnReviewSession.ts`
- `src/components/InterventionOverlayScreen.tsx`
- `src/pages/Breathing.tsx`

Wichtig:

- Check-in zeigt den Overlay-Erfolg jetzt auch dann, wenn `unlockDurationMinutes` fehlt und der Default verwendet wird.
- Intervention hat einen echten Abbruchpfad und einen `Abbrechen`-Button.
- Learn Review dismiss't beim Verlassen/Erfolg sauber.
- `Breathing -> Checkin` navigiert mit `replace`, damit der Blocking-Flow nicht unnoetig im History-Stack haengen bleibt.

## Relevante Dateien fuer neue Agents

- `android/app/src/main/java/app/blearn/mobile/ScreenTimeAccessibilityService.java`
- `android/app/src/main/java/app/blearn/mobile/OverlayPresenter.java`
- `android/app/src/main/java/app/blearn/mobile/OverlayHandoffCoordinator.java`
- `android/app/src/main/java/app/blearn/mobile/PendingNavigationLauncher.java`
- `android/app/src/main/java/app/blearn/mobile/ScreenTimePlugin.java`
- `android/app/src/main/java/app/blearn/mobile/BlockingOverlayActivity.java`
- `src/hooks/useNativePendingNavigation.ts`
- `src/hooks/useNativeRouteReady.ts`
- `src/pages/Breathing.tsx`
- `src/pages/Checkin.tsx`
- `src/pages/Intervention.tsx`
- `src/hooks/useLearnReviewSession.ts`
- `src/test/androidOverlaySuccess.test.tsx`
- `src/test/useNativePendingNavigation.test.tsx`
- `src/test/appBlockingFallback.test.tsx`

## Verifiziert

Gruen gelaufen:

- `npm test -- --run src/test/androidOverlaySuccess.test.tsx src/test/useNativePendingNavigation.test.tsx src/test/appBlockingFallback.test.tsx`
- `android\\.\\gradlew testDebugUnitTest`
- `npm run build`

## Offener sinnvoller Naechstschritt

Ein echter Android-Emulator-End-to-End-Check des Overlay-Handoffs fehlt noch.

Wenn ein neuer Agent weitermacht, sollte er genau das als Erstes live pruefen:

- blockierte App oeffnen
- Blearn-Overlay erscheint
- Success-Pfad
- Abbruch-Pfad
- Blearn verschwindet jeweils korrekt
