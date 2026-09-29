import { driver, type DriveStep } from 'driver.js';
import 'driver.js/dist/driver.css';

type TFn = (key: string, fallback?: string) => string;

// One entry per real citizen nav target. `tourId` matches the data-tour
// attribute emitted by App.tsx's navbar (see navConfig.ts). Steps whose
// element isn't rendered/visible for this user are dropped, so a feature the
// role can't see is never spotlighted (spec §7).
interface TourStepDef {
  tourId: string;
  titleKey: string;
  titleFallback: string;
  descKey: string;
  descFallback: string;
}

const CITIZEN_TOUR_STEPS: TourStepDef[] = [
  {
    tourId: 'citizen-nav-dashboard',
    titleKey: 'onboarding.tour.dashboardTitle',
    titleFallback: 'Your dashboard',
    descKey: 'onboarding.tour.dashboardDesc',
    descFallback: 'Return here any time for an overview of your land records and requests.',
  },
  {
    tourId: 'citizen-nav-find',
    titleKey: 'onboarding.tour.findTitle',
    titleFallback: 'Find land parcels',
    descKey: 'onboarding.tour.findDesc',
    descFallback: 'Search by ULPIN, survey number or district, and locate parcels on the GIS map.',
  },
  {
    tourId: 'citizen-nav-parcels',
    titleKey: 'onboarding.tour.parcelsTitle',
    titleFallback: 'Your parcels',
    descKey: 'onboarding.tour.parcelsDesc',
    descFallback: 'Open a parcel to view its records, ownership and documents.',
  },
  {
    tourId: 'citizen-nav-cases',
    titleKey: 'onboarding.tour.casesTitle',
    titleFallback: 'Track your requests',
    descKey: 'onboarding.tour.casesDesc',
    descFallback: 'Submitted requests and their current status appear here.',
  },
  {
    tourId: 'citizen-nav-assistance',
    titleKey: 'onboarding.tour.assistanceTitle',
    titleFallback: 'Get assistance',
    descKey: 'onboarding.tour.assistanceDesc',
    descFallback: 'Need help? Find guides and support here - and replay this tour any time.',
  },
  {
    tourId: 'citizen-nav-notifications',
    titleKey: 'onboarding.tour.notificationsTitle',
    titleFallback: 'Notifications',
    descKey: 'onboarding.tour.notificationsDesc',
    descFallback: 'Updates on your requests and records show up here.',
  },
  {
    tourId: 'citizen-nav-profile',
    titleKey: 'onboarding.tour.profileTitle',
    titleFallback: 'Your profile',
    descKey: 'onboarding.tour.profileDesc',
    descFallback: 'Manage your details, contact methods, documents and language here.',
  },
];

// A tourId is targetable only if a matching element is actually laid out (the
// desktop navbar is display:none on mobile, so its links have no box there).
// Returns the first visible match, or null. Exported for the self-check.
export function visibleTarget(tourId: string): Element | null {
  const nodes = Array.from(document.querySelectorAll(`[data-tour="${tourId}"]`));
  return (
    nodes.find((el) => {
      const rect = (el as HTMLElement).getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }) ?? null
  );
}

// Pure step-picker split out from DOM/driver so it can be unit-tested: keep
// only steps whose target resolves to an element. See onboardingTour.test.ts.
export function pickVisibleSteps(
  defs: TourStepDef[],
  resolve: (tourId: string) => Element | null,
): { def: TourStepDef; element: Element }[] {
  const out: { def: TourStepDef; element: Element }[] = [];
  for (const def of defs) {
    const element = resolve(def.tourId);
    if (element) out.push({ def, element });
  }
  return out;
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

// Runs the interactive spotlight tour over the citizen navbar. On small
// screens the desktop nav is hidden, so ask AppShell to open the mobile menu
// first and wait for it to render before resolving targets. Resolves when the
// tour is finished, skipped or closed. Reusable for first-login AND the
// "Take a tour" replay (spec §13) - it never touches onboarding_completed.
export async function runCitizenTour(t: TFn): Promise<void> {
  const isSmall = typeof window !== 'undefined' && window.matchMedia?.('(max-width: 1023px)').matches;
  if (isSmall) {
    window.dispatchEvent(new Event('bhoomisetu:open-mobile-menu'));
    await new Promise((r) => setTimeout(r, 350)); // let the menu mount/animate
  }

  const steps = pickVisibleSteps(CITIZEN_TOUR_STEPS, visibleTarget);
  if (steps.length === 0) return;

  const driveSteps: DriveStep[] = steps.map(({ def, element }) => ({
    element,
    popover: {
      title: t(def.titleKey, def.titleFallback),
      description: t(def.descKey, def.descFallback),
    },
  }));

  return new Promise<void>((resolve) => {
    const d = driver({
      showProgress: true,
      animate: !prefersReducedMotion(),
      allowClose: true, // Esc / overlay click ends the tour
      nextBtnText: t('onboarding.tour.next', 'Next'),
      prevBtnText: t('onboarding.tour.prev', 'Back'),
      doneBtnText: t('onboarding.tour.done', 'Done'),
      steps: driveSteps,
      onDestroyed: () => resolve(),
    });
    d.drive();
  });
}
