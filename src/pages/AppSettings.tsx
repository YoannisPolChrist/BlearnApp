import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { useTheme } from 'next-themes';
import { BrandLockup } from '@/components/brand/BrandMark';
import PageTransition from '@/components/PageTransition';
import { SettingsLockBanner } from '@/components/settings/SettingsSections';
import { AccountCloudSection } from '@/components/settings/AccountCloudSection';
import { AppSettingsDialogs } from '@/components/settings/AppSettingsDialogs';
import { AppearanceSettingsSection } from '@/components/settings/AppearanceSettingsSection';
import { BlockingSettingsSection } from '@/components/settings/BlockingSettingsSection';
import { LearningSettingsSection } from '@/components/settings/LearningSettingsSection';
import { PermissionsSettingsSection } from '@/components/settings/PermissionsSettingsSection';
import { useAppTour } from '@/components/setup/appTourContext';
import { useI18n } from '@/hooks/useI18n';
import { useManualLearningCloudSync } from '@/hooks/useManualLearningCloudSync';
import { useCloudSyncRuntimeStore } from '@/lib/cloudSyncRuntime';
import { ensureLanguagePackAvailable } from '@/lib/i18n';
import {
  APP_LANGUAGE_PACKS,
  getSelectableAppLanguageOptions,
  isLanguagePackBundled,
} from '@/lib/languages';
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
import type { AppLanguage } from '@/store/useAppStore';
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
  const { t, locale } = useI18n();
  const {
    activeMode,
    blockedSearchTermsCount,
    userProfile,
    isStrictLocked,
    strictLockScope,
    penaltyAmountSats,
    penaltyEnabled,
    appLanguage,
    installedAppLanguagePacks,
    notificationsEnabled,
    blockedWebsites,
  } = usePermissionStatus();
  const {
    setAppLanguage,
    installAppLanguagePack,
    setNotificationsEnabled,
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
  const [downloadingLanguage, setDownloadingLanguage] = useState<AppLanguage | null>(null);
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const [showLanguagePackDialog, setShowLanguagePackDialog] = useState(false);
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
  const modeLabel =
    activeMode === 'normal'
      ? t('common.modes.normal')
      : activeMode === 'strict'
        ? t('common.modes.reflection')
        : activeMode === 'learn'
          ? t('common.modes.learn')
          : activeMode === 'penalty'
            ? t('common.modes.penalty')
            : t('common.modes.strict');
  const appIntroActionLabel = isGerman ? 'App-Einfuehrung ansehen' : 'Open app intro';
  const permissionsTitle = isGerman ? 'Systemberechtigungen' : 'System permissions';

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
  const selectableLanguageOptions = useMemo(
    () => getSelectableAppLanguageOptions(installedAppLanguagePacks),
    [installedAppLanguagePacks],
  );
  const visibleLanguagePackTiles = useMemo(
    () =>
      APP_LANGUAGE_PACKS
        .filter((pack) => isLanguagePackBundled(pack.value) || installedAppLanguagePacks.includes(pack.value))
        .sort((left, right) => Number(right.value === appLanguage) - Number(left.value === appLanguage)),
    [appLanguage, installedAppLanguagePacks],
  );
  const notificationStatusLabel = getNotificationStatusLabel(notificationPermissionState);
  const getLanguageLabel = (language: AppLanguage) =>
    APP_LANGUAGE_PACKS.find((pack) => pack.value === language)?.label ?? language.toUpperCase();

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

  const handleLanguagePackInstall = async (language: AppLanguage) => {
    setDownloadingLanguage(language);

    try {
      await ensureLanguagePackAvailable(language);
      installAppLanguagePack(language);
      setAppLanguage(language);
      showSuccessFeedback({
        eyebrow: 'Sprachpaket hinzugefügt',
        title: `${getLanguageLabel(language)} hinzugefügt`,
        description: 'Das Sprachpaket wurde heruntergeladen und direkt aktiviert.',
        detail: 'Sprache gespeichert',
        emoji: '🌍',
      });
    } catch (error) {
      console.warn(`Language pack install failed for ${language}:`, error);
    } finally {
      setDownloadingLanguage(null);
    }
  };

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

  const handleAppLanguageChange = (language: AppLanguage) => {
    setAppLanguage(language);
    showSuccessFeedback({
      eyebrow: isGerman ? 'Sprache' : 'Language',
      title: isGerman ? 'Sprache gespeichert' : 'Language saved',
      description: isGerman
        ? `${getLanguageLabel(language)} ist jetzt aktiv.`
        : `${getLanguageLabel(language)} is now active.`,
    });
  };

  const handleLanguagePackActivate = (language: AppLanguage) => {
    setAppLanguage(language);
    showSuccessFeedback({
      eyebrow: 'Sprache aktiviert',
      title: `${getLanguageLabel(language)} aktiviert`,
      description: 'Die Sprache wurde direkt umgestellt und gespeichert.',
      detail: 'Sprache gespeichert',
      emoji: '🌍',
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
            className="min-w-0 flex-1 overflow-visible"
            initial={false}
            animate={{
              opacity: headerCollapsed ? 0 : 1,
              maxHeight: headerCollapsed ? 0 : 144,
              y: headerCollapsed ? -8 : 0,
            }}
            transition={{ duration: 0.2, ease: premiumEase }}
          >
            <h1 className="page-header-title text-left sm:text-center">{t('settings.page.title')}</h1>
            {!headerCollapsed ? (
              <BrandLockup
                compact
                className="mt-3 justify-start overflow-visible sm:justify-center"
                subtitle="Eigene Steuerung für Fokus, Rechte und Aussehen"
              />
            ) : null}
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
            appLanguage={appLanguage}
            isGerman={isGerman}
            notificationPermissionState={notificationPermissionState}
            notificationStatusLabel={notificationStatusLabel}
            notificationsEnabled={notificationsEnabled}
            onAppLanguageChange={handleAppLanguageChange}
            onManageLanguages={() => setShowLanguagePackDialog(true)}
            onNotificationsToggle={handleNotificationsToggle}
            onOpenNotificationDialog={() => setShowNotificationDialog(true)}
            onThemeChange={handleThemeChange}
            selectableLanguageOptions={selectableLanguageOptions}
            t={t}
            theme={theme}
            visibleLanguagePackTiles={visibleLanguagePackTiles}
          />

          <BlockingSettingsSection
            blockedSearchTermsCount={blockedSearchTermsCount}
            isGerman={isGerman}
            locked={locked}
            onForceReleaseLock={forceReleaseLock}
            onOpenModes={() => navigate('/modes')}
            onOpenWallet={() => navigate('/wallet')}
            showForceReleaseEscape={showForceReleaseEscape}
            t={t}
            userProfile={userProfile}
          />

          {showPermissionsSection ? (
            <PermissionsSettingsSection
              expandedSettingsPanel={expandedSettingsPanel}
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
            allPermissionsGranted={allPermissionsGranted}
            appIntroActionLabel={appIntroActionLabel}
            isGerman={isGerman}
            modeLabel={modeLabel}
            onOpenTour={openTour}
            penaltyAmountSats={penaltyAmountSats}
            penaltyEnabled={penaltyEnabled}
            t={t}
          />
        </motion.div>
      </div>

      <AppSettingsDialogs
        appLanguage={appLanguage}
        authUser={authUser}
        downloadingLanguage={downloadingLanguage}
        installedAppLanguagePacks={installedAppLanguagePacks}
        locale={locale}
        onActivateLanguage={handleLanguagePackActivate}
        onInstallLanguage={(language) => {
          void handleLanguagePackInstall(language);
        }}
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
    </PageTransition>
  );
}
