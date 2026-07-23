import { BookOpenCheck } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface RemoteBlockingReviewGateDialogProps {
  deckName: string;
  onContinueLearning: () => void;
  onOpenChange: (open: boolean) => void;
  onUnlock: () => void;
  open: boolean;
  progress: number;
}

const REQUIRED_REVIEWS = 15;

export function RemoteBlockingReviewGateDialog({
  deckName,
  onContinueLearning,
  onOpenChange,
  onUnlock,
  open,
  progress,
}: RemoteBlockingReviewGateDialogProps) {
  const completed = progress >= REQUIRED_REVIEWS;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-[2rem] border-border bg-[linear-gradient(180deg,hsl(var(--background)/0.98),hsl(var(--card)/0.95))] sm:max-w-md">
        <DialogHeader>
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
            <BookOpenCheck size={21} />
          </div>
          <DialogTitle className="text-2xl font-black tracking-[-0.04em] text-foreground">Coach-Sperre schützen</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
            Zum Ausschalten lernst du 15 unterschiedliche Vokabeln aus „{deckName}“. „Nochmal“ zählt nicht.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-2xl border border-primary/18 bg-primary/8 px-4 py-3">
          <div className="flex items-center justify-between text-xs font-black uppercase tracking-[0.14em] text-primary">
            <span>Fortschritt</span>
            <span>{Math.min(progress, REQUIRED_REVIEWS)} / {REQUIRED_REVIEWS}</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-primary/12">
            <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${Math.min(100, (progress / REQUIRED_REVIEWS) * 100)}%` }} />
          </div>
        </div>

        {completed ? (
          <button type="button" onClick={onUnlock} className="btn-press rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground">
            Coach-Remote-Sperre ausschalten
          </button>
        ) : (
          <button type="button" onClick={onContinueLearning} className="btn-press rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground">
            Jetzt 15 Vokabeln lernen
          </button>
        )}
      </DialogContent>
    </Dialog>
  );
}
