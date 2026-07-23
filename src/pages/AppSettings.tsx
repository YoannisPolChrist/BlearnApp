import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Settings2 } from 'lucide-react';
import { useTheme } from 'next-themes';
import { BrandMark } from '@/components/brand/BrandMark';
import PageTransition from '@/components/PageTransition';
import { SettingsLockBanner } from '@/components/settings/SettingsSections';
import { AccountCloudSection } from '@/components/settings/AccountCloudSection';
import { AppSettingsDialogs } from '@/components/settings/AppSettingsDialogs';
import { AppearanceSettingsSection } from '@/components/settings/AppearanceSettingsSection';
import { BlockingSettingsSection } from '@/components/settings/BlockingSettingsSection';
import { LearningSettingsSection } from '@/components/settings/LearningSettingsSection';
import { PermissionsSettingsSection } from '@/components/settings/PermissionsSettingsSection';
import { RemoteBlockingReviewGateDialog } from '@/components/settings/RemoteBlockingReviewGateDialog';
import { useAppTour } from '@/components/setup/appTourContext';
import { useI18n } from '@/hooks/useI18n';
import { useManualLearningCloudSync } from '@/hooks/useManualLearningCloudSync';
import { useCloudSyncRuntimeStore } from '@/lib/cloudSyncRuntime';
import { premiumEase, sectionStagger } from '@/lib/motion';
import { showSuccessFeedback } from '@/lib/successFeedback';
import { getNotificationStatusLabel, getSettingsSectionIds } from '@/lib/view-models/settings';
import { getAccountCloudViewModel } from '@/modules/settings/accountCloudViewModel';
import {
  SETTINGS_PERMISSIONS_PANEL_VALUE,
  isInsideStrictScheduleWindow,
} from '@/modules/settings/settingsRuntime';
import { useSettingsPermissions } from '@/modules/settings/useSettingsPermissions';
import {
  getNotificationPermissionState,
  syncNotificationPreferences,
  type NotificationPermissionState,
} from '@/services/notificationService';
import { isNative } from '@/services/screenTimeService';
import { useAppStore } from '@/store/useAppStore';
import { useLearningStore } from '@/store/useLearningStore';
import {
  useModeActions,
  useModeSettings,
  usePermissionStatus,
  usePreferenceActions,
  usePreferenceSettings,
} from '@/store/selectors';
import { useAuthStore } from '@/store/useAuthStore';

