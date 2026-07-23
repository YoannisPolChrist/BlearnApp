import { Check, Cloud, Globe2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface SettingsLanguagePackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const futureLanguages = ['English', 'Français', 'Español', 'Italiano', 'Arabic'];

export default function SettingsLanguagePackDialog({ open, onOpenChange }: SettingsLanguagePackDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-[2rem] border-border bg-[linear-gradient(180deg,hsl(var(--background)/0.98),hsl(var(--card)/0.95))] p-0 sm:max-w-xl">
        <DialogHeader className="border-b border-border/70 px-5 py-5 pr-16 sm:px-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-[1.35rem] border border-primary/20 bg-primary/10 text-primary">
              <Globe2 size={20} />
            </div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">Sprache</p>
              <DialogTitle className="mt-2 text-2xl font-black tracking-[-0.04em] text-foreground">Sprachen verwalten</DialogTitle>
              <DialogDescription className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Deutsch ist auf diesem Gerät installiert. Weitere Sprachen werden später als Cloud-Sprachpakete verfügbar.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 px-5 py-5 sm:px-6">
          <div className="flex items-center justify-between rounded-2xl border border-primary/24 bg-primary/10 px-4 py-3">
            <span className="font-bold text-foreground">Deutsch</span>
            <span className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-[0.14em] text-primary"><Check size={14} /> Installiert</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {futureLanguages.map((language) => (
              <div key={language} className="flex items-center gap-2 rounded-xl border border-border/70 bg-background/58 px-3 py-2.5 text-sm text-muted-foreground">
                <Cloud size={15} className="text-primary/72" />
                <span>{language}</span>
                <span className="ml-auto text-[10px] font-black uppercase tracking-[0.12em] text-foreground/42">Später</span>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
