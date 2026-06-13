/**
 * Lokale Debug-Telemetrie für das Overlay-Latenz-Budget (Masterplan 2.3/4b.1):
 * Zeit von "Blocking-Navigation konsumiert" bis "erste Karte interaktiv".
 * Zielwert: < 800 ms auf dem Xiaomi-Referenzgerät. Nur Konsolen-Log, keine
 * Persistenz, kein Netzwerk.
 */

let blockingLearnStartedAt: number | null = null;
let reported = false;

export function markBlockingLearnStart(now = performance.now()): void {
  blockingLearnStartedAt = now;
  reported = false;
}

export function reportFirstCardInteractive(now = performance.now()): void {
  if (blockingLearnStartedAt === null || reported) {
    return;
  }

  reported = true;
  const elapsedMs = Math.round(now - blockingLearnStartedAt);
  // Bewusst auch im Release sichtbar (adb logcat) — eine Zeile, keine Nutzerdaten.
  console.info(`[blearn-perf] overlay_to_first_card_ms=${elapsedMs}`);
}

export function resetBlockingLearnLatency(): void {
  blockingLearnStartedAt = null;
  reported = false;
}
