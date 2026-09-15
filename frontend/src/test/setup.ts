import { vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

// Components call useTranslation() (LanguageContext.tsx) without every test
// wrapping in <LanguageProvider> - stub it the same way ResizeObserver/
// matchMedia are stubbed below, so useTranslation() works standalone and
// t(key) just returns the key, same fallback behavior as the real hook.
vi.mock('../context/LanguageContext', async () => {
  const actual = await vi.importActual<typeof import('../context/LanguageContext')>('../context/LanguageContext');
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, options?: Record<string, string | number> | string) => (typeof options === 'string' ? options : key),
      currentLang: 'en',
      setLanguage: () => Promise.resolve(),
      loading: false,
    }),
  };
});

// jsdom has no ResizeObserver (it does no real layout), but recharts'
// ResponsiveContainer requires one to exist at all just to mount - without
// this stub every chart-based component throws on render in tests.
class ResizeObserverStub implements ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = ResizeObserverStub;

// jsdom also has no matchMedia - theme/theme.ts's system-preference check
// (and any future prefers-color-scheme code) needs this stubbed the same
// way, or mounting the app shell throws before a single test can run.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});
