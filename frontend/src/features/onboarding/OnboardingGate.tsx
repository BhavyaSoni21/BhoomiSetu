import React, { useEffect } from 'react';
import { useTranslation } from '../../context/LanguageContext';
import { useAuthUser } from '../auth/auth';
import { runCitizenTour } from './onboardingTour';
import OnboardingWizard from './OnboardingWizard';

// Decides whether a citizen sees first-login onboarding. The backend flag
// (onboarding_completed, exposed as authUser.onboardingCompleted) is the
// source of truth, so this works across devices, cleared storage and PWA
// reinstalls (spec §1). Rendered once in AppShell, so it covers password
// login, registration and Google OAuth without touching each redirect site.
//
// It also powers the "Take a Tour" replay (spec §13): a
// `bhoomisetu:start-tour` event runs the interactive tour on demand and never
// changes onboarding_completed.
const OnboardingGate: React.FC = () => {
  const { t } = useTranslation();
  const { data: authUser } = useAuthUser();

  useEffect(() => {
    const replay = () => void runCitizenTour(t);
    window.addEventListener('bhoomisetu:start-tour', replay);
    return () => window.removeEventListener('bhoomisetu:start-tour', replay);
  }, [t]);

  // Only gate genuine new citizen accounts. Trigger strictly on `=== false`
  // so a stale user object missing the field never forces onboarding.
  if (!authUser || authUser.role !== 'CITIZEN' || authUser.onboardingCompleted !== false) {
    return null;
  }
  return <OnboardingWizard user={authUser} />;
};

export default OnboardingGate;
