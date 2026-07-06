import type { Firestore } from 'firebase/firestore';
import {
  ensureFirebaseFirestore,
  getFirebaseFirestore,
} from '@/lib/firebase';

export type FirestoreSdk = typeof import('firebase/firestore');

let firestoreSdkPromise: Promise<FirestoreSdk> | null = null;

/**
 * Gemeinsamer Firestore-Transport fuer alle Sync-Services (learning, progress,
 * hermes). Vorher existierten drei identische Kopien dieser Helfer — mit dem
 * Risiko divergierender Fixes.
 */
export function loadFirestoreSdk(): Promise<FirestoreSdk> {
  if (!firestoreSdkPromise) {
    firestoreSdkPromise = import('firebase/firestore');
  }

  return firestoreSdkPromise;
}

export function assertFirestore(): Firestore {
  const firestore = getFirebaseFirestore();
  if (!firestore) {
    throw new Error('Firestore ist nicht konfiguriert. Setze alle VITE_FIREBASE_* Variablen.');
  }

  return firestore;
}

export async function ensureFirestore(): Promise<Firestore> {
  const firestore = await ensureFirebaseFirestore();
  if (!firestore) {
    throw new Error('Firestore ist nicht konfiguriert. Setze alle VITE_FIREBASE_* Variablen.');
  }

  return firestore;
}
