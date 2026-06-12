import { create } from 'zustand';
import {
  type Auth,
  type User,
  type UserCredential,
} from 'firebase/auth';
import {
  ensureFirebaseAuth,
  getFirebaseGoogleWebClientId,
  isFirebaseConfigured,
  isFirebaseWriteEnabled,
} from '@/lib/firebase';
import { isNativePlatform } from '@/lib/platform';

const AUTH_PROMPT_STORAGE_KEY = 'blearn-auth-onboarding-dismissed';

type AuthStatus = 'idle' | 'checking' | 'authenticated' | 'unauthenticated' | 'disabled';

export interface AuthUser {
  uid: string;
  email?: string;
}

export interface AuthCapabilities {
  firebaseConfigured: boolean;
  firebaseWritesEnabled: boolean;
  authAvailable: boolean;
  nativeGoogleConfigured: boolean;
  nativeGoogleReason?: string;
}

interface AuthState {
  status: AuthStatus;
  authReady: boolean;
  user: AuthUser | null;
  capabilities: AuthCapabilities;
  error?: string;
  onboardingRequired: boolean;
  authDialogOpen: boolean;
  initialize: () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  resetPassword: (email: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  showAuthDialog: () => void;
  hideAuthDialog: () => void;
  dismissOnboarding: () => void;
  clearError: () => void;
}

const initialState: Pick<AuthState, 'status' | 'authReady' | 'user' | 'error' | 'onboardingRequired' | 'authDialogOpen'> = {
  status: 'idle',
  authReady: false,
  user: null,
  error: undefined,
  onboardingRequired: false,
  authDialogOpen: false,
};

function isNativeGoogleLoginExplicitlyEnabled(): boolean {
  return ((import.meta.env as Record<string, string | undefined>).VITE_ENABLE_NATIVE_GOOGLE_LOGIN || '')
    .trim()
    .toLowerCase() === 'true';
}

function getAuthCapabilities(): AuthCapabilities {
  const firebaseConfigured = isFirebaseConfigured();
  const firebaseWritesEnabled = isFirebaseWriteEnabled();
  const googleWebClientIdConfigured = Boolean(getFirebaseGoogleWebClientId());
  const nativeGoogleEnabled = !isNativePlatform || isNativeGoogleLoginExplicitlyEnabled();
  const nativeGoogleDisabledReason = !nativeGoogleEnabled
    ? 'Google ist auf Android aus. Nutze E-Mail.'
    : !googleWebClientIdConfigured
      ? 'Google-Login ist auf Android noch nicht fertig.'
      : undefined;

  return {
    firebaseConfigured,
    firebaseWritesEnabled,
    authAvailable: firebaseConfigured,
    nativeGoogleConfigured: !isNativePlatform || (nativeGoogleEnabled && googleWebClientIdConfigured),
    nativeGoogleReason: isNativePlatform ? nativeGoogleDisabledReason : undefined,
  };
}

function hasDismissedOnboarding(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(AUTH_PROMPT_STORAGE_KEY) === 'true';
}

function persistOnboardingDismissed() {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(AUTH_PROMPT_STORAGE_KEY, 'true');
}

let unsubscribeAuthListener: (() => void) | null = null;

function loadFirebaseAuthSdk() {
  return import('firebase/auth');
}

function extractErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '';
}

function isNativeGoogleDeveloperError(error: unknown): boolean {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = String(error.code).toLowerCase();
    if (code === '10' || code === 'developer_error' || code === 'google/developer-error') {
      return true;
    }
  }

  const message = extractErrorMessage(error).toLowerCase();
  return (
    message.includes('28444')
    || message.includes('developer_error')
    || message.includes('unknown calling package')
    || message.includes('statuscode=developer_error')
  );
}

