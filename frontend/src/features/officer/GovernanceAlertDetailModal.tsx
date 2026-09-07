import React from 'react';
import { X, Sparkles, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { GovernanceAlert } from '../../types/governanceAlert';
import { AiExplanation } from '../../types/aiExplanation';
import AiExplanationCard from '../ai/AiExplanationCard';

// Severity/status badges share the same semantics as GovernanceAlertsPanel
// (status wins over the portal's role color where the two would conflict -
// docs/design.md): OPEN -> accent, REVIEWED -> primary, DISMISSED -> secondary.
const SEVERITY_STYLES: Record<string, string> = {
  LOW: 'bg-muted text-ink',
  MEDIUM: 'bg-accent text-ink',
  HIGH: 'bg-secondary text-white',
  CRITICAL: 'bg-secondary-strong text-white',
};

const STATUS_STYLES: Record<string, string> = {
  OPEN: 'bg-accent text-ink',
  REVIEWED: 'bg-primary text-white',
  DISMISSED: 'bg-secondary text-white',
};

const badgeClass = (styles: Record<string, string>, key: string) =>
  `inline-block border-2 border-ink px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest mr-2 ${styles[key] ?? 'bg-muted text-ink'}`;

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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
      <div className="relative bg-surface border-4 border-ink shadow-hard-lg max-w-lg w-full p-6">
        <div className="flex items-start justify-between mb-4 gap-3">
          <div>
            <span className={badgeClass(SEVERITY_STYLES, alert.severity)}>
              {alert.severity}
            </span>
            <span className={badgeClass(STATUS_STYLES, alert.status)}>
              {alert.status}
            </span>
            <h3 className="text-lg font-black uppercase tracking-tight font-display text-ink mt-2">{alert.alertType.replace(/_/g, ' ')}</h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Close alert details"
            className="shrink-0 w-8 h-8 flex items-center justify-center border-2 border-ink bg-surface text-ink hover:bg-muted transition"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm mb-4 border-b-2 border-ink pb-4">
          <div>
            <dt className="text-[11px] font-bold uppercase tracking-widest text-ink/60">Parcel</dt>
            <dd className="text-ink font-bold">{alert.parcelId}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-bold uppercase tracking-widest text-ink/60">Source</dt>
            <dd className="text-ink font-bold">{alert.source.replace(/_/g, ' ')}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-bold uppercase tracking-widest text-ink/60">Raised</dt>
            <dd className="text-ink font-bold">{alert.createdAt ? new Date(alert.createdAt).toLocaleString() : 'Unknown'}</dd>
          </div>
        </dl>

        <p className="text-sm text-ink/80 mb-4">{alert.explanation}</p>

        {explanation ? (
          <div className="mb-4">
            <AiExplanationCard explanation={explanation} />
          </div>
        ) : (
          <button
            onClick={onExplain}
            disabled={isExplaining}
            className="w-full mb-2 inline-flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-bold uppercase tracking-widest bg-accent text-ink border-2 border-ink shadow-hard-sm transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4" aria-hidden="true" />
            {isExplaining ? 'Explaining...' : 'Explain with AI'}
          </button>
        )}
        {explainError && (
          <p className="flex items-center gap-1.5 text-xs font-medium text-secondary-strong mb-4">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            Could not generate an explanation. Please try again.
          </p>
        )}

        <div className="flex flex-wrap gap-2 justify-end mt-4">
          <button
            onClick={onMarkReviewed}
            disabled={isUpdatingStatus}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase tracking-widest bg-primary text-white border-2 border-ink shadow-hard-sm transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50"
          >
            <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
            Mark Reviewed
          </button>
          <button
            onClick={onDismiss}
            disabled={isUpdatingStatus}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase tracking-widest bg-secondary text-white border-2 border-ink shadow-hard-sm transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50"
          >
            <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
            Dismiss
          </button>
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-bold uppercase tracking-widest bg-surface text-ink border-2 border-ink shadow-hard-sm transition hover:bg-muted active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default GovernanceAlertDetailModal;
