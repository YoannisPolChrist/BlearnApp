import { Info } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface InfoPopoverProps {
  title: string;
  description: string;
  compact?: boolean;
}

export function InfoPopover({ title, description, compact = false }: InfoPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={title}
          className={`btn-press inline-flex items-center justify-center rounded-full border border-border bg-card/80 text-muted-foreground transition-colors hover:text-foreground ${
            compact ? 'h-7 w-7' : 'h-8 w-8'
          }`}
        >
          <Info size={compact ? 14 : 15} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
      className="w-[18rem] rounded-2xl border-border bg-card/95 p-4 shadow-[0_20px_60px_hsl(var(--foreground)/0.16)] lg:backdrop-blur-xl"
      >
        <p className="text-sm font-bold text-foreground">{title}</p>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{description}</p>
      </PopoverContent>
    </Popover>
  );
}
