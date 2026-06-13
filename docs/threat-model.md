# Blearn Threat Model

Datum: 2026-06-13 · Status: lebendes Dokument (Masterplan Phase 5.1)

## Leitsatz

Blearn ist **Selbstbindungs-Software**. Der „Angreifer" ist der eigene zukünftige
Impuls des Nutzers – nicht ein technischer Profi, der das Gerät kompromittieren
will. Daraus folgt die Designhaltung des North Star: **schützend wirken, nicht
feindselig.** Jede Härtung muss Reibung erzeugen und eine bewusste Entscheidung
erzwingen, darf den Nutzer aber nie aussperren oder ihm Daten/Geld gegen seinen
finalen, expliziten Willen entziehen.

## Was Blearn garantiert

- **Reibung + bewusste Entscheidung vor dem Impuls.** Eine blockierte App/Website
  wird abgefangen und der Nutzer durch den konfigurierten Flow (Lernen / Atmen /
  Check-in / Penalty) geführt. Nur ein bewusster Abschluss schaltet frei.
- **Ehrlicher Schutzstatus.** Wenn ein für die Konfiguration nötiger Pfad nicht
  läuft (Accessibility beendet, VPN nach Reboot aus, Berechtigung fehlt), zeigt
  die App das sichtbar an statt stillschweigend „grün" zu bleiben
  (Schutzstatus-Karte + hochpriore Benachrichtigungen).
- **Strict-Lock-Integrität gegen einfache Umgehung.** Innerhalb eines aktiven
  Strict-Fensters sind die Schutz-Einstellungen unveränderbar (Store-Enforcement),
  die maximale Dauer ist hart gedeckelt, und das Lock-Ende ist gegen
  **Wall-Clock-Manipulation** verankert (`StrictLockClockGuard` nutzt
  `elapsedRealtime` + Boot-Count; Datum-Vorstellen beendet den Lock nicht
  innerhalb derselben Boot-Session).
- **Datensicherheit der Lerninhalte.** Reviews überleben Prozess-Tod (WAL +
  Pause-Flush), und beobachteter Bildschirmtext verlässt das Gerät nie.

## Was Blearn ausdrücklich NICHT garantiert

Diese Punkte sind **bewusst** außerhalb des Schutzversprechens. Feature-Wünsche,
die hier hineingreifen, drohen in feindseliges Verhalten abzurutschen und werden
abgelehnt:

- **Deinstallation der App.** Wer Blearn entschlossen deinstalliert, umgeht es.
  Wir versehen dies mit Reibung (Verzögerungs-Dialog im Strict-Fenster), klammern
  uns aber nicht per Device-Admin über das Strict-Fenster hinaus fest
  (Play-Store-Policy-Risiko + Nutzervertrauen).
- **Deaktivieren der Bedienungshilfe.** Android erlaubt dem Nutzer jederzeit, den
  Accessibility-Service zu beenden. Wir erkennen das und warnen ehrlich
  (`ProtectionWatchdog`), verhindern es aber nicht hart.
- **Zweitgerät / Desktop / anderer Browser.** Blearn schützt das Gerät, auf dem
  es läuft. Ein ungeschütztes Zweitgerät ist kein Angriff, den Blearn abwehrt.
- **Private DNS (DoT) / DoH.** Verschlüsseltes DNS verbirgt Hostnamen vor dem
  VPN-DNS-Pfad. Wir erkennen aktives Private DNS und zeigen es im Schutzstatus als
  Einschränkung an; das Text-Matching im Browser bleibt der aktive Pfad.
- **Root / ADB / Entwickleroptionen.** Ein Nutzer mit Root-Zugriff oder ADB kann
  jeden lokalen Schutz aushebeln. Das ist kein Bedrohungsmodell für
  Selbstbindungs-Software.

## Bekannte Umgehungen → Reibung statt Hard-Block

| Umgehung | Antwort von Blearn |
|---|---|
| Deinstallation im Strict-Fenster | Verzögerungs-Dialog („in 60 s fortfahren") + Atemübung anbieten |
| Bedienungshilfe deaktivieren | Watchdog-Warnung „Schutz deaktiviert", kein Hard-Block |
| System-Settings öffnen (Hardcore-Modus, opt-in) | Settings-App als Ziel behandeln, aber mit Notausstieg |
| Wall-Clock vorstellen | `elapsedRealtime`-Anker hält das Lock bis zum echten Ablauf |
| Trigger-Sturm / hängender Overlay-Flow | Suppression + Diagnose-Notification + garantierter Notausgang zum Launcher |

## Datenschutz des Accessibility-Pfads (verifiziert 2026-06-13)

`ObservedTextCollector` liest Bildschirmtext in den per Allowlist erlaubten
Browser-/Such-Apps. Das ist hochsensibel. Garantien, code-verifiziert:

- Der gesammelte Text wird **nur in-memory** gegen die Blockliste gematcht
  (`TargetMatcher.findTextMatch`, reine Containment-Prüfung).
- Er wird **nie persistiert** (kein `SharedPreferences`-/Datei-Schreibpfad).
- Er wird **nie geloggt**: die `debug()`-Aufrufe enthalten ausschließlich
  Paketnamen und Match-Quelle/Target-ID, nie den beobachteten Text. `debug()` ist
  zudem hinter `FLAG_DEBUGGABLE` gegated → Release-Builds loggen gar nicht.
- Er wird **nie gesynct** (kein Firestore-/Netzwerkpfad berührt `observedText`).

Play-Store-Konsequenz: Die Accessibility- und VPN-Nutzung muss im Listing
prominent deklariert und begründet werden (Prominent-Disclosure-Pflicht).

## Wallet/Penalty-Pfad

Secrets (Stripe/SendGrid/Alby) liegen serverseitig in den Cloud Functions. Regel:
**Kein Pfad bucht Geld ab, ohne dass der Nutzer den finalen Schritt explizit
bestätigt.** Wallet-Fehlerzustände müssen den Block **auflösen** statt den Nutzer
einzusperren (Geld-Risiko + Vertrauen).
