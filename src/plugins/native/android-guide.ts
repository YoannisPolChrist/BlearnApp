/**
 * Native Android implementation notes for Blearn.
 *
 * Main package:
 * `app.blearn.mobile`
 *
 * Key entry points:
 * - `MainActivity.java`
 * - `ScreenTimePlugin.java`
 * - `ScreenTimeAccessibilityService.java`
 * - `BlearnVpnService.java`
 *
 * Build flow:
 * 1. `npm run build`
 * 2. `npx cap sync android`
 * 3. `cd android && .\\gradlew assembleDebug`
 *
 * Keep the native bridge aligned with the shared `policy_snapshot` shape.
 */

export {};
