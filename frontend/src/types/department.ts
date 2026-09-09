// Shape of GET/POST/PATCH /api/v1/admin/departments - display/admin
// metadata only (docs/FRONTEND_UPGRADE_SPEC.md §7). Distinct from the
// hardcoded department codes (LAND_RECORDS, REGISTRATION, ...) used
// elsewhere in the app - `code` is expected to line up with those but
// nothing enforces it.
export interface Department {
  id: string;
  code: string;
  name: string;
  description: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  createdAt: string;
  updatedAt: string;
}
