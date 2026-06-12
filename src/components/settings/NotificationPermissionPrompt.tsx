import { lazy, Suspense, useEffect, useState } from 'react';
import { useAppTour } from '@/components/setup/appTourContext';
import { getNotificationPermissionState } from '@/services/notificationService';
import { usePreferenceActions, usePreferenceSettings } from '@/store/selectors';
import { useAppStore } from '@/store/useAppStore';

const NotificationPermissionDialog = lazy(() => import('@/components/settings/NotificationPermissionDialog'));

export default function NotificationPermissionPrompt() {
  const { notificationsEnabled, notificationPermissionPromptSeen } = usePreferenceSettings();
  const { setNotificationPermissionPromptSeen } = usePreferenceActions();
  const appIntroSeen = useAppStore((state) => state.appIntroSeen);
  const { isOpen: isTourOpen } = useAppTour();
  const [open, setOpen] = useState(false);
  const promptAllowed = appIntroSeen && !isTourOpen;

  useEffect(() => {
    if (!promptAllowed) {
      setOpen(false);
      return undefined;
    }

    let cancelled = false;

    const checkPermission = async () => {
      const permissionState = await getNotificationPermissionState();
      if (cancelled) return;

      if (
        notificationsEnabled &&
        !notificationPermissionPromptSeen &&
        permissionState === 'default'
      ) {
        setOpen(true);
      }
    };

    void checkPermission();

    return () => {
      cancelled = true;
    };
  }, [notificationPermissionPromptSeen, notificationsEnabled, promptAllowed]);

  return open && promptAllowed ? (
    <Suspense fallback={null}>
      <NotificationPermissionDialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setNotificationPermissionPromptSeen(true);
          }
          setOpen(nextOpen);
        }}
        title="Benachrichtigungen beim Start freigeben"
        description="Blearn kann dich direkt ab dem Start über Erinnerungen, Learn-Status und wichtige Schutzsignale informieren. Wähle jetzt auch gleich, welche Bereiche aktiv sein sollen."
      />
    </Suspense>
  ) : null;
}
