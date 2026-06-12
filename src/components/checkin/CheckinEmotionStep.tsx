import { AnimatePresence, motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CheckinEmotionEntry {
  id: string;
  label: string;
  emoji: string;
}

export interface CheckinEmotionCategory {
  id: string;
  label: string;
  color: string;
  emotions: CheckinEmotionEntry[];
}

interface CheckinEmotionStepProps {
  stepKey: string;
  categories: CheckinEmotionCategory[];
  selectedCategories: string[];
  selectedEmotions: string[];
  onToggleCategory: (id: string) => void;
  onToggleEmotion: (id: string) => void;
  onFinish: () => void;
  canComplete: boolean;
  isBlockedFlow: boolean;
  badgeClassName: string;
  cardClassName: string;
  summaryClassName: string;
  chipClassName: string;
  inactiveCategoryClassName?: string;
  inactiveEmotionClassName?: string;
  minSelections?: number;
  maxSelections?: number;
  finishLabel?: string;
}

export function CheckinEmotionStep({
  stepKey,
  categories,
  selectedCategories,
  selectedEmotions,
  onToggleCategory,
  onToggleEmotion,
  onFinish,
  canComplete,
  isBlockedFlow,
  badgeClassName,
  cardClassName,
  summaryClassName,
  chipClassName,
  inactiveCategoryClassName,
  inactiveEmotionClassName,
  minSelections = 1,
  maxSelections = 5,
  finishLabel = 'Abschließen',
}: CheckinEmotionStepProps) {
  const selectedEmotionEntries = selectedEmotions
    .map((emotionId) => categories.flatMap((category) => category.emotions).find((emotion) => emotion.id === emotionId))
    .filter((emotion): emotion is CheckinEmotionEntry => Boolean(emotion));

  return (
    <motion.div
      key={stepKey}
      initial={{ opacity: 0, y: 30, filter: 'blur(6px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      exit={{ opacity: 0, y: -20, filter: 'blur(6px)' }}
      transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
      className="relative z-10 flex flex-1 flex-col pb-[calc(7rem+env(safe-area-inset-bottom,0px))] sm:pb-0"
    >
      <div className="flex flex-1 flex-col">
        <motion.h2
          className="mb-2 text-center font-serif text-3xl font-bold text-foreground"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
        >
          Wie fühlst du dich?
        </motion.h2>
        <motion.p
          className="mb-2 text-center text-sm text-muted-foreground"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          {`Wähle ${minSelections} bis ${maxSelections} Emotionen`}
        </motion.p>
        <motion.p
          className="mb-6 text-center text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.14 }}
        >
          {`${selectedEmotions.length} von max. ${maxSelections} gewählt`}
        </motion.p>

        <motion.div
          className={cn(
            'mb-5 rounded-[1.5rem] border px-4 py-3 text-center shadow-[0_18px_40px_hsl(var(--mode-breathing-glow)/0.12)]',
            badgeClassName,
          )}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16 }}
        >
          <p className="text-[11px] font-black uppercase tracking-[0.18em]">Mehr Gefühlstiefe</p>
          <p className="mt-2 text-sm font-semibold leading-relaxed">
            {`Wähle mindestens eine passende Emotion. Wenn es genauer sein soll, kannst du bis zu ${maxSelections} auswählen.`}
          </p>
        </motion.div>

        <motion.div
          className="mb-6 flex flex-wrap justify-center gap-2"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
        >
          {categories.map((category, index) => {
            const isActive = selectedCategories.includes(category.id);
            return (
              <motion.button
                key={category.id}
                onClick={() => onToggleCategory(category.id)}
                whileTap={{ scale: 0.95 }}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + index * 0.03 }}
                className={`rounded-xl border px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all duration-300 ${
                  isActive
                    ? badgeClassName
                    : inactiveCategoryClassName
                      || 'border-[hsl(var(--mode-breathing-border)/0.24)] bg-[hsl(var(--mode-breathing-surface)/0.24)] text-foreground/72 backdrop-blur-sm hover:bg-[hsl(var(--mode-breathing-surface)/0.38)]'
                }`}
                style={isActive ? { boxShadow: `0 10px 28px ${category.color}33` } : undefined}
              >
                {category.label}
              </motion.button>
            );
          })}
        </motion.div>

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={onFinish}
          disabled={!canComplete}
          className={cn(
            'mb-6 flex w-full items-center justify-center gap-2 rounded-2xl py-4 font-semibold disabled:opacity-30',
            cardClassName,
          )}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {finishLabel}
          <Check size={18} />
        </motion.button>

        <motion.div
          className="mb-6 flex flex-wrap justify-center gap-2.5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          {categories
            .filter((category) => selectedCategories.length === 0 || selectedCategories.includes(category.id))
            .flatMap((category, categoryIndex) =>
              category.emotions.map((emotion, emotionIndex) => {
                const isSelected = selectedEmotions.includes(emotion.id);
                const globalIndex = categoryIndex * 12 + emotionIndex;

                return (
                  <motion.button
                    key={emotion.id}
                    onClick={() => onToggleEmotion(emotion.id)}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{
                      delay: 0.22 + globalIndex * 0.012,
                      type: 'spring',
                      stiffness: 300,
                      damping: 20,
                    }}
                    whileHover={{ scale: 1.06, y: -2 }}
                    whileTap={{ scale: 0.92 }}
                    className={`flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm transition-all duration-300 ${
                      isSelected
                        ? badgeClassName
                        : inactiveEmotionClassName
                          || 'border-[hsl(var(--mode-breathing-border)/0.24)] bg-[hsl(var(--mode-breathing-surface)/0.26)] text-foreground backdrop-blur-sm hover:border-[hsl(var(--mode-breathing-border)/0.46)] hover:bg-[hsl(var(--mode-breathing-surface)/0.38)]'
                    }`}
                    style={isSelected ? { boxShadow: `0 14px 34px ${category.color}44` } : undefined}
                  >
                    <span className="text-lg">{emotion.emoji}</span>
                    <span className="font-semibold">{emotion.label}</span>
                    {isSelected ? (
                      <motion.span
                        initial={{ scale: 0, rotate: -90 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: 'spring', stiffness: 400 }}
                      >
                        <Check size={14} strokeWidth={3} />
                      </motion.span>
                    ) : null}
                  </motion.button>
                );
              }),
            )}
        </motion.div>

        <AnimatePresence>
          {selectedEmotionEntries.length > 0 ? (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className={cn('mb-4 px-4 py-3', summaryClassName)}
            >
              <div className="flex flex-wrap items-center justify-center gap-2">
                {selectedEmotionEntries.map((emotion) => (
                  <motion.span
                    key={emotion.id}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    className={cn('inline-flex items-center gap-2 rounded-full', chipClassName)}
                  >
                    <span>{emotion.emoji}</span>
                    <span>{emotion.label}</span>
                  </motion.span>
                ))}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
