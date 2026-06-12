# Triage: Die 8 roten Tests in learningCloudSyncRuntime.test.tsx

Datum: 2026-06-12 · Ergebnis: **behoben** (444/444 grün)

## Befund

Alle 8 Failures hatten EINE gemeinsame Ursache und waren KEINE Code-Regression
in der Sync-Schicht: `isFirebaseConfigured()` liest `VITE_FIREBASE_*` aus
`import.meta.env`. Im Repo existiert nur `.env.example` mit leeren Werten —
auf jeder Maschine ohne ausgefüllte `.env.local` (CI, frische Clones) meldete
der Hook deshalb `blocked-firebase-missing`, der Sync bootstrappte nie, und
alle 8 Tests scheiterten kaskadierend (Backup/Restore, Debounced Save,
Cursor, Baseline-Cache, Signature-Save).

Sichtbarstes Symptom: der Writes-Disabled-Test erwartete
`blocked-writes-disabled`, bekam aber `blocked-firebase-missing`, weil der
Configured-Guard VOR dem Writes-Guard greift.

## Fix

`vitest.config.ts` definiert jetzt hermetische Dummy-Werte für alle
`VITE_FIREBASE_*`-Variablen (`test.env`). Es entstehen keine echten
Verbindungen: die Tests injizieren sämtliche Sync-APIs über
`__setLearningCloudSyncApiForTest`, und Firestore-Writes sind ohnehin nur im
Test-Mode freigeschaltet.

## Konsequenz für Masterplan Phase 3

Die Mutation-Log-/Delta-Schicht (`mutationLog.ts`, `deltaSync.ts`) ist durch
diese Tests ABGEDECKT und grün. Phase 3 bleibt nötig (Monolith-Dokument →
Subcollections, Signatur-Pfade aus dem Hot Path entfernen, Sync-Status-UI),
startet aber von einer grünen, vertrauenswürdigen Testbasis — die im Alltag
beobachteten Sync-Aussetzer sind damit NICHT erklärt durch kaputte Logik der
neuen Schicht, sondern weiterhin am wahrscheinlichsten durch den
Full-State-Hot-Path (1-MiB-Grenze, stilles Scheitern ohne Status-UI/Retry).
