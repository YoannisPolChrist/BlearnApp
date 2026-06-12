import { showSuccessFeedback } from '@/lib/successFeedback';

export type SettingsToastKind = 'saved' | 'active';

type SettingsToastOptions = {
  detail?: string;
  durationMs?: number;
  onDone?: () => void;
};

export function showSettingsToast(kind: SettingsToastKind, options?: SettingsToastOptions) {
  const title = kind === 'saved' ? 'Einstellungen gespeichert' : 'Modus jetzt aktiv';
  const description = options?.detail?.trim() ? options.detail.trim() : undefined;
  const eyebrow = kind === 'saved' ? 'Blearn' : 'Modus';

  showSuccessFeedback({
    eyebrow,
    title,
    description,
    durationMs: options?.durationMs,
    onDone: options?.onDone,
  });
}
