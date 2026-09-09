// Single shared source of truth for the Citizen/Officer Portal page lists,
// consumed by App.tsx's one merged navbar (there is no second, portal-owned
// nav bar any more - CitizenPortal.tsx/OfficerPortal.tsx are just their own
// <Routes> now). Every role's labels go through i18n (labelKey) - Officer/
// Admin switched from plain `label` strings 2026-09-10 (docs/ADMIN_PANEL_ISSUES.md
// Cross-Portal B, "i18n coverage for Officer + Admin").
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

// Documents (grouped-by-parcel document browsing) merged into Assigned
// Requests 2026-09-10 (docs/ADMIN_PANEL_ISSUES.md follow-up) - was its own
// nav item/page that just duplicated this same department workflow list,
// grouped differently; /officer/documents now redirects (OfficerPortal.tsx).
export const OFFICER_NAV_ITEMS: NavItem[] = [
  { to: '/officer', end: true, labelKey: 'officerNav.dashboard' },
  { to: '/officer/requests', labelKey: 'officerNav.assignedRequests' },
  { to: '/officer/alerts', labelKey: 'officerNav.governanceAlerts' },
  { to: '/officer/historical-imagery', labelKey: 'officerNav.historicalImagery' },
  { to: '/officer/map', labelKey: 'officerNav.map' },
  { to: '/officer/notifications', labelKey: 'officerNav.notifications' },
  { to: '/officer/profile', labelKey: 'officerNav.profile' },
];

// Admin Portal split into multiple pages (docs/FRONTEND_UPGRADE_SPEC.md §7,
// Phase 3) - Users/Officers/Governance Rules are still planning-only (real
// engine rewrites, scoped as their own separate effort per the spec's own
// recommended sequencing), so only the pieces actually built (Departments,
// System Monitoring, Workflow Oversight, Map Layer Authoring) plus the
// existing Dashboard are listed here.
export const ADMIN_NAV_ITEMS: NavItem[] = [
  { to: '/admin', end: true, labelKey: 'adminNav.dashboard' },
  { to: '/admin/departments', labelKey: 'adminNav.departments' },
  { to: '/admin/system-monitoring', labelKey: 'adminNav.systemMonitoring' },
  { to: '/admin/workflows', labelKey: 'adminNav.workflows' },
  { to: '/admin/map-layers', labelKey: 'adminNav.mapLayerAuthoring' },
];
