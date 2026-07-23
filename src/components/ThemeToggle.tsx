import { useTheme } from 'next-themes';
import { motion } from 'framer-motion';
import { Sun, Moon } from 'lucide-react';

interface ThemeToggleProps {
  onThemeChange?: (nextTheme: 'light' | 'dark') => void;
  variant?: 'icon' | 'segmented';
  lightLabel?: string;
  darkLabel?: string;
}

export default function ThemeToggle({
  onThemeChange,
  variant = 'icon',
  lightLabel = 'Heller Modus',
  darkLabel = 'Dunkler Modus',
}: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();
  const isDark = theme === 'dark';
  const nextTheme = isDark ? 'light' : 'dark';
  const setSelectedTheme = (nextTheme: 'light' | 'dark') => {
    if (nextTheme === theme) return;

    setTheme(nextTheme);
    onThemeChange?.(nextTheme);
  };

  if (variant === 'segmented') {
    return (
      <div
        role="group"
        aria-label="Darstellung"
        className="grid w-full grid-cols-2 gap-2 rounded-2xl border border-border/70 bg-muted/35 p-1.5"
      >
        <button
          type="button"
          aria-pressed={!isDark}
          onClick={() => setSelectedTheme('light')}
          className={`btn-press inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold transition-colors sm:text-sm ${
            !isDark
              ? 'bg-card text-foreground shadow-[0_8px_20px_hsl(var(--foreground)/0.1)]'
              : 'text-muted-foreground hover:bg-card/60 hover:text-foreground'
          }`}
        >
          <Sun size={16} className={!isDark ? 'text-accent' : undefined} aria-hidden="true" />
          <span>{lightLabel}</span>
        </button>
        <button
          type="button"
          aria-pressed={isDark}
          onClick={() => setSelectedTheme('dark')}
          className={`btn-press inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold transition-colors sm:text-sm ${
            isDark
              ? 'bg-card text-foreground shadow-[0_8px_20px_hsl(var(--foreground)/0.1)]'
              : 'text-muted-foreground hover:bg-card/60 hover:text-foreground'
          }`}
        >
          <Moon size={16} className={isDark ? 'text-primary' : undefined} aria-hidden="true" />
          <span>{darkLabel}</span>
        </button>
      </div>
    );
  }

  return (
    <motion.button
      onClick={() => {
        setSelectedTheme(nextTheme);
      }}
      className="relative flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card/60 lg:backdrop-blur-xl transition-colors hover:bg-card"
      whileTap={{ scale: 0.9, rotate: 15 }}
      whileHover={{ scale: 1.05 }}
      title={isDark ? 'Heller Modus' : 'Dunkler Modus'}
      aria-label={isDark ? 'Heller Modus' : 'Dunkler Modus'}
    >
      <motion.div
        key={isDark ? 'moon' : 'sun'}
        initial={{ scale: 0, rotate: -90, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        exit={{ scale: 0, rotate: 90, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      >
        {isDark ? (
          <Moon size={18} className="text-primary" />
        ) : (
          <Sun size={18} className="text-accent" />
        )}
      </motion.div>
    </motion.button>
  );
}
