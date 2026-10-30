import { useState, useEffect, useCallback } from 'react';

export type Theme = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'proofpatch_theme';

function getInitialTheme(): Theme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (saved === 'light' || saved === 'dark' || saved === 'system') {
      return saved;
    }
  } catch {
    // Storage access restricted
  }
  return 'system';
}

function resolveIsDark(theme: Theme): boolean {
  if (theme === 'dark') return true;
  if (theme === 'light') return false;
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  return false;
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);
  const [isDark, setIsDark] = useState<boolean>(() => resolveIsDark(getInitialTheme()));

  const applyTheme = useCallback((newTheme: Theme) => {
    const dark = resolveIsDark(newTheme);
    setIsDark(dark);
    if (typeof document !== 'undefined') {
      if (dark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }, []);

  const setTheme = useCallback(
    (newTheme: Theme) => {
      setThemeState(newTheme);
      try {
        localStorage.setItem(STORAGE_KEY, newTheme);
      } catch {
        // Storage access restricted
      }
      applyTheme(newTheme);
    },
    [applyTheme]
  );

  const toggleTheme = useCallback(() => {
    setTheme(isDark ? 'light' : 'dark');
  }, [isDark, setTheme]);

  useEffect(() => {
    applyTheme(theme);

    // Listen for OS color scheme changes when in 'system' mode
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handler = () => {
      if (theme === 'system') {
        applyTheme('system');
      }
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [theme, applyTheme]);

  return {
    theme,
    isDark,
    setTheme,
    toggleTheme,
  };
}

