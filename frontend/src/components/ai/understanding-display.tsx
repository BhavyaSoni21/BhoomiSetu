import React from 'react';
import { UnderstandRequestOut } from '../../types/aiFlow';
import { useTranslation } from '../../context/LanguageContext';
import { ClipboardCheck, Tag, Database, Quote, Briefcase } from 'lucide-react';

interface UnderstandingDisplayProps {
  understanding: UnderstandRequestOut;
}

const UnderstandingDisplay: React.FC<UnderstandingDisplayProps> = ({ understanding }) => {
  const { t } = useTranslation();

  const issues = understanding.issues ?? [];
  const citFacts = understanding.facts_stated_by_citizen ?? [];
  const dbFacts = understanding.facts_database ?? [];
  const departments = understanding.departments ?? [];

  return (
    <div className="rounded-xl border border-gov-border bg-surface-2 p-4 space-y-4">
      <div className="flex items-center gap-2 text-sm font-heading font-bold text-text-heading">
        <ClipboardCheck className="w-5 h-5 text-brand-900" />
        <span>{t('aiChat.understandingHeading', 'We understand your request as:')}</span>
      </div>

      {understanding.intent && (
        <div className="flex items-start gap-2">
          <Tag className="mt-0.5 w-4 h-4 text-text-secondary flex-shrink-0" />
          <div>
            <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
              {t('aiChat.intentLabel', 'Intent')}
            </span>
            <p className="text-sm text-text-heading">{understanding.intent}</p>
          </div>
        </div>
      )}

      {issues.length > 0 && (
        <div className="flex items-start gap-2">
          <Tag className="mt-0.5 w-4 h-4 text-text-secondary flex-shrink-0" />
          <div className="flex-1">
            <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
              {t('aiChat.issuesLabel', 'Identified Issues')}
            </span>
            <ul className="list-disc list-inside text-sm text-text-secondary mt-1 space-y-0.5 pl-2">
              {issues.map((issue, i) => (
                <li key={`issue-${i}`}>{issue}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {dbFacts.length > 0 && (
        <div className="flex items-start gap-2">
          <Database className="mt-0.5 w-4 h-4 text-text-secondary flex-shrink-0" />
          <div className="flex-1">
            <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
              {t('aiChat.factsDatabaseLabel', 'Facts from Records')}
            </span>
            <ul className="list-disc list-inside text-sm text-text-secondary mt-1 space-y-0.5 pl-2">
              {dbFacts.map((f, i) => (
                <li key={`db-${i}`}>{f}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {citFacts.length > 0 && (
        <div className="flex items-start gap-2">
          <Quote className="mt-0.5 w-4 h-4 text-text-secondary flex-shrink-0" />
          <div className="flex-1">
            <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
              {t('aiChat.factsCitizenLabel', 'Your Statements')}
            </span>
            <ul className="list-disc list-inside text-sm text-text-secondary mt-1 space-y-0.5 pl-2">
              {citFacts.map((s, i) => (
                <li key={`citz-${i}`}>{s}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {departments.length > 0 && (
        <div className="flex items-start gap-2">
          <Briefcase className="mt-0.5 w-4 h-4 text-text-secondary flex-shrink-0" />
          <div className="flex-1">
            <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
              {t('aiChat.departmentsLabel', 'Affected Departments')}
            </span>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {departments.map((d) => (
                <span key={d} className="text-xs px-2 py-1 rounded-full bg-brand-900/10 text-brand-900 border border-brand-900/20">
                  {d}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UnderstandingDisplay;