function mapAuthError(error: unknown): string {
  if (isNativeGoogleDeveloperError(error)) {
    return 'Google-Login ist auf Android noch nicht korrekt eingerichtet. In Firebase oder Google Cloud fehlt sehr wahrscheinlich der Android-OAuth-Client oder die passende SHA-1/SHA-256 fuer app.blearn.mobile.';
  }

  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = String(error.code);

    switch (code) {
      case 'auth/popup-closed-by-user':
        return 'Google-Anmeldung wurde geschlossen.';
      case 'auth/popup-blocked':
        return 'Der Browser hat das Google-Popup blockiert. Wir versuchen es per Weiterleitung.';
      case 'auth/unauthorized-domain':
        return 'Diese Domain ist fuer Google-Login in Firebase noch nicht freigegeben.';
      case 'auth/account-exists-with-different-credential':
        return 'Fuer diese E-Mail existiert bereits ein Konto mit einer anderen Anmeldemethode.';
      case 'auth/operation-not-supported-in-this-environment':
        return 'Google-Login ist hier gerade nicht verfuegbar.';
      case 'auth/network-request-failed':
        return 'Google-Anmeldung konnte das Netzwerk nicht erreichen.';
      case 'auth/operation-not-allowed':
        return 'E-Mail/Passwort oder Passwort-Reset sind in Firebase Authentication fuer dieses Projekt noch nicht aktiviert.';
      case 'auth/email-already-in-use':
        return 'Diese E-Mail-Adresse wird bereits verwendet.';
      case 'auth/invalid-email':
        return 'Bitte gib eine gueltige E-Mail-Adresse ein.';
      case 'auth/weak-password':
        return 'Das Passwort ist zu schwach. Nutze mindestens 8 Zeichen.';
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'E-Mail oder Passwort sind nicht korrekt.';
      case 'auth/too-many-requests':
        return 'Zu viele Versuche. Bitte warte kurz und probiere es erneut.';
      case 'auth/user-disabled':
        return 'Dieses Konto wurde deaktiviert.';
      default:
        break;
    }
  }

  return extractErrorMessage(error) || 'Anmeldung fehlgeschlagen.';
}

function canFallbackToRedirect(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return false;
  }

  const code = String(error.code);
  return code === 'auth/popup-blocked' || code === 'auth/web-storage-unsupported';
}

function buildAuthUser(firebaseUser: User | null): AuthUser | null {
  if (!firebaseUser) {
    return null;
  }

  return {
    uid: firebaseUser.uid,
    email: firebaseUser.email ?? undefined,
  };
}

function buildAuthUserFromCredential(auth: Auth, credential?: UserCredential | null): AuthUser | null {
  return buildAuthUser(credential?.user ?? auth.currentUser);
}

function createGoogleProvider() {
  return loadFirebaseAuthSdk().then(({ GoogleAuthProvider }) => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    return provider;
  });
}

async function signInWithNativeGoogle(auth: Auth) {
  const service = await import('@/services/nativeGoogleAuthService');
  return service.signInWithNativeGoogle(auth);
}

async function signOutNativeGoogle() {
  const service = await import('@/services/nativeGoogleAuthService');
  return service.signOutNativeGoogle();
}

async function resolveRedirectResult(auth: Auth): Promise<string | undefined> {
  try {
    const { getRedirectResult } = await loadFirebaseAuthSdk();
    await getRedirectResult(auth);
    return undefined;
  } catch (error) {
    return mapAuthError(error);
  }
}

async function subscribeToAuthState(auth: Auth, callback: (user: User | null) => void) {
  const { onAuthStateChanged } = await loadFirebaseAuthSdk();
  return onAuthStateChanged(auth, callback);
}

async function signInWithEmail(auth: Auth, email: string, password: string) {
  const { signInWithEmailAndPassword } = await loadFirebaseAuthSdk();
  return signInWithEmailAndPassword(auth, email, password);
}

async function signUpWithEmail(auth: Auth, email: string, password: string) {
  const { createUserWithEmailAndPassword } = await loadFirebaseAuthSdk();
  return createUserWithEmailAndPassword(auth, email, password);
}

async function signInWithGooglePopup(auth: Auth, provider: Awaited<ReturnType<typeof createGoogleProvider>>) {
  const { signInWithPopup } = await loadFirebaseAuthSdk();
  return signInWithPopup(auth, provider);
}

