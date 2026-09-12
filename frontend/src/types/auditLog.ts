// Shape of GET /api/v1/audit and GET /api/v1/parcels/:id/audit.
export interface AuditLogEntry {
  id: string;
  userId: string;
  userRole: string;
  action: string;
  entityType: string;
  entityId: string | null;
  parcelId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}
