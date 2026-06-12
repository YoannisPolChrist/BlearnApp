import type { ModeId } from '@/modules/modes/modeTypes';

export function getDashboardModeLabel(mode: ModeId, t: (key: string) => string) {
  switch (mode) {
    case 'learn':
      return t('common.modes.learn');
    case 'strict':
      return t('common.modes.reflection');
    case 'lock':
      return t('common.modes.strict');
    case 'penalty':
      return t('common.modes.penalty');
    default:
      return t('common.modes.normal');
  }
}
