import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Bell, ClipboardCheck, ShieldAlert, AlertTriangle } from 'lucide-react';
import apiService from '../../services/apiService';
import { AppNotification } from '../../types/notification';
import { useAuthUser } from '../auth/auth';
import { OFFICER_ROLES } from '../officer/officerAuth';

const TYPE_ICON: Record<string, typeof Bell> = {
  WORKFLOW_ASSIGNED: ClipboardCheck,
  WORKFLOW_STEP_APPROVED: ClipboardCheck,
  WORKFLOW_STEP_REJECTED: ClipboardCheck,
  GOVERNANCE_ALERT_REVIEWED: ShieldAlert,
  GOVERNANCE_ALERT_DISMISSED: ShieldAlert,
  // An Admin flagging a pending step for urgent review (AdminWorkflowOversightPage.tsx)
  // - see WorkflowsService.escalateStep.
  ADMIN_ESCALATION: AlertTriangle,
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
  const { data: user } = useAuthUser();
  const isOfficer = !!user && (OFFICER_ROLES as readonly string[]).includes(user.role);

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

  // An officer's notification never opens Parcel 360 (docs/ADMIN_PANEL_ISSUES.md
  // follow-up, per the user's explicit "the notification in officer must not
  // lead to parcel 360 view... notification should lead to Assigned Requests
  // / Governance Alerts these tabs as there is alerts raised") - it goes to
  // whichever of the officer's own queue tabs actually deals with this
  // notification: Governance Alerts for the two GOVERNANCE_ALERT_* types,
  // Assigned Requests for everything else (WORKFLOW_ASSIGNED, ADMIN_ESCALATION,
  // and any future workflow-related type). The specific workflow/alert is
  // passed through as a query param (per the user's follow-up "the
  // notification that is leading to the respective tab is also selected
  // there") so the destination page can select/open it directly instead of
  // just landing on the bare list - see AssignedRequestsPage's ?workflow=
  // and GovernanceAlertsPanel's ?alert= handling. A citizen's own
  // notifications are untouched - they still open the relevant parcel, same
  // as before.
  const handleClick = (notification: AppNotification) => {
    if (!notification.read) markReadMutation.mutate(notification.id);
    if (isOfficer) {
      if (notification.type.startsWith('GOVERNANCE_ALERT')) {
        navigate(notification.alertId ? `/officer/alerts?alert=${notification.alertId}` : '/officer/alerts');
      } else {
        navigate(notification.workflowId ? `/officer/requests?workflow=${notification.workflowId}` : '/officer/requests');
      }
      return;
    }
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
