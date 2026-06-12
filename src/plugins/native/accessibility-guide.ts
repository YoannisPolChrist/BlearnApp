/**
 * Native Android Accessibility notes for Blearn.
 *
 * Package root:
 * `android/app/src/main/java/app/blearn/mobile/`
 *
 * Runtime classes already used by the app:
 * - `ScreenTimeAccessibilityService`
 * - `ObservedTextCollector`
 * - `TargetMatcher`
 * - `OverlayPresenter`
 *
 * Related resources:
 * - `android/app/src/main/res/xml/accessibility_service_config.xml`
 * - `android/app/src/main/AndroidManifest.xml`
 *
 * When extending accessibility behavior:
 * - keep app blocking package-based
 * - keep search matching limited to browser/search allowlists
 * - open the existing Blearn intervention route instead of adding new overlays
 */

export {};
