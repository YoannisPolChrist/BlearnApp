import { useEffect, useMemo, useState } from 'react';
import type { InstalledApp } from '@/plugins/ScreenTimePlugin';
import type { TargetModeId } from '@/lib/targetModes';
import { buildActiveUnlockDisplayEntries } from '@/modules/modes/modesPageModel';

export function useModesActiveUnlocks(options: {
  blockedAppModes: Record<string, TargetModeId>;
  blockedApps: string[];
  blockedSearchTermModes: Record<string, TargetModeId>;
  blockedSearchTerms: string[];
  blockedWebsiteModes: Record<string, TargetModeId>;
  blockedWebsites: string[];
  installedApps: InstalledApp[];
  unlockedTargets: Record<string, number>;
}) {
  const [unlockClockNow, setUnlockClockNow] = useState(() => Date.now());
  const activeUnlocks = useMemo(
    () => buildActiveUnlockDisplayEntries({
      ...options,
      now: unlockClockNow,
    }),
    [options, unlockClockNow],
  );

  useEffect(() => {
    if (activeUnlocks.length === 0) return;
    const timer = window.setInterval(() => {
      setUnlockClockNow(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, [activeUnlocks.length]);

  return activeUnlocks;
}
