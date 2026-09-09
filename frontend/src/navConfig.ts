// Single shared source of truth for the Citizen/Officer Portal page lists,
// consumed by App.tsx's one merged navbar (there is no second, portal-owned
// nav bar any more - CitizenPortal.tsx/OfficerPortal.tsx are just their own
// <Routes> now). Citizen labels go through i18n (labelKey, matching this
// portal's existing fully-localized convention); officer labels stay plain
// strings (matching OfficerPortal's existing non-i18n convention, unchanged
// by this refactor).
export interface NavItem {
  to: string;
  end?: boolean;
  labelKey?: string;
  label?: string;
}

// Documents/Verify Documents used to be their own entries here - both moved
// into Profile as tabs 2026-09-09 (docs/FRONTEND_UPGRADE_SPEC.md §4), so the
// list is 7 items now, not 9. CitizenPortal.tsx redirects the old routes.
export const CITIZEN_NAV_ITEMS: NavItem[] = [
  { to: '/citizen', end: true, labelKey: 'citizenNav.dashboard' },
  { to: '/citizen/parcels', labelKey: 'citizenNav.myParcels' },
  { to: '/citizen/find', labelKey: 'citizenNav.findParcels' },
  { to: '/citizen/raise-request', labelKey: 'citizenNav.raiseRequest' },
  { to: '/citizen/requests', labelKey: 'citizenNav.requests' },
  { to: '/citizen/notifications', labelKey: 'citizenNav.notifications' },
  { to: '/citizen/profile', labelKey: 'citizenNav.profile' },
];

export const OFFICER_NAV_ITEMS: NavItem[] = [
  { to: '/officer', end: true, label: 'Dashboard' },
  { to: '/officer/requests', label: 'Assigned Requests' },
  { to: '/officer/alerts', label: 'Governance Alerts' },
  { to: '/officer/historical-imagery', label: 'Historical Imagery' },
  { to: '/officer/map', label: 'Map' },
  { to: '/officer/documents', label: 'Documents' },
  { to: '/officer/notifications', label: 'Notifications' },
  { to: '/officer/profile', label: 'Profile' },
];

// Admin Portal split into multiple pages (docs/FRONTEND_UPGRADE_SPEC.md §7,
// Phase 3) - Users/Officers/Workflow Configuration/Governance Rules are
// still planning-only (real engine rewrites, scoped as their own separate
// effort per the spec's own recommended sequencing), so only the two pieces
// actually built (Departments, System Monitoring) plus the existing
// Dashboard are listed here.
export const ADMIN_NAV_ITEMS: NavItem[] = [
  { to: '/admin', end: true, label: 'Dashboard' },
  { to: '/admin/departments', label: 'Departments' },
  { to: '/admin/system-monitoring', label: 'System Monitoring' },
];
