import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Clock3, Globe, Search, Shield, Smartphone } from 'lucide-react';
import { ctaFollowThrough, premiumEase } from '@/lib/motion';
import { getModePalette } from '@/lib/semanticTones';
import { formatUnlockDurationLabel } from '@/lib/unlockDuration';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

export type InterventionBlockType = 'app' | 'website' | 'search';
export type InterventionMode = 'reflection' | 'strict' | 'learn' | 'penalty' | 'lock';

interface InterventionOverlayScreenProps {
  open: boolean;
  blockedTarget?: string | null;
  blockType: InterventionBlockType;
  mode: InterventionMode;
  penaltyAmountLabel?: string;
  recipientLabel?: string;
  penaltyConfirmStep?: 1 | 2;
  penaltyBusy?: boolean;
  penaltyErrorMessage?: string;
  unlockDurationMinutes?: number | null;
  closeLabel?: string;
  onPrimaryAction: () => void;
  onClose?: () => void;
}

function getBlockMeta(blockType: InterventionBlockType) {
  switch (blockType) {
    case 'website':
      return {
        label: 'Website blockiert',
        icon: Globe,
      };
    case 'search':
      return {
        label: 'Suche blockiert',
        icon: Search,
      };
    default:
      return {
        label: 'App blockiert',
        icon: Smartphone,
      };
  }
}

function getInterventionTone(mode: InterventionMode) {
  if (mode === 'learn') {
    return 'learn' as const;
  }

  if (mode === 'penalty') {
    return 'penalty' as const;
  }

  if (mode === 'lock') {
    return 'strict' as const;
  }

  if (mode === 'strict') {
    return 'reflection' as const;
  }

  return 'reflection' as const;
}