async function signInWithGoogleRedirect(auth: Auth, provider: Awaited<ReturnType<typeof createGoogleProvider>>) {
  const { signInWithRedirect } = await loadFirebaseAuthSdk();
  return signInWithRedirect(auth, provider);
}

async function signOutFirebase(auth: Auth) {
  const { signOut } = await loadFirebaseAuthSdk();
  return signOut(auth);
}

async function sendPasswordReset(auth: Auth, email: string) {
  const { sendPasswordResetEmail } = await loadFirebaseAuthSdk();
  return sendPasswordResetEmail(auth, email);
}

export const useAuthStore = create<AuthState>((set, get) => ({
  ...initialState,
  capabilities: getAuthCapabilities(),
  initialize: () => {
    if (get().status === 'checking') return;
    if (unsubscribeAuthListener) return;

    const capabilities = getAuthCapabilities();

    if (!capabilities.firebaseConfigured) {
      set({
        status: 'disabled',
        authReady: true,
        capabilities,
        onboardingRequired: false,
        authDialogOpen: false,
      });
      return;
    }

    set({ status: 'checking', authReady: false });
    void (async () => {
      const auth = await ensureFirebaseAuth();
      if (!auth) {
        set({
          status: 'disabled',
          authReady: true,
          capabilities: getAuthCapabilities(),
          onboardingRequired: false,
          authDialogOpen: false,
        });
        return;
      }

      let latestFirebaseUser: User | null = auth.currentUser;
      let authStateResolved = false;
      let redirectResolved = false;
      let redirectError: string | undefined = undefined;
      const flushAuthState = () => {
        if (!authStateResolved || !redirectResolved) {
          return;
        }

        set({
          status: latestFirebaseUser ? 'authenticated' : 'unauthenticated',
          authReady: true,
          capabilities: getAuthCapabilities(),
          user: buildAuthUser(latestFirebaseUser),
          onboardingRequired: !latestFirebaseUser && !hasDismissedOnboarding(),
          authDialogOpen: false,
          error: redirectError,
        });
      };

      unsubscribeAuthListener = await subscribeToAuthState(auth, (firebaseUser) => {
        latestFirebaseUser = firebaseUser;
        authStateResolved = true;
        flushAuthState();
      });

      redirectError = await resolveRedirectResult(auth);
      redirectResolved = true;
      flushAuthState();
    })().catch((error) => {
      const message = error instanceof Error ? error.message : 'Authentifizierung konnte nicht initialisiert werden.';
      set({
        status: 'disabled',
        authReady: true,
        capabilities: getAuthCapabilities(),
        onboardingRequired: false,
        authDialogOpen: false,
        error: message,
      });
    });
  },
  signIn: async (email, password) => {
    const capabilities = getAuthCapabilities();
    const auth = await ensureFirebaseAuth();
    if (!auth) {
      set({
        error: capabilities.firebaseConfigured
          ? 'Firebase Auth ist in diesem Build noch nicht bereit.'
          : 'Firebase ist nicht konfiguriert.',
        capabilities,
      });
      return;
    }
    set({ error: undefined, status: 'checking', capabilities });
    try {
      const credential = await signInWithEmail(auth, email, password);
      const nextUser = buildAuthUserFromCredential(auth, credential);
      set({
        authDialogOpen: false,
        onboardingRequired: false,
        capabilities,
        user: nextUser,
        status: nextUser ? 'authenticated' : 'checking',
        error: undefined,
      });
      persistOnboardingDismissed();
    } catch (error) {
      const message = mapAuthError(error);
      set({ error: message, status: 'unauthenticated', capabilities });
    }
  },
  signUp: async (email, password) => {
    const capabilities = getAuthCapabilities();
    const auth = await ensureFirebaseAuth();
    if (!auth) {
      set({
        error: capabilities.firebaseConfigured
          ? 'Firebase Auth ist in diesem Build noch nicht bereit.'
          : 'Firebase ist nicht konfiguriert.',
        capabilities,
      });
      return;
    }
    set({ error: undefined, status: 'checking', capabilities });
    try {
      const credential = await signUpWithEmail(auth, email, password);
      const nextUser = buildAuthUserFromCredential(auth, credential);
      set({
        authDialogOpen: false,
        onboardingRequired: false,
        capabilities,
        user: nextUser,
        status: nextUser ? 'authenticated' : 'checking',
        error: undefined,
      });
      persistOnboardingDismissed();
    } catch (error) {
      const message = mapAuthError(error);
      set({ error: message, status: 'unauthenticated', capabilities });
    }
  },
  signInWithGoogle: async () => {
    const capabilities = getAuthCapabilities();
    const auth = await ensureFirebaseAuth();
    if (!auth) {
      set({ error: 'Firebase ist nicht konfiguriert.', capabilities });
      return;
    }

    if (isNativePlatform && !capabilities.nativeGoogleConfigured) {
      set({
        error: capabilities.nativeGoogleReason,
        status: auth.currentUser ? 'authenticated' : 'unauthenticated',
        capabilities,
      });
      return;
    }

    auth.useDeviceLanguage();
    const provider = await createGoogleProvider();
    set({ error: undefined, status: 'checking', capabilities });

    try {
      if (isNativePlatform) {
        await signInWithNativeGoogle(auth);
        set({
          authDialogOpen: false,
          onboardingRequired: false,
          capabilities,
          user: buildAuthUserFromCredential(auth),
          status: auth.currentUser ? 'authenticated' : 'checking',
          error: undefined,
        });
        persistOnboardingDismissed();
        return;
      }

      const credential = await signInWithGooglePopup(auth, provider);
      set({
        authDialogOpen: false,
        onboardingRequired: false,
        capabilities,
        user: buildAuthUserFromCredential(auth, credential),
        status: auth.currentUser ? 'authenticated' : 'checking',
        error: undefined,
      });
      persistOnboardingDismissed();
    } catch (error) {
      if (!isNativePlatform && canFallbackToRedirect(error)) {
        await signInWithGoogleRedirect(auth, provider);
        return;
      }

      const message = mapAuthError(error);
      set({
        error: message,
        status: auth.currentUser ? 'authenticated' : 'unauthenticated',
        capabilities: getAuthCapabilities(),
      });
    }
  },
  resetPassword: async (email) => {
    const capabilities = getAuthCapabilities();
    const auth = await ensureFirebaseAuth();
    if (!auth) {
      set({
        error: capabilities.firebaseConfigured
          ? 'Firebase Auth ist in diesem Build noch nicht bereit.'
          : 'Firebase ist nicht konfiguriert.',
        capabilities,
      });
      return false;
    }

    set({ error: undefined, status: 'checking', capabilities });

    try {
      await sendPasswordReset(auth, email);
      set({
        capabilities,
        status: auth.currentUser ? 'authenticated' : 'unauthenticated',
      });
      return true;
    } catch (error) {
      const message = mapAuthError(error);
      set({
        error: message,
        status: auth.currentUser ? 'authenticated' : 'unauthenticated',
        capabilities,
      });
      return false;
    }
  },
  signOut: async () => {
    const auth = await ensureFirebaseAuth();
    if (!auth) return;
    try {
      await signOutFirebase(auth);
      if (isNativePlatform) {
        await signOutNativeGoogle().catch(() => undefined);
      }
      set({
        authDialogOpen: false,
        onboardingRequired: false,
        capabilities: getAuthCapabilities(),
        user: null,
        status: 'unauthenticated',
        error: undefined,
      });
      persistOnboardingDismissed();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Abmelden fehlgeschlagen.';
      set({ error: message, capabilities: getAuthCapabilities() });
    }
  },
  showAuthDialog: () => {
    set({ authDialogOpen: true });
  },
  hideAuthDialog: () => {
    set({ authDialogOpen: false });
  },
  dismissOnboarding: () => {
    persistOnboardingDismissed();
    set({ onboardingRequired: false, authDialogOpen: false });
  },
  clearError: () => set({ error: undefined }),
}));

export function resetAuthStoreForTests() {
  unsubscribeAuthListener?.();
  unsubscribeAuthListener = null;
  useAuthStore.setState({ ...initialState, capabilities: getAuthCapabilities() });
}
