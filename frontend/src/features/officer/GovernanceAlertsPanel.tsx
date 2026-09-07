import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, CheckCircle2, XCircle } from 'lucide-react';
import apiService from '../../services/apiService';
import { GovernanceAlert } from '../../types/governanceAlert';
import { AiExplanation } from '../../types/aiExplanation';
import GovernanceAlertDetailModal from './GovernanceAlertDetailModal';

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

const GovernanceAlertsPanel: React.FC = () => {
  const queryClient = useQueryClient();
  const [explanations, setExplanations] = useState<Record<string, AiExplanation>>({});
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);

  const { data: alerts = [], isLoading, error } = useQuery<GovernanceAlert[]>(
    ['governance-alerts', 'OPEN'],
    async () => {
      const response = await apiService.get('/governance-alerts', { params: { status: 'OPEN' } });
      return response.data;
    },
  );

  const statusMutation = useMutation(
    async ({ id, status }: { id: string; status: 'REVIEWED' | 'DISMISSED' }) => {
      const response = await apiService.patch(`/governance-alerts/${id}/status`, { status });
      return response.data;
    },
    {
      onSuccess: (_data, variables) => {
        queryClient.invalidateQueries(['governance-alerts', 'OPEN']);
        // The list only shows OPEN alerts, so an alert acted on from inside
        // the detail modal is about to disappear from underneath it -
        // closing here avoids leaving the modal open on a stale reference.
        setSelectedAlertId((current) => (current === variables.id ? null : current));
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

  return (
    <div className="space-y-3">
      {alerts.map((alert) => (
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
              onClick={() => statusMutation.mutate({ id: alert.id, status: 'REVIEWED' })}
              disabled={statusMutation.isLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase tracking-widest bg-primary text-white border-2 border-ink shadow-hard-sm transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50"
            >
              <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
              Mark Reviewed
            </button>
            <button
              onClick={() => statusMutation.mutate({ id: alert.id, status: 'DISMISSED' })}
              disabled={statusMutation.isLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase tracking-widest bg-secondary text-white border-2 border-ink shadow-hard-sm transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50"
            >
              <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
              Dismiss
            </button>
          </div>
        </div>
      ))}

      {selectedAlert && (
        <GovernanceAlertDetailModal
          alert={selectedAlert}
          explanation={explanations[selectedAlert.id]}
          isExplaining={explainMutation.isLoading && explainMutation.variables === selectedAlert.id}
          explainError={explainMutation.isError && explainMutation.variables === selectedAlert.id}
          isUpdatingStatus={statusMutation.isLoading}
          onExplain={() => explainMutation.mutate(selectedAlert.id)}
          onMarkReviewed={() => statusMutation.mutate({ id: selectedAlert.id, status: 'REVIEWED' })}
          onDismiss={() => statusMutation.mutate({ id: selectedAlert.id, status: 'DISMISSED' })}
          onClose={() => setSelectedAlertId(null)}
        />
      )}
    </div>
  );
};

export default GovernanceAlertsPanel;
