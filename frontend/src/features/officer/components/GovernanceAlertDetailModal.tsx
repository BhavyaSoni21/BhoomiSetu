import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { X, Sparkles, AlertCircle, MapPinned } from 'lucide-react';
import { GovernanceAlert } from '../../types/governanceAlert';
import { AiExplanation } from '../../types/aiExplanation';
import AiExplanationCard from '../../ai/components/AiExplanationCard';
import {
  AlertStage,
  NEXT_ACTIONS,
  STAGE_CONFIG,
  STAGE_TRACK,
  STAGE_TRACK_LABEL_KEYS,
  STATUS_BADGE_STYLES,
  STATUS_LABEL_KEYS,
} from './GovernanceAlertReasonPrompt';

// Severity badges share the same low-key-to-critical palette as
// GovernanceAlertsPanel; status badges (STATUS_BADGE_STYLES) come from
// GovernanceAlertReasonPrompt so the two panels never drift.
const SEVERITY_STYLES: Record<string, string> = {
  LOW: 'bg-muted text-ink',
  MEDIUM: 'bg-accent text-ink',
  HIGH: 'bg-secondary text-white',
  CRITICAL: 'bg-secondary-strong text-white',
};

const badgeClass = (styles: Record<string, string>, key: string) =>
  `inline-block border-2 border-ink px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest mr-2 ${styles[key] ?? 'bg-muted text-ink'}`;

interface GovernanceAlertDetailModalProps {
  alert: GovernanceAlert;
  explanation?: AiExplanation;
  isExplaining: boolean;
  explainError: boolean;
  onExplain: () => void;
  onAdvance: (stage: AlertStage) => void;
  onClose: () => void;
}

// Four-stage progress line (docs/ADMIN_PANEL_ISSUES.md Officer #4) - Detected
// -> Acknowledged -> Field Verified -> Resolved, current stage highlighted.
// DISMISSED is a separate early-exit outcome, not a track position, so it's
// shown as a standalone note under the track instead of trying to place it
// on a line it may never have fully traversed.
const StageProgress: React.FC<{ status: string }> = ({ status }) => {
  const { t } = useTranslation();
  if (status === 'DISMISSED') {
    return <p className="text-xs font-bold uppercase tracking-widest text-secondary-strong mb-4">{t('officerPortal.stageDismissedNote')}</p>;
  }
  const currentIndex = STAGE_TRACK.indexOf(status as (typeof STAGE_TRACK)[number]);
  return (
    <div className="flex items-center gap-1 mb-4" aria-label={t('officerPortal.verificationStagesAria')}>
      {STAGE_TRACK.map((stage, index) => (
        <React.Fragment key={stage}>
          {index > 0 && <span className={`h-0.5 flex-1 ${index <= currentIndex ? 'bg-primary' : 'bg-ink/15'}`} aria-hidden="true" />}
          <span
            className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-1 border-2 border-ink whitespace-nowrap ${
              index === currentIndex ? 'bg-primary text-white' : index < currentIndex ? 'bg-primary/30 text-ink' : 'bg-surface text-ink/50'
            }`}
          >
            {t(STAGE_TRACK_LABEL_KEYS[stage])}
          </span>
        </React.Fragment>
      ))}
    </div>
  );
};

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
  onExplain,
  onAdvance,
  onClose,
}) => {
  const { t } = useTranslation();
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
      <div className="relative bg-surface border-4 border-ink shadow-hard-lg max-w-lg w-full p-6">
        <div className="flex items-start justify-between mb-4 gap-3">
          <div>
            <span className={badgeClass(SEVERITY_STYLES, alert.severity)}>
              {alert.severity}
            </span>
            <span className={badgeClass(STATUS_BADGE_STYLES, alert.status)}>
              {t(STATUS_LABEL_KEYS[alert.status] ?? alert.status)}
            </span>
            <h3 className="text-lg font-black uppercase tracking-tight font-display text-ink mt-2">{alert.alertType.replace(/_/g, ' ')}</h3>
          </div>
          <button
            onClick={onClose}
            aria-label={t('officerPortal.closeAlertDetailsAria')}
            className="shrink-0 w-8 h-8 flex items-center justify-center border-2 border-ink bg-surface text-ink hover:bg-muted transition"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <StageProgress status={alert.status} />

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm mb-4 border-b-2 border-ink pb-4">
          <div>
            <dt className="text-[11px] font-bold uppercase tracking-widest text-ink/60">{t('officerPortal.parcelDtLabel')}</dt>
            <dd className="text-ink font-bold">
              {alert.parcelId}
              {/* Notifications stopped auto-opening Parcel 360 (docs/ADMIN_PANEL_ISSUES.md
                  follow-up) - this is the direct path from an alert's detail
                  back to its parcel's full detail view. */}
              <Link
                to={`/parcels/${alert.parcelId}`}
                className="ml-2 inline-flex items-center gap-1 text-primary hover:text-primary-strong font-bold text-[10px] uppercase tracking-wide underline underline-offset-2"
              >
                <MapPinned className="w-3 h-3" aria-hidden="true" />
                {t('officerPortal.viewParcelCta')}
              </Link>
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-bold uppercase tracking-widest text-ink/60">{t('officerPortal.sourceDtLabel')}</dt>
            <dd className="text-ink font-bold">{alert.source.replace(/_/g, ' ')}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-bold uppercase tracking-widest text-ink/60">{t('officerPortal.raisedDtLabel')}</dt>
            <dd className="text-ink font-bold">{alert.createdAt ? new Date(alert.createdAt).toLocaleString() : t('officerPortal.unknownLabel')}</dd>
          </div>
        </dl>

        <p className="text-sm text-ink/80 mb-4">{alert.explanation}</p>

        {alert.reason && (
          <p className="text-xs text-ink/60 mb-4 border-l-4 border-ink/20 pl-3">
            <strong className="font-bold text-ink/70">{t('officerPortal.reviewersNoteLabel')}</strong> {alert.reason}
          </p>
        )}

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
            {isExplaining ? t('officerPortal.explainingLabel') : t('officerPortal.explainWithAiCta')}
          </button>
        )}
        {explainError && (
          <p className="flex items-center gap-1.5 text-xs font-medium text-secondary-strong mb-4">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            {t('officerPortal.explainError')}
          </p>
        )}

        <div className="flex flex-wrap gap-2 justify-end mt-4">
          {(NEXT_ACTIONS[alert.status] ?? []).map((stage) => {
            const { labelKey, Icon, colorClass } = STAGE_CONFIG[stage];
            return (
              <button
                key={stage}
                onClick={() => onAdvance(stage)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-white border-2 border-ink shadow-hard-sm transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none ${colorClass}`}
              >
                <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                {t(labelKey)}
              </button>
            );
          })}
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-bold uppercase tracking-widest bg-surface text-ink border-2 border-ink shadow-hard-sm transition hover:bg-muted active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
          >
            {t('officerPortal.closeCta')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GovernanceAlertDetailModal;
