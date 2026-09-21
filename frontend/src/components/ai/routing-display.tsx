import React from 'react';
import { RoutingDecisionOut, DepartmentRouting } from '../../types/aiFlow';
import { useTranslation } from '../../context/LanguageContext';
import { CheckCircle2, Target } from 'lucide-react';

interface RoutingDisplayProps {
  routing: RoutingDecisionOut;
}

const ROUTING_DEPT_LABELS: Record<string, string> = {
  SURVEY: 'Survey & Land Records',
  DISPUTE: 'Dispute Resolution',
  LAND_RECORDS: 'Land Records',
  REGISTRATION: 'Registration',
  TAX: 'Tax Department',
  PLANNING: 'Town Planning',
  RESTRICTION: 'Restriction Department',
  ENCUMBRANCE: 'Encumbrance',
};

const RoutingDisplay: React.FC<RoutingDisplayProps> = ({ routing }) => {
  const { t } = useTranslation();

  const deptLabel = (d: DepartmentRouting | string) =>
    typeof d === 'string' ? d : ROUTING_DEPT_LABELS[d.department] ?? d.department;

  const departments = routing.departments ?? [];
  const workflows = routing.workflows_per_department;

  const getWorkflow = (dept: string): string | null => {
    if (!workflows) return null;
    const wf = (workflows as Record<string, unknown>)[dept];
    if (typeof wf === 'string') return wf;
    if (wf && typeof wf === 'object' && 'workflow' in wf) return String((wf as { workflow: unknown }).workflow);
    return null;
  };

  return (
    <div className="rounded-xl border border-gov-border bg-surface-2 p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-heading font-bold text-text-heading">
        <Target className="w-5 h-5 text-brand-900" />
        <span>{t('aiChat.routingHeading', 'Routing Decision')}</span>
      </div>

      <div className="space-y-2">
        {departments.map((d) => {
          const name = deptLabel(d);
          const conf = typeof d === 'object' ? d.confidence : undefined;
          const reason = typeof d === 'object' ? d.reason : undefined;
          const workflow = getWorkflow(typeof d === 'object' ? d.department : d);
          return (
            <div key={name} className="flex items-start gap-3 rounded-lg border border-gov-border bg-surface-1 px-3 py-2.5">
              <CheckCircle2 className="mt-0.5 w-4 h-4 text-emerald-600 flex-shrink-0" />
              <div className="flex-1 text-sm">
                <p className="font-semibold text-text-heading">{name}</p>
                {workflow && <p className="text-xs text-text-secondary">Workflow: {workflow}</p>}
                {conf != null && (
                  <p className="text-xs text-text-secondary">Confidence: {Math.round(conf * 100)}%</p>
                )}
                {reason && <p className="mt-1 text-xs text-text-secondary">{reason}</p>}
              </div>
            </div>
          );
        })}
      </div>

      {routing.priority && (
        <p className="text-xs text-text-secondary">
          {t('aiChat.priorityLabel', 'Priority')}: <span className="font-semibold text-text-heading">{routing.priority}</span>
        </p>
      )}

      {routing.required_capabilities && routing.required_capabilities.length > 0 && (
        <p className="text-xs text-text-secondary">
          {t('aiChat.requiredCapabilities', 'Required capabilities')}:{' '}
          {routing.required_capabilities.join(', ')}
        </p>
      )}
    </div>
  );
};

export default RoutingDisplay;
