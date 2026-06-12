import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import NotificationPermissionPrompt from '@/components/settings/NotificationPermissionPrompt';
import { useAppStore } from '@/store/useAppStore';

const getNotificationPermissionStateMock = vi.hoisted(() => vi.fn());
const tourState = vi.hoisted(() => ({ isOpen: false }));

vi.mock('@/services/notificationService', () => ({
  getNotificationPermissionState: getNotificationPermissionStateMock,
}));

vi.mock('@/components/setup/appTourContext', () => ({
  useAppTour: () => ({
    isOpen: tourState.isOpen,
    currentStep: null,
    currentStepId: null,
    currentStepIndex: 0,
    currentTargetId: null,
    currentRoute: null,
    totalSteps: 0,
    openTour: vi.fn(),
    closeTour: vi.fn(),
    setCurrentStepIndex: vi.fn(),
    isTargetActive: vi.fn().mockReturnValue(false),
  }),
}));

vi.mock('@/components/settings/NotificationPermissionDialog', () => ({
  default: ({
    open,
    title = 'Benachrichtigungen einrichten',
  }: {
    open: boolean;
    title?: string;
  }) => (open ? <div>{title}</div> : null),
}));

function resetStore() {
  useAppStore.setState(
    {
      ...useAppStore.getInitialState(),
      hasHydrated: true,
      notificationsEnabled: true,
      notificationPermissionPromptSeen: false,
    },
    true,
  );
}

describe('NotificationPermissionPrompt', () => {
  beforeEach(() => {
    cleanup();
    resetStore();
    tourState.isOpen = false;
    getNotificationPermissionStateMock.mockReset();
    getNotificationPermissionStateMock.mockResolvedValue('default');
  });

  afterEach(() => {
    cleanup();
    resetStore();
    vi.clearAllMocks();
  });

  it('waits until the app intro is completed before opening the startup prompt', async () => {
    useAppStore.setState({ appIntroSeen: false });

    render(<NotificationPermissionPrompt />);

    await waitFor(() => {
      expect(getNotificationPermissionStateMock).not.toHaveBeenCalled();
    });
    expect(screen.queryByText('Benachrichtigungen beim Start freigeben')).not.toBeInTheDocument();

    act(() => {
      useAppStore.setState({ appIntroSeen: true });
    });

    expect(await screen.findByText('Benachrichtigungen beim Start freigeben')).toBeInTheDocument();
    expect(getNotificationPermissionStateMock).toHaveBeenCalledTimes(1);
  });

  it('stays hidden while the intro dialog is currently open', async () => {
    useAppStore.setState({ appIntroSeen: true });
    tourState.isOpen = true;

    const view = render(<NotificationPermissionPrompt />);

    await waitFor(() => {
      expect(getNotificationPermissionStateMock).not.toHaveBeenCalled();
    });
    expect(screen.queryByText('Benachrichtigungen beim Start freigeben')).not.toBeInTheDocument();

    tourState.isOpen = false;
    view.rerender(<NotificationPermissionPrompt />);

    expect(await screen.findByText('Benachrichtigungen beim Start freigeben')).toBeInTheDocument();
    expect(getNotificationPermissionStateMock).toHaveBeenCalledTimes(1);
  });
});
