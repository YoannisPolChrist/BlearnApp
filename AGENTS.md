# Project Rules

- Start every new implementation session with [`docs/AI_AGENT_START_HERE.md`](docs/AI_AGENT_START_HERE.md), then [`docs/project-memory.md`](docs/project-memory.md), and then the latest implementation plan under [`docs/plans/`](docs/plans).
- The current high-signal improvement plan is [`docs/plans/2026-06-14-improvement-plan.md`](docs/plans/2026-06-14-improvement-plan.md). Older plans still matter for architecture context, but do not treat them as fresher than this file.
- The core blocking architectural rules are codified in [`docs/plans/2026-04-11-native-blocking-architecture.md`](docs/plans/2026-04-11-native-blocking-architecture.md). Always adhere to the Overlay & Handoff pattern; never use force-stop or HOME redirects.
- Blearn soll impulsive, ablenkende Nutzung nicht nur blockieren, sondern in einen bewussten Fokus- und Lernmoment verwandeln.
- Das Produktziel ist: aus "ich oeffne es automatisch" soll "ich halte kurz an, reflektiere, lerne oder atme und entscheide dann bewusst" werden.
- Das UX-Ziel ist: Blocking muss sich schuetzend, klar und hilfreich anfuehlen, nicht chaotisch, strafend oder technisch kaputt.
- Das technische Ziel ist: Der native Android-Blockierpfad muss zuverlaessig triggern, den passenden Blearn-Flow oeffnen, sich danach sauber wieder abbauen und keine haengenden Overlays oder Bedienungshilfe-Fehler hinterlassen.
- Bei Produktentscheidungen sollen Agents deshalb immer Fokus, bewusste Unterbrechung, saubere Freigabe-Logik und robuste Overlay-/Handoff-Stabilitaet priorisieren.
- "Erfolg" bedeutet in diesem Repo nicht nur, dass etwas kompiliert, sondern dass ein echter Blocking-Flow auf dem Geraet stabil wirkt: Trigger, Handoff, Completion, Dismiss und optionales Reopen des Ziels muessen konsistent zusammenpassen.
- Beim Neuinstallieren der Android-App fuer Tests oder Verifikation immer als Update installieren, damit lokale App-Daten und Vokabeln erhalten bleiben.
- Dafuer bevorzugt `adb install -r` verwenden; nur wenn fuer Debug-Builds noetig zusaetzlich `-t`.
- Niemals `adb uninstall`, `pm clear` oder andere datenloeschende Schritte ausfuehren, ausser der Nutzer verlangt das ausdruecklich.
