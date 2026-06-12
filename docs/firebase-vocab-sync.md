# Firebase Vocab Sync

This app now syncs only learning and vocabulary data through Firestore.

Synced data:
- decks
- notes
- cards
- review logs
- learning presets
- active deck selection

Not synced:
- blocking modes
- app, website, and search blocking configuration
- wallet data
- temporary unlock grants

## Firebase setup

1. Create or select a Firebase project.
2. Enable Authentication.
3. Enable the Email/Password sign-in provider.
4. Create a Firestore database in Native mode.
5. Deploy the included Firestore rules:
   `firebase deploy --only firestore:rules`
6. Fill the app's `.env.local` with:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
7. Rebuild the app and sign in with the same account on phone and PC.

## Firestore layout

All synced learning data is stored below:

`users/{uid}/learningMeta/profile`

Entity collections:
- `users/{uid}/learningDecks`
- `users/{uid}/learningNotes`
- `users/{uid}/learningCards`
- `users/{uid}/learningReviewLogs`
- `users/{uid}/learningPresets`

## Runtime behavior

- Local IndexedDB remains the fast offline cache.
- Firestore mirrors only the learning slice.
- Remote updates are merged back into the local store.
- Local changes are debounced before upload.