export default function AppSettings() {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { t, locale, language } = useI18n();
  const {
    activeMode,
    isStrictLocked,
    strictLockScope,
    notificationsEnabled,
    blockedWebsites,
    remoteBlockingEnabled,
  } = usePermissionStatus();
  const {
    setNotificationsEnabled,
    setRemoteBlockingEnabled,
    startRemoteBlockingDisableGate,
    clearRemoteBlockingDisableGate,
  } = usePreferenceActions();
  const { forceReleaseLock } = useModeActions();
  const { strictStartTime, strictEndTime } = useModeSettings();
  const { notificationPreferences } = usePreferenceSettings();
  const authUser = useAuthStore((state) => state.user);
  const authStatus = useAuthStore((state) => state.status);
  const authReady = useAuthStore((state) => state.authReady);
  const authCapabilities = useAuthStore((state) => state.capabilities);
  const openAuthDialog = useAuthStore((state) => state.showAuthDialog);
  const signOutUser = useAuthStore((state) => state.signOut);
  const learningSyncRuntime = useCloudSyncRuntimeStore((state) => state.learning);
  const progressSyncRuntime = useCloudSyncRuntimeStore((state) => state.progress);
  const { openTour } = useAppTour();
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const [showLanguagePackDialog, setShowLanguagePackDialog] = useState(false);
  const [showRemoteBlockingGate, setShowRemoteBlockingGate] = useState(false);
  const [showNotificationDialog, setShowNotificationDialog] = useState(false);
  const [showLearningCloudSnapshotDialog, setShowLearningCloudSnapshotDialog] = useState(false);
  const [notificationPermissionState, setNotificationPermissionState] = useState<NotificationPermissionState>('unsupported');
  const [expandedSettingsPanel, setExpandedSettingsPanel] = useState<string>(() =>
    location.hash === '#permissions' ? SETTINGS_PERMISSIONS_PANEL_VALUE : '',
  );
  const {
    canSync,
    firebaseWritesEnabled,
    syncing: learningCloudSyncBusy,
    syncError: learningCloudSyncError,
    syncCapabilityReason,
    syncCapabilityState,
    syncLearningCloud,
  } = useManualLearningCloudSync();

  const isGerman = locale.toLowerCase().startsWith('de');
  const locked = isStrictLocked();
  const showForceReleaseEscape = locked && !isInsideStrictScheduleWindow(strictStartTime, strictEndTime);
  const appIntroActionLabel = isGerman ? 'App-Einfuehrung ansehen' : 'Open app intro';
  const permissionsTitle = isGerman ? 'Systemberechtigungen' : 'System permissions';
  const remoteBlockingDisableGate = useAppStore((state) => state.remoteBlockingDisableGate);
  const activeLearningDeck = useLearningStore((state) => state.activeDeckId ? state.decks[state.activeDeckId] : undefined);
  const remoteGateDeck = useLearningStore((state) =>
    remoteBlockingDisableGate ? state.decks[remoteBlockingDisableGate.deckId] : undefined,
  );
  const remoteBlockingGateProgress = useLearningStore((state) => {
    if (!remoteBlockingDisableGate) return 0;
    return new Set(
      Object.values(state.reviewLogs)
        .filter((log) =>
          log.deckId === remoteBlockingDisableGate.deckId
          && log.reviewedAt >= remoteBlockingDisableGate.startedAt
          && log.wasCorrect
          && log.rating !== 'again',
        )
        .map((log) => log.cardId),
    ).size;
  });

  const refreshNotificationPermissionState = useCallback(() => {
    getNotificationPermissionState().then(setNotificationPermissionState).catch(() => {
      setNotificationPermissionState('unsupported');
    });
  }, []);
  const {
    allPermissionsGranted,
    permissionCards,
    permissionErrorMessage,
    permissionSetupSteps,
    permissionStatus,
    permissionSummaryLabel,
    permissionsNeedAttention,
    monitoringStatus,
    openAccessibilitySettings,
    refreshPermissions,
    setShowPermissionGuide,
    showPermissionGuide,
    showPermissionGuideCta,
    showPermissionsSection,
    markPermissionGuideSeen,
  } = useSettingsPermissions({
    blockedWebsites,
    isGerman,
    onRuntimeResume: refreshNotificationPermissionState,
    t,
  });
  const settingsSections = getSettingsSectionIds(showPermissionsSection).map((id) => ({
    id,
    label: t(`settings.sections.${id}`),
  }));
  const accountCloud = getAccountCloudViewModel({
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
  });
  const notificationStatusLabel = getNotificationStatusLabel(notificationPermissionState);

  const scrollToSection = (sectionId: (typeof settingsSections)[number]['id']) => {
    if (sectionId === 'permissions') {
      setExpandedSettingsPanel(SETTINGS_PERMISSIONS_PANEL_VALUE);
      window.setTimeout(() => {
        document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 40);
      return;
    }

    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  useEffect(() => {
    refreshNotificationPermissionState();
  }, [refreshNotificationPermissionState]);

  useEffect(() => {
    const handleScroll = () => {
      setHeaderCollapsed(window.scrollY > 36);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  useEffect(() => {
    if (!permissionErrorMessage) return;
    setExpandedSettingsPanel(SETTINGS_PERMISSIONS_PANEL_VALUE);
  }, [permissionErrorMessage]);

  useEffect(() => {
    const sectionId = location.hash.replace('#', '');
    if (!sectionId) return;

    if (sectionId === 'permissions') {
      setExpandedSettingsPanel(SETTINGS_PERMISSIONS_PANEL_VALUE);
    }

    const timeout = window.setTimeout(() => {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [location.hash]);

  const handleThemeChange = (nextTheme: 'light' | 'dark') => {
    showSuccessFeedback({
      eyebrow: 'Blearn',
      title: isGerman ? 'Theme gespeichert' : 'Theme saved',
      description:
        nextTheme === 'dark'
          ? isGerman
            ? 'Der dunkle Modus ist jetzt aktiv.'
            : 'Dark mode is now active.'
          : isGerman
            ? 'Der helle Modus ist jetzt aktiv.'
            : 'Light mode is now active.',
    });
  };

  const handleRemoteBlockingToggle = (enabled: boolean) => {
    if (enabled) {
      clearRemoteBlockingDisableGate();
      setRemoteBlockingEnabled(true);
      return;
    }

    if (!remoteBlockingDisableGate) {
      if (!activeLearningDeck) {
        navigate('/learn');
        return;
      }
      startRemoteBlockingDisableGate(activeLearningDeck.id);
      setShowRemoteBlockingGate(true);
      return;
    }

    setShowRemoteBlockingGate(true);
  };

  const disableRemoteBlockingAfterReview = () => {
    if (remoteBlockingGateProgress < 15) return;
    setRemoteBlockingEnabled(false);
    clearRemoteBlockingDisableGate();
    setShowRemoteBlockingGate(false);
    showSuccessFeedback({
      eyebrow: 'Coach-Remote-Sperre',
      title: 'Sperre ausgeschaltet',
      description: '15 Vokabeln aus deinem ausgewählten Deck wurden gelernt.',
    });
  };

  const handleNotificationsToggle = (enabled: boolean) => {
    setNotificationsEnabled(enabled);
    void syncNotificationPreferences({
      enabled,
      preferences: notificationPreferences,
      preview: enabled
        ? {
            category: 'statusHints',
            title: isGerman ? 'Benachrichtigungen aktiv' : 'Notifications enabled',
            body: isGerman
              ? 'Blearn kann dir jetzt native Hinweise senden.'
              : 'Blearn can now send native notifications.',
          }
        : null,
    }).catch(() => undefined);
    showSuccessFeedback({
      eyebrow: isGerman ? 'Hinweise' : 'Notifications',
      title: isGerman ? 'Einstellung gespeichert' : 'Setting saved',
      description: enabled
        ? isGerman
          ? 'Benachrichtigungen sind jetzt aktiv.'
          : 'Notifications are now active.'
        : isGerman
          ? 'Benachrichtigungen sind jetzt pausiert.'
          : 'Notifications are now paused.',
    });
  };

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate('/');
  };

  return (
    <PageTransition>
      <div className="app-page">
        <div className="page-header page-header-wrap">
          <button onClick={handleBack} className="rounded-full p-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft size={22} />
          </button>

          <motion.div
            data-tour-id="tour-settings-overview"
            data-testid="settings-page-hero"
            className="relative min-w-0 flex-1 overflow-hidden rounded-[1.65rem] border border-border/70 bg-[linear-gradient(135deg,hsl(var(--card)/0.98),hsl(var(--primary)/0.09))] px-4 py-3 shadow-[0_18px_48px_hsl(var(--foreground)/0.07)] sm:px-5"
            initial={false}
            animate={{
              opacity: headerCollapsed ? 0 : 1,
              maxHeight: headerCollapsed ? 0 : 168,
              y: headerCollapsed ? -8 : 0,
            }}
            transition={{ duration: 0.2, ease: premiumEase }}
          >
            <div className="absolute -right-8 -top-9 h-28 w-28 rounded-full bg-primary/14 blur-3xl" aria-hidden="true" />
            <div className="relative flex min-w-0 items-center gap-3 sm:gap-4">
              <div className="hidden shrink-0 sm:block">
                <BrandMark size={46} withHalo />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-primary">
                  <Settings2 size={14} strokeWidth={2.4} aria-hidden="true" />
                  <p className="text-[10px] font-black uppercase tracking-[0.18em]">Blearn</p>
                </div>
                <h1 className="mt-1 text-2xl font-black tracking-[-0.05em] text-foreground sm:text-3xl">
                  {t('settings.page.title')}
                </h1>
                <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted-foreground sm:text-sm">
                  {t('settings.page.description')}
                </p>
              </div>
            </div>
          </motion.div>

          {showPermissionGuideCta ? (
            <button
              onClick={() => setShowPermissionGuide(true)}
              className="btn-press shrink-0 rounded-full border border-border bg-card/70 px-3 py-2 text-xs font-bold text-foreground"
            >
              {t('common.actions.setup')}
            </button>
          ) : null}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
          className="anchor-chip-row"
        >
          {settingsSections.map((section, index) => (
            <motion.button
              key={section.id}
              type="button"
              onClick={() => scrollToSection(section.id)}
              className="anchor-chip"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04, duration: 0.22 }}
              whileTap={{ scale: 0.98 }}
            >
              {section.label}
            </motion.button>
          ))}
        </motion.div>

        {locked && (
          <SettingsLockBanner t={t} strictLockScope={strictLockScope} />
        )}

        <motion.div variants={sectionStagger} initial="hidden" animate="show" className="section-stack">
          <AccountCloudSection
            authUser={authUser}
            canSync={canSync}
            firebaseWritesEnabled={firebaseWritesEnabled}
            isGerman={isGerman}
            learningCloudSyncBusy={learningCloudSyncBusy}
            learningCloudSyncError={learningCloudSyncError}
            onAuthAction={openAuthDialog}
            onOpenCloudSnapshot={() => setShowLearningCloudSnapshotDialog(true)}
            onSignOut={() => {
              void signOutUser();
            }}
            onSyncLearningCloud={() => {
              void syncLearningCloud();
            }}
            syncCapabilityReason={syncCapabilityReason}
            syncCapabilityState={syncCapabilityState}
            {...accountCloud}
          />

          <AppearanceSettingsSection
            activeLanguage={language}
            isGerman={isGerman}
            notificationPermissionState={notificationPermissionState}
            notificationStatusLabel={notificationStatusLabel}
            notificationsEnabled={notificationsEnabled}
            onManageLanguages={() => setShowLanguagePackDialog(true)}
            onNotificationsToggle={handleNotificationsToggle}
            onOpenNotificationDialog={() => setShowNotificationDialog(true)}
            onThemeChange={handleThemeChange}
            t={t}
            theme={theme}
          />

          <BlockingSettingsSection
            isGerman={isGerman}
            remoteBlockingEnabled={remoteBlockingEnabled}
            onRemoteBlockingToggle={handleRemoteBlockingToggle}
            onForceReleaseLock={forceReleaseLock}
            onOpenWallet={() => navigate('/wallet')}
            showForceReleaseEscape={showForceReleaseEscape}
            t={t}
          />

          {showPermissionsSection ? (
            <PermissionsSettingsSection
              expandedSettingsPanel={expandedSettingsPanel}
              locale={locale}
              monitoringStatus={monitoringStatus}
              onOpenAccessibilitySettings={() => {
                void openAccessibilitySettings();
              }}
              onOpenModes={() => navigate('/modes')}
              onOpenPermissionGuide={() => setShowPermissionGuide(true)}
              onRefreshPermissions={() => {
                void refreshPermissions();
              }}
              onValueChange={setExpandedSettingsPanel}
              permissionCards={permissionCards}
              permissionErrorMessage={permissionErrorMessage}
              permissionStatus={permissionStatus}
              permissionSummaryLabel={permissionSummaryLabel}
              permissionsNeedAttention={permissionsNeedAttention}
              permissionsTitle={permissionsTitle}
              showPermissionGuideCta={showPermissionGuideCta}
              t={t}
            />
          ) : null}

          <LearningSettingsSection
            appIntroActionLabel={appIntroActionLabel}
            onOpenTour={openTour}
          />
        </motion.div>
      </div>

      <AppSettingsDialogs
        authUser={authUser}
        locale={locale}
        onLanguagePackDialogChange={setShowLanguagePackDialog}
        onLearningCloudSnapshotDialogChange={setShowLearningCloudSnapshotDialog}
        onNotificationDialogChange={setShowNotificationDialog}
        onPermissionGuideChange={setShowPermissionGuide}
        onPermissionGuideSeen={markPermissionGuideSeen}
        onRefreshNotificationPermission={refreshNotificationPermissionState}
        permissionSetupSteps={permissionSetupSteps}
        showLanguagePackDialog={showLanguagePackDialog}
        showLearningCloudSnapshotDialog={showLearningCloudSnapshotDialog}
        showNotificationDialog={showNotificationDialog}
        showPermissionGuide={showPermissionGuide}
      />
      {remoteBlockingDisableGate && remoteGateDeck ? (
        <RemoteBlockingReviewGateDialog
          deckName={remoteGateDeck.name}
          onContinueLearning={() => {
            setShowRemoteBlockingGate(false);
            navigate(`/learn/review?deckId=${encodeURIComponent(remoteBlockingDisableGate.deckId)}`);
          }}
          onOpenChange={setShowRemoteBlockingGate}
          onUnlock={disableRemoteBlockingAfterReview}
          open={showRemoteBlockingGate}
          progress={remoteBlockingGateProgress}
        />
      ) : null}
    </PageTransition>
  );
}
