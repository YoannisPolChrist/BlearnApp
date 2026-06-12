import type { FirebaseApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';

type RawFirebaseEnv = Partial<Pick<
  ImportMetaEnv,
  | 'VITE_FIREBASE_API_KEY'
  | 'VITE_FIREBASE_AUTH_DOMAIN'
  | 'VITE_FIREBASE_PROJECT_ID'
  | 'VITE_FIREBASE_STORAGE_BUCKET'
  | 'VITE_FIREBASE_MESSAGING_SENDER_ID'
  | 'VITE_FIREBASE_APP_ID'
>>;

type FirebaseEnvConfig = Required<RawFirebaseEnv>;

const REQUIRED_FIREBASE_KEYS: Array<keyof FirebaseEnvConfig> = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
];

export function loadFirebaseEnv(rawEnv: RawFirebaseEnv): FirebaseEnvConfig | null {
  const missingKey = REQUIRED_FIREBASE_KEYS.find((key) => {
    const value = rawEnv[key];
    return !value || value.trim().length === 0;
  });

  if (missingKey) {
    return null;
  }

  return REQUIRED_FIREBASE_KEYS.reduce((acc, key) => {
    acc[key] = rawEnv[key] as string;
    return acc;
  }, {} as FirebaseEnvConfig);
}

export function areFirebaseWritesEnabled(
  rawEnv: Partial<Record<'VITE_ENABLE_FIREBASE_WRITES', string | undefined>>,
  mode?: string,
) {
  return ((rawEnv.VITE_ENABLE_FIREBASE_WRITES || '').trim().toLowerCase() === 'true')
    || mode === 'test';
}

const firebaseEnvConfig = loadFirebaseEnv(import.meta.env);
const firebaseGoogleWebClientId =
  ((import.meta.env as Record<string, string | undefined>).VITE_FIREBASE_GOOGLE_WEB_CLIENT_ID || '').trim();
const firebaseWritesEnabled = areFirebaseWritesEnabled(
  import.meta.env as Record<'VITE_ENABLE_FIREBASE_WRITES', string | undefined>,
  import.meta.env.MODE,
);

export const isFirebaseConfigured = (): boolean => Boolean(firebaseEnvConfig);
export const getFirebaseGoogleWebClientId = (): string => firebaseGoogleWebClientId;
export const isFirebaseWriteEnabled = (): boolean => firebaseWritesEnabled;

let firebaseApp: FirebaseApp | null = null;
let firebaseAuth: Auth | null = null;
let firebaseFirestore: Firestore | null = null;
let firebaseAppModulePromise: Promise<typeof import('firebase/app')> | null = null;
let firebaseAuthModulePromise: Promise<typeof import('firebase/auth')> | null = null;
let firebaseFirestoreModulePromise: Promise<typeof import('firebase/firestore')> | null = null;
let firebaseAppInitializationPromise: Promise<FirebaseApp | null> | null = null;
let firebaseAuthInitializationPromise: Promise<Auth | null> | null = null;
let firebaseFirestoreInitializationPromise: Promise<Firestore | null> | null = null;

function assertFirebaseConfigured(): asserts firebaseEnvConfig is FirebaseEnvConfig {
  if (!firebaseEnvConfig) {
    throw new Error(
      'Firebase ist nicht konfiguriert. Setze alle VITE_FIREBASE_* Variablen in deiner .env.local.',
    );
  }
}

export function assertFirebaseWritesEnabled(feature = 'Firebase-Schreibzugriffe') {
  if (firebaseWritesEnabled) {
    return;
  }

  throw new Error(
    `${feature} sind in diesem Build gesperrt. Setze VITE_ENABLE_FIREBASE_WRITES=true nur fuer freigegebene Builds.`,
  );
}

function loadFirebaseAppModule() {
  if (!firebaseAppModulePromise) {
    firebaseAppModulePromise = import('firebase/app');
  }

  return firebaseAppModulePromise;
}

function loadFirebaseAuthModule() {
  if (!firebaseAuthModulePromise) {
    firebaseAuthModulePromise = import('firebase/auth');
  }

  return firebaseAuthModulePromise;
}

function loadFirebaseFirestoreModule() {
  if (!firebaseFirestoreModulePromise) {
    firebaseFirestoreModulePromise = import('firebase/firestore');
  }

  return firebaseFirestoreModulePromise;
}

export const getFirebaseApp = (): FirebaseApp | null => firebaseApp;

export const ensureFirebaseApp = async (): Promise<FirebaseApp | null> => {
  if (!isFirebaseConfigured()) {
    return null;
  }

  if (firebaseApp) {
    return firebaseApp;
  }

  if (!firebaseAppInitializationPromise) {
    firebaseAppInitializationPromise = (async () => {
      assertFirebaseConfigured();
      const { initializeApp } = await loadFirebaseAppModule();
      firebaseApp = initializeApp({
        apiKey: firebaseEnvConfig.VITE_FIREBASE_API_KEY,
        authDomain: firebaseEnvConfig.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: firebaseEnvConfig.VITE_FIREBASE_PROJECT_ID,
        storageBucket: firebaseEnvConfig.VITE_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: firebaseEnvConfig.VITE_FIREBASE_MESSAGING_SENDER_ID,
        appId: firebaseEnvConfig.VITE_FIREBASE_APP_ID,
      });
      return firebaseApp;
    })().catch((error) => {
      firebaseAppInitializationPromise = null;
      throw error;
    });
  }

  return firebaseAppInitializationPromise;
};

export const getFirebaseAuth = (): Auth | null => firebaseAuth;

export const ensureFirebaseAuth = async (): Promise<Auth | null> => {
  if (firebaseAuth) {
    return firebaseAuth;
  }

  if (!firebaseAuthInitializationPromise) {
    firebaseAuthInitializationPromise = (async () => {
      const app = await ensureFirebaseApp();
      if (!app) {
        return null;
      }

      const { getAuth } = await loadFirebaseAuthModule();
      firebaseAuth = getAuth(app);
      return firebaseAuth;
    })().catch((error) => {
      firebaseAuthInitializationPromise = null;
      throw error;
    });
  }

  return firebaseAuthInitializationPromise;
};

export const getFirebaseFirestore = (): Firestore | null => firebaseFirestore;

export const ensureFirebaseFirestore = async (): Promise<Firestore | null> => {
  if (firebaseFirestore) {
    return firebaseFirestore;
  }

  if (!firebaseFirestoreInitializationPromise) {
    firebaseFirestoreInitializationPromise = (async () => {
      const app = await ensureFirebaseApp();
      if (!app) {
        return null;
      }

      const { initializeFirestore, memoryLocalCache, persistentLocalCache } = await loadFirebaseFirestoreModule();
      firebaseFirestore = initializeFirestore(app, {
        localCache:
          typeof indexedDB !== 'undefined'
            ? persistentLocalCache({})
            : memoryLocalCache(),
      });
      return firebaseFirestore;
    })().catch((error) => {
      firebaseFirestoreInitializationPromise = null;
      throw error;
    });
  }

  return firebaseFirestoreInitializationPromise;
};

export const getFunctionsBaseUrl = (): string => {
  if (!firebaseEnvConfig) return '';
  return `https://us-central1-${firebaseEnvConfig.VITE_FIREBASE_PROJECT_ID}.cloudfunctions.net`;
};

export const FUNCTIONS_BASE_URL = getFunctionsBaseUrl();
