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

export const CITIZEN_NAV_ITEMS: NavItem[] = [
  { to: '/citizen', end: true, labelKey: 'citizenNav.dashboard' },
  { to: '/citizen/parcels', labelKey: 'citizenNav.myParcels' },
  { to: '/citizen/find', labelKey: 'citizenNav.findParcels' },
  { to: '/citizen/raise-request', labelKey: 'citizenNav.raiseRequest' },
  { to: '/citizen/requests', labelKey: 'citizenNav.requests' },
  { to: '/citizen/verify', labelKey: 'citizenNav.verifyDocuments' },
  { to: '/citizen/documents', labelKey: 'citizenNav.documents' },
  { to: '/citizen/notifications', labelKey: 'citizenNav.notifications' },
  { to: '/citizen/profile', labelKey: 'citizenNav.profile' },
];

export const OFFICER_NAV_ITEMS: NavItem[] = [
  { to: '/officer', end: true, label: 'Dashboard' },
  { to: '/officer/requests', label: 'Assigned Requests' },
  { to: '/officer/alerts', label: 'Governance Alerts' },
  { to: '/officer/map', label: 'Map' },
  { to: '/officer/documents', label: 'Documents' },
  { to: '/officer/notifications', label: 'Notifications' },
  { to: '/officer/profile', label: 'Profile' },
];
