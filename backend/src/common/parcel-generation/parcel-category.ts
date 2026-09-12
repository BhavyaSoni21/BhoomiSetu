// The category a parcel falls into for a given year of the historical
// imagery archive (docs/FRONTEND_UPGRADE_SPEC.md §8, redesigned 2026-09-08
// per the user's follow-up: "remove the pixel difference feature... more
// colour variation depicting different causes of disputes or governance
// alerts"). One function computes this for BOTH the cluster-snapshot
// renderer (the color a parcel gets painted) and HistoricalComparisonService
// (whether two years differ for a parcel) - a real, data-driven category
// instead of a synthetic randomly-"changed" pixel set, so the two can never
// disagree with each other.
// The single source of truth for "which year counts as current" - shared by
// seed.ts (which year gets real DisputeRecord-based coloring, not just
// restrictionStatus history) and HistoricalComparisonService (which year's
// comparison side may pull DisputeRecord directly instead of only
// ParcelHistoricalState). A fixed year, not `new Date().getFullYear()| -
// this demo's snapshot archive is a fixed 2022-2026 arc, not a rolling
// window, so treating some future real-world year as "current" without a
// matching seeded snapshot would silently break categoryFor.
export const CURRENT_YEAR = 2026;

export type ParcelCategory =
  | 'NONE'
  | 'RESTRICTED'
  | 'DISPUTE_OWNERSHIP'
  | 'DISPUTE_BOUNDARY'
  | 'DISPUTE_INHERITANCE'
  | 'DISPUTE_ENCROACHMENT';

export const CATEGORY_COLORS: Record<ParcelCategory, string> = {
  NONE: '#8fae86', // muted green - clean, nothing on file
  RESTRICTED: '#3f6fb3', // blue - a regulatory restriction (flood/protected-area/etc.), not an interpersonal dispute
  DISPUTE_OWNERSHIP: '#6b4c9a', // purple
  DISPUTE_BOUNDARY: '#c9702e', // burnt orange
  DISPUTE_INHERITANCE: '#c9a227', // gold
  DISPUTE_ENCROACHMENT: '#b33f3f', // crimson
};

export const CATEGORY_LABELS: Record<ParcelCategory, string> = {
  NONE: 'Clear',
  RESTRICTED: 'Restricted zone',
  DISPUTE_OWNERSHIP: 'Ownership dispute',
  DISPUTE_BOUNDARY: 'Boundary dispute',
  DISPUTE_INHERITANCE: 'Inheritance dispute',
  DISPUTE_ENCROACHMENT: 'Encroachment dispute',
};

export const SNAPSHOT_LEGEND: { category: ParcelCategory; color: string; label: string }[] = (
  Object.keys(CATEGORY_LABELS) as ParcelCategory[]
).map((category) => ({ category, color: CATEGORY_COLORS[category], label: CATEGORY_LABELS[category] }));

function disputeCategory(disputeType: string | null): ParcelCategory | null {
  switch (disputeType) {
    case 'OWNERSHIP':
      return 'DISPUTE_OWNERSHIP';
    case 'BOUNDARY':
      return 'DISPUTE_BOUNDARY';
    case 'INHERITANCE':
      return 'DISPUTE_INHERITANCE';
    case 'ENCROACHMENT':
      return 'DISPUTE_ENCROACHMENT';
    default:
      return null;
  }
}

// `currentDispute` only ever applies for the current year - dispute status
// (unlike restrictionStatus) has no per-year history anywhere in this
// schema, so it would misrepresent an earlier year to apply today's dispute
// to it (same reasoning already documented for the old disputed-color-only-
// on-2026 behavior this replaces).
export function categoryFor(
  restrictionStatus: string | null,
  currentDispute: { hasActiveDispute: boolean; disputeType: string | null } | null,
): ParcelCategory {
  if (currentDispute?.hasActiveDispute) {
    const category = disputeCategory(currentDispute.disputeType);
    if (category) return category;
  }
  if (restrictionStatus === 'RESTRICTED') return 'RESTRICTED';
  return 'NONE';
}
