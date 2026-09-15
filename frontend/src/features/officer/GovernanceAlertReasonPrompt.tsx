import React, { useState } from 'react';
import { useTranslation } from '../../context/LanguageContext';
import { CheckCircle2, ShieldCheck, XCircle, X } from 'lucide-react';
import { GovernanceAlert } from '../../types/governanceAlert';
import MicButton from '../../components/MicButton';

export type AlertStage = 'ACKNOWLEDGED' | 'FIELD_VERIFIED' | 'RESOLVED' | 'DISMISSED';

interface GovernanceAlertReasonPromptProps {
  alert: GovernanceAlert;
  status: AlertStage;
  isSubmitting: boolean;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

// Four verification stages (docs/ADMIN_PANEL_ISSUES.md Officer #4): each of
// the 4 reachable-via-PATCH statuses gets its own label/icon/color, replacing
// the old REVIEWED/DISMISSED-only ternaries.
export const STAGE_CONFIG: Record<AlertStage, { labelKey: string; Icon: typeof CheckCircle2; colorClass: string }> = {
  ACKNOWLEDGED: { labelKey: 'officerPortal.acknowledgeCta', Icon: CheckCircle2, colorClass: 'bg-primary' },
  FIELD_VERIFIED: { labelKey: 'officerPortal.fieldVerifiedCta', Icon: ShieldCheck, colorClass: 'bg-primary' },
  RESOLVED: { labelKey: 'officerPortal.resolveCta', Icon: CheckCircle2, colorClass: 'bg-primary' },
  DISMISSED: { labelKey: 'officerPortal.dismissCta', Icon: XCircle, colorClass: 'bg-secondary' },
};

// Mirrors the backend's VALID_TRANSITIONS (governance-alerts.service.ts) -
// which stage(s) are reachable from a given current status. RESOLVED/DISMISSED
// are terminal (empty array - no further action possible).
export const NEXT_ACTIONS: Record<string, AlertStage[]> = {
  OPEN: ['ACKNOWLEDGED', 'DISMISSED'],
  ACKNOWLEDGED: ['FIELD_VERIFIED', 'DISMISSED'],
  FIELD_VERIFIED: ['RESOLVED', 'DISMISSED'],
  RESOLVED: [],
  DISMISSED: [],
};

// The 4-stage happy-path track for the progress stepper (DISMISSED is a
// separate early-exit outcome, not a track position - shown as its own badge
// instead, see GovernanceAlertDetailModal). OPEN is included here (unlike
// AlertStage above, which is only the 4 values reachable via PATCH) since
// it's a real starting value of `alert.status` that the stepper must show as
// "Detected".
export const STAGE_TRACK = ['OPEN', 'ACKNOWLEDGED', 'FIELD_VERIFIED', 'RESOLVED'] as const;
export const STAGE_TRACK_LABEL_KEYS: Record<(typeof STAGE_TRACK)[number], string> = {
  OPEN: 'officerPortal.stageDetected',
  ACKNOWLEDGED: 'officerPortal.stageAcknowledged',
  FIELD_VERIFIED: 'officerPortal.stageFieldVerified',
  RESOLVED: 'officerPortal.stageResolved',
};

// Status badge (all 5 real values, unlike STAGE_CONFIG's 4 PATCH-reachable
// ones) - shared between GovernanceAlertsPanel's row cards and
// GovernanceAlertDetailModal's header badge.
export const STATUS_BADGE_STYLES: Record<string, string> = {
  OPEN: 'bg-accent text-ink',
  ACKNOWLEDGED: 'bg-primary/70 text-white',
  FIELD_VERIFIED: 'bg-primary text-white',
  RESOLVED: 'bg-primary text-white',
  DISMISSED: 'bg-secondary text-white',
};
export const STATUS_LABEL_KEYS: Record<string, string> = {
  OPEN: 'officerPortal.stageDetected',
  ACKNOWLEDGED: 'officerPortal.stageAcknowledged',
  FIELD_VERIFIED: 'officerPortal.stageFieldVerified',
  RESOLVED: 'officerPortal.stageResolved',
  DISMISSED: 'officerPortal.stageDismissed',
};

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
  const { t } = useTranslation();
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

  const { labelKey, Icon: ActionIcon, colorClass: actionColorClass } = STAGE_CONFIG[status];
  const actionLabel = t(labelKey);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
      <div className="relative bg-surface border-4 border-ink shadow-hard-lg max-w-md w-full p-6">
        <div className="flex items-start justify-between mb-4 gap-3">
          <div>
            <h3 className="text-lg font-black uppercase tracking-tight font-display text-ink">{actionLabel}</h3>
            <p className="text-xs text-ink/60 mt-1">{t('officerPortal.alertTypeParcelLine', { alertType: alert.alertType.replace(/_/g, ' '), id: alert.parcelId })}</p>
          </div>
          <button
            onClick={onCancel}
            aria-label={t('officerPortal.closeWithoutSubmitting')}
            className="shrink-0 w-8 h-8 flex items-center justify-center border-2 border-ink bg-surface text-ink hover:bg-muted transition"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex items-center justify-between mb-1.5">
          <label htmlFor="alert-reason-prompt" className="block text-xs font-bold uppercase tracking-widest text-ink">
            {t('officerPortal.reasonLabel')}
          </label>
          <MicButton
            onResult={(text) => setReason((prev) => (prev ? `${prev} ${text}` : text))}
          />
        </div>
        <textarea
          id="alert-reason-prompt"
          autoFocus
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t('officerPortal.reasonPlaceholder')}
          rows={3}
          className={`w-full px-3 py-2 border-2 bg-surface text-ink text-sm placeholder:text-ink/40 focus:outline-none focus:border-primary ${
            touched && !trimmed ? 'border-secondary-strong' : 'border-ink'
          }`}
        />
        {touched && !trimmed && <p className="text-xs font-medium text-secondary-strong mt-1">{t('officerPortal.reasonRequiredError')}</p>}

        <div className="flex flex-wrap gap-2 justify-end mt-4">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-xs font-bold uppercase tracking-widest bg-surface text-ink border-2 border-ink shadow-hard-sm transition hover:bg-muted active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
          >
            {t('officerPortal.cancelCta')}
          </button>
          <button
            onClick={handleConfirm}
            disabled={isSubmitting}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-white border-2 border-ink shadow-hard-sm transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50 ${actionColorClass}`}
          >
            <ActionIcon className="w-3.5 h-3.5" aria-hidden="true" />
            {isSubmitting ? t('officerPortal.submittingLabel') : t('officerPortal.confirmActionCta', { action: actionLabel })}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GovernanceAlertReasonPrompt;
