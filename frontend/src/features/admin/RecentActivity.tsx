import React, { useState } from 'react';
import { useTranslation } from '../../context/LanguageContext';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import apiService from '../../services/apiService';
import { AuditLogEntry } from '../../types/auditLog';

// Read-side of the audit trail (docs/FEATURE_AUDIT.md §8 item 10) - closes
// the "Integration Monitoring" half of Tech.md §38's Admin Portal ask
// alongside UserManagement's "User/Role Management" half. Used by the
// System Monitoring page (docs/FRONTEND_UPGRADE_SPEC.md §7, Phase 3) as the
// full, filterable audit feed - it used to sit on the Dashboard capped to 50
// entries; the entityType filter and uncapped list only make sense with the
// dedicated page's extra room.
const ACTION_LABEL_KEYS: Record<string, string> = {
  AUTH_LOGIN: 'adminPortal.actionLabel.AUTH_LOGIN',
  WORKFLOW_STEP_APPROVED: 'adminPortal.actionLabel.WORKFLOW_STEP_APPROVED',
  WORKFLOW_STEP_REJECTED: 'adminPortal.actionLabel.WORKFLOW_STEP_REJECTED',
  WORKFLOW_STATUS_CHANGED: 'adminPortal.actionLabel.WORKFLOW_STATUS_CHANGED',
  GOVERNANCE_ALERT_STATUS_CHANGED: 'adminPortal.actionLabel.GOVERNANCE_ALERT_STATUS_CHANGED',
  USER_CREATED: 'adminPortal.actionLabel.USER_CREATED',
  USER_ROLE_CHANGED: 'adminPortal.actionLabel.USER_ROLE_CHANGED',
  USER_DELETED: 'adminPortal.actionLabel.USER_DELETED',
  DEPARTMENT_CREATED: 'adminPortal.actionLabel.DEPARTMENT_CREATED',
  DEPARTMENT_UPDATED: 'adminPortal.actionLabel.DEPARTMENT_UPDATED',
  DEPARTMENT_DELETED: 'adminPortal.actionLabel.DEPARTMENT_DELETED',
};

// Purely decorative marker dot per action family (docs/design.md's geometric-
// shape-as-wayfinding idea) - keyed off the same `action` value already used
// for ACTION_LABEL_KEYS, so it needs no new data and can't drift from it.
const ACTION_DOT_CLASS: Record<string, string> = {
  AUTH_LOGIN: 'bg-primary',
  WORKFLOW_STEP_APPROVED: 'bg-primary',
  WORKFLOW_STEP_REJECTED: 'bg-secondary-strong',
  WORKFLOW_STATUS_CHANGED: 'bg-accent',
  GOVERNANCE_ALERT_STATUS_CHANGED: 'bg-accent',
  USER_CREATED: 'bg-primary',
  USER_ROLE_CHANGED: 'bg-accent',
  USER_DELETED: 'bg-secondary-strong',
  DEPARTMENT_CREATED: 'bg-primary',
  DEPARTMENT_UPDATED: 'bg-accent',
  DEPARTMENT_DELETED: 'bg-secondary-strong',
};

const ENTITY_TYPE_OPTIONS = [
  { value: '', labelKey: 'adminPortal.entityTypeAll' },
  { value: 'USER', labelKey: 'adminPortal.entityTypeUsers' },
  { value: 'WORKFLOW', labelKey: 'adminPortal.entityTypeWorkflows' },
  { value: 'WORKFLOW_STEP', labelKey: 'adminPortal.entityTypeWorkflowSteps' },
  { value: 'GOVERNANCE_ALERT', labelKey: 'adminPortal.entityTypeGovernanceAlerts' },
  { value: 'DEPARTMENT', labelKey: 'adminPortal.entityTypeDepartments' },
];

function formatDateTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString('en-IN', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const RecentActivity: React.FC = () => {
  const { t } = useTranslation();
  const [entityType, setEntityType] = useState('');
  const { data: entries = [], isLoading, error } = useQuery<AuditLogEntry[]>(['audit-log', entityType], async () => {
    const response = await apiService.get('/audit', { params: entityType ? { entityType } : undefined });
    return response.data;
  });

  return (
    <div>
      <div className="flex justify-end mb-3">
        <select
          aria-label={t('adminPortal.filterActivityAria')}
          value={entityType}
          onChange={(e) => setEntityType(e.target.value)}
          className="px-3 py-2 border-2 border-ink bg-surface text-ink text-xs font-bold uppercase tracking-wide focus:outline-none focus:border-primary"
        >
          {ENTITY_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{t(option.labelKey)}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm font-medium text-ink/60 py-3">
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          {t('adminPortal.loadingActivity')}
        </div>
      ) : error ? (
        <div className="text-sm font-medium text-ink/60 py-3">{t('adminPortal.errorLoadingActivity')}</div>
      ) : entries.length === 0 ? (
        <div className="text-sm font-medium text-ink/60 py-3">{t('adminPortal.noActivityRecorded')}</div>
      ) : (
        <div className="border-2 border-ink divide-y-2 divide-ink bg-surface max-h-[650px] overflow-y-auto">
          {entries.map((entry) => (
            <div key={entry.id} className="flex items-start gap-3 px-3.5 py-3 text-sm">
              <span
                className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${ACTION_DOT_CLASS[entry.action] ?? 'bg-muted'}`}
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <p className="text-ink">
                  <span className="font-bold uppercase text-xs tracking-wide text-ink/70">{entry.userRole.replace(/_/g, ' ')}</span>{' '}
                  {ACTION_LABEL_KEYS[entry.action] ? t(ACTION_LABEL_KEYS[entry.action]) : entry.action.toLowerCase().replace(/_/g, ' ')}
                  {entry.parcelId && <span className="text-ink/60"> {t('adminPortal.onParcelSuffix', { id: entry.parcelId.substring(0, 8) })}</span>}
                </p>
                <p className="text-xs text-ink/50 mt-0.5">{formatDateTime(entry.createdAt)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RecentActivity;
