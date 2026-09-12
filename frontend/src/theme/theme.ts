import { useEffect, useState } from 'react';

// Dark-mode persistence, same shape as i18n/config.ts's language storage:
// localStorage-backed, falling back to the OS/browser preference on a first
// visit rather than always defaulting to light (docs/design.md §5).
const THEME_STORAGE_KEY = 'bhoomisetu_theme';

export type Theme = 'light' | 'dark';

function getSystemPreference(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // Private browsing / storage disabled - fall through to system preference.
  }
  return getSystemPreference();
}

function setStoredTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Ignore storage failures - the choice just won't survive a reload.
  }
}

function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

// Applied once, synchronously, outside React - avoids a flash of the wrong
// theme between first paint and the App component mounting.
export function initTheme(): void {
  applyTheme(getStoredTheme());
}

export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(getStoredTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      setStoredTheme(next);
      return next;
    });
  };

  return [theme, toggleTheme];
}
