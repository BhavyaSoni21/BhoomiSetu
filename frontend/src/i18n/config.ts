import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import hi from './locales/hi.json';

// Keyed the same way the navbar's language <select> already labels its
// options (App.tsx) so the toggle's stored value and i18next's language
// code are the exact same string - no separate mapping table to keep in
// sync between the two.
//
// Marathi and Kannada are intentionally not enabled yet (2026-09-07, per
// request) - selectable only once their locale JSON files exist alongside
// en.json/hi.json below and are added to both this list and the
// `resources` object. Every component already routes its text through
// t('...') regardless of language count, so enabling them later is just
// adding two files - no component changes needed.
export const SUPPORTED_LANGUAGES = ['English', 'Hindi'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const LANGUAGE_STORAGE_KEY = 'bhoomisetu_language';

function getStoredLanguage(): SupportedLanguage {
  try {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored && (SUPPORTED_LANGUAGES as readonly string[]).includes(stored)) {
      return stored as SupportedLanguage;
    }
  } catch {
    // Private browsing / storage disabled - fall through to the default.
  }
  return 'English';
}

export function setStoredLanguage(language: SupportedLanguage): void {
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // Ignore storage failures - the choice just won't survive a reload.
  }
}

i18n.use(initReactI18next).init({
  resources: {
    English: { translation: en },
    Hindi: { translation: hi },
  },
  lng: getStoredLanguage(),
  fallbackLng: 'English',
  interpolation: { escapeValue: false },
});

export default i18n;
