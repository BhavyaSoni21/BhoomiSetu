import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, CheckCircle2, XCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import apiService from '../../services/apiService';
import { GovernanceAlert } from '../../types/governanceAlert';
import { AiExplanation } from '../../types/aiExplanation';
import GovernanceAlertDetailModal from './GovernanceAlertDetailModal';
import GovernanceAlertReasonPrompt from './GovernanceAlertReasonPrompt';

interface PendingAction {
  alertId: string;
  status: 'REVIEWED' | 'DISMISSED';
}

// Severity is its own axis from workflow/alert *status* - not literally
// approved/pending/rejected - so it borrows the palette rather than the
// strict status mapping: low-key up through the portal's secondary
// (terracotta) "danger" tone for the two most serious tiers.
const SEVERITY_STYLES: Record<string, string> = {
  LOW: 'bg-muted text-ink',
  MEDIUM: 'bg-accent text-ink',
  HIGH: 'bg-secondary text-white',
  CRITICAL: 'bg-secondary-strong text-white',
};

const severityBadgeClass = (severity: string) =>
  `inline-block border-2 border-ink px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest mr-2 ${SEVERITY_STYLES[severity] ?? 'bg-muted text-ink'}`;

const ALERTS_PER_PAGE = 5;

const GovernanceAlertsPanel: React.FC = () => {
  const queryClient = useQueryClient();
  const [explanations, setExplanations] = useState<Record<string, AiExplanation>>({});
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

  const { data: alerts = [], isLoading, error } = useQuery<GovernanceAlert[]>(
    ['governance-alerts', 'OPEN'],
    async () => {
      const response = await apiService.get('/governance-alerts', { params: { status: 'OPEN' } });
      return response.data;
    },
  );

  const pageCount = Math.max(1, Math.ceil(alerts.length / ALERTS_PER_PAGE));
  // An alert leaving the list (reviewed/dismissed elsewhere, or this page's
  // last alert acted on) can strand `page` past the new last page - clamp
  // rather than showing an empty page with working prev/next controls.
  useEffect(() => {
    if (page > pageCount - 1) setPage(Math.max(0, pageCount - 1));
  }, [page, pageCount]);
  const pagedAlerts = alerts.slice(page * ALERTS_PER_PAGE, page * ALERTS_PER_PAGE + ALERTS_PER_PAGE);

  const statusMutation = useMutation(
    async ({ id, status, reason }: { id: string; status: 'REVIEWED' | 'DISMISSED'; reason: string }) => {
      const response = await apiService.patch(`/governance-alerts/${id}/status`, { status, reason });
      return response.data;
    },
    {
      onSuccess: (_data, variables) => {
        queryClient.invalidateQueries(['governance-alerts', 'OPEN']);
        // The list only shows OPEN alerts, so an alert acted on from inside
        // the detail modal is about to disappear from underneath it -
        // closing here avoids leaving the modal open on a stale reference.
        setSelectedAlertId((current) => (current === variables.id ? null : current));
        setPendingAction((current) => (current?.alertId === variables.id ? null : current));
      },
    },
  );

  const explainMutation = useMutation<AiExplanation, Error, string>(
    async (alertId) => {
      const response = await apiService.post(`/ai/alerts/${alertId}/explain`);
      return response.data;
    },
    {
      onSuccess: (data, alertId) => setExplanations((prev) => ({ ...prev, [alertId]: data })),
    },
  );

  if (isLoading) return <div className="text-ink/60 text-sm">Loading governance alerts...</div>;
  if (error) return <div className="text-ink/60 text-sm">Error loading governance alerts</div>;

  if (alerts.length === 0) {
    return <div className="text-ink/60 text-sm border-2 border-dashed border-ink/30 px-4 py-6 text-center">No open governance alerts requiring attention.</div>;
  }

  const selectedAlert = alerts.find((a) => a.id === selectedAlertId) ?? null;
  const pendingAlert = pendingAction ? alerts.find((a) => a.id === pendingAction.alertId) ?? null : null;

  return (
    <div className="space-y-3">
      {pagedAlerts.map((alert) => (
        <div key={alert.id} className="bg-surface border-2 border-ink shadow-hard-sm px-3.5 py-3 transition hover:-translate-y-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className={severityBadgeClass(alert.severity)}>
                {alert.severity}
              </span>
              <span className="font-bold text-sm uppercase tracking-wide text-ink">{alert.alertType.replace(/_/g, ' ')}</span>
              <p className="text-xs text-ink/60 mt-0.5">Parcel: {alert.parcelId}</p>
              <p className="text-sm text-ink/70 mt-1">{alert.explanation}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            <button
              onClick={() => setSelectedAlertId(alert.id)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase tracking-widest bg-surface text-ink border-2 border-ink shadow-hard-sm transition hover:bg-muted active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
            >
              <Eye className="w-3.5 h-3.5" aria-hidden="true" />
              View Details
            </button>
            <button
              onClick={() => setPendingAction({ alertId: alert.id, status: 'REVIEWED' })}
              disabled={statusMutation.isLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase tracking-widest bg-primary text-white border-2 border-ink shadow-hard-sm transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50"
            >
              <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
              Mark Reviewed
            </button>
            <button
              onClick={() => setPendingAction({ alertId: alert.id, status: 'DISMISSED' })}
              disabled={statusMutation.isLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase tracking-widest bg-secondary text-white border-2 border-ink shadow-hard-sm transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50"
            >
              <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
              Dismiss
            </button>
          </div>
        </div>
      ))}

      {pageCount > 1 && (
        <div className="flex items-center justify-between gap-3 border-t-2 border-ink/10 pt-3 text-xs font-bold uppercase tracking-widest text-ink/70">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="inline-flex items-center gap-1 px-3 py-1.5 border-2 border-ink bg-surface shadow-hard-sm transition hover:bg-muted active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-40 disabled:pointer-events-none"
          >
            <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
            Prev
          </button>
          <span>
            Page {page + 1} of {pageCount} ({alerts.length} alerts)
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            disabled={page >= pageCount - 1}
            className="inline-flex items-center gap-1 px-3 py-1.5 border-2 border-ink bg-surface shadow-hard-sm transition hover:bg-muted active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-40 disabled:pointer-events-none"
          >
            Next
            <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      )}

      {selectedAlert && (
        <GovernanceAlertDetailModal
          alert={selectedAlert}
          explanation={explanations[selectedAlert.id]}
          isExplaining={explainMutation.isLoading && explainMutation.variables === selectedAlert.id}
          explainError={explainMutation.isError && explainMutation.variables === selectedAlert.id}
          onExplain={() => explainMutation.mutate(selectedAlert.id)}
          // Both actions open the reason prompt (below) instead of
          // submitting directly - closing the detail view first keeps
          // exactly one modal on screen at a time.
          onMarkReviewed={() => {
            setPendingAction({ alertId: selectedAlert.id, status: 'REVIEWED' });
            setSelectedAlertId(null);
          }}
          onDismiss={() => {
            setPendingAction({ alertId: selectedAlert.id, status: 'DISMISSED' });
            setSelectedAlertId(null);
          }}
          onClose={() => setSelectedAlertId(null)}
        />
      )}

      {pendingAlert && pendingAction && (
        <GovernanceAlertReasonPrompt
          alert={pendingAlert}
          status={pendingAction.status}
          isSubmitting={statusMutation.isLoading}
          onConfirm={(reason) => statusMutation.mutate({ id: pendingAction.alertId, status: pendingAction.status, reason })}
          onCancel={() => setPendingAction(null)}
        />
      )}
    </div>
  );
};

export default GovernanceAlertsPanel;
