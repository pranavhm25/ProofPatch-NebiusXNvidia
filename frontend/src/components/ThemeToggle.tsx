import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';

interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className = '' }: ThemeToggleProps) {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={`p-1.5 rounded-lg border border-warm-border dark:border-dark-border bg-white dark:bg-dark-surface text-ink-secondary dark:text-dark-ink-secondary hover:text-ink-primary dark:hover:text-dark-ink-primary hover:bg-warm-pill dark:hover:bg-dark-pill transition-colors focus-visible:outline-2 ${className}`}
    >
      {isDark ? (
        <Sun className="h-4 w-4 text-amber-400 transition-transform hover:rotate-45" strokeWidth={1.5} />
      ) : (
        <Moon className="h-4 w-4 text-ink-secondary transition-transform hover:-rotate-12" strokeWidth={1.5} />
      )}
    </button>
  );
}

