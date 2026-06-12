import type { TargetModeCollections, TargetModeId } from '@/lib/targetModes';

interface EffectiveTargetModeCollectionsOptions extends TargetModeCollections {
  penaltyRuntimeActive: boolean;
}

interface EffectiveBlockingTargetsOptions extends EffectiveTargetModeCollectionsOptions {
  blockedApps: string[];
  blockedWebsites: string[];
  blockedSearchTerms: string[];
}

function filterEffectiveModeRecord(
  record: Record<string, TargetModeId>,
  penaltyRuntimeActive: boolean,
): Record<string, TargetModeId> {
  if (penaltyRuntimeActive) {
    return { ...record };
  }

  return Object.fromEntries(
    Object.entries(record).filter(([, mode]) => mode !== 'penalty'),
  );
}

export function deriveEffectiveTargetModeCollections({
  blockedAppModes,
  blockedWebsiteModes,
  blockedSearchTermModes,
  penaltyRuntimeActive,
}: EffectiveTargetModeCollectionsOptions): TargetModeCollections {
  return {
    blockedAppModes: filterEffectiveModeRecord(blockedAppModes, penaltyRuntimeActive),
    blockedWebsiteModes: filterEffectiveModeRecord(blockedWebsiteModes, penaltyRuntimeActive),
    blockedSearchTermModes: filterEffectiveModeRecord(blockedSearchTermModes, penaltyRuntimeActive),
  };
}

export function deriveEffectiveBlockingTargets({
  blockedApps,
  blockedAppModes,
  blockedWebsites,
  blockedWebsiteModes,
  blockedSearchTerms,
  blockedSearchTermModes,
  penaltyRuntimeActive,
}: EffectiveBlockingTargetsOptions) {
  const effectiveCollections = deriveEffectiveTargetModeCollections({
    blockedAppModes,
    blockedWebsiteModes,
    blockedSearchTermModes,
    penaltyRuntimeActive,
  });

  return {
    ...effectiveCollections,
    blockedApps: blockedApps.filter((targetId) => Boolean(effectiveCollections.blockedAppModes[targetId])),
    blockedWebsites: blockedWebsites.filter((targetId) => Boolean(effectiveCollections.blockedWebsiteModes[targetId])),
    blockedSearchTerms: blockedSearchTerms.filter((targetId) => Boolean(effectiveCollections.blockedSearchTermModes[targetId])),
  };
}
