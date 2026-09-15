import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

export type SupportedLanguage = 'en' | 'hi' | 'bn' | 'gu' | 'kn' | 'ml' | 'mr' | 'or' | 'pa' | 'ta' | 'te';

interface LanguageContextType {
  currentLang: SupportedLanguage;
  uiText: Record<string, string>;
  setLanguage: (lang: SupportedLanguage) => Promise<void>;
  t: (key: string, options?: Record<string, string | number> | string) => string;
  loading: boolean;
  translationFailed: boolean;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

const SUPPORTED_LANGUAGES: SupportedLanguage[] = ['en', 'hi', 'bn', 'gu', 'kn', 'ml', 'mr', 'or', 'pa', 'ta', 'te'];
const STORAGE_KEY = 'bhoomisetu_lang';
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

// Embedded fallback dictionary for instant responsiveness & offline resilience
export const FALLBACK_STRINGS: Record<string, Record<string, string>> = {
  en: {
    'nav.home': 'Home',
    'nav.about': 'About',
    'nav.features': 'Features',
    'nav.parcels': 'My Parcels',
    'nav.requests': 'Requests',
    'nav.profile': 'Profile',
    'nav.returnToPortal': 'Return to Portal',
    'citizenPortal.profileHeading': 'My Profile',
    'citizenPortal.profileRoleLabel': 'Role',
    'citizenPortal.profileRoleValue': 'Citizen',
    'citizenPortal.profileAccountTab': 'Account',
    'citizenPortal.profileDocumentsTab': 'Documents',
    'citizenPortal.profileNameLabel': 'Full Name',
    'citizenPortal.profileAddressLabel': 'Residential Address',
    'citizenPortal.profileGovernmentIdLabel': 'Government ID',
    'citizenPortal.profileOccupationLabel': 'Occupation',
    'citizenPortal.profileMemberSinceLabel': 'Member Since',
    'citizenPortal.profileLinkedParcelsLabel': 'Linked Parcels',
    'citizenPortal.profileTotalRequestsLabel': 'Total Requests',
    'citizenPortal.profileContactHeading': 'Identity & Contact Verification',
    'citizenPortal.profileContactDesc': 'Manage your phone and email contact details.',
    'citizenPortal.profileEmailLabel': 'Email address',
    'citizenPortal.profileMobileLabel': 'Mobile number',
    'citizenPortal.profileVerifiedBadge': 'Verified',
    'citizenPortal.profileUnverifiedBadge': 'Unverified',
    'citizenPortal.profileNotProvided': 'Not provided',
    'citizenPortal.profileAddCta': 'Add',
    'citizenPortal.profileChangeCta': 'Change',
    'citizenPortal.profileVerifyCta': 'Verify',
    'citizenPortal.profileEditCta': 'Edit',
    'citizenPortal.profileSaveCta': 'Save',
    'citizenPortal.profileCancelCta': 'Cancel',
    'citizenPortal.profileDetailsHeading': 'Profile Details',
    'citizenPortal.profileDetailsDesc': 'Your official registered profile details.',
    'citizenPortal.profilePendingNote': 'Verification pending for {{value}}',
    'citizenPortal.profileDocumentsEmpty': 'No documents are on file for this parcel yet.',
    'citizenPortal.profileDocumentsNoParcels': 'No parcels are linked to your account yet.',
    'placeholders.documentsTitle': 'Documents',
    'placeholders.documentsDesc': 'Land property papers on file for your linked parcels.',
    'auth.emailPlaceholder': 'Enter email address',
    'auth.mobilePlaceholder': '10-digit mobile number',
    'auth.otpVerifying': 'Verifying...',
    'citizenPortal.profileSendCodeCta': 'Send Code',
    'auth.otpSentTo': "We've sent a 6-digit code to {{target}}",
    'auth.otpCodeLabel': 'Verification Code',
    'auth.otpCodePlaceholder': '000000',
    'auth.otpVerifyButton': 'Verify',
    'auth.otpResendButton': 'Resend code',
    'auth.otpResendCooldown': 'Resend in {{seconds}}s',
    'auth.otpResendSuccess': 'A new code has been sent.',
    'auth.otpExpiresIn': 'Code expires in {{time}}',
    'auth.otpExpired': 'Code has expired. Please request a new one.',
    'auth.otpInvalid': 'Invalid or expired code. Please try again.',
    'auth.otpLockedOut': 'Too many incorrect attempts — request a new code.',
    'auth.otpSkipForNow': 'Skip for now — verify later from Profile',
    'citizenPortal.profileContactUpdateError': 'Failed to update contact. Please try again.',
  },
  hi: {
    'nav.home': 'होम',
    'nav.about': 'परिचय',
    'nav.features': 'सुविधाएं',
    'nav.parcels': 'मेरे भूखंड',
    'nav.requests': 'अनुरोध',
    'nav.profile': 'प्रोफ़ाइल',
    'nav.returnToPortal': 'पोर्टल पर लौटें',
    'citizenPortal.profileHeading': 'मेरी प्रोफ़ाइल',
    'citizenPortal.profileRoleLabel': 'भूमिका',
    'citizenPortal.profileRoleValue': 'नागरिक',
    'citizenPortal.profileAccountTab': 'खाता',
    'citizenPortal.profileDocumentsTab': 'दस्तावेज़',
    'citizenPortal.profileNameLabel': 'पूरा नाम',
    'citizenPortal.profileAddressLabel': 'आवासीय पता',
    'citizenPortal.profileGovernmentIdLabel': 'सरकारी पहचान पत्र',
    'citizenPortal.profileOccupationLabel': 'व्यवसाय',
    'citizenPortal.profileMemberSinceLabel': 'सदस्यता तिथि',
    'citizenPortal.profileLinkedParcelsLabel': 'लिंक किए गए भूखंड',
    'citizenPortal.profileTotalRequestsLabel': 'कुल अनुरोध',
    'citizenPortal.profileContactHeading': 'पहचान एवं संपर्क सत्यापन',
    'citizenPortal.profileContactDesc': 'अपना फ़ोन और ईमेल संपर्क प्रबंधित करें।',
    'citizenPortal.profileEmailLabel': 'ईमेल पता',
    'citizenPortal.profileMobileLabel': 'मोबाइल नंबर',
    'citizenPortal.profileVerifiedBadge': 'सत्यापित (Verified)',
    'citizenPortal.profileUnverifiedBadge': 'असत्यापित (Unverified)',
    'citizenPortal.profileNotProvided': 'उपलब्ध नहीं',
    'citizenPortal.profileAddCta': 'जोड़ें',
    'citizenPortal.profileChangeCta': 'बदलें',
    'citizenPortal.profileVerifyCta': 'सत्यापित करें',
    'citizenPortal.profileEditCta': 'संपादित करें',
    'citizenPortal.profileSaveCta': 'सहेजें',
    'citizenPortal.profileCancelCta': 'रद्द करें',
    'citizenPortal.profileDetailsHeading': 'प्रोफ़ाइल विवरण',
    'citizenPortal.profileDetailsDesc': 'आपका पंजीकृत आधिकारिक प्रोफ़ाइल विवरण।',
    'citizenPortal.profilePendingNote': '{{value}} के लिए सत्यापन लंबित है',
    'citizenPortal.profileDocumentsEmpty': 'इस भूखंड के लिए कोई दस्तावेज़ नहीं मिला।',
    'citizenPortal.profileDocumentsNoParcels': 'दस्तावेज़ प्रदर्शित करने के लिए कोई भूखंड लिंक नहीं है।',
    'placeholders.documentsTitle': 'दस्तावेज़',
    'placeholders.documentsDesc': 'आपके लिंक किए गए भूखंडों के लिए भूमि दस्तावेज।',
  },
  mr: {
    'nav.home': 'मुख्यपृष्ठ',
    'nav.about': 'माहिती',
    'nav.features': 'वैशिष्ट्ये',
    'nav.parcels': 'माझे भूखंड',
    'nav.requests': 'विनंत्या',
    'nav.profile': 'माझे प्रोफाईल',
    'nav.returnToPortal': 'पोर्टलवर परत जा',
    'citizenPortal.profileHeading': 'माझे प्रोफाईल',
    'citizenPortal.profileRoleLabel': 'भूमिका',
    'citizenPortal.profileRoleValue': 'नागरिक',
    'citizenPortal.profileAccountTab': 'खाते',
    'citizenPortal.profileDocumentsTab': 'दस्तऐवज',
    'citizenPortal.profileNameLabel': 'पूर्ण नाव',
    'citizenPortal.profileAddressLabel': 'निवासी पत्ता',
    'citizenPortal.profileGovernmentIdLabel': 'सरकारी ओळखपत्र',
    'citizenPortal.profileOccupationLabel': 'व्यवसाय',
    'citizenPortal.profileMemberSinceLabel': 'नोंदणी तारीख',
    'citizenPortal.profileLinkedParcelsLabel': 'संलग्न भूखंड',
    'citizenPortal.profileTotalRequestsLabel': 'एकूण विनंत्या',
    'citizenPortal.profileContactHeading': 'ओळख व संपर्क पडताळणी',
    'citizenPortal.profileContactDesc': 'तुमचा फोन आणि ईमेल संपर्क व्यवस्थापित करा.',
    'citizenPortal.profileEmailLabel': 'ईमेल पत्ता',
    'citizenPortal.profileMobileLabel': 'मोबाईल नंबर',
    'citizenPortal.profileVerifiedBadge': 'पडताळणीकृत (Verified)',
    'citizenPortal.profileUnverifiedBadge': 'अपडताळणीकृत (Unverified)',
    'citizenPortal.profileNotProvided': 'दिलेले नाही',
    'citizenPortal.profileAddCta': 'जोडा',
    'citizenPortal.profileChangeCta': 'बदला',
    'citizenPortal.profileVerifyCta': 'पडताळा',
    'citizenPortal.profileEditCta': 'संपादित करा',
    'citizenPortal.profileSaveCta': 'जतन करा',
    'citizenPortal.profileCancelCta': 'रद्द करा',
    'citizenPortal.profileDetailsHeading': 'प्रोफाईल तपशील',
    'citizenPortal.profileDetailsDesc': 'तुमचा अधिकृत नोंदणीकृत प्रोफाईल तपशील.',
    'citizenPortal.profilePendingNote': '{{value}} साठी पडताळणी प्रलंबित आहे',
    'citizenPortal.profileDocumentsEmpty': 'या भूखंडासाठी कोणतेही दस्तऐवज आढळले नाहीत.',
    'citizenPortal.profileDocumentsNoParcels': 'दस्तऐवज दाखवण्यासाठी कोणतेही भूखंड संलग्न नाहीत.',
    'placeholders.documentsTitle': 'दस्तऐवज',
    'placeholders.documentsDesc': 'तुमच्या संलग्न भूखंडांचे जमिनीचे कागदपत्रे.',
  },
};

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
  const [uiText, setUiText] = useState<Record<string, string>>(() => FALLBACK_STRINGS[currentLang] || FALLBACK_STRINGS.en);
  const [loading, setLoading] = useState(false);
  const [translationFailed, setTranslationFailed] = useState(false);

