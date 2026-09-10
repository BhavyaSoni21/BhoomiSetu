import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Bell, ClipboardCheck, ShieldAlert, AlertTriangle, CheckCircle2, RotateCcw } from 'lucide-react';
import apiService from '../../services/apiService';
import { AppNotification } from '../../types/notification';
import { useAuthUser } from '../auth/auth';
import { OFFICER_ROLES } from '../officer/officerAuth';

const TYPE_ICON: Record<string, typeof Bell> = {
  WORKFLOW_ASSIGNED: ClipboardCheck,
  WORKFLOW_STEP_APPROVED: CheckCircle2,
  WORKFLOW_STEP_REJECTED: AlertTriangle,
  GOVERNANCE_ALERT_RESOLVED: ShieldAlert,
  GOVERNANCE_ALERT_DISMISSED: ShieldAlert,
  ADMIN_ESCALATION: AlertTriangle,
  ADMIN_REOPENED_STEP: RotateCcw,
};

function formatDateTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString('en-IN', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

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
      <div className="flex items-center gap-2 text-sm font-medium text-text-muted py-6">
        <Loader2 className="w-4 h-4 animate-spin text-brand-700" aria-hidden="true" />
        Loading notifications...
      </div>
    );
  }
  if (error) {
    return <div className="text-sm font-medium text-gov-error py-4">Error loading notifications</div>;
  }
  if (notifications.length === 0) {
    return (
      <div className="gov-card p-10 text-center bg-surface-2 border border-gov-border">
        <Bell className="w-8 h-8 mx-auto text-text-muted mb-2 opacity-50" />
        <p className="text-sm font-semibold text-text-heading">No notifications yet</p>
        <p className="text-xs text-text-secondary mt-1">
          You will be notified when your land documents are verified or workflows update.
        </p>
      </div>
    );
  }

  return (
    <div className="gov-card overflow-hidden divide-y divide-gov-border">
      {notifications.map((notification) => {
        const Icon = TYPE_ICON[notification.type] ?? Bell;
        const unread = !notification.read;

        return (
          <button
            key={notification.id}
            type="button"
            onClick={() => handleClick(notification)}
            className={`w-full flex items-start gap-4 p-4 text-left transition hover:bg-surface-2/60 ${
              unread ? 'bg-brand-900/[0.03]' : ''
            }`}
          >
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                unread
                  ? 'bg-brand-900 text-white'
                  : 'bg-surface-2 text-text-secondary border border-gov-border'
              }`}
            >
              <Icon className="w-4 h-4" aria-hidden="true" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p
                  className={`text-sm font-heading ${
                    unread ? 'font-bold text-text-heading' : 'font-medium text-text-primary'
                  }`}
                >
                  {notification.title}
                </p>
                <span className="text-[11px] font-mono text-text-muted shrink-0">
                  {formatDateTime(notification.createdAt)}
                </span>
              </div>
              <p className="text-xs text-text-secondary mt-1 leading-relaxed">{notification.message}</p>
            </div>

            {unread && (
              <span
                className="w-2.5 h-2.5 rounded-full bg-action-500 shrink-0 mt-2"
                title="Unread notification"
                aria-hidden="true"
              />
            )}
          </button>
        );
      })}
    </div>
  );
};

export default NotificationFeed;
