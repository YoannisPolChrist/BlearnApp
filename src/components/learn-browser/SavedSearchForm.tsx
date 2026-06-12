import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface SavedSearchFormProps {
  draftName: string;
  onDraftNameChange: (value: string) => void;
  onSave: () => void;
  disabled?: boolean;
}

export function SavedSearchForm({ draftName, onDraftNameChange, onSave, disabled }: SavedSearchFormProps) {
  return (
    <div className="space-y-2.5">
      <label className="block text-[10px] font-black uppercase tracking-[0.16em] text-foreground/62">
        Suche speichern
      </label>
      <div className="flex gap-2">
        <Input
          value={draftName}
          onChange={(event) => onDraftNameChange(event.target.value)}
          placeholder="Name für diese Suche"
          className="h-11 rounded-[1rem] border-border/70 bg-background/90 text-sm"
        />
        <button
          onClick={onSave}
          disabled={disabled}
          className={cn(
            'btn-press rounded-[1rem] px-4 py-2.5 text-sm font-bold',
            disabled ? 'cursor-not-allowed opacity-50' : 'bg-[hsl(var(--mode-learn))] text-[hsl(var(--mode-learn-foreground))]',
          )}
        >
          Speichern
        </button>
      </div>
    </div>
  );
}