  const fetchUiText = useCallback(async (lang: SupportedLanguage) => {
    setLoading(true);
    setTranslationFailed(false);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const response = await fetch(`${API_BASE}/multilingual/ui-text/${lang}`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        const merged = { ...(FALLBACK_STRINGS[lang] || FALLBACK_STRINGS.en), ...(data || {}) };
        setUiText(merged);
      } else {
        setUiText(FALLBACK_STRINGS[lang] || FALLBACK_STRINGS.en);
      }
    } catch (error) {
      console.warn(`Bhashini translation service fallback used for ${lang}`);
      setUiText(FALLBACK_STRINGS[lang] || FALLBACK_STRINGS.en);
      if (lang !== 'en') {
        setTranslationFailed(true);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const setLanguage = useCallback(async (lang: SupportedLanguage) => {
    if (!SUPPORTED_LANGUAGES.includes(lang)) {
      return;
    }
    setCurrentLang(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // ignore
    }
    await fetchUiText(lang);
  }, [fetchUiText]);

  useEffect(() => {
    fetchUiText(currentLang);
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
    <LanguageContext.Provider value={{ currentLang, uiText, setLanguage, t, loading, translationFailed }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(LanguageContext);
  if (!context) {
    return {
      currentLang: 'en' as SupportedLanguage,
      uiText: FALLBACK_STRINGS.en,
      setLanguage: async () => {},
      t: (key: string, options?: Record<string, string | number> | string) => {
        let text = FALLBACK_STRINGS.en[key] ?? (typeof options === 'string' ? options : key);
        if (options && typeof options === 'object') {
          Object.entries(options).forEach(([k, v]) => {
            text = text.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v));
          });
        }
        return text;
      },
      loading: false,
      translationFailed: false,
    };
  }
  const { t, currentLang, setLanguage, loading, translationFailed } = context;
  return { t, currentLang, setLanguage, loading, translationFailed };
}