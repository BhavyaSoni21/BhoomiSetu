import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import {
  Sparkles, Languages, UserRound, Landmark, Search, FileText, Bell, ClipboardList,
  ArrowRight, ArrowLeft, CheckCircle2, MapPin,
} from 'lucide-react';
import { useTranslation } from '../../context/LanguageContext';
import type { SupportedLanguage } from '../../context/LanguageContext';
import { AuthUser, useUpdateProfileDetails, useCompleteOnboarding } from '../auth/auth';
import { runCitizenTour } from './onboardingTour';

// One-time citizen account initialization: Welcome -> Language -> Profile ->
// Intro -> Features -> (interactive tour) -> Completion. The backend flag is
// the source of truth (see OnboardingGate); this component only drives the
// local wizard/tour steps and confirms completion server-side at the end.
type Step = 'welcome' | 'language' | 'profile' | 'intro' | 'features' | 'completion';
const ORDER: Step[] = ['welcome', 'language', 'profile', 'intro', 'features', 'completion'];

// All languages the app already ships (see SUPPORTED_LANGUAGES in
// LanguageContext); native script first, English name as the sub-label.
const LANG_CHOICES: { code: SupportedLanguage; label: string; native: string }[] = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी' },
  { code: 'bn', label: 'Bengali', native: 'বাংলা' },
  { code: 'gu', label: 'Gujarati', native: 'ગુજરાતી' },
  { code: 'kn', label: 'Kannada', native: 'ಕನ್ನಡ' },
  { code: 'ml', label: 'Malayalam', native: 'മലയാളം' },
  { code: 'mr', label: 'Marathi', native: 'मराठी' },
  { code: 'or', label: 'Odia', native: 'ଓଡ଼ିଆ' },
  { code: 'pa', label: 'Punjabi', native: 'ਪੰਜਾਬੀ' },
  { code: 'ta', label: 'Tamil', native: 'தமிழ்' },
  { code: 'te', label: 'Telugu', native: 'తెలుగు' },
];

export interface OnboardingWizardProps {
  user: AuthUser;
}

const primaryBtn =
  'inline-flex items-center gap-2 rounded-xl bg-[#0F3D2E] hover:bg-[#166534] px-4 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-xs transition disabled:opacity-50';
const secondaryBtn =
  'inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--border)] bg-white dark:bg-surface-1 text-text-heading font-bold uppercase text-xs tracking-wider hover:bg-surface-2 transition';

