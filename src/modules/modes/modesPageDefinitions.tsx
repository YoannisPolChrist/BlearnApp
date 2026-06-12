import { Banknote, Brain, Globe, Search, Shield, Smartphone, Wind as WindIcon } from 'lucide-react';
import type { ModeDefinition, ModeId } from '@/components/modes/ModesSections';

type Translate = (key: string, values?: Record<string, unknown>) => string;

export type BlockTabId = 'apps' | 'websites' | 'search';

export function buildModeDefinitions(t: Translate): ModeDefinition[] {
  return [
    { id: 'normal', name: t('common.modes.normal'), subtitle: t('modes.modeCards.normal.subtitle'), description: t('modes.modeCards.normal.description'), icon: Smartphone, tone: 'normal', showBlockConfig: false },
    { id: 'strict', name: t('common.modes.reflection'), subtitle: t('modes.modeCards.strict.subtitle'), description: t('modes.modeCards.strict.description'), icon: WindIcon, tone: 'reflection', showBlockConfig: true },
    { id: 'learn', name: t('common.modes.learn'), subtitle: t('modes.modeCards.learn.subtitle'), description: t('modes.modeCards.learn.description'), icon: Brain, tone: 'learn', showBlockConfig: true },
    { id: 'penalty', name: t('common.modes.penalty'), subtitle: t('modes.modeCards.penalty.subtitle'), description: t('modes.modeCards.penalty.description'), icon: Banknote, tone: 'penalty', showBlockConfig: true },
    { id: 'lock', name: t('modes.badges.lock'), subtitle: t('modes.modeCards.lock.subtitle'), description: t('modes.modeCards.lock.description'), icon: Shield, tone: 'lock', showBlockConfig: false },
  ];
}

export function getEditableMode(selectedMode: ModeId) {
  return selectedMode === 'strict' || selectedMode === 'learn' || selectedMode === 'penalty' ? selectedMode : null;
}

export function buildBlockTabs(options: {
  t: Translate;
  blockedAppsCount: number;
  blockedWebsitesCount: number;
  blockedSearchTermsCount: number;
}) {
  return [
    { id: 'apps' as const, label: options.t('modes.blocking.tabs.apps'), icon: <Shield size={14} />, count: options.blockedAppsCount },
    { id: 'websites' as const, label: options.t('modes.blocking.tabs.websites'), icon: <Globe size={14} />, count: options.blockedWebsitesCount },
    { id: 'search' as const, label: options.t('modes.blocking.tabs.search'), icon: <Search size={14} />, count: options.blockedSearchTermsCount },
  ];
}
