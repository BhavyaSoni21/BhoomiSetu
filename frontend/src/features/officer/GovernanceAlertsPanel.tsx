import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiService from '../../services/apiService';
import { GovernanceAlert } from '../../types/governanceAlert';
import { AiExplanation } from '../../types/aiExplanation';
import GovernanceAlertDetailModal from './GovernanceAlertDetailModal';

const SEVERITY_COLORS: Record<string, string> = {
  LOW: 'bg-gray-100 text-gray-700',
  MEDIUM: 'bg-yellow-100 text-yellow-700',
  HIGH: 'bg-orange-100 text-orange-700',
  CRITICAL: 'bg-red-100 text-red-700',
};

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

  if (isLoading) return <div className="text-gray-500 text-sm">Loading governance alerts...</div>;
  if (error) return <div className="text-gray-500 text-sm">Error loading governance alerts</div>;

  if (alerts.length === 0) {
    return <div className="text-gray-500 text-sm">No open governance alerts requiring attention.</div>;
  }

  const selectedAlert = alerts.find((a) => a.id === selectedAlertId) ?? null;

  return (
    <div className="space-y-3">
      {alerts.map((alert) => (
        <div key={alert.id} className="border rounded px-3 py-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium mr-2 ${SEVERITY_COLORS[alert.severity] ?? 'bg-gray-100 text-gray-700'}`}>
                {alert.severity}
              </span>
              <span className="font-medium text-sm">{alert.alertType.replace(/_/g, ' ')}</span>
              <p className="text-xs text-gray-500 mt-0.5">Parcel: {alert.parcelId}</p>
              <p className="text-sm text-gray-600 mt-1">{alert.explanation}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            <button
              onClick={() => setSelectedAlertId(alert.id)}
              className="px-3 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700"
            >
              View Details
            </button>
            <button
              onClick={() => statusMutation.mutate({ id: alert.id, status: 'REVIEWED' })}
              disabled={statusMutation.isLoading}
              className="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            >
              Mark Reviewed
            </button>
            <button
              onClick={() => statusMutation.mutate({ id: alert.id, status: 'DISMISSED' })}
              disabled={statusMutation.isLoading}
              className="px-3 py-1 text-xs border border-gray-300 text-gray-700 rounded hover:bg-gray-50 disabled:opacity-50"
            >
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
