import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Banknote, Link2, UserRoundCheck } from 'lucide-react';
import { BrandLockup } from '@/components/brand/BrandMark';
import PageTransition from '@/components/PageTransition';
import type { SetupStep } from '@/components/setup/SetupNarrativeDialog';
import AlbyConnectionConfig from '@/components/wallet/AlbyConnectionConfig';
import PenaltyConfig from '@/components/wallet/PenaltyConfig';
import RecipientConfig from '@/components/wallet/RecipientConfig';
import TransactionHistory from '@/components/wallet/TransactionHistory';
import WalletBalance from '@/components/wallet/WalletBalance';
import { WalletAlertStack, WalletMetricsSection, WalletSummarySection } from '@/components/wallet/WalletSections';
import { cardCascade, cardCascadeItem, premiumEase, sectionItem, sectionStagger } from '@/lib/motion';
import { formatSats, getWalletStatus } from '@/lib/view-models/wallet';
import { usePenaltyStatus } from '@/store/selectors';

const WALLET_SETUP_SEEN_KEY = 'blearn-wallet-setup-seen';
const dialogStepVariants = {};
const SetupNarrativeDialog = lazy(() => import('@/components/setup/SetupNarrativeDialog'));

export default function WalletPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const {
    penaltyAmountSats,
    penaltyEnabled,
    accountabilityPartner,
    albyConnection,
    albyConnectionTest,
    getTotalPenalties,
    getWeeklyPenalties,
  } = usePenaltyStatus();
  const {
    albyReady,
    recipientVerified,
    connectionTestPassed,
    penaltyAmountConfigured,
    penaltyReady,
    statusTitle,
    statusDescription,
    walletTitle,
    walletDescription,
    recipientTitle,
    recipientDescription,
  } = getWalletStatus({
    penaltyAmountSats,
    penaltyEnabled,
    accountabilityPartner,
    albyConnection,
    albyConnectionTest,
  });

  const setupMode = searchParams.get('setup') === 'penalty';
  const returnTo = searchParams.get('return') || '/modes';
  const [showSetupGuide, setShowSetupGuide] = useState(false);
  const [setupGuideDismissed, setSetupGuideDismissed] = useState(false);
  const setupGuideLocked = setupMode && !penaltyReady;

  useEffect(() => {
    if (setupGuideDismissed) {
      return;
    }

    const setupSeen = window.localStorage.getItem(WALLET_SETUP_SEEN_KEY) === 'true';

    if (setupMode && !penaltyReady) {
      setShowSetupGuide(true);
      return;
    }

    if (!setupSeen && !penaltyReady) {
      setShowSetupGuide(true);
    }

    if (penaltyReady) {
      window.localStorage.setItem(WALLET_SETUP_SEEN_KEY, 'true');
      if (setupMode) {
        setShowSetupGuide(false);
      }
    }
  }, [penaltyReady, setupGuideDismissed, setupMode]);

  const setupSteps = useMemo<SetupStep[]>(
    () => [
      {
        id: 'wallet',
        eyebrow: '1',
        title: 'Wallet verbinden und testen',
        description:
          'Erst Verbindung anlegen, dann live testen – dann ist der Pfad bereit.',
        bullets: [
          'Ohne gültige NWC-Verbindung gibt es keinen Zahlungspfad.',
          'Der Live-Test bestätigt Wallet, Budget und Erreichbarkeit.',
          'Sobald Wallet und Live-Test stehen, ist Schritt 1 erledigt.',
        ],
        completed: connectionTestPassed,
        icon: Link2,
        actionLabel: 'Alby Go öffnen',
        actionStateLabel: 'Wallet live getestet',
        onAction: () => {
          window.open('https://getalby.com/alby-go', '_blank', 'noopener,noreferrer');
        },
        content: <AlbyConnectionConfig variants={dialogStepVariants} />,
      },
      {
        id: 'recipient',
        eyebrow: '2',
        title: 'Empfänger verifizieren',
        description:
          'Grün erst nach Bestätigung der Lightning-Adresse.',
        bullets: [
          'Unverifizierte Empfänger halten den Strafmodus bewusst weiter zurück.',
          'Markiert einen offenen Sicherheitsschritt.',
        ],
        completed: recipientVerified,
        icon: UserRoundCheck,
        content: <RecipientConfig variants={dialogStepVariants} />,
      },
      {
        id: 'penalty',
        eyebrow: '3',
        title: 'Strafbetrag setzen',
        description: 'Bereit erst mit Wallet, Live-Test, Empfänger und Betrag.',
        bullets: [
          'Der Betrag wird bewusst direkt in sats gespeichert.',
          'Alte EUR-Werte müssen nach dem Update einmal neu bestätigt werden.',
        ],
        completed: penaltyReady,
        icon: Banknote,
        content: <PenaltyConfig variants={dialogStepVariants} />,
      },
    ],
    [connectionTestPassed, penaltyReady, recipientVerified],
  );

  const handleBack = () => {
    if (setupMode && !penaltyReady) {
      navigate(returnTo, { replace: true });
      return;
    }

    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate(returnTo);
  };

  const dismissSetupGuide = () => {
    setSetupGuideDismissed(true);
    setShowSetupGuide(false);

    if (setupMode) {
      navigate(returnTo, { replace: true });
      return;
    }

    window.localStorage.setItem(WALLET_SETUP_SEEN_KEY, 'true');
    setShowSetupGuide(false);
  };

  const handleSetupGuideOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setSetupGuideDismissed(false);
      setShowSetupGuide(true);
      return;
    }

    dismissSetupGuide();
  };

  return (
    <PageTransition>
      <div className="app-page">
        <div className="page-header">
          <button onClick={handleBack} className="rounded-full p-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft size={22} />
          </button>
          <motion.div
            variants={cardCascade}
            initial="hidden"
            animate="show"
            className="flex-1 text-center"
          >
            <motion.h1 variants={cardCascadeItem} className="page-header-title">Strafkonto</motion.h1>
            <motion.div variants={cardCascadeItem}>
              <BrandLockup compact className="mt-2 justify-center" subtitle="Wallet, Empfänger und Strafmodus unter eigener Marke" />
            </motion.div>
          </motion.div>
          <motion.button
            onClick={() => {
              setSetupGuideDismissed(false);
              setShowSetupGuide(true);
            }}
            whileHover={{ y: -1, scale: 1.02 }}
            whileTap={{ y: 1, scale: 0.985 }}
            transition={{ duration: 0.2, ease: premiumEase }}
            className="rounded-full border border-border bg-card/70 px-3 py-1.5 text-xs font-bold text-foreground"
          >
            {penaltyReady ? 'Status' : 'Guide'}
          </motion.button>
        </div>

        <motion.div variants={sectionStagger} initial="hidden" animate="show" className="section-stack">
          <motion.div variants={sectionItem}>
            <WalletSummarySection
              penaltyReady={penaltyReady}
              albyReady={albyReady}
              recipientVerified={recipientVerified}
              walletStatusTitle={statusTitle}
              walletStatusDescription={statusDescription}
              walletTitle={walletTitle}
              walletDescription={walletDescription}
              recipientTitle={recipientTitle}
              recipientDescription={recipientDescription}
            />
          </motion.div>

          <WalletBalance variants={sectionItem} />

          <motion.div variants={sectionItem}>
            <WalletMetricsSection
              weeklyPenaltyLabel={formatSats(getWeeklyPenalties())}
              totalPenaltyLabel={formatSats(getTotalPenalties())}
            />
          </motion.div>

          <AlbyConnectionConfig variants={sectionItem} />
          <RecipientConfig variants={sectionItem} />
          <PenaltyConfig variants={sectionItem} />

          <WalletAlertStack
            variants={sectionItem}
            penaltyEnabled={penaltyEnabled}
            albyReady={albyReady}
            recipientVerified={recipientVerified}
            connectionTestPassed={connectionTestPassed}
            penaltyAmountConfigured={penaltyAmountConfigured}
            penaltyReady={penaltyReady}
          />

          <TransactionHistory variants={sectionItem} />
        </motion.div>
      </div>

      {showSetupGuide ? (
        <Suspense fallback={null}>
          <SetupNarrativeDialog
            open={showSetupGuide}
            onOpenChange={handleSetupGuideOpenChange}
            title="Strafkonto sicher einrichten"
            description="Der erste Versuch führt dich Schritt für Schritt durchs Setup."
            steps={setupSteps}
            finishLabel={setupMode && !penaltyReady ? 'Setup abschließen' : 'Fertig'}
            onDismiss={dismissSetupGuide}
            onFinish={() => {
              if (penaltyReady) {
                window.localStorage.setItem(WALLET_SETUP_SEEN_KEY, 'true');
              }
              if (setupMode) {
                navigate(returnTo, { replace: true });
              }
            }}
            lockUntilFinished={setupGuideLocked}
            canFinish={setupMode ? penaltyReady : undefined}
            allowCloseWhenLocked={setupMode}
          />
        </Suspense>
      ) : null}
    </PageTransition>
  );
}
