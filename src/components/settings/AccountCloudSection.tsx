import { motion } from 'framer-motion';
import { Lock, LogOut } from 'lucide-react';
import type { AuthUser } from '@/store/useAuthStore';
import GlassCard from '@/components/GlassCard';
import { sectionItem } from '@/lib/motion';

interface AccountCloudSectionProps {
  authBadgeLabel: string;
  authCardDescription: string;
  authCardTitle: string;
  authDisabled: boolean;
  authPrimaryActionLabel: string;
  authUser: AuthUser | null;
  canSync: boolean;
  firebaseWritesEnabled: boolean;
  isGerman: boolean;
  learningCloudSyncBusy: boolean;
  learningCloudSyncError: string | null;
  nativeGooglePaused: boolean;
  onAuthAction: () => void;
  onOpenCloudSnapshot: () => void;
  onSignOut: () => void;
  onSyncLearningCloud: () => void;
  runtimeSyncError: string | null;
  showAuthMetaRow: boolean;
  syncAvailable: boolean;
  syncBlocked: boolean;
  syncCapabilityReason: string | null;
  syncCapabilityState: string;
  syncRuntimeStarting: boolean;
}

export function AccountCloudSection({
  authBadgeLabel,
  authCardDescription,
  authCardTitle,
  authDisabled,
  authPrimaryActionLabel,
  authUser,
  canSync,
  firebaseWritesEnabled,
  isGerman,
  learningCloudSyncBusy,
  learningCloudSyncError,
  nativeGooglePaused,
  onAuthAction,
  onOpenCloudSnapshot,
  onSignOut,
  onSyncLearningCloud,
  runtimeSyncError,
  showAuthMetaRow,
  syncAvailable,
  syncBlocked,
  syncCapabilityReason,
  syncCapabilityState,
  syncRuntimeStarting,
}: AccountCloudSectionProps) {
  return (
    <>
      <motion.section id="account" variants={sectionItem} className="section-anchor">
        <div className="relative overflow-hidden rounded-[2rem] border border-primary/20 bg-[linear-gradient(145deg,hsl(var(--card)/0.98),hsl(var(--primary)/0.08),hsl(var(--accent)/0.08))] p-5 shadow-[0_20px_60px_hsl(var(--foreground)/0.08)] sm:p-6">
          <div className="absolute -right-12 -top-10 h-36 w-36 rounded-full bg-primary/12 blur-3xl" aria-hidden="true" />
          <div className="absolute -left-10 bottom-0 h-32 w-32 rounded-full bg-accent/12 blur-3xl" aria-hidden="true" />

          <div className="relative z-10 flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start lg:gap-5">
            <div className="order-2 min-w-0 lg:order-1">
              <div className="flex items-start gap-3">
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
                  authUser
                    ? 'bg-success/10 text-success'
                    : authDisabled
                      ? 'bg-warning/10 text-warning'
                      : 'bg-primary/10 text-primary'
                }`}>
                  <Lock size={20} />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                    {isGerman ? 'Konto, Login & Sync' : 'Account, login and sync'}
                  </p>
                  <h2 className="mt-2 text-xl font-black tracking-[-0.04em] text-foreground sm:text-2xl">
                    {authCardTitle}
                  </h2>
                  <p className="mt-3 max-w-xl text-sm leading-6 text-foreground/76">
                    {authCardDescription}
                  </p>
                </div>
              </div>

              {showAuthMetaRow ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${
                    syncAvailable
                      ? 'bg-success/10 text-success'
                      : authUser
                        ? 'bg-warning/10 text-warning'
                      : authDisabled
                        ? 'bg-warning/10 text-warning'
                        : 'bg-primary/10 text-primary'
                  }`}>
                    {authBadgeLabel}
                  </span>
                  {authUser ? (
                    <span className="inline-flex max-w-full rounded-full border border-border/70 bg-background/80 px-3 py-1 text-[10px] font-semibold text-foreground/82">
                      <span className="truncate">{authUser.email ?? authUser.uid}</span>
                    </span>
                  ) : null}
                  {!authUser && nativeGooglePaused ? (
                    <span className="rounded-full border border-warning/30 bg-warning/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-warning">
                      {isGerman ? 'Google auf Android pausiert' : 'Google paused on Android'}
                    </span>
                  ) : null}
                  {authUser && !firebaseWritesEnabled ? (
                    <span className="rounded-full border border-warning/30 bg-warning/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-warning">
                      {isGerman ? 'Cloud-Schreiben aus' : 'Cloud writes off'}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="order-1 flex shrink-0 flex-wrap gap-2 lg:order-2 lg:justify-end">
              {authUser ? (
                <>
                  <button
                    type="button"
                    onClick={onSyncLearningCloud}
                    disabled={learningCloudSyncBusy || !canSync}
                    className="btn-press rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-[0_14px_30px_hsl(var(--primary)/0.24)] disabled:opacity-60"
                  >
                    {learningCloudSyncBusy
                      ? (isGerman ? 'Synchronisiere...' : 'Syncing...')
                      : canSync
                        ? (isGerman ? 'Vokabeln synchronisieren' : 'Sync vocabulary')
                        : (isGerman ? 'Sync nicht bereit' : 'Sync not ready')}
                  </button>
                  <button
                    type="button"
                    onClick={onOpenCloudSnapshot}
                    className="btn-press rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm font-bold text-primary"
                  >
                    {isGerman ? 'Cloud ansehen' : 'View cloud'}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={onAuthAction}
                  className="btn-press rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-[0_14px_30px_hsl(var(--primary)/0.24)]"
                >
                  {authPrimaryActionLabel}
                </button>
              )}
            </div>
            {authUser && (learningCloudSyncError || runtimeSyncError || syncBlocked) ? (
              <p className={`mt-3 text-sm ${learningCloudSyncError || runtimeSyncError ? 'text-destructive' : 'text-warning'}`}>
                {learningCloudSyncError || runtimeSyncError || syncCapabilityReason || (
                  syncCapabilityState === 'writes-disabled'
                    ? (isGerman ? 'Dieser Build kann nicht in die Cloud schreiben.' : 'This build cannot write to the cloud.')
                    : syncRuntimeStarting
                      ? (isGerman ? 'Learning- und Progress-Sync werden gerade vorbereitet.' : 'Learning and progress sync are still starting.')
                      : (isGerman ? 'Sync ist gerade nicht bereit.' : 'Sync is not ready yet.')
                )}
              </p>
            ) : null}
          </div>
        </div>
      </motion.section>

      {authUser ? (
        <motion.section variants={sectionItem} className="section-anchor">
          <GlassCard className="space-y-4 border-destructive/20 bg-[linear-gradient(145deg,hsl(var(--card)/0.96),hsl(var(--destructive)/0.05))]">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
                <LogOut size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">
                  {isGerman ? 'Konto' : 'Account'}
                </p>
                <p className="mt-2 text-lg font-black text-foreground">
                  {isGerman ? 'Abmelden' : 'Sign out'}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="inline-flex max-w-full rounded-full border border-border/70 bg-background/80 px-3 py-1.5 text-[11px] font-semibold text-foreground/82">
                <span className="truncate">{authUser.email ?? authUser.uid}</span>
              </span>
              <button
                type="button"
                onClick={onSignOut}
                className="btn-press rounded-xl bg-destructive px-4 py-3 text-sm font-bold text-destructive-foreground shadow-[0_14px_30px_hsl(var(--destructive)/0.22)]"
              >
                {isGerman ? 'Abmelden' : 'Sign out'}
              </button>
            </div>
          </GlassCard>
        </motion.section>
      ) : null}
    </>
  );
}
