import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Bell, ClipboardCheck, ShieldAlert } from 'lucide-react';
import apiService from '../../services/apiService';
import { AppNotification } from '../../types/notification';

const TYPE_ICON: Record<string, typeof Bell> = {
  WORKFLOW_ASSIGNED: ClipboardCheck,
  WORKFLOW_STEP_APPROVED: ClipboardCheck,
  WORKFLOW_STEP_REJECTED: ClipboardCheck,
  GOVERNANCE_ALERT_REVIEWED: ShieldAlert,
  GOVERNANCE_ALERT_DISMISSED: ShieldAlert,
};

function formatDateTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString('en-IN', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// The real in-app notification feed (docs/FRONTEND_UPGRADE_SPEC.md §11 item
// 5, resolved 2026-09-09: in-app only) - a citizen's new request notifies
// the assigned department's officer(s); an officer's decision notifies the
// citizen back; a governance alert review/dismissal notifies the relevant
// department. Shared between the Citizen and Officer Portals' Notifications
// pages (same component, same GET /notifications endpoint - the backend
// scopes to whichever user is signed in), matching HistoricalMapView's
// precedent for a citizen/officer-shared feature component.
const NotificationFeed: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading, error } = useQuery<AppNotification[]>(['notifications'], async () => {
    const response = await apiService.get('/notifications');
    return response.data;
  });

  const markReadMutation = useMutation(
    async (id: string) => {
      await apiService.patch(`/notifications/${id}/read`);
    },
    { onSuccess: () => queryClient.invalidateQueries(['notifications']) },
  );

  const handleClick = (notification: AppNotification) => {
    if (!notification.read) markReadMutation.mutate(notification.id);
    if (notification.parcelId) navigate(`/parcels/${notification.parcelId}`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm font-medium text-ink/60 py-3">
        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
        Loading notifications...
      </div>
    );
  }
  if (error) return <div className="text-sm font-medium text-ink/60 py-3">Error loading notifications</div>;
  if (notifications.length === 0) {
    return (
      <div className="text-ink/60 text-sm border-2 border-dashed border-ink/30 px-4 py-6 text-center">
        No notifications yet.
      </div>
    );
  }

  return (
    <div className="border-2 border-ink divide-y-2 divide-ink bg-surface">
      {notifications.map((notification) => {
        const Icon = TYPE_ICON[notification.type] ?? Bell;
        return (
          <button
            key={notification.id}
            type="button"
            onClick={() => handleClick(notification)}
            className={`w-full flex items-start gap-3 px-3.5 py-3 text-left text-sm transition hover:bg-muted ${
              notification.read ? '' : 'bg-primary/5'
            }`}
          >
            <Icon className="w-4 h-4 text-primary mt-0.5 shrink-0" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className={`text-ink ${notification.read ? 'font-medium' : 'font-bold'}`}>{notification.title}</p>
              <p className="text-ink/70 mt-0.5">{notification.message}</p>
              <p className="text-xs text-ink/50 mt-1">{formatDateTime(notification.createdAt)}</p>
            </div>
            {!notification.read && <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );
};

export default NotificationFeed;
