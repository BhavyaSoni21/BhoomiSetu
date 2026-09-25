import React from 'react';
import { ApplicationDraftOut } from '../../types/aiFlow';
import { useTranslation } from '../../context/LanguageContext';
import { FileText, Database, Quote } from 'lucide-react';

interface ApplicationDraftProps {
  draft: ApplicationDraftOut;
  editedDraft: string;
  onEditDraft: (value: string) => void;
}

// The editable formal application. Rendered full-width *under* the chat so it
// has room to breathe (see ai-chat.tsx layout).
export const ApplicationDraftEditor: React.FC<Pick<ApplicationDraftProps, 'editedDraft' | 'onEditDraft'>> = ({
  editedDraft,
  onEditDraft,
}) => {
  const { t } = useTranslation();
  return (
    <div className="rounded-xl border border-gov-border bg-surface-2 p-4">
      <div className="flex items-center gap-2 text-sm font-heading font-bold text-text-heading mb-3">
        <FileText className="w-5 h-5 text-brand-900" />
        <span>{t('aiChat.applicationDraftHeading', 'Formal Application')}</span>
      </div>
      <textarea
        value={editedDraft}
        onChange={(e) => onEditDraft(e.target.value)}
        rows={10}
        className="w-full px-3 py-2 rounded-lg border border-gov-border bg-surface-1 text-text-heading placeholder:text-text-muted font-mono text-sm resize-y focus:outline-none focus:border-brand-700"
      />
    </div>
  );
};

// The supporting evidence (DB facts + citizen statements). Rendered to the
// *right* of the chat as the "information" panel. Renders nothing when empty.
export const ApplicationDraftFacts: React.FC<Pick<ApplicationDraftProps, 'draft'>> = ({ draft }) => {
  const { t } = useTranslation();
  const databaseFacts = draft.facts_database ?? [];
  const citizenStatements = draft.citizen_statements ?? [];

  if (databaseFacts.length === 0 && citizenStatements.length === 0) return null;

  return (
    <div className="space-y-4">
      {databaseFacts.length > 0 && (
        <div className="rounded-xl border border-gov-border bg-surface-2 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-text-secondary mb-2 uppercase tracking-wider">
            <Database className="w-4 h-4" />
            <span>{t('aiChat.databaseFacts', 'Database Facts')}</span>
          </div>
          <ul className="list-disc list-inside text-xs text-text-secondary space-y-0.5 pl-2">
            {databaseFacts.map((f, i) => (
              <li key={`db-${i}`}>{f}</li>
            ))}
          </ul>
        </div>
      )}

      {citizenStatements.length > 0 && (
        <div className="rounded-xl border border-gov-border bg-surface-2 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-text-secondary mb-2 uppercase tracking-wider">
            <Quote className="w-4 h-4" />
            <span>{t('aiChat.citizenStatements', 'Citizen Statements')}</span>
          </div>
          <ul className="list-disc list-inside text-xs text-text-secondary space-y-0.5 pl-2">
            {citizenStatements.map((s, i) => (
              <li key={`citz-${i}`}>{s}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

// Combined view (editor + facts) kept for any consumer that wants both stacked.
const ApplicationDraft: React.FC<ApplicationDraftProps> = ({ draft, editedDraft, onEditDraft }) => (
  <div className="space-y-4">
    <ApplicationDraftEditor editedDraft={editedDraft} onEditDraft={onEditDraft} />
    <ApplicationDraftFacts draft={draft} />
  </div>
);

export default ApplicationDraft;
