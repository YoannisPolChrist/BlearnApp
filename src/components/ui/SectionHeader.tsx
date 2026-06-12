import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface SectionHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function SectionHeader({ eyebrow, title, description, action, className }: SectionHeaderProps) {
  return (
    <motion.div
      className={cn(
        'flex flex-col items-start gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4',
        className,
      )}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-2 text-[11px] font-black uppercase tracking-[0.22em] text-muted-foreground/80">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="break-words text-lg font-black tracking-[-0.03em] text-foreground sm:text-xl">{title}</h2>
        {description ? (
          <p className="mt-1 max-w-[36rem] break-words text-[13px] leading-relaxed text-muted-foreground sm:text-sm">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="w-full shrink-0 sm:w-auto">{action}</div> : null}
    </motion.div>
  );
}