export default function InterventionOverlayScreen({
  open,
  blockedTarget,
  blockType,
  mode,
  penaltyAmountLabel = '0 sats',
  recipientLabel = 'deinen Accountability-Partner',
  penaltyConfirmStep = 1,
  penaltyBusy = false,
  penaltyErrorMessage,
  unlockDurationMinutes,
  closeLabel = 'Abbrechen',
  onPrimaryAction,
  onClose,
}: InterventionOverlayScreenProps) {
  const reducedMotion = useReducedMotion();
  const isMobile = useIsMobile();
  const reduceInterfaceMotion = reducedMotion || isMobile;
  const interventionTone = getInterventionTone(mode);
  const palette = getModePalette(interventionTone);
  const durationLabel = formatUnlockDurationLabel(unlockDurationMinutes);
  const { icon: BlockIcon, label: blockLabel } = getBlockMeta(blockType);

  if (!open) {
    return null;
  }

  const title =
    mode === 'penalty'
      ? penaltyConfirmStep === 1
        ? 'Freigabe kostet'
        : 'Letzte Bestaetigung'
      : mode === 'learn'
        ? 'Learn vor Freigabe'
        : mode === 'lock'
          ? 'App bleibt blockiert'
          : 'Reflexion vor Freigabe';

  const description =
    mode === 'penalty'
      ? penaltyConfirmStep === 1
        ? `Pruefe die Zahlung von ${penaltyAmountLabel}, um die Freigabe fortzusetzen.`
        : `${penaltyAmountLabel} werden jetzt an ${recipientLabel} ausgeloest.`
      : mode === 'learn'
        ? 'Starte jetzt deine Lernrunde, um den Zugriff freizuschalten.'
        : mode === 'lock'
          ? 'Dieser Schutzmodus laesst gerade keine Freischaltung zu.'
          : 'Starte jetzt kurz die Reflexion, um den Zugriff freizuschalten.';

  const primaryLabel =
    mode === 'penalty'
      ? penaltyBusy
        ? 'Zahlung laeuft...'
        : penaltyConfirmStep === 1
          ? 'Zahlung pruefen'
          : 'Jetzt bezahlen'
      : mode === 'learn'
        ? 'Learn starten'
        : mode === 'lock'
          ? 'Zurueck zu Blearn'
          : 'Reflexion starten';

  const targetTitle = blockedTarget || blockLabel;

  return (
    <div
      data-testid="intervention-root"
      data-intervention-tone={interventionTone}
      className="relative min-h-[100svh] overflow-hidden bg-background text-foreground"
    >
      <div className="absolute inset-0 bg-[linear-gradient(180deg,hsl(var(--background)),hsl(var(--background)/0.96)_40%,hsl(var(--background)))]" />
      <div className={cn('absolute -left-20 top-[-3rem] h-72 w-72 rounded-full blur-3xl', palette.glow)} />
      <div className={cn('absolute -bottom-16 right-[-3rem] h-80 w-80 rounded-full blur-3xl opacity-70', palette.glow)} />

      <motion.div
        // Ruhiger "Über-die-App-legen"-Effekt: das Overlay sinkt leicht herab
        // und schärft sich ein, statt abrupt aufzupoppen. Nur transform/opacity
        // (GPU); die Animation läuft auch auf Mobile, aber respektiert
        // prefers-reduced-motion.
        initial={reducedMotion ? false : { opacity: 0, scale: 1.03, y: -8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4, ease: premiumEase }}
        className="relative z-10 flex min-h-[100svh] flex-col px-6 pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)] pt-[calc(env(safe-area-inset-top,0px)+1.5rem)] sm:px-8"
        style={{ willChange: 'transform, opacity' }}
      >
        <div className="flex flex-1 flex-col justify-between gap-10">
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <span className={cn('inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.16em]', palette.badge)}>
                <Shield size={15} />
                Blearn
              </span>
            </div>

            <div className="max-w-xl space-y-3">
              <h1 className="text-[2.5rem] font-black tracking-[-0.07em] text-foreground sm:text-[3.5rem]">
                {title}
              </h1>
              <p className="text-base leading-relaxed text-foreground/72 sm:text-lg">
                {description}
              </p>
            </div>

            <div className={cn('w-full max-w-xl rounded-[2rem] border px-5 py-5 shadow-[0_24px_60px_hsl(var(--foreground)/0.08)]', palette.card)}>
              <div className="flex items-center gap-3">
                <div className={cn('flex h-12 w-12 items-center justify-center rounded-[1.2rem]', palette.icon)}>
                  <BlockIcon size={20} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-2xl font-black tracking-[-0.05em] text-foreground">
                    {targetTitle}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className={cn('inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.14em]', palette.badge)}>
                      <BlockIcon size={13} />
                      {blockLabel}
                    </span>
                    {durationLabel && mode !== 'lock' ? (
                      <span className={cn('inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.14em]', palette.badge)}>
                        <Clock3 size={13} />
                        {durationLabel}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            {mode === 'penalty' ? (
              <div className={cn('w-full max-w-xl rounded-[1.7rem] border px-5 py-4 text-sm text-foreground/76', palette.card)}>
                {penaltyConfirmStep === 1
                  ? 'Ein weiterer Tap fuehrt in die letzte Bestaetigung.'
                  : 'Mit dem naechsten Tap wird die Zahlung sofort ausgeloest.'}
              </div>
            ) : null}

            {penaltyErrorMessage ? (
              <div className="w-full max-w-xl rounded-[1.7rem] border border-destructive/25 bg-destructive/10 px-5 py-4 text-sm font-semibold text-destructive">
                {penaltyErrorMessage}
              </div>
            ) : null}
          </div>

          <div className="w-full max-w-xl space-y-3">
            <motion.button
              type="button"
              initial="rest"
              animate="rest"
              whileHover={reduceInterfaceMotion ? 'rest' : 'hover'}
              whileTap={reduceInterfaceMotion ? 'rest' : 'tap'}
              variants={ctaFollowThrough}
              onClick={() => {
                if (mode === 'lock') {
                  onClose?.();
                  return;
                }
                onPrimaryAction();
              }}
              disabled={penaltyBusy}
              className={cn('flex w-full items-center justify-center gap-3 rounded-[1.7rem] px-6 py-5 text-base font-black tracking-[-0.02em] transition-transform', palette.button)}
            >
              <span>{primaryLabel}</span>
              <ArrowRight size={20} />
            </motion.button>

            {onClose && mode !== 'lock' ? (
              <button
                type="button"
                onClick={() => {
                  onClose();
                }}
                className="flex w-full items-center justify-center rounded-[1.7rem] border border-foreground/10 bg-foreground/5 px-6 py-4 text-sm font-bold text-foreground/72 transition-colors hover:bg-foreground/8"
              >
                {closeLabel}
              </button>
            ) : null}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
