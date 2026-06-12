# Blearn

Blearn is an Android focus app. It combines app and website blocking with breathing interventions, learn gates, check-ins, and optional penalty flows.

## Platform Guardrails

- The Android runtime (debug or release via Capacitor) is the only supported environment. Browser builds now show an Android-only placeholder instead of a semi-functional product.
- There is no PWA, desktop, or iOS install path. Delete any old shortcuts and reinstall via the Android Gradle build if you need a fresh copy.
- `npm run dev` is available strictly for UI development. Set `VITE_ALLOW_WEB_RUNTIME=true` in `.env.local` only when you need to visually inspect layouts in a desktop browser; blocking, permissions, and gates still run exclusively on Android.

## Stack

- Vite
- React
- TypeScript
- Capacitor Android
- Zustand
- Vitest

## Local Development

```sh
npm install
npm run dev
```

The browser dev server runs on `http://127.0.0.1:5173` for UI work only. Set `VITE_ALLOW_WEB_RUNTIME=true` in `.env.local` if you need to preview the UI in a browser during development; blocking, permissions, overlays, and screen-time data still only work inside the Android runtime.

## Firebase Setup

Multi-device vocabulary sync and account features require a Firebase project with Authentication, Firestore, and Cloud Functions enabled.

1. Create a Firebase project and a Web App. Enable Email/Password authentication.
2. Copy the Firebase config values into `.env.local` (clone `.env.example`):

   ```
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_AUTH_DOMAIN=...
   VITE_FIREBASE_PROJECT_ID=...
   VITE_FIREBASE_STORAGE_BUCKET=...
   VITE_FIREBASE_MESSAGING_SENDER_ID=...
   VITE_FIREBASE_APP_ID=...
   ```

3. Download `google-services.json` for Android and place it in `android/app/google-services.json`. Sync Gradle so Capacitor picks up the config.
4. Deploy the Cloud Functions under `firebase/functions` using the Firebase CLI after setting the required secrets (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SENDGRID_API_KEY`):

   ```sh
   cd firebase/functions
   npm install
   npm run build
   firebase deploy --only functions
   ```

If these variables are missing, Blearn stays in offline-only mode and prompts the user to configure Firebase before enabling cross-device vocabulary sync.

## Android Build

```sh
npm run build
npx cap sync android
cd android
.\gradlew assembleDebug
```

The debug APK is created at `android/app/build/outputs/apk/debug/app-debug.apk`.

## Android Install

```sh
C:\Users\%USERNAME%\AppData\Local\Android\Sdk\platform-tools\adb.exe install -r android\app\build\outputs\apk\debug\app-debug.apk
```

## Notes

- Android package id: `app.blearn.mobile`
- The native Android runtime lives under `android/app/src/main/java/app/blearn/mobile`
