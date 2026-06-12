#!/usr/bin/env bash
# Chaos-Test-Harness (Masterplan Phase 2.7): reproduziert die echten
# Datenverlust-Szenarien auf einem per adb verbundenen Gerät.
#
# Voraussetzungen:
#   - Gerät via adb verbunden, Debug-Build von Blearn installiert
#   - Mindestens ein Deck mit fälligen Karten
#   - Vor jedem Szenario: App öffnen, EIN Review manuell beantworten,
#     dann SOFORT Enter drücken, wenn das Skript dazu auffordert.
#
# Verifikation: Nach jedem Kill startet das Skript die App neu. Prüfe im
# Logcat die Zeile "Review-WAL replay" — replayedCount > 0 bedeutet: der
# Snapshot-Persist wurde gekillt, aber das WAL hat das Review gerettet.
# replayedCount = 0 UND das Review ist sichtbar = Snapshot hat gewonnen.
# Verlust liegt NUR vor, wenn das Review nach Neustart fehlt.
#
# Nutzung: scripts/chaos/run-chaos.sh [szenario]   (1|2|3|4|all)

set -euo pipefail

PKG="app.blearn.mobile"
SCENARIO="${1:-all}"

adb_ok() { adb get-state >/dev/null 2>&1 || { echo "FEHLER: kein adb-Gerät verbunden"; exit 1; }; }

wait_for_user() {
  echo ""
  echo ">>> $1"
  read -r -p ">>> Enter drücken, sobald erledigt... " _
}

kill_app() {
  echo "    force-stop ${PKG}"
  adb shell am force-stop "${PKG}"
  sleep 1
}

start_app() {
  echo "    Start ${PKG} + Logcat-Watch (10 s) auf WAL-Replay"
  adb logcat -c
  adb shell monkey -p "${PKG}" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
  timeout 10 adb logcat -v brief | grep -m1 -i "Review-WAL replay" || echo "    (kein WAL-Replay nötig — Snapshot war vollständig)"
}

scenario_1() {
  echo "== Szenario 1: Review → sofortiger Kill =="
  wait_for_user "App öffnen, genau EIN Review beantworten, dann SOFORT Enter"
  kill_app
  start_app
  wait_for_user "Verifizieren: Ist das Review vorhanden (Karte korrekt terminiert)? j/n notieren"
}

scenario_2() {
  echo "== Szenario 2: Review → Home → 10 s → Kill =="
  wait_for_user "Review beantworten, dann HOME drücken, dann Enter"
  echo "    warte 10 s (Pause-Flush-Fenster)"
  sleep 10
  kill_app
  start_app
  wait_for_user "Verifizieren: Review vorhanden? (Erwartung: ja, via Pause-Flush — Logcat sollte KEIN Replay zeigen)"
}

scenario_3() {
  echo "== Szenario 3: Review im Blocking-Overlay → Back → Kill =="
  wait_for_user "Blockierte App öffnen → Lern-Overlay → 1 Review beantworten → BACK drücken → Enter"
  kill_app
  start_app
  wait_for_user "Verifizieren: Review vorhanden UND kein Overlay-Loop beim Neustart?"
}

scenario_4() {
  echo "== Szenario 4: Flugmodus → 3 Reviews → Kill → Flugmodus aus =="
  adb shell cmd connectivity airplane-mode enable || adb shell settings put global airplane_mode_on 1
  wait_for_user "3 Reviews im Flugmodus beantworten, dann Enter"
  kill_app
  adb shell cmd connectivity airplane-mode disable || adb shell settings put global airplane_mode_on 0
  start_app
  wait_for_user "Verifizieren: alle 3 Reviews vorhanden? Nach Netz-Rückkehr: Sync-Status prüfen"
}

adb_ok
case "${SCENARIO}" in
  1) scenario_1 ;;
  2) scenario_2 ;;
  3) scenario_3 ;;
  4) scenario_4 ;;
  all) scenario_1; scenario_2; scenario_3; scenario_4 ;;
  *) echo "Nutzung: $0 [1|2|3|4|all]"; exit 1 ;;
esac

echo ""
echo "Chaos-Lauf abgeschlossen. Abnahme Phase 2: jedes Szenario 10× ohne ein einziges verlorenes Review."
