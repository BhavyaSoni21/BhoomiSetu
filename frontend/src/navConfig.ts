// Single shared source of truth for the Citizen/Officer Portal page lists,
 // consumed by App.tsx's one merged navbar.
 export interface NavItem {
   /** Omitted for group headers (Tools, Analytics) that only open a submenu. */
   to?: string;
   end?: boolean;
   labelKey?: string;
   label?: string;
   /** If set, only render an icon in the navbar (no text label) */
   iconOnly?: boolean;
   /** Lucide icon name for icon-only items */
   iconName?: 'Bell' | 'UserCircle2';
   /** Stable hook for the onboarding product tour - emitted as data-tour="…". */
   tourId?: string;
   /** Dropdown children (Officer Tools / Analytics). Group header itself has no `to`. */
   children?: NavItem[];
 }

 // Documents/Verify Documents used to be their own entries here - both moved
 // into Profile as tabs 2026-09-09.
 export const CITIZEN_NAV_ITEMS: NavItem[] = [
   { to: '/citizen', end: true, labelKey: 'citizenNav.dashboard', tourId: 'citizen-nav-dashboard' },
   { to: '/citizen/parcels', labelKey: 'citizenNav.myParcels', tourId: 'citizen-nav-parcels' },
    { to: '/citizen/find', labelKey: 'citizenNav.findParcels', tourId: 'citizen-nav-find' },
    { to: '/citizen/get-assistance', labelKey: 'citizenNav.getAssistance', tourId: 'citizen-nav-assistance' },
    { to: '/citizen/my-cases', labelKey: 'citizenNav.myCases', tourId: 'citizen-nav-cases' },
   { to: '/citizen/notifications', iconOnly: true, iconName: 'Bell', labelKey: 'citizenNav.notifications', tourId: 'citizen-nav-notifications' },
   { to: '/citizen/profile', iconOnly: true, iconName: 'UserCircle2', labelKey: 'citizenNav.profile', tourId: 'citizen-nav-profile' },
 ];

  // Common tabs for every officer (workspace-level, always visible).
  const OFFICER_COMMON_TABS: NavItem[] = [
    { to: '/officer', end: true, labelKey: 'officerNav.dashboard' },
    { to: '/officer/requests', labelKey: 'officerNav.cases' },
    { to: '/officer/tasks', labelKey: 'officerNav.myTasks' },
  ];

  // Analytics group (SLA + Performance) - kept as a submenu, not primary peers.
  const OFFICER_ANALYTICS_GROUP: NavItem = {
    labelKey: 'officerNav.analytics',
    children: [
      { to: '/officer/sla', labelKey: 'officerNav.sla' },
      { to: '/officer/performance', labelKey: 'officerNav.performance' },
    ],
  };

 // Department-specific Tools, keyed by department (derived from role). Rendered
 // as a single "Tools" dropdown - never duplicated 8x in the navbar. Land Records
 // has none (operates via Cases / Tasks / Parcel 360).
 export const OFFICER_TOOLS: Record<string, NavItem[]> = {
   LAND_RECORDS: [],
   REGISTRATION: [
     { to: '/officer/duplicate-registry', labelKey: 'officerNav.duplicateRegistry' },
     { to: '/officer/registration-chain', labelKey: 'officerNav.registrationChain' },
   ],
   PLANNING: [
     { to: '/officer/map', labelKey: 'officerNav.planningMap' },
   ],
   TAX: [
     { to: '/officer/reassessment-queue', labelKey: 'officerNav.reassessmentQueue' },
     { to: '/officer/tax-analytics', labelKey: 'officerNav.taxAnalytics' },
     { to: '/officer/map', labelKey: 'officerNav.map' },
   ],
   RESTRICTION: [
     { to: '/officer/alerts', labelKey: 'officerNav.governanceAlerts' },
   ],
   ENCUMBRANCE: [
     { to: '/officer/fraud-prevention', labelKey: 'officerNav.fraudPrevention' },
     { to: '/officer/certificate-generator', labelKey: 'officerNav.certificateGenerator' },
   ],
   DISPUTE: [
     { to: '/officer/alerts', labelKey: 'officerNav.governanceAlerts' },
     { to: '/officer/historical-imagery', labelKey: 'officerNav.historicalImagery' },
   ],
   SURVEY: [
     { to: '/officer/map', labelKey: 'officerNav.surveyMap' },
     { to: '/officer/change-detection', labelKey: 'officerNav.changeDetection' },
     { to: '/officer/documents', labelKey: 'officerNav.documents' },
     { to: '/officer/alerts', labelKey: 'officerNav.governanceAlerts' },
     { to: '/officer/historical-imagery', labelKey: 'officerNav.historicalImagery' },
   ],
 };

 // Shared tabs for all officers
 const SHARED_OFFICER_TABS: NavItem[] = [
   { to: '/officer/notifications', iconOnly: true, iconName: 'Bell', labelKey: 'officerNav.notifications' },
   { to: '/officer/profile', iconOnly: true, iconName: 'UserCircle2', labelKey: 'officerNav.profile' },
 ];

 // Officer navbar: Dashboard / Cases / Tasks / Tools / Analytics / Notifications / Profile.
 // Tools appears only when the department actually has any (Land Records has none).
 export function getOfficerNavItems(department: string): NavItem[] {
   const tools = OFFICER_TOOLS[department] || [];
   const items: NavItem[] = [...OFFICER_COMMON_TABS];
   if (tools.length) items.push({ labelKey: 'officerNav.tools', children: tools });
   items.push(OFFICER_ANALYTICS_GROUP, ...SHARED_OFFICER_TABS);
   return items;
 }

 // For backward compatibility - returns all tabs (used by Admin)
  export const OFFICER_NAV_ITEMS: NavItem[] = [
    { to: '/officer', end: true, labelKey: 'officerNav.dashboard' },
    { to: '/officer/requests', labelKey: 'officerNav.cases' },
    { to: '/officer/tasks', labelKey: 'officerNav.myTasks' },
    { to: '/officer/alerts', labelKey: 'officerNav.governanceAlerts' },
   { to: '/officer/historical-imagery', labelKey: 'officerNav.historicalImagery' },
   { to: '/officer/change-detection', labelKey: 'officerNav.changeDetection' },
   { to: '/officer/map', labelKey: 'officerNav.map' },
   { to: '/officer/notifications', iconOnly: true, iconName: 'Bell', labelKey: 'officerNav.notifications' },
   { to: '/officer/profile', iconOnly: true, iconName: 'UserCircle2', labelKey: 'officerNav.profile' },
   { to: '/officer/documents', labelKey: 'officerNav.documents' },
   { to: '/officer/duplicate-registry', labelKey: 'officerNav.duplicateRegistry' },
   { to: '/officer/registration-chain', labelKey: 'officerNav.registrationChain' },
   { to: '/officer/reassessment-queue', labelKey: 'officerNav.reassessmentQueue' },
   { to: '/officer/tax-analytics', labelKey: 'officerNav.taxAnalytics' },
   { to: '/officer/fraud-prevention', labelKey: 'officerNav.fraudPrevention' },
   { to: '/officer/certificate-generator', labelKey: 'officerNav.certificateGenerator' },
 ];

 // Verifier Portal nav items - deliberately narrow (see VerifierPortal.tsx):
 // a Verifier collects field evidence, nothing else.
 export const VERIFIER_NAV_ITEMS: NavItem[] = [
   { to: '/verifier', end: true, labelKey: 'verifierNav.dashboard' },
   { to: '/verifier/profile', iconOnly: true, iconName: 'UserCircle2', labelKey: 'verifierNav.profile' },
 ];

 // Admin Portal nav items.
 export const ADMIN_NAV_ITEMS: NavItem[] = [
   { to: '/admin', end: true, labelKey: 'adminNav.dashboard' },
   { to: '/admin/departments', labelKey: 'adminNav.departments' },
   { to: '/admin/workflows', labelKey: 'adminNav.workflows' },
   { to: '/admin/officer-monitoring', labelKey: 'adminNav.officerMonitoring' },
   { to: '/admin/system-monitoring', labelKey: 'adminNav.systemMonitoring' },
   { to: '/admin/map-layers', labelKey: 'adminNav.mapLayerAuthoring' },
   { to: '/admin/audit-log', label: 'Audit Log' },
   { to: '/admin/profile', iconOnly: true, iconName: 'UserCircle2', label: 'Profile' },
 ];
