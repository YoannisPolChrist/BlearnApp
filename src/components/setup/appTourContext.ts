import { createContext, useContext } from 'react';
import type { AppTourStep } from '@/components/setup/appTourSteps';

export interface AppTourContextValue {
  isOpen: boolean;
  currentStep: AppTourStep | null;
  currentStepId: string | null;
  currentStepIndex: number;
  currentTargetId: string | null;
  currentRoute: string | null;
  totalSteps: number;
  openTour: () => void;
  closeTour: () => void;
  setCurrentStepIndex: (index: number) => void;
  isTargetActive: (targetId: string) => boolean;
}

export const AppTourContext = createContext<AppTourContextValue>({
  isOpen: false,
  currentStep: null,
  currentStepId: null,
  currentStepIndex: 0,
  currentTargetId: null,
  currentRoute: null,
  totalSteps: 0,
  openTour: () => undefined,
  closeTour: () => undefined,
  setCurrentStepIndex: () => undefined,
  isTargetActive: () => false,
});

export function useAppTour() {
  return useContext(AppTourContext);
}
