import { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Cloud,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  Mail,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/useAuthStore';
import { cn } from '@/lib/utils';
import { isNativePlatform } from '@/lib/platform';
import { useAppTour } from '@/components/setup/appTourContext';
import { AuthDialogHero } from './auth/AuthDialogHero';
import { AuthDialogDisabledView } from './auth/AuthDialogDisabledView';
import { PasswordStrengthMeter } from './auth/PasswordStrengthMeter';
import { PASSWORD_MIN_LENGTH } from '@/lib/password';

const AUTH_PROMPT_STORAGE_KEY = 'blearn-auth-onboarding-dismissed';
const EMAIL_PLACEHOLDER = 'ich@beispiel.de';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface AuthDialogProps {
  suppressPassiveOnboarding?: boolean;
}

function isValidEmail(value: string) {
  return EMAIL_PATTERN.test(value.trim());
}

function persistOnboardingDismissed() {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(AUTH_PROMPT_STORAGE_KEY, 'true');
}

function getErrorMessage(error: string) {
  const lowerDesc = error.toLowerCase();
  if (lowerDesc.includes('too-many-requests') || lowerDesc.includes('too many requests')) {
    return 'Zu viele Versuche – warte kurz oder setze dein Passwort zurück.';
  }
  return error;
}

export function AuthDialog({ suppressPassiveOnboarding = false }: AuthDialogProps) {
  const {
    status,
    authReady,
    authDialogOpen,
    onboardingRequired,
    user,
    capabilities,
    error,
    signIn,
    signUp,
    signInWithGoogle,
    resetPassword,
    hideAuthDialog,
    dismissOnboarding,
    showAuthDialog,
    clearError,
  } = useAuthStore();
  
  const { isOpen: isTourOpen } = useAppTour();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formNotice, setFormNotice] = useState<string | null>(null);
  
  const passiveOnboardingOpen = onboardingRequired && !suppressPassiveOnboarding;
  const googleSignInAvailable = !isNativePlatform || capabilities.nativeGoogleConfigured;
  const firebaseMissing = !capabilities.firebaseConfigured || status === 'disabled';
  const authFlowAvailable = capabilities.firebaseConfigured && capabilities.authAvailable;
  const androidGoogleMisconfigured = isNativePlatform && capabilities.firebaseConfigured && !capabilities.nativeGoogleConfigured;
  
  const googleSignInDisabledReason = capabilities.nativeGoogleReason
    || 'Google-Login ist auf diesem Android-Build temporaer deaktiviert.';
    
  const open = (authDialogOpen || passiveOnboardingOpen) && !user && !isTourOpen;
  const isBusy = status === 'checking';
  const authInitializing = !authReady && status === 'checking';

  useEffect(() => {
    if (error) {
      setFormNotice(null);
      setFormError(getErrorMessage(error));
    } else {
      setFormError(null);
    }
  }, [error]);

  useEffect(() => {
    if (!open) {
      return;
    }
    setMode(passiveOnboardingOpen && !authDialogOpen ? 'signup' : 'login');
  }, [authDialogOpen, open, passiveOnboardingOpen]);

  const emailIsFilled = email.trim().length > 0;
  const confirmPasswordMatches = confirmPassword.length > 0 && password === confirmPassword;
  const modeMeta = mode === 'login'
    ? {
        eyebrow: 'Sicher anmelden',
        title: 'Willkommen zurück',
        description: isNativePlatform
          ? 'Mit E-Mail anmelden.'
          : 'Mit deinem Konto anmelden.',
        primaryLabel: 'Anmelden',
        primaryBusyLabel: 'Anmeldung läuft...',
      }
    : {
        eyebrow: 'Eigenes Konto erstellen',
        title: 'Konto erstellen',
        description: 'Schnell startklar.',
        primaryLabel: 'Konto erstellen',
        primaryBusyLabel: 'Konto wird erstellt...',
      };

  const resetLocalState = () => {
    setMode('login');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setFormError(null);
    setFormNotice(null);
    clearError();
  };

  const resetAndClose = () => {
    resetLocalState();
    hideAuthDialog();
    if (!user && onboardingRequired) {
      dismissOnboarding();
    }
  };

  const switchMode = (nextMode: 'login' | 'signup') => {
    setMode(nextMode);
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setFormError(null);
    setFormNotice(null);
    clearError();
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedEmail = email.trim();

    if (!trimmedEmail || !password) {
      setFormNotice(null);
      setFormError('E-Mail und Passwort dürfen nicht leer sein.');
      return;
    }

    if (!isValidEmail(trimmedEmail)) {
      setFormNotice(null);
      setFormError('Bitte gib eine gültige E-Mail-Adresse ein.');
      return;
    }

    if (mode === 'signup') {
      if (password.length < PASSWORD_MIN_LENGTH) {
        setFormNotice(null);
        setFormError(`Dein Passwort braucht mindestens ${PASSWORD_MIN_LENGTH} Zeichen.`);
        return;
      }

      if (!confirmPassword) {
        setFormNotice(null);
        setFormError('Bitte bestätige dein Passwort.');
        return;
      }

      if (password !== confirmPassword) {
        setFormNotice(null);
        setFormError('Die Passwörter stimmen nicht überein.');
        return;
      }
    }

    clearError();
    setFormNotice(null);
    setFormError(null);

    if (mode === 'login') {
      await signIn(trimmedEmail, password);
      return;
    }

    await signUp(trimmedEmail, password);
  };

  const handlePasswordReset = async () => {
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setFormNotice(null);
      setFormError('Gib zuerst deine E-Mail-Adresse ein.');
      return;
    }

    if (!isValidEmail(trimmedEmail)) {
      setFormNotice(null);
      setFormError('Bitte gib eine gültige E-Mail-Adresse ein.');
      return;
    }

    clearError();
    setFormError(null);
    setFormNotice(null);

    const resetWasTriggered = await resetPassword(trimmedEmail);
    if (resetWasTriggered) {
      setFormNotice(
        `Falls ein Konto existiert, ist die Reset-Mail unterwegs.`,
      );
    }
  };

  if (status === 'disabled') {
    return (
      <AuthDialogDisabledView 
        open={open} 
        onOpenChange={(nextOpen) => (nextOpen ? showAuthDialog() : resetAndClose())} 
        resetAndClose={resetAndClose} 
      />
    );
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (nextOpen ? showAuthDialog() : resetAndClose())}>
      <DialogContent
        className={cn(
          'max-h-[92vh] w-[calc(100vw-1rem)] max-w-5xl overflow-y-auto rounded-[2rem] border-border/70 bg-background p-0 shadow-[0_32px_120px_rgba(0,0,0,0.34)] sm:w-[calc(100vw-2rem)]',
          'md:h-auto md:max-h-[88vh] md:overflow-hidden',
        )}
      >
        <div className="relative grid md:h-full md:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)]">
          <AuthDialogHero />

          <div className="relative bg-card/96 p-6 sm:p-8 md:overflow-y-auto">
            <DialogHeader className="space-y-2 pr-20 text-left">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-primary">
                {modeMeta.eyebrow}
              </p>
              <DialogTitle className="text-3xl font-black tracking-[-0.05em] text-foreground">
                {modeMeta.title}
              </DialogTitle>
              <DialogDescription className="max-w-xl text-sm leading-6 text-muted-foreground">
                {modeMeta.description}
              </DialogDescription>
            </DialogHeader>

            <div className="mt-6 inline-flex rounded-full border border-border/70 bg-background/80 p-1">
              <button
                type="button"
                onClick={() => switchMode('login')}
                className={cn(
                  'rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.18em] transition',
                  mode === 'login'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                Anmelden
              </button>
              <button
                type="button"
                onClick={() => switchMode('signup')}
                className={cn(
                  'rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.18em] transition',
                  mode === 'signup'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                Konto erstellen
              </button>
            </div>

            {authInitializing ? (
              <div className="mt-4 rounded-[1.35rem] border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-foreground/82">
                Login wird vorbereitet.
              </div>
            ) : null}

            {firebaseMissing ? (
              <div className="mt-4 rounded-[1.35rem] border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-foreground/82">
                <div className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                  <span>Konto und Sync sind noch nicht bereit.</span>
                </div>
              </div>
            ) : null}

            {androidGoogleMisconfigured ? (
              <div className="mt-4 rounded-[1.35rem] border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-foreground/82">
                <div className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                  <span>{googleSignInDisabledReason}</span>
                </div>
              </div>
            ) : null}

            {authFlowAvailable && !androidGoogleMisconfigured ? (
              <div className="mt-4 rounded-[1.35rem] border border-success/25 bg-success/10 px-4 py-3 text-sm text-foreground/82">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  <span>E-Mail-Login und Reset sind bereit.</span>
                </div>
              </div>
            ) : null}

            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              <div className="rounded-[1.55rem] border border-border/70 bg-background/72 p-4 text-center">
                <Button
                  type="button"
                  variant="secondary"
                  className={cn(
                    "h-12 w-full rounded-2xl border font-semibold shadow-sm transition-all",
                    googleSignInAvailable 
                      ? "border-transparent bg-white text-black hover:bg-gray-100 hover:scale-[1.02] active:scale-[0.98]" 
                      : "border-border bg-background text-foreground"
                  )}
                  onClick={() => {
                    void signInWithGoogle();
                  }}
                  disabled={isBusy || authInitializing || !googleSignInAvailable}
                >
                  {googleSignInAvailable && !isBusy && (
                    <svg viewBox="0 0 24 24" className="mr-3 h-5 w-5 shrink-0" aria-hidden="true">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                  )}
                  {isBusy ? 'Google startet...' : !googleSignInAvailable ? 'Google Login offline' : 'Mit Google fortfahren'}
                </Button>
                <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                  {!googleSignInAvailable
                    ? googleSignInDisabledReason
                    : '1-Klick Anmeldung für all deine Geräte.'}
                </p>
              </div>

              <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.16em] text-muted-foreground/75">
                <span className="h-px flex-1 bg-border/70" />
                <span>oder mit E-Mail und Passwort</span>
                <span className="h-px flex-1 bg-border/70" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="auth-email">E-Mail</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="auth-email"
                    type="email"
                    inputMode="email"
                    placeholder={EMAIL_PLACEHOLDER}
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      if (formNotice) setFormNotice(null);
                    }}
                    className="h-12 rounded-2xl border-border bg-background/90 pl-11 text-base"
                    autoComplete="email"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="auth-password">Passwort</Label>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="auth-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder={`Mindestens ${PASSWORD_MIN_LENGTH} Zeichen`}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="h-12 rounded-2xl border-border bg-background/90 pl-11 pr-12 text-base"
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    required
                    minLength={PASSWORD_MIN_LENGTH}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground transition hover:text-foreground"
                    aria-label={showPassword ? 'Passwort verbergen' : 'Passwort anzeigen'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {mode === 'signup' ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="auth-confirm-password">Passwort bestätigen</Label>
                    <div className="relative">
                      <KeyRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="auth-confirm-password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Passwort wiederholen"
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        className="h-12 rounded-2xl border-border bg-background/90 pl-11 pr-12 text-base"
                        autoComplete="new-password"
                        required
                      />
                      {confirmPasswordMatches ? (
                        <CheckCircle2 className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-success" />
                      ) : null}
                    </div>
                  </div>

                  <PasswordStrengthMeter password={password} />
                </>
              ) : null}

              {formError ? (
                <div className="rounded-[1.35rem] border border-destructive/35 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{formError}</span>
                  </div>
                </div>
              ) : null}

              {formNotice ? (
                <div className="rounded-[1.35rem] border border-success/25 bg-success/10 px-4 py-3 text-sm text-success">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{formNotice}</span>
                  </div>
                </div>
              ) : null}

              <div className="flex flex-col gap-3">
                <Button
                  type="submit"
                  className="h-12 rounded-2xl bg-primary text-primary-foreground shadow-[0_18px_36px_hsl(var(--primary)/0.22)]"
                  disabled={isBusy || authInitializing}
                >
                  {isBusy ? modeMeta.primaryBusyLabel : modeMeta.primaryLabel}
                </Button>

                {mode === 'login' ? (
                  <button
                    type="button"
                    onClick={() => {
                      void handlePasswordReset();
                    }}
                    disabled={isBusy || authInitializing || !emailIsFilled}
                    className="text-sm font-semibold text-muted-foreground transition hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Passwort vergessen?
                  </button>
                ) : (
                  <p className="text-sm leading-6 text-muted-foreground">
                    Danach bist du direkt drin.
                  </p>
                )}
              </div>
            </form>

            <button
              type="button"
              onClick={() => {
                persistOnboardingDismissed();
                resetAndClose();
              }}
              className={cn(
                'btn-press mt-5 text-xs font-black uppercase tracking-[0.16em]',
                'text-muted-foreground transition hover:text-foreground',
              )}
            >
              Später erinnern
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
