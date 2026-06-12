import type { CloudSyncRuntimeEntry } from '@/lib/cloudSyncRuntime';
import type { AuthCapabilities, AuthUser } from '@/store/useAuthStore';

type AuthStatus = 'idle' | 'checking' | 'authenticated' | 'unauthenticated' | 'disabled';

interface AccountCloudViewModelOptions {
  authCapabilities: AuthCapabilities;
  authReady: boolean;
  authStatus: AuthStatus;
  authUser: AuthUser | null;
  canSync: boolean;
  isGerman: boolean;
  isNative: boolean;
  learningSyncRuntime: CloudSyncRuntimeEntry;
  progressSyncRuntime: CloudSyncRuntimeEntry;
  syncCapabilityReason: string | null;
}

export function getAccountCloudViewModel({
  authCapabilities,
  authReady,
  authStatus,
  authUser,
  canSync,
  isGerman,
  isNative,
  learningSyncRuntime,
  progressSyncRuntime,
  syncCapabilityReason,
}: AccountCloudViewModelOptions) {
  const authDisabled = authStatus === 'disabled';
  const authInitializing = !authDisabled && !authUser && authStatus === 'checking' && !authReady;
  const nativeGooglePaused = isNative && !authCapabilities.nativeGoogleConfigured;
  const learningSyncReady = learningSyncRuntime.status === 'ready';
  const progressSyncReady = progressSyncRuntime.status === 'ready';
  const syncRuntimeStarting = learningSyncRuntime.status === 'starting' || progressSyncRuntime.status === 'starting';
  const runtimeSyncError = learningSyncRuntime.currentError || progressSyncRuntime.currentError;
  const syncAvailable = Boolean(authUser) && canSync && learningSyncReady && progressSyncReady;
  const syncBlocked = Boolean(authUser) && !syncAvailable;
  const authBadgeLabel = authUser
    ? (syncAvailable
      ? (isGerman ? 'Sync aktiv' : 'Sync active')
      : syncRuntimeStarting
        ? (isGerman ? 'Sync startet' : 'Sync starting')
        : (isGerman ? 'Sync blockiert' : 'Sync blocked'))
    : authInitializing
      ? (isGerman ? 'Wird vorbereitet' : 'Preparing')
    : authDisabled
      ? (isGerman ? 'Setup noetig' : 'Setup needed')
      : nativeGooglePaused
        ? (isGerman ? 'E-Mail aktiv' : 'Email only')
      : (isGerman ? 'Bereit' : 'Ready');
  const authCardTitle = authUser
    ? (syncAvailable
      ? (isGerman ? 'Konto & Sync sind aktiv' : 'Account and sync are active')
      : syncRuntimeStarting
        ? (isGerman ? 'Konto verbunden, Sync wird vorbereitet' : 'Account connected, sync is starting')
        : (isGerman ? 'Konto verbunden, Sync blockiert' : 'Account connected, sync blocked'))
    : authInitializing
      ? (isGerman ? 'Login wird vorbereitet' : 'Login is preparing')
    : authDisabled
      ? (isGerman ? 'Konto-Setup fehlt' : 'Account setup missing')
    : nativeGooglePaused
        ? (isGerman ? 'Mit E-Mail anmelden' : 'Sign in with email')
      : (isGerman ? 'Lernfortschritt sichern' : 'Keep learning progress safe');
  const authCardDescription = authUser
    ? (syncAvailable
      ? (isGerman
        ? 'Dein Lernstand wird jetzt synchron gehalten.'
        : 'Firebase, writes, auth and both runtime syncs are ready. Learning data and app progress can now stay in sync across your devices.')
      : (runtimeSyncError
        ?? (syncRuntimeStarting
          ? (isGerman
            ? 'Konto verbunden. Sync startet noch.'
            : 'Your account is connected. Learning and progress sync are still initializing.')
          : syncCapabilityReason)
        ?? (isGerman
          ? 'Konto verbunden, aber Sync ist gerade blockiert.'
          : 'Your account is connected, but this build cannot complete full cloud sync right now.')))
    : authInitializing
      ? (isGerman
        ? 'E-Mail-Login wird vorbereitet.'
        : 'Blearn is initializing Firebase and the login flow. Email sign-in, Google login, and sign-up will be ready right after that.')
    : authDisabled
      ? (isGerman
        ? 'Konto und Sync sind in diesem Build noch nicht bereit.'
        : 'Google sign-in, account creation and cloud sync only appear here once Firebase is correctly connected.')
      : nativeGooglePaused
        ? (isGerman
          ? 'Bitte nutze auf Android gerade E-Mail und Passwort.'
          : 'On Android, Google sign-in stays currently paused. Email login, reset, and sign-up stay available.')
      : (isGerman
        ? 'Melde dich an und sichere deinen Lernstand.'
        : 'Link and secure your learning progress.');
  const authPrimaryActionLabel = authDisabled
    ? (isGerman ? 'Setup ansehen' : 'View setup')
    : authInitializing
      ? (isGerman ? 'Login oeffnen' : 'Open login')
      : nativeGooglePaused
        ? (isGerman ? 'Mit E-Mail anmelden' : 'Sign in with email')
      : (isGerman ? 'Anmelden' : 'Sign in');
  const showAuthMetaRow = authUser || authInitializing || authDisabled || nativeGooglePaused;

  return {
    authBadgeLabel,
    authCardDescription,
    authCardTitle,
    authDisabled,
    authInitializing,
    authPrimaryActionLabel,
    nativeGooglePaused,
    runtimeSyncError,
    showAuthMetaRow,
    syncAvailable,
    syncBlocked,
    syncRuntimeStarting,
  };
}
