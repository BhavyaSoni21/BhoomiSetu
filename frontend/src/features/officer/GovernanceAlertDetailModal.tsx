import React from 'react';
import { GovernanceAlert } from '../../types/governanceAlert';
import { AiExplanation } from '../../types/aiExplanation';
import AiExplanationCard from '../ai/AiExplanationCard';

const SEVERITY_COLORS: Record<string, string> = {
  LOW: 'bg-gray-100 text-gray-700',
  MEDIUM: 'bg-yellow-100 text-yellow-700',
  HIGH: 'bg-orange-100 text-orange-700',
  CRITICAL: 'bg-red-100 text-red-700',
};

const STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-red-50 text-red-700',
  REVIEWED: 'bg-blue-50 text-blue-700',
  DISMISSED: 'bg-gray-50 text-gray-500',
};

interface GovernanceAlertDetailModalProps {
  alert: GovernanceAlert;
  explanation?: AiExplanation;
  isExplaining: boolean;
  explainError: boolean;
  isUpdatingStatus: boolean;
  onExplain: () => void;
  onMarkReviewed: () => void;
  onDismiss: () => void;
  onClose: () => void;
}

// The popout triggered by "View Details" on GovernanceAlertsPanel - full
// alert detail plus the "Explain with AI" action, both of which used to be
// crammed into the alert's row card. Same modal shell (fixed overlay,
// role="dialog") as ServiceRequestForm.tsx's citizen-facing modal, for
// visual consistency between the two.
const GovernanceAlertDetailModal: React.FC<GovernanceAlertDetailModalProps> = ({
  alert,
  explanation,
  isExplaining,
  explainError,
  isUpdatingStatus,
  onExplain,
  onMarkReviewed,
  onDismiss,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
      <div className="bg-white rounded-lg shadow-lg max-w-lg w-full p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium mr-2 ${SEVERITY_COLORS[alert.severity] ?? 'bg-gray-100 text-gray-700'}`}>
              {alert.severity}
            </span>
            <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[alert.status] ?? 'bg-gray-100 text-gray-700'}`}>
              {alert.status}
            </span>
            <h3 className="text-lg font-semibold mt-2">{alert.alertType.replace(/_/g, ' ')}</h3>
          </div>
          <button onClick={onClose} aria-label="Close alert details" className="text-gray-400 hover:text-gray-600 text-2xl leading-none">
            &times;
          </button>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm mb-4 border-b border-gray-100 pb-4">
          <div>
            <dt className="text-gray-500">Parcel</dt>
            <dd className="text-gray-800 font-medium">{alert.parcelId}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Source</dt>
            <dd className="text-gray-800 font-medium">{alert.source.replace(/_/g, ' ')}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Raised</dt>
            <dd className="text-gray-800 font-medium">{alert.createdAt ? new Date(alert.createdAt).toLocaleString() : 'Unknown'}</dd>
          </div>
        </dl>

        <p className="text-sm text-gray-700 mb-4">{alert.explanation}</p>

        {explanation ? (
          <div className="mb-4">
            <AiExplanationCard explanation={explanation} />
          </div>
        ) : (
          <button
            onClick={onExplain}
            disabled={isExplaining}
            className="w-full mb-2 px-3 py-2 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
          >
            {isExplaining ? 'Explaining...' : 'Explain with AI'}
          </button>
        )}
        {explainError && <p className="text-xs text-red-600 mb-4">Could not generate an explanation. Please try again.</p>}

        <div className="flex flex-wrap gap-2 justify-end mt-4">
          <button
            onClick={onMarkReviewed}
            disabled={isUpdatingStatus}
            className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            Mark Reviewed
          </button>
          <button
            onClick={onDismiss}
            disabled={isUpdatingStatus}
            className="px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded hover:bg-gray-50 disabled:opacity-50"
          >
            Dismiss
          </button>
          <button onClick={onClose} className="px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded hover:bg-gray-50">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default GovernanceAlertDetailModal;
