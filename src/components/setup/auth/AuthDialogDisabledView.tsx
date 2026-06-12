import { X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { dialogCloseButtonClassName } from '@/components/ui/dialogStyles';

interface AuthDialogDisabledViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resetAndClose: () => void;
}

export function AuthDialogDisabledView({
  open,
  onOpenChange,
  resetAndClose,
}: AuthDialogDisabledViewProps) {
  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-xl rounded-[2rem] border-warning/30 bg-background p-0 shadow-[0_32px_120px_rgba(0,0,0,0.34)] sm:w-[calc(100vw-2rem)]">
        <div className="relative overflow-hidden rounded-[2rem] border border-warning/20 bg-[linear-gradient(180deg,hsl(var(--warning)/0.14),hsl(var(--background))_48%,hsl(var(--warning)/0.08)_100%)] p-6 sm:p-8">
          <button
            type="button"
            onClick={resetAndClose}
            className={dialogCloseButtonClassName}
            aria-label="Schliessen"
          >
            <X className="h-4 w-4" />
          </button>
          <DialogHeader className="space-y-2 pr-12 text-left">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-warning">
              Firebase fehlt
            </p>
            <DialogTitle className="text-2xl font-black tracking-[-0.04em] text-foreground">
              Firebase-Setup fehlt noch
            </DialogTitle>
            <DialogDescription className="text-sm leading-6 text-warning-foreground/80">
              Setze `VITE_FIREBASE_*`, aktiviere E-Mail/Passwort und Firestore, dann starte die App neu.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              className="btn-press rounded-full border border-warning/40 px-3 py-2 text-xs font-bold text-warning-foreground"
              onClick={() => window.open('https://console.firebase.google.com', '_blank')}
            >
              Firebase Console oeffnen
            </button>
            <button
              type="button"
              className="btn-press rounded-full border border-warning/30 px-3 py-2 text-xs font-bold text-warning-foreground"
              onClick={resetAndClose}
            >
              Schliessen
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
