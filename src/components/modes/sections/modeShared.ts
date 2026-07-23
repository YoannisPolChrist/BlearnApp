import type { ComponentType } from 'react';
import type { ActiveModeId, TargetModeId } from '@/lib/targetModes';
import type { ModeColorId } from '@/lib/semanticTones';
import type { ModeId } from '@/modules/modes/modeTypes';

export type { ModeId };

export interface ModeDefinition {
  id: ModeId;
  name: string;
  subtitle: string;
  description: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  tone: ModeColorId;
  showBlockConfig: boolean;
}

export interface SelectionClasses {
  selected: string;
  ring: string;
  dot: string;
  badge: string;
}

export function getModeLabelText(
  mode: TargetModeId | ActiveModeId | 'normal',
  translate: (key: string, params?: Record<string, string | number>) => string,
) {
  switch (mode) {
    case 'penalty':
      return translate('modes.badges.penalty');
    case 'learn':
      return translate('modes.badges.learn');
    case 'lock':
      return translate('modes.badges.lock');
    case 'normal':
      return translate('common.modes.normal');
    default:
      return translate('modes.badges.strict');
  }
}

export function isAssignableMode(mode: ModeId): mode is TargetModeId {
  return mode === 'strict' || mode === 'learn' || mode === 'penalty';
}

export const REVIEW_MIX_OPTIONS = [5, 10, 15, 20];
