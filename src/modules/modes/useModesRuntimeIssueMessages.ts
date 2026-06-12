import { useMemo } from 'react';
import type { NativeRuntimeIssueKey } from '@/store/useAppStore';
import { NATIVE_RUNTIME_LABELS } from '@/modules/modes/modesPageModel';

export function useModesRuntimeIssueMessages({
  isGerman,
  nativeRuntimeIssues,
  permissionErrorMessage,
  runtimeStatusMessage,
}: {
  isGerman: boolean;
  nativeRuntimeIssues: Record<NativeRuntimeIssueKey, string | null>;
  permissionErrorMessage: string | null;
  runtimeStatusMessage: string | null;
}) {
  return useMemo(() => {
    const messages: string[] = [];
    if (permissionErrorMessage) messages.push(permissionErrorMessage);
    if (runtimeStatusMessage) messages.push(runtimeStatusMessage);
    (Object.entries(nativeRuntimeIssues) as [NativeRuntimeIssueKey, string | null][])
      .filter(([, value]): value is string => Boolean(value))
      .forEach(([key, message]) => {
        const label = NATIVE_RUNTIME_LABELS[key][isGerman ? 'de' : 'en'];
        messages.push(`${label}: ${message}`);
      });
    return messages;
  }, [isGerman, nativeRuntimeIssues, permissionErrorMessage, runtimeStatusMessage]);
}
