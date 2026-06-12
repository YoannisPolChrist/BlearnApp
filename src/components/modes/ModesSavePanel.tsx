import { AlertTriangle, Banknote, Lock } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { ModeId } from '@/components/modes/ModesSections';

type Palette = {
  badge: string;
  button: string;
  text: string;
};

type Translate = (key: string, values?: Record<string, unknown>) => string;

interface ModesSavePanelProps {
  activateButtonDisabled: boolean;
  currentModeName?: string;
  disabledButtonReason: string | null;
  handleActivate: () => void | Promise<void>;
  isGerman: boolean;
  isSaving: boolean;
  needsPenaltyActivation: boolean;
  pendingAssignmentHint: string;
  permissionWarningActive: boolean;
  permissionWarningText: string;
  retryRuntimeChecks: () => void;
  runtimeIssueMessages: string[];
  saveErrorMessage: string | null;
  selectedMode: ModeId;
  selectedModePalette: Palette;
  selectedModeRequiresTargets: boolean;
  selectedModeHasRequiredApp: boolean;
  showSavedStateHint: boolean;
  t: Translate;
  warningPalette: Palette;
  navigateToPermissions: () => void;
}

export function ModesSavePanel({
  activateButtonDisabled,
  currentModeName,
  disabledButtonReason,
  handleActivate,
  isGerman,
  isSaving,
  needsPenaltyActivation,
  pendingAssignmentHint,
  permissionWarningActive,
  permissionWarningText,
  retryRuntimeChecks,
  runtimeIssueMessages,
  saveErrorMessage,
  selectedMode,
  selectedModePalette,
  selectedModeRequiresTargets,
  selectedModeHasRequiredApp,
  showSavedStateHint,
  t,
  warningPalette,
  navigateToPermissions,
}: ModesSavePanelProps) {
  return (
    <motion.div variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }} className="mt-8">
      <p className="mb-3 text-center text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
        {t('modes.page.introNotice')}
      </p>
      {runtimeIssueMessages.length > 0 ? (
        <div className="mb-4 rounded-2xl border border-warning/30 bg-warning/8 px-4 py-4 text-left text-sm text-foreground shadow-[0_14px_34px_hsl(var(--warning)/0.08)]">
          <div className="flex items-start gap-3">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-warning" />
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-warning">
                {isGerman ? 'Android-Schutz prüfen' : 'Check Android protection'}
              </p>
              <div className="mt-1 space-y-1 text-foreground/82">
                {runtimeIssueMessages.map((message, index) => (
                  <p key={`runtime-issue-${index}`} className="leading-relaxed">
                    {message}
                  </p>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={retryRuntimeChecks}
                  className="rounded-xl bg-warning px-3 py-2 text-xs font-bold text-warning-foreground"
                >
                  {isGerman ? 'Erneut prüfen' : 'Retry checks'}
                </button>
                <button
                  type="button"
                  onClick={navigateToPermissions}
                  className="rounded-xl border border-warning/30 bg-background/80 px-3 py-2 text-xs font-bold text-foreground"
                >
                  {isGerman ? 'Zu Android-Rechten' : 'Open Android permissions'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {permissionWarningActive ? (
        <div className={cn('mb-4 rounded-2xl border px-4 py-3 text-sm', warningPalette.badge)}>
          <p className="text-sm font-semibold text-foreground">{t('modes.warnings.title')}</p>
          <p className="mt-1 text-xs text-foreground/78">
            {t('modes.warnings.description', { missing: permissionWarningText || t('modes.permissions.usage') })}
          </p>
          <button
            type="button"
            onClick={navigateToPermissions}
            className={cn('mt-2 text-xs font-bold uppercase tracking-[0.18em] underline-offset-2 hover:underline', warningPalette.text)}
          >
            {t('modes.warnings.cta')}
          </button>
        </div>
      ) : null}
      {!permissionWarningActive && selectedModeRequiresTargets && !selectedModeHasRequiredApp ? (
        <div className={cn('mb-4 rounded-2xl border px-4 py-3 text-sm', warningPalette.badge)}>
          <p className="text-sm font-semibold text-foreground">{currentModeName || t('modes.page.title')}</p>
          <p className="mt-1 text-xs text-foreground/78">
            {pendingAssignmentHint}
          </p>
        </div>
      ) : null}
      <div className="space-y-2">
        <motion.button
          whileHover={isSaving ? undefined : { scale: 1.02 }}
          whileTap={isSaving ? undefined : { scale: 0.98 }}
          onClick={() => void handleActivate()}
          disabled={activateButtonDisabled}
          className={cn('flex w-full items-center justify-center gap-2 rounded-xl py-4 font-bold uppercase tracking-wider disabled:opacity-30', selectedModePalette.button)}
        >
          {isSaving
            ? (isGerman ? 'Speichert...' : 'Saving...')
            : selectedMode === 'lock'
              ? <><Lock size={18} /> {t('modes.page.lockButton')}</>
              : needsPenaltyActivation
                ? <><Banknote size={18} /> {t('modes.page.penaltyButton')}</>
                : t('modes.page.saveButton')}
        </motion.button>
        {isSaving ? (
          <p className="text-center text-xs font-semibold uppercase tracking-[0.16em] text-foreground/70">
            {isGerman ? 'Änderungen und Schutz werden gerade aktiviert.' : 'Changes and protection are being activated now.'}
          </p>
        ) : null}
        {showSavedStateHint ? (
          <div className="rounded-2xl border border-border/70 bg-background/70 px-4 py-3 text-left text-sm text-foreground/72 shadow-[0_14px_34px_hsl(var(--foreground)/0.04)]">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">
              {isGerman ? 'Bereits gespeichert' : 'Already saved'}
            </p>
            <p className="mt-1 font-semibold leading-relaxed text-foreground/72">
              {isGerman
                ? 'Diese Einstellungen sind bereits aktiv.'
                : 'These settings are already active. Change something if you want to save again.'}
            </p>
          </div>
        ) : null}
        {saveErrorMessage ? (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/8 px-4 py-3 text-left text-sm text-destructive shadow-[0_14px_34px_hsl(var(--destructive)/0.08)]">
            <div className="flex items-start gap-3">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-destructive/80">
                  {isGerman ? 'Synchronisierung fehlgeschlagen' : 'Sync failed'}
                </p>
                <p className="mt-1 font-semibold leading-relaxed text-destructive">
                  {saveErrorMessage}
                </p>
              </div>
            </div>
          </div>
        ) : null}
        {disabledButtonReason ? (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/8 px-4 py-3 text-left text-sm text-destructive shadow-[0_14px_34px_hsl(var(--destructive)/0.08)]">
            <div className="flex items-start gap-3">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-destructive/80">
                  Warum gerade gesperrt
                </p>
                <p className="mt-1 font-semibold leading-relaxed text-destructive">
                  {disabledButtonReason}
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}
