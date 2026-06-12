import { motion } from 'framer-motion';
import { ArrowRightCircle, Play } from 'lucide-react';
import GlassCard from '@/components/GlassCard';
import { premiumEase } from '@/lib/motion';
import type { CardBrowserRow } from '@/hooks/useCardBrowser';

interface FilteredDeckPreviewProps {
  previewRows: CardBrowserRow[];
  totalCount: number;
  previewCount: number;
}

export function FilteredDeckPreview({ previewRows, totalCount, previewCount }: FilteredDeckPreviewProps) {
  return (
    <GlassCard tone="learn" surface="featured" className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-foreground/62">Vorschau</p>
          <p className="mt-1 text-sm text-foreground/72">
            {previewCount}/{totalCount} Karten stehen aktuell in der Queue
          </p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/90 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-foreground/66">
          <Play size={11} />
          Live
        </span>
      </div>

      <div className="space-y-2">
        {previewRows.length > 0 ? (
          previewRows.map((row, index) => (
            <motion.div
              key={row.cardId}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: index * 0.015, ease: premiumEase }}
              className="rounded-[1rem] border border-border/70 bg-background/90 p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words text-sm font-black tracking-[-0.03em] text-foreground">{row.front}</p>
                  <p className="mt-1 break-words text-[11px] leading-relaxed text-foreground/64">{row.deckName}</p>
                </div>
                <ArrowRightCircle size={16} className="shrink-0 text-foreground/50" />
              </div>
            </motion.div>
          ))
        ) : (
          <div className="rounded-[1rem] border border-dashed border-border/70 bg-background/70 p-4 text-sm text-foreground/66">
          Noch keine Queue. Das ist die elegante Stelle für Empty State und spätere Router-Integration.
          </div>
        )}
      </div>
    </GlassCard>
  );
}
