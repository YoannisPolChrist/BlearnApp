import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore, resetAuthStoreForTests } from './useAuthStore';

vi.mock('@/lib/firebase', () => ({
  isFirebaseConfigured: vi.fn(),
  isFirebaseWriteEnabled: vi.fn(() => true),
  getFirebaseGoogleWebClientId: vi.fn(() => 'web-client-id'),
  ensureFirebaseAuth: vi.fn(),
}));

vi.mock('@/lib/platform', () => ({
  isNativePlatform: false,
}));

vi.mock('@/services/nativeGoogleAuthService', () => ({
  signInWithNativeGoogle: vi.fn(),
  signOutNativeGoogle: vi.fn(),
}));

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn(),
  getRedirectResult: vi.fn(),
  GoogleAuthProvider: vi.fn().mockImplementation(() => ({
    setCustomParameters: vi.fn(),
  })),
  signInWithPopup: vi.fn(),
  signInWithRedirect: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  signOut: vi.fn(),
}));

import { ensureFirebaseAuth, getFirebaseGoogleWebClientId, isFirebaseConfigured } from '@/lib/firebase';
import {
  createUserWithEmailAndPassword,
  getRedirectResult,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from 'firebase/auth';
import * as platformModule from '@/lib/platform';
import { signInWithNativeGoogle } from '@/services/nativeGoogleAuthService';

describe('useAuthStore', () => {
  let authStateCallback: ((user: { uid: string; email?: string } | null) => void) | null = null;

  beforeEach(() => {
    resetAuthStoreForTests();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv('VITE_ENABLE_NATIVE_GOOGLE_LOGIN', '');
    vi.spyOn(window.localStorage, 'getItem').mockReturnValue(null);
    (platformModule as { isNativePlatform: boolean }).isNativePlatform = false;
    vi.mocked(getFirebaseGoogleWebClientId).mockReturnValue('web-client-id');
    vi.mocked(getRedirectResult).mockResolvedValue(null);
    vi.mocked(onAuthStateChanged).mockImplementation((_auth, callback) => {
      authStateCallback = callback;
      callback(null);
      return vi.fn();
    });
  });

  it('sets disabled state when Firebase config missing', () => {
    vi.mocked(isFirebaseConfigured).mockReturnValue(false);
    useAuthStore.getState().initialize();
    const state = useAuthStore.getState();
    expect(state.status).toBe('disabled');
    expect(state.authReady).toBe(true);
  });

  it('opens auth dialog when explicitly requested', () => {
    vi.mocked(isFirebaseConfigured).mockReturnValue(false);
    useAuthStore.getState().showAuthDialog();
    expect(useAuthStore.getState().authDialogOpen).toBe(true);
  });

  it('uses Google popup sign-in on web', async () => {
    const auth = {
      currentUser: null,
      useDeviceLanguage: vi.fn(),
    };

    vi.mocked(isFirebaseConfigured).mockReturnValue(true);
    vi.mocked(ensureFirebaseAuth).mockResolvedValue(auth as never);
    vi.mocked(signInWithPopup).mockResolvedValue({} as never);

    await useAuthStore.getState().signInWithGoogle();

    expect(auth.useDeviceLanguage).toHaveBeenCalled();
    expect(signInWithPopup).toHaveBeenCalledTimes(1);
    expect(signInWithRedirect).not.toHaveBeenCalled();
  });

  it('marks the store authenticated after Google popup sign-in succeeds', async () => {
    const auth = {
      currentUser: null,
      useDeviceLanguage: vi.fn(),
    };

    vi.mocked(isFirebaseConfigured).mockReturnValue(true);
    vi.mocked(ensureFirebaseAuth).mockResolvedValue(auth as never);
    vi.mocked(signInWithPopup).mockImplementation(async (_auth, _provider) => {
      const user = { uid: 'user-google', email: 'google@example.com' } as never;
      auth.currentUser = user;
      authStateCallback?.(user);
      return { user } as never;
    });

    await useAuthStore.getState().signInWithGoogle();

    expect(signInWithPopup).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().status).toBe('authenticated');
    expect(useAuthStore.getState().user?.email).toBe('google@example.com');
    expect(useAuthStore.getState().authDialogOpen).toBe(false);
  });

  it('marks the store authenticated immediately after email sign-in succeeds', async () => {
    const auth = {
      currentUser: null,
      useDeviceLanguage: vi.fn(),
    };

    vi.mocked(isFirebaseConfigured).mockReturnValue(true);
    vi.mocked(ensureFirebaseAuth).mockResolvedValue(auth as never);
    vi.mocked(signInWithEmailAndPassword).mockImplementation(async (_auth, email) => {
      const user = { uid: 'user-login', email } as never;
      auth.currentUser = user;
      authStateCallback?.(user);
      return { user } as never;
    });

    await useAuthStore.getState().signIn('blearn@example.com', 'Secure123!');

    expect(signInWithEmailAndPassword).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().status).toBe('authenticated');
    expect(useAuthStore.getState().user?.email).toBe('blearn@example.com');
    expect(useAuthStore.getState().authDialogOpen).toBe(false);
  });

  it('marks the store authenticated immediately after email sign-up succeeds', async () => {
    const auth = {
      currentUser: null,
      useDeviceLanguage: vi.fn(),
    };

    vi.mocked(isFirebaseConfigured).mockReturnValue(true);
    vi.mocked(ensureFirebaseAuth).mockResolvedValue(auth as never);
    vi.mocked(createUserWithEmailAndPassword).mockImplementation(async (_auth, email) => {
      const user = { uid: 'user-signup', email } as never;
      auth.currentUser = user;
      authStateCallback?.(user);
      return { user } as never;
    });

    await useAuthStore.getState().signUp('blearn@example.com', 'Secure123!');

    expect(createUserWithEmailAndPassword).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().status).toBe('authenticated');
    expect(useAuthStore.getState().user?.email).toBe('blearn@example.com');
    expect(useAuthStore.getState().authDialogOpen).toBe(false);
  });

  it('clears the store user immediately after sign-out', async () => {
    const auth = {
      currentUser: {
        uid: 'user-logout',
        email: 'logout@example.com',
      },
      useDeviceLanguage: vi.fn(),
    };

    vi.mocked(isFirebaseConfigured).mockReturnValue(true);
    vi.mocked(ensureFirebaseAuth).mockResolvedValue(auth as never);
    vi.mocked(signOut).mockResolvedValue(undefined);

    useAuthStore.setState({
      status: 'authenticated',
      authReady: true,
      user: {
        uid: 'user-logout',
        email: 'logout@example.com',
      },
    });

    await useAuthStore.getState().signOut();

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().status).toBe('unauthenticated');
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().authDialogOpen).toBe(false);
  });

  it('falls back to redirect when popup is blocked on web', async () => {
    const auth = {
      currentUser: null,
      useDeviceLanguage: vi.fn(),
    };

    vi.mocked(isFirebaseConfigured).mockReturnValue(true);
    vi.mocked(ensureFirebaseAuth).mockResolvedValue(auth as never);
    vi.mocked(signInWithPopup).mockRejectedValue({ code: 'auth/popup-blocked' });
    vi.mocked(signInWithRedirect).mockResolvedValue(undefined);

    await useAuthStore.getState().signInWithGoogle();

    expect(signInWithPopup).toHaveBeenCalledTimes(1);
    expect(signInWithRedirect).toHaveBeenCalledTimes(1);
  });

  it('enables native Google sign-in on Android when the Web Client ID is configured', async () => {
    const auth = {
      currentUser: null,
      useDeviceLanguage: vi.fn(),
    };

    (platformModule as { isNativePlatform: boolean }).isNativePlatform = true;
    vi.stubEnv('VITE_ENABLE_NATIVE_GOOGLE_LOGIN', 'true');
    vi.mocked(isFirebaseConfigured).mockReturnValue(true);
    vi.mocked(getFirebaseGoogleWebClientId).mockReturnValue('web-client-id');
    vi.mocked(ensureFirebaseAuth).mockResolvedValue(auth as never);
    vi.mocked(signInWithNativeGoogle).mockResolvedValue(undefined as never);

    await useAuthStore.getState().signInWithGoogle();

    expect(signInWithNativeGoogle).toHaveBeenCalledTimes(1);
    expect(signInWithPopup).not.toHaveBeenCalled();
    expect(signInWithRedirect).not.toHaveBeenCalled();
  });

  it('exposes native Google capability diagnostics for Android builds', () => {
    (platformModule as { isNativePlatform: boolean }).isNativePlatform = true;
    vi.mocked(isFirebaseConfigured).mockReturnValue(true);
    vi.mocked(getFirebaseGoogleWebClientId).mockReturnValue('web-client-id');

    resetAuthStoreForTests();

    expect(useAuthStore.getState().capabilities.authAvailable).toBe(true);
    expect(useAuthStore.getState().capabilities.nativeGoogleConfigured).toBe(false);
    expect(useAuthStore.getState().capabilities.nativeGoogleReason).toMatch(/nutze e-mail/i);
  });

  it('still falls back to redirect when a web popup is blocked', async () => {
    const auth = {
      currentUser: null,
      useDeviceLanguage: vi.fn(),
    };

    vi.mocked(isFirebaseConfigured).mockReturnValue(true);
    vi.mocked(ensureFirebaseAuth).mockResolvedValue(auth as never);
    (platformModule as { isNativePlatform: boolean }).isNativePlatform = false;
    vi.mocked(signInWithPopup).mockRejectedValue({ code: 'auth/popup-blocked' });
    vi.mocked(signInWithRedirect).mockResolvedValue(undefined);

    await useAuthStore.getState().signInWithGoogle();

    expect(signInWithPopup).toHaveBeenCalledTimes(1);
    expect(signInWithRedirect).toHaveBeenCalledTimes(1);
  });

  it('sends a password reset email for email accounts', async () => {
    const auth = {
      currentUser: null,
      useDeviceLanguage: vi.fn(),
    };

    vi.mocked(isFirebaseConfigured).mockReturnValue(true);
    vi.mocked(ensureFirebaseAuth).mockResolvedValue(auth as never);
    vi.mocked(sendPasswordResetEmail).mockResolvedValue(undefined);

    const result = await useAuthStore.getState().resetPassword('ich@beispiel.de');

    expect(result).toBe(true);
    expect(sendPasswordResetEmail).toHaveBeenCalledTimes(1);
    expect(sendPasswordResetEmail).toHaveBeenCalledWith(auth, 'ich@beispiel.de');
  });
});
