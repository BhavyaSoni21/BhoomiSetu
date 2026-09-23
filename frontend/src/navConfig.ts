// Single shared source of truth for the Citizen/Officer Portal page lists,
 // consumed by App.tsx's one merged navbar.
 export interface NavItem {
   to: string;
   end?: boolean;
   labelKey?: string;
   label?: string;
   /** If set, only render an icon in the navbar (no text label) */
   iconOnly?: boolean;
   /** Lucide icon name for icon-only items */
   iconName?: 'Bell' | 'UserCircle2';
 }

 // Documents/Verify Documents used to be their own entries here - both moved
 // into Profile as tabs 2026-09-09.
 export const CITIZEN_NAV_ITEMS: NavItem[] = [
   { to: '/citizen', end: true, labelKey: 'citizenNav.dashboard' },
   { to: '/citizen/parcels', labelKey: 'citizenNav.myParcels' },
    { to: '/citizen/find', labelKey: 'citizenNav.findParcels' },
    { to: '/citizen/get-assistance', labelKey: 'citizenNav.getAssistance' },
    { to: '/citizen/my-cases', labelKey: 'citizenNav.myCases' },
    { to: '/citizen/raise-request', labelKey: 'citizenNav.raiseRequest' },
   { to: '/citizen/requests', labelKey: 'citizenNav.requests' },
   { to: '/citizen/notifications', iconOnly: true, iconName: 'Bell', labelKey: 'citizenNav.notifications' },
   { to: '/citizen/profile', iconOnly: true, iconName: 'UserCircle2', labelKey: 'citizenNav.profile' },
 ];

  // Base tabs for all officers
  const BASE_OFFICER_TABS: NavItem[] = [
    { to: '/officer', end: true, labelKey: 'officerNav.dashboard' },
    { to: '/officer/requests', labelKey: 'officerNav.assignedRequests' },
    { to: '/officer/tasks', labelKey: 'officerNav.myTasks' },
  ];

 // Department-specific tabs mapping based on OFFICER_DASHBOARD_PLAN.md tab access matrix
 const DEPARTMENT_TABS: Record<string, NavItem[]> = {
   LAND_RECORDS: [
     // No additional tabs - only base tabs
   ],
   REGISTRATION: [
     { to: '/officer/duplicate-registry', labelKey: 'officerNav.duplicateRegistry' },
     { to: '/officer/registration-chain', labelKey: 'officerNav.registrationChain' },
   ],
   PLANNING: [
     { to: '/officer/map', labelKey: 'officerNav.map' },
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
     { to: '/officer/map', labelKey: 'officerNav.map' },
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

 // Get officer nav items based on department (derived from role)
 export function getOfficerNavItems(department: string): NavItem[] {
   const deptTabs = DEPARTMENT_TABS[department] || [];
   return [...BASE_OFFICER_TABS, ...deptTabs, ...SHARED_OFFICER_TABS];
 }

 // For backward compatibility - returns all tabs (used by Admin)
  export const OFFICER_NAV_ITEMS: NavItem[] = [
    { to: '/officer', end: true, labelKey: 'officerNav.dashboard' },
    { to: '/officer/requests', labelKey: 'officerNav.assignedRequests' },
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
   { to: '/admin/system-monitoring', labelKey: 'adminNav.systemMonitoring' },
   { to: '/admin/workflows', labelKey: 'adminNav.workflows' },
   { to: '/admin/map-layers', labelKey: 'adminNav.mapLayerAuthoring' },
   { to: '/admin/officer-monitoring', labelKey: 'adminNav.officerMonitoring' },
   { to: '/admin/profile', iconOnly: true, iconName: 'UserCircle2', label: 'Profile' },
 ];
