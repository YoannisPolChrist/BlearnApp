import { motion } from 'framer-motion';
import { ShieldAlert, ArrowLeft, Globe, Search, Smartphone } from 'lucide-react';
import { ctaFollowThrough, premiumEase } from '@/lib/motion';
import { tonePalettes } from '@/lib/semanticTones';
import { cn } from '@/lib/utils';

interface CoachRemoteBlockScreenProps {
  onReturnHome: () => void | Promise<void>;
  reduceInterfaceMotion?: boolean;
  targetId?: string | null;
  targetLabel?: string | null;
  targetType?: 'app' | 'website' | 'search' | null;
  expiresAt?: number | null;
  isGerman?: boolean;
}

export function CoachRemoteBlockScreen({
  onReturnHome,
  reduceInterfaceMotion = false,
  targetId,
  targetLabel,
  targetType,
  expiresAt,
  isGerman = true,
}: CoachRemoteBlockScreenProps) {
  // Use warning/reflection palette for coach block to feel protective and clear
  const palette = tonePalettes.reflection;
  
  const defaultLabel = targetType === 'website' 
    ? (isGerman ? 'Webseite' : 'Website') 
    : targetType === 'search' 
      ? (isGerman ? 'Suchanfrage' : 'Search') 
      : (isGerman ? 'App' : 'App');
      
  const displayLabel = targetLabel?.trim() || targetId?.trim() || defaultLabel;

  const TargetIcon = (() => {
    if (targetType === 'website') {
      return Globe;
    }
    if (targetType === 'search') {
      return Search;
    }
    return Smartphone;
  })();

  const timeString = expiresAt
    ? new Date(expiresAt).toLocaleTimeString(isGerman ? 'de-DE' : 'en-US', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  const diffMins = expiresAt
    ? Math.max(0, Math.ceil((expiresAt - Date.now()) / 60_000))
    : 0;

  const title = isGerman ? 'Vom Coach gesperrt' : 'Remotely Blocked';
  
  const description = isGerman
    ? `Dein Coach hat diese ${targetType === 'website' ? 'Webseite' : targetType === 'search' ? 'Suchanfrage' : 'App'} (${displayLabel}) vorübergehend gesperrt, um dich vor Ablenkungen zu schützen.`
    : `Your coach has temporarily blocked this ${targetType === 'website' ? 'website' : targetType === 'search' ? 'search request' : 'app'} (${displayLabel}) to protect you from distractions.`;

  const timeDetails = timeString
    ? (isGerman 
        ? `Freigabe erst wieder ab ${timeString} Uhr (in ca. ${diffMins} Minuten).`
        : `Access will be restored at ${timeString} (in about ${diffMins} minutes).`)
    : '';

  const buttonLabel = isGerman ? 'Zurück zum Hauptbildschirm' : 'Back to Main Screen';

  return (
    <div className="app-page app-page-compact page-shell-clip section-stack min-h-screen flex items-center justify-center bg-background px-6">
      <motion.div
        initial={reduceInterfaceMotion ? false : { opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.38, ease: premiumEase }}
        className={`premium-shell ${palette.hero} relative w-full max-w-md px-6 py-8 sm:px-8 sm:py-10 rounded-[2.5rem] border shadow-[0_32px_64px_hsl(var(--foreground)/0.12)] overflow-hidden`}
      >
        <div className={`pointer-events-none absolute -left-16 top-12 h-36 w-36 rounded-full blur-3xl ${palette.glow}`} />
        <div className={`pointer-events-none absolute -right-12 bottom-12 h-40 w-40 rounded-full blur-3xl ${palette.glow}`} />

        <div className="relative z-10 flex flex-col items-center text-center">
          <span className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.16em] bg-foreground/5 text-foreground/80 border border-foreground/10">
            <ShieldAlert size={14} />
            Coach-Sperre
          </span>

          <div className="mt-8 flex h-24 w-24 items-center justify-center rounded-[2rem] bg-foreground/5 text-foreground border border-foreground/10 shadow-inner sm:h-28 sm:w-28 relative">
            <TargetIcon size={40} strokeWidth={1.8} className="text-foreground/80" />
            <div className="absolute -bottom-1 -right-1 bg-background text-destructive border border-destructive/20 rounded-xl p-1.5 shadow-md">
              <ShieldAlert size={16} strokeWidth={2.2} />
            </div>
          </div>

          <h1 className="mt-8 text-3xl font-black tracking-[-0.05em] text-foreground sm:text-4xl">
            {title}
          </h1>

          <p className="mt-4 text-base leading-relaxed text-foreground/80 font-medium px-2">
            {description}
          </p>

          {timeString && (
            <div className="mt-4 px-4 py-2.5 rounded-2xl bg-destructive/10 border border-destructive/20 text-sm font-bold text-destructive">
              {timeDetails}
            </div>
          )}

          <motion.button
            initial="rest"
            animate="rest"
            whileHover={reduceInterfaceMotion ? 'rest' : 'hover'}
            whileTap={reduceInterfaceMotion ? 'rest' : 'tap'}
            variants={ctaFollowThrough}
            onClick={() => void onReturnHome()}
            className={cn(
              'mt-10 inline-flex w-full items-center justify-center gap-3 rounded-[1.7rem] px-6 py-5 text-base font-black tracking-[-0.02em] transition-transform',
              palette.button
            )}
          >
            <ArrowLeft size={20} />
            <span>{buttonLabel}</span>
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
