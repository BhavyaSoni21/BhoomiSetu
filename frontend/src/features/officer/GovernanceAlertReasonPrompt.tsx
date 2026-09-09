import React, { useState } from 'react';
import { CheckCircle2, XCircle, X } from 'lucide-react';
import { GovernanceAlert } from '../../types/governanceAlert';

interface GovernanceAlertReasonPromptProps {
  alert: GovernanceAlert;
  status: 'REVIEWED' | 'DISMISSED';
  isSubmitting: boolean;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

// Opens on clicking "Mark Reviewed"/"Dismiss" (row or detail-modal buttons)
// - per the user's explicit follow-up: a popup on button-press, not an
// always-visible textarea sitting on the row/modal beforehand (that earlier
// version is what this replaces). Reason is mandatory - Confirm no-ops and
// shows an inline error instead of submitting until one is typed; the
// backend enforces this too (governance-alert.dto.ts), this is just the
// friendlier client-side check.
const GovernanceAlertReasonPrompt: React.FC<GovernanceAlertReasonPromptProps> = ({
  alert,
  status,
  isSubmitting,
  onConfirm,
  onCancel,
}) => {
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const trimmed = reason.trim();

  const handleConfirm = () => {
    if (!trimmed) {
      setTouched(true);
      return;
    }
    onConfirm(trimmed);
  };

  const actionLabel = status === 'DISMISSED' ? 'Dismiss' : 'Mark Reviewed';
  const ActionIcon = status === 'DISMISSED' ? XCircle : CheckCircle2;
  const actionColorClass = status === 'DISMISSED' ? 'bg-secondary' : 'bg-primary';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
      <div className="relative bg-surface border-4 border-ink shadow-hard-lg max-w-md w-full p-6">
        <div className="flex items-start justify-between mb-4 gap-3">
          <div>
            <h3 className="text-lg font-black uppercase tracking-tight font-display text-ink">{actionLabel}</h3>
            <p className="text-xs text-ink/60 mt-1">{alert.alertType.replace(/_/g, ' ')} &middot; Parcel {alert.parcelId}</p>
          </div>
          <button
            onClick={onCancel}
            aria-label="Close without submitting"
            className="shrink-0 w-8 h-8 flex items-center justify-center border-2 border-ink bg-surface text-ink hover:bg-muted transition"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <label htmlFor="alert-reason-prompt" className="block text-xs font-bold uppercase tracking-widest text-ink mb-1.5">
          Reason
        </label>
        <textarea
          id="alert-reason-prompt"
          autoFocus
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Why are you taking this action? Shared with the relevant department."
          rows={3}
          className={`w-full px-3 py-2 border-2 bg-surface text-ink text-sm placeholder:text-ink/40 focus:outline-none focus:border-primary ${
            touched && !trimmed ? 'border-secondary-strong' : 'border-ink'
          }`}
        />
        {touched && !trimmed && <p className="text-xs font-medium text-secondary-strong mt-1">A reason is required.</p>}

        <div className="flex flex-wrap gap-2 justify-end mt-4">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-xs font-bold uppercase tracking-widest bg-surface text-ink border-2 border-ink shadow-hard-sm transition hover:bg-muted active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isSubmitting}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-white border-2 border-ink shadow-hard-sm transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50 ${actionColorClass}`}
          >
            <ActionIcon className="w-3.5 h-3.5" aria-hidden="true" />
            {isSubmitting ? 'Submitting...' : `Confirm ${actionLabel}`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GovernanceAlertReasonPrompt;
