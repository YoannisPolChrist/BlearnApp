import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AuthDialog } from '@/components/setup/AuthDialog';
import { resetAuthStoreForTests, useAuthStore } from '@/store/useAuthStore';
import * as firebaseModule from '@/lib/firebase';
import * as platformModule from '@/lib/platform';

vi.mock('@/components/setup/appTourContext', () => ({
  useAppTour: () => ({
    isOpen: false,
  }),
}));

(globalThis as any).mockIsNativePlatform = false;
vi.mock('@/lib/platform', () => ({
  get isNativePlatform() {
    return (globalThis as any).mockIsNativePlatform ?? false;
  },
}));

vi.mock('@/lib/firebase', async () => {
  const actual = await vi.importActual<typeof import('@/lib/firebase')>('@/lib/firebase');
  return {
    ...actual,
    getFirebaseGoogleWebClientId: vi.fn(),
    isFirebaseConfigured: vi.fn().mockReturnValue(true),
  };
});

describe('AuthDialog', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    resetAuthStoreForTests();
    vi.clearAllMocks();
    (globalThis as any).mockIsNativePlatform = false;
    vi.mocked(firebaseModule.getFirebaseGoogleWebClientId).mockReturnValue('web-client-id');

    useAuthStore.setState({
      status: 'unauthenticated',
      authReady: true,
      authDialogOpen: true,
      onboardingRequired: false,
      user: null,
      error: undefined,
      signIn: vi.fn().mockResolvedValue(undefined),
      signUp: vi.fn().mockResolvedValue(undefined),
      signInWithGoogle: vi.fn().mockResolvedValue(undefined),
      resetPassword: vi.fn().mockResolvedValue(true),
      hideAuthDialog: vi.fn(),
      dismissOnboarding: vi.fn(),
      showAuthDialog: vi.fn(),
      clearError: vi.fn(),
    });
  });

  it('shows the Firebase warning automatically on passive onboarding when auth is disabled', () => {
    useAuthStore.setState({
      status: 'disabled',
      authReady: true,
      authDialogOpen: false,
      onboardingRequired: true,
    });

    render(<AuthDialog />);

    expect(screen.getByText(/Firebase fehlt/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Firebase Console oeffnen/i })).toBeInTheDocument();
  });

  it('renders the Google CTA and email fields in the primary dialog', () => {
    render(<AuthDialog />);

    expect(screen.getByRole('button', { name: /Mit Google fortfahren/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/E-Mail/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Passwort$/i)).toBeInTheDocument();
  });

  it('submits sign-up through the dialog form', async () => {
    const signUpMock = vi.fn().mockResolvedValue(undefined);
    useAuthStore.setState({ signUp: signUpMock });

    render(<AuthDialog />);

    fireEvent.click(screen.getByRole('button', { name: /Konto erstellen/i }));
    fireEvent.change(screen.getByLabelText(/E-Mail/i), {
      target: { value: 'blearn@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/^Passwort$/i), {
      target: { value: 'Secure123!' },
    });
    fireEvent.change(screen.getByLabelText(/Passwort best/i), {
      target: { value: 'Secure123!' },
    });

    fireEvent.click(screen.getAllByRole('button', { name: /^Konto erstellen$/i })[1]);

    await waitFor(() => {
      expect(signUpMock).toHaveBeenCalledWith('blearn@example.com', 'Secure123!');
    });
  });

  it('disables the native Google CTA when the web client id is missing', () => {
    (globalThis as any).mockIsNativePlatform = true;
    vi.stubEnv('VITE_ENABLE_NATIVE_GOOGLE_LOGIN', '');
    vi.mocked(firebaseModule.getFirebaseGoogleWebClientId).mockReturnValue('');
    resetAuthStoreForTests();
    useAuthStore.setState({
      status: 'unauthenticated',
      authReady: true,
      authDialogOpen: true,
      onboardingRequired: false,
      user: null,
      error: undefined,
      signIn: vi.fn().mockResolvedValue(undefined),
      signUp: vi.fn().mockResolvedValue(undefined),
      signInWithGoogle: vi.fn().mockResolvedValue(undefined),
      resetPassword: vi.fn().mockResolvedValue(true),
      hideAuthDialog: vi.fn(),
      dismissOnboarding: vi.fn(),
      showAuthDialog: vi.fn(),
      clearError: vi.fn(),
    });

    render(<AuthDialog />);

    expect(screen.getByRole('button', { name: /Google Login offline/i })).toBeDisabled();
    expect(screen.getAllByText(/Google ist auf Android aus. Nutze E-Mail./i).length).toBeGreaterThan(0);
  });
});
