# Firebase Vocabulary Sync

## Firestore Layout

```
users/{uid}
├── decks/{deckId}
├── notes/{noteId}
├── cards/{cardId}
├── reviewLogs/{logId}
├── assignments/{targetId}
├── unlockGrants/{grantId}
└── profile
    ├── gateRule
    ├── lastSyncAt
    └── versionToken
```

- Every document stores `updatedAt` (epoch millis). Last-write-wins compares that field.
- Decks/notes/cards mirror the structures in `src/lib/learning.ts`.
- Assignments store learn-mode target configuration; `profile.gateRule` holds global defaults.
- Unlock grants keep recent unlock waivers created by the device.

## Cloud Functions

| Endpoint | Description |
| --- | --- |
| `importDeck` | Accepts `ImportPayload` and writes decks/notes/cards under the user scope. |
| `getDueCards` | Returns due cards filtered by `deckIds`. |
| `submitReviewBatch` | Applies card state updates + review logs. |
| `assignDeckToTarget` | Upserts per-target assignments. |
| `createUnlockGrant` | Adds a temporary unlock window for a target. |
| `getDevicePolicy` | Returns assignments + gate rule snapshot for the Android host. |
| `syncClientState` | Stores the latest device policy the native host used. |
| `pullVocabularySnapshot` | Exports decks/notes/cards/reviewLogs + assignments with an ETag-like version token. Supports `since` (epoch) to fetch deltas. |
| `pushVocabularyChanges` | Accepts batched deck/note/card/reviewLog/assignment mutations (including deletes) and applies them based on `updatedAt`. |

All endpoints require a Firebase Auth Bearer token. Enable Email/Password auth for the Capacitor shell.

## Testing & Deployment

```
cd firebase/functions
npm install
npm run build
npm run test           # Vitest + firebase-functions-test
firebase emulators:start --only functions
firebase deploy --only functions
```

CI should run `npm run build && npm run test` in this folder before deployment. The emulator config currently scopes to Cloud Functions only; extend it when Firestore/Hosting should also run locally.
