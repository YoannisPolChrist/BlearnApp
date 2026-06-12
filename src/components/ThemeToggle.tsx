import { useTheme } from 'next-themes';
import { motion } from 'framer-motion';
import { Sun, Moon } from 'lucide-react';

interface ThemeToggleProps {
  onThemeChange?: (nextTheme: 'light' | 'dark') => void;
}

export default function ThemeToggle({ onThemeChange }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();
  const isDark = theme === 'dark';
  const nextTheme = isDark ? 'light' : 'dark';

  return (
    <motion.button
      onClick={() => {
        setTheme(nextTheme);
        onThemeChange?.(nextTheme);
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
