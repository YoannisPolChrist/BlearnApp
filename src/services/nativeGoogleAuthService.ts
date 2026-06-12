import type { Auth, UserCredential } from 'firebase/auth';
import { getFirebaseGoogleWebClientId } from '@/lib/firebase';
import type { GoogleLoginResponse } from '@capgo/capacitor-social-login';

let nativeGoogleInitialization: Promise<void> | null = null;

async function getSocialLoginModule() {
  return import('@capgo/capacitor-social-login');
}

async function getFirebaseAuthSdk() {
  return import('firebase/auth');
}

function getIdTokenFromResult(result: GoogleLoginResponse): string | null {
  if ('responseType' in result && result.responseType === 'offline') {
    return null;
  }

  return result.idToken;
}

async function ensureNativeGoogleInitialized() {
  if (!nativeGoogleInitialization) {
    const webClientId = getFirebaseGoogleWebClientId();
    if (!webClientId) {
      throw new Error(
        'Google-Login ist noch nicht konfiguriert. Setze VITE_FIREBASE_GOOGLE_WEB_CLIENT_ID in deiner .env.local.',
      );
    }

    nativeGoogleInitialization = getSocialLoginModule()
      .then(({ SocialLogin }) =>
        SocialLogin.initialize({
          google: {
            webClientId,
            mode: 'online',
          },
        }),
      )
      .catch((error) => {
        nativeGoogleInitialization = null;
        throw error;
      });
  }

  await nativeGoogleInitialization;
}

export async function signInWithNativeGoogle(auth: Auth): Promise<UserCredential> {
  await ensureNativeGoogleInitialized();
  const { GoogleAuthProvider, signInWithCredential } = await getFirebaseAuthSdk();
  const { SocialLogin } = await getSocialLoginModule();
  const response = await SocialLogin.login({
    provider: 'google',
    options: {
      scopes: ['email', 'profile'],
    },
  });
  const idToken = getIdTokenFromResult(response.result);

  if (!idToken) {
    throw new Error('Google-Login hat kein ID-Token geliefert.');
  }

  return signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
}

export async function signOutNativeGoogle(): Promise<void> {
  if (!nativeGoogleInitialization) {
    return;
  }

  const { SocialLogin } = await getSocialLoginModule();
  await SocialLogin.logout({ provider: 'google' });
}
