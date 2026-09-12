// Shape of GET/PATCH /api/v1/notifications - the in-app notification feed
// (docs/FRONTEND_UPGRADE_SPEC.md §11 item 5, resolved: in-app only).
export interface AppNotification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  parcelId: string | null;
  workflowId: string | null;
  alertId: string | null;
  read: boolean;
  createdAt: string;
}