const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ user }) => {
  const { t, currentLang, setLanguage } = useTranslation();
  const updateDetails = useUpdateProfileDetails();
  const completeOnboarding = useCompleteOnboarding();
  const [step, setStep] = useState<Step>('welcome');
  // While the interactive tour runs we hide the wizard entirely so its
  // blurred backdrop doesn't sit over (and blur) the elements the tour is
  // spotlighting on the real page.
  const [tourRunning, setTourRunning] = useState(false);
  const [form, setForm] = useState({
    name: user.name ?? '',
    address: user.address ?? '',
    governmentIdNumber: user.governmentIdNumber ?? '',
    occupation: user.occupation ?? '',
  });
  // Browser geolocation captured in the profile step. Persisted with the
  // profile so the Find Parcels map can default to the nearest cluster.
  const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(
    user.homeLatitude != null && user.homeLongitude != null
      ? { lat: user.homeLatitude, lng: user.homeLongitude }
      : null,
  );
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  const useMyLocation = () => {
    if (!('geolocation' in navigator)) {
      setGeoError(true);
      return;
    }
    setLocating(true);
    setGeoError(false);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setGeo({ lat, lng });
        // Reverse-geocode so the captured location shows as a readable address
        // in the (required) address field. Best-effort via OSM Nominatim; on any
        // failure fall back to raw coords so the required field is still filled.
        let label = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&zoom=16&lat=${lat}&lon=${lng}`,
            { headers: { Accept: 'application/json' } },
          );
          const data = await res.json();
          if (data?.display_name) label = String(data.display_name);
        } catch {
          /* keep coords fallback */
        }
        setForm((f) => ({ ...f, address: label }));
        setLocating(false);
      },
      () => {
        setGeoError(true);
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 10000 },
    );
  };

  const idx = ORDER.indexOf(step);
  const goto = (s: Step) => setStep(s);

  // Move focus into the dialog on step change and keep a light focus trap so
  // Tab/Shift+Tab cycle within the modal (spec §15 keyboard support).
  useEffect(() => {
    dialogRef.current?.focus();
  }, [step]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    if (!focusables || focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const saveProfileThen = (next: Step) => {
    // name is the only required field; it's prefilled from signup so this is
    // usually a no-op confirm. Partial update - only what changed matters.
    const payload = geo ? { ...form, homeLatitude: geo.lat, homeLongitude: geo.lng } : form;
    updateDetails.mutate(payload, { onSuccess: () => goto(next) });
  };

  const runTourThenComplete = async () => {
    setTourRunning(true);
    try {
      await runCitizenTour(t);
    } finally {
      setTourRunning(false);
    }
    goto('completion');
  };

  // FastAPI puts custom error payloads under `detail` (our 400 validation is
  // {detail:{message,errors}}; a plain 500 is {detail:"..."}), while axios
  // network/timeout errors have only `message`. Dig out the most specific one
  // so the user sees why instead of a blank "try again".
  const errData = axios.isAxiosError(updateDetails.error)
    ? (updateDetails.error.response?.data as { detail?: unknown; message?: string } | undefined)
    : undefined;
  const detail = errData?.detail as { message?: string; errors?: string[] } | string | undefined;
  const serverMsg =
    (typeof detail === 'object' && detail?.errors?.length ? detail.errors[0] : undefined) ||
    (typeof detail === 'object' ? detail?.message : undefined) ||
    (typeof detail === 'string' ? detail : undefined) ||
    errData?.message;
  const profileError =
    updateDetails.isError &&
    (serverMsg || t('onboarding.profileError', 'Could not save your details. Please try again.'));

  const completeError =
    completeOnboarding.isError &&
    t('onboarding.completeError', 'Something went wrong finishing setup. Please retry.');

  if (tourRunning) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className="w-full max-w-lg my-auto bg-white dark:bg-surface-1 border border-[var(--border)] rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.25)] outline-none max-h-[92vh] flex flex-col"
      >
        {/* Progress dots */}
        <div className="flex items-center gap-1.5 px-6 pt-5" aria-hidden="true">
          {ORDER.map((s, i) => (
            <span
              key={s}
              className={`h-1.5 rounded-full transition-all ${i <= idx ? 'bg-[#0F3D2E] w-6' : 'bg-[var(--border)] w-3'}`}
            />
          ))}
        </div>
        <p className="px-6 pt-2 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
          {t('onboarding.stepLabel', { n: idx + 1, total: ORDER.length })}
        </p>

        <div className="px-6 py-4 overflow-y-auto">
          {step === 'welcome' && (
            <div className="text-center py-4">
              <div className="mx-auto w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-900/20 flex items-center justify-center mb-4">
                <Sparkles className="w-7 h-7 text-[#0F3D2E] dark:text-emerald-300" aria-hidden="true" />
              </div>
              <h2 id="onboarding-title" className="text-xl font-bold font-heading text-text-heading">
                {t('onboarding.welcomeTitle', { name: user.name })}
              </h2>
              <p className="mt-2 text-sm text-text-secondary">
                {t('onboarding.welcomeDesc', "Let's set up your account in a few quick steps so you can search land parcels, view records and track requests.")}
              </p>
            </div>
          )}

          {step === 'language' && (
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Languages className="w-5 h-5 text-[#0F3D2E] dark:text-emerald-300" aria-hidden="true" />
                <h2 id="onboarding-title" className="text-lg font-bold font-heading text-text-heading">
                  {t('onboarding.languageTitle', 'Choose your language')}
                </h2>
              </div>
              <p className="text-sm text-text-secondary mb-4">
                {t('onboarding.languageDesc', 'This is used across BhoomiSetu. You can change it any time from the menu.')}
              </p>
              <div className="grid gap-2">
                {LANG_CHOICES.map((l) => (
                  <button
                    key={l.code}
                    type="button"
                    onClick={() => void setLanguage(l.code)}
                    aria-pressed={currentLang === l.code}
                    className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left transition ${
                      currentLang === l.code
                        ? 'border-[#0F3D2E] bg-emerald-50 dark:bg-emerald-900/20 ring-1 ring-[#0F3D2E]'
                        : 'border-[var(--border)] bg-white dark:bg-surface-1 hover:bg-surface-2'
                    }`}
                  >
                    <span className="text-sm font-semibold text-text-heading">{l.native} <span className="text-text-muted font-normal">· {l.label}</span></span>
                    {currentLang === l.code && <CheckCircle2 className="w-4 h-4 text-[#0F3D2E] dark:text-emerald-300" aria-hidden="true" />}
                  </button>
                ))}
              </div>
            </div>
          )}
          {step === 'profile' && (
            <div>
              <div className="flex items-center gap-2 mb-1">
                <UserRound className="w-5 h-5 text-[#0F3D2E] dark:text-emerald-300" aria-hidden="true" />
                <h2 id="onboarding-title" className="text-lg font-bold font-heading text-text-heading">
                  {t('onboarding.profileTitle', 'Complete your profile')}
                </h2>
              </div>
              <p className="text-sm text-text-secondary mb-4">
                {t('onboarding.profileDesc', 'Confirm your name and add optional details. You can edit these later.')}
              </p>
              <div className="space-y-3">
                <div>
                  <label htmlFor="onboardingName" className="block text-xs font-semibold text-text-heading mb-1">
                    {t('citizenPortal.profileNameLabel', 'Full Name')} <span className="text-rose-600">*</span>
                    <span className="ml-1 font-normal text-text-muted">({t('onboarding.required', 'required')})</span>
                  </label>
                  <input
                    id="onboardingName"
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    className="w-full border border-[var(--border)] bg-white dark:bg-surface-1 rounded-xl px-3.5 py-2 text-text-primary text-sm focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                  />
                </div>
                <div>
                  <label htmlFor="onboardingAddress" className="block text-xs font-semibold text-text-heading mb-1">
                    {t('citizenPortal.profileAddressLabel', 'Residential Address')} <span className="text-rose-600">*</span>
                    <span className="ml-1 font-normal text-text-muted">({t('onboarding.required', 'required')})</span>
                  </label>
                  <input
                    id="onboardingAddress"
                    type="text"
                    required
                    value={form.address}
                    onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                    className="w-full border border-[var(--border)] bg-white dark:bg-surface-1 rounded-xl px-3.5 py-2 text-text-primary text-sm focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                  />
                </div>
                <div>
                  <label htmlFor="onboardingOccupation" className="block text-xs font-semibold text-text-heading mb-1">
                    {t('citizenPortal.profileOccupationLabel', 'Occupation')}
                    <span className="ml-1 font-normal text-text-muted">({t('onboarding.optional', 'optional')})</span>
                  </label>
                  <input
                    id="onboardingOccupation"
                    type="text"
                    value={form.occupation}
                    onChange={(e) => setForm((f) => ({ ...f, occupation: e.target.value }))}
                    className="w-full border border-[var(--border)] bg-white dark:bg-surface-1 rounded-xl px-3.5 py-2 text-text-primary text-sm focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                  />
                </div>
                {profileError && <p className="text-xs font-medium text-rose-600">{profileError}</p>}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={useMyLocation}
                    disabled={locating}
                    className={secondaryBtn}
                  >
                    {geo && !locating ? (
                      <CheckCircle2 className="w-4 h-4 text-[#0F3D2E] dark:text-emerald-300" aria-hidden="true" />
                    ) : (
                      <MapPin className="w-4 h-4" aria-hidden="true" />
                    )}
                    {locating
                      ? t('onboarding.locating', 'Locating…')
                      : geo
                        ? t('onboarding.locationSet', 'Location set')
                        : t('onboarding.useLocation', 'Use my current location')}
                  </button>
                  <p className="mt-1.5 text-xs text-text-muted">
                    {geoError
                      ? t('onboarding.locationError', "Couldn't get your location. You can still continue.")
                      : t('onboarding.locationHint', 'Optional - helps show land parcels near you first.')}
                  </p>
                </div>
              </div>
            </div>
          )}

          {step === 'intro' && (
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Landmark className="w-5 h-5 text-[#0F3D2E] dark:text-emerald-300" aria-hidden="true" />
                <h2 id="onboarding-title" className="text-lg font-bold font-heading text-text-heading">
                  {t('onboarding.introTitle', 'What is BhoomiSetu?')}
                </h2>
              </div>
              <p className="text-sm text-text-secondary mb-4">
                {t('onboarding.introDesc', 'A single, trusted place to access land records, view parcels on a map, and submit and track land-related requests to the right department.')}
              </p>
              <ul className="space-y-2.5">
                {[
                  { Icon: Search, txt: t('onboarding.introSearch', 'Search parcels by ULPIN, survey number or district.') },
                  { Icon: MapPin, txt: t('onboarding.introMap', 'View accurate parcel boundaries on the GIS map.') },
                  { Icon: FileText, txt: t('onboarding.introRecords', 'See ownership, records and documents for a parcel.') },
                  { Icon: ClipboardList, txt: t('onboarding.introRequests', 'Submit requests and track their status end to end.') },
                ].map(({ Icon, txt }, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="mt-0.5 shrink-0 w-7 h-7 rounded-lg bg-surface-2 flex items-center justify-center">
                      <Icon className="w-4 h-4 text-[#0F3D2E] dark:text-emerald-300" aria-hidden="true" />
                    </span>
                    <span className="text-sm text-text-body">{txt}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {step === 'features' && (
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-5 h-5 text-[#0F3D2E] dark:text-emerald-300" aria-hidden="true" />
                <h2 id="onboarding-title" className="text-lg font-bold font-heading text-text-heading">
                  {t('onboarding.featuresTitle', 'Your key features')}
                </h2>
              </div>
              <p className="text-sm text-text-secondary mb-4">
                {t('onboarding.featuresDesc', "Here's what you'll use most. Take a quick interactive tour to see where everything lives, or skip and explore on your own.")}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { Icon: Search, txt: t('citizenNav.findParcels', 'Find Parcels') },
                  { Icon: MapPin, txt: t('citizenNav.myParcels', 'My Parcels') },
                  { Icon: ClipboardList, txt: t('citizenNav.myCases', 'My Cases') },
                  { Icon: Bell, txt: t('citizenNav.notifications', 'Notifications') },
                ].map(({ Icon, txt }, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-surface-2 px-3 py-2.5">
                    <Icon className="w-4 h-4 shrink-0 text-[#0F3D2E] dark:text-emerald-300" aria-hidden="true" />
                    <span className="text-xs font-semibold text-text-heading">{txt}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 'completion' && (
            <div className="text-center py-4">
              <div className="mx-auto w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-900/20 flex items-center justify-center mb-4">
                <CheckCircle2 className="w-7 h-7 text-[#0F3D2E] dark:text-emerald-300" aria-hidden="true" />
              </div>
              <h2 id="onboarding-title" className="text-xl font-bold font-heading text-text-heading">
                {t('onboarding.completionTitle', "You're ready to use BhoomiSetu")}
              </h2>
              <p className="mt-2 text-sm text-text-secondary">
                {t('onboarding.completionDesc', 'Your account is set up. You can replay this tour any time from Get Assistance.')}
              </p>
              {completeError && <p className="mt-3 text-xs font-medium text-rose-600">{completeError}</p>}
            </div>
          )}
        </div>
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-[var(--border)]">
          {/* Back / secondary (left) */}
          {step === 'welcome' && <span />}
          {(step === 'language' || step === 'profile' || step === 'intro') && (
            <button type="button" onClick={() => goto(ORDER[idx - 1])} className={secondaryBtn}>
              <ArrowLeft className="w-4 h-4" aria-hidden="true" /> {t('onboarding.tour.prev', 'Back')}
            </button>
          )}
          {step === 'features' && (
            <button type="button" onClick={() => goto('completion')} className={secondaryBtn}>
              {t('onboarding.skipTour', 'Skip tour')}
            </button>
          )}
          {step === 'completion' && <span />}

          {/* Primary (right) */}
          {step === 'welcome' && (
            <button type="button" onClick={() => goto('language')} className={primaryBtn}>
              {t('onboarding.getStarted', 'Get started')} <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
          {step === 'language' && (
            <button type="button" onClick={() => goto('profile')} className={primaryBtn}>
              {t('onboarding.continue', 'Continue')} <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
          {step === 'profile' && (
            <button
              type="button"
              onClick={() => saveProfileThen('intro')}
              disabled={!form.name.trim() || !form.address.trim() || updateDetails.isLoading}
              className={primaryBtn}
            >
              {updateDetails.isLoading ? t('onboarding.saving', 'Saving…') : t('onboarding.continue', 'Continue')}
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
          {step === 'intro' && (
            <button type="button" onClick={() => goto('features')} className={primaryBtn}>
              {t('onboarding.continue', 'Continue')} <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
          {step === 'features' && (
            <button type="button" onClick={() => void runTourThenComplete()} className={primaryBtn}>
              {t('onboarding.startTour', 'Start tour')} <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
          {step === 'completion' && (
            <button
              type="button"
              onClick={() => completeOnboarding.mutate()}
              disabled={completeOnboarding.isLoading}
              className={primaryBtn}
            >
              {completeOnboarding.isLoading
                ? t('onboarding.finishing', 'Finishing…')
                : completeOnboarding.isError
                  ? t('onboarding.retry', 'Retry')
                  : t('onboarding.goToDashboard', 'Go to Dashboard')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default OnboardingWizard;
