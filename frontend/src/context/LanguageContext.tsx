import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

export type SupportedLanguage = 'en' | 'hi' | 'bn' | 'gu' | 'kn' | 'ml' | 'mr' | 'or' | 'pa' | 'ta' | 'te';

interface LanguageContextType {
  currentLang: SupportedLanguage;
  uiText: Record<string, string>;
  setLanguage: (lang: SupportedLanguage) => Promise<void>;
  t: (key: string, options?: Record<string, string | number> | string) => string;
  loading: boolean;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

const SUPPORTED_LANGUAGES: SupportedLanguage[] = ['en', 'hi', 'bn', 'gu', 'kn', 'ml', 'mr', 'or', 'pa', 'ta', 'te'];
const STORAGE_KEY = 'bhoomisetu_lang';
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

interface LanguageProviderProps {
  children: ReactNode;
}

export function LanguageProvider({ children }: LanguageProviderProps) {
  const [currentLang, setCurrentLang] = useState<SupportedLanguage>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && SUPPORTED_LANGUAGES.includes(stored as SupportedLanguage)) {
        return stored as SupportedLanguage;
      }
    } catch {
      // ignore
    }
    return 'en';
  });
  const [uiText, setUiText] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const fetchUiText = useCallback(async (lang: SupportedLanguage) => {
    try {
      const response = await fetch(`${API_BASE}/multilingual/ui-text/${lang}`);
      if (response.ok) {
        const data = await response.json();
        setUiText(data || {});
      } else {
        setUiText({});
      }
    } catch (error) {
      console.error(`Failed to load UI text for ${lang}:`, error);
      setUiText({});
    }
  }, []);

  const setLanguage = useCallback(async (lang: SupportedLanguage) => {
    if (!SUPPORTED_LANGUAGES.includes(lang)) {
      return;
    }
    setCurrentLang(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
      
      // Attempt to sync with backend if user is logged in
      const token = localStorage.getItem('access_token');
      if (token) {
        fetch(`${API_BASE}/auth/profile/details`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ preferredLanguage: lang })
        }).catch(() => {}); // Ignore if it fails
      }
    } catch {
      // ignore
    }
    await fetchUiText(lang);
  }, [fetchUiText]);

  useEffect(() => {
    fetchUiText(currentLang).then(() => setLoading(false));
  }, [currentLang, fetchUiText]);

  const t = useCallback((key: string, options?: Record<string, string | number> | string) => {
    let text = uiText[key] ?? (typeof options === 'string' ? options : key);
    if (options && typeof options === 'object') {
      Object.entries(options).forEach(([k, v]) => {
        text = text.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v));
      });
    }
    return text;
  }, [uiText]);

  return (
    <LanguageContext.Provider value={{ currentLang, uiText, setLanguage, t, loading }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  const { t, currentLang, setLanguage, loading } = context;
  return { t, currentLang, setLanguage, loading };
}