import { lazy, Suspense } from 'react';
import type { SetupStep } from '@/components/setup/SetupNarrativeDialog';
import type { AuthUser } from '@/store/useAuthStore';
import type { AppLanguage } from '@/store/useAppStore';

const SetupNarrativeDialog = lazy(() => import('@/components/setup/SetupNarrativeDialog'));
const NotificationPermissionDialog = lazy(() => import('@/components/settings/NotificationPermissionDialog'));
const SettingsLanguagePackDialog = lazy(() => import('@/components/settings/SettingsLanguagePackDialog'));
const LearningCloudSnapshotDialog = lazy(() => import('@/components/settings/LearningCloudSnapshotDialog'));

interface AppSettingsDialogsProps {
  appLanguage: AppLanguage;
  authUser: AuthUser | null;
  downloadingLanguage: AppLanguage | null;
  installedAppLanguagePacks: AppLanguage[];
  locale: string;
  onActivateLanguage: (language: AppLanguage) => void;
  onInstallLanguage: (language: AppLanguage) => void;
  onLearningCloudSnapshotDialogChange: (open: boolean) => void;
  onLanguagePackDialogChange: (open: boolean) => void;
  onNotificationDialogChange: (open: boolean) => void;
  onPermissionGuideChange: (open: boolean) => void;
  onPermissionGuideSeen: () => void;
  onRefreshNotificationPermission: () => void;
  permissionSetupSteps: SetupStep[];
  showLanguagePackDialog: boolean;
  showLearningCloudSnapshotDialog: boolean;
  showNotificationDialog: boolean;
  showPermissionGuide: boolean;
}

export function AppSettingsDialogs({
  appLanguage,
  authUser,
  downloadingLanguage,
  installedAppLanguagePacks,
  locale,
  onActivateLanguage,
  onInstallLanguage,
  onLearningCloudSnapshotDialogChange,
  onLanguagePackDialogChange,
  onNotificationDialogChange,
  onPermissionGuideChange,
  onPermissionGuideSeen,
  onRefreshNotificationPermission,
  permissionSetupSteps,
  showLanguagePackDialog,
  showLearningCloudSnapshotDialog,
  showNotificationDialog,
  showPermissionGuide,
}: AppSettingsDialogsProps) {
  return (
    <>
      {showPermissionGuide ? (
        <Suspense fallback={null}>
          <SetupNarrativeDialog
            open={showPermissionGuide}
            onOpenChange={(nextOpen) => {
              if (!nextOpen) {
                onPermissionGuideSeen();
              }
              onPermissionGuideChange(nextOpen);
            }}
            title="Berechtigungen"
            description="Erkennung, Overlay und Trigger aktivieren."
            steps={permissionSetupSteps}
            finishLabel="Fertig"
            onFinish={onPermissionGuideSeen}
            onDismiss={onPermissionGuideSeen}
          />
        </Suspense>
      ) : null}

      {showLanguagePackDialog ? (
        <Suspense fallback={null}>
          <SettingsLanguagePackDialog
            open={showLanguagePackDialog}
            onOpenChange={onLanguagePackDialogChange}
            appLanguage={appLanguage}
            installedAppLanguagePacks={installedAppLanguagePacks}
            downloadingLanguage={downloadingLanguage}
            onActivateLanguage={onActivateLanguage}
            onInstallLanguage={onInstallLanguage}
          />
        </Suspense>
      ) : null}

      {showNotificationDialog ? (
        <Suspense fallback={null}>
          <NotificationPermissionDialog
            open={showNotificationDialog}
            onOpenChange={(nextOpen) => {
              onNotificationDialogChange(nextOpen);
              if (!nextOpen) {
                onRefreshNotificationPermission();
              }
            }}
          />
        </Suspense>
      ) : null}

      {showLearningCloudSnapshotDialog ? (
        <Suspense fallback={null}>
          <LearningCloudSnapshotDialog
            open={showLearningCloudSnapshotDialog}
            onOpenChange={onLearningCloudSnapshotDialogChange}
            user={authUser}
            locale={locale}
          />
        </Suspense>
      ) : null}
    </>
  );
}
