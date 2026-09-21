import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from '../../context/LanguageContext';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckSquare, Send, AlertCircle } from 'lucide-react';
import apiService from '../../services/apiService';

const FINDING_OPTIONS = [
  { value: 'SUPPORTED', labelKey: 'findings.supported' },
  { value: 'NOT_VERIFIED', labelKey: 'findings.notVerified' },
  { value: 'CONTRADICTED', labelKey: 'findings.contradicted' },
  { value: 'PARTIALLY_VERIFIED', labelKey: 'findings.partiallyVerified' },
  { value: 'UNABLE_TO_DETERMINE', labelKey: 'findings.unableToDetermine' },
];

interface FindingEntry {
  field_name: string;
  finding: string;
  description: string;
}

const VerifierFindingsPage: React.FC = () => {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [findings, setFindings] = useState<FindingEntry[]>([
    { field_name: '', finding: '', description: '' },
  ]);
  const [overallFinding, setOverallFinding] = useState('');
  const [declarationConfirmed, setDeclarationConfirmed] = useState(false);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleFindingChange = (index: number, field: keyof FindingEntry, value: string) => {
    const updated = [...findings];
    updated[index] = { ...updated[index], [field]: value };
    setFindings(updated);
  };

  const addFinding = () => {
    setFindings([...findings, { field_name: '', finding: '', description: '' }]);
  };

  const removeFinding = (index: number) => {
    setFindings(findings.filter((_, i) => i !== index));
  };

  const submitMutation = useMutation(
    async () => {
      if (!declarationConfirmed) {
        throw new Error(t('findings.declarationRequired'));
      }
      if (!overallFinding) {
        throw new Error(t('findings.overallFindingRequired'));
      }
      const anyEmpty = findings.some(f => !f.field_name || !f.finding || !f.description);
      if (anyEmpty) {
        throw new Error(t('findings.allFieldsRequired'));
      }

      const payload = {
        findings,
        overall_finding: overallFinding,
        declaration_confirmed: declarationConfirmed,
        notes,
        task_id: taskId,
      };

      const response = await apiService.post(`/cases/${taskId}/findings`, payload);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['verifier-tasks']);
        navigate('/verifier');
      },
      onError: (err: Error) => {
        setError(err.message);
      },
    },
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black uppercase tracking-tight font-display text-ink">
          {t('verifierPortal.submitFindingsTitle')}
        </h1>
        <button
          type="button"
          onClick={() => navigate('/verifier')}
          className="text-xs font-bold uppercase tracking-widest text-ink/50 hover:text-ink"
        >
          {t('verifierPortal.backToDashboard')}
        </button>
      </div>

      {error && (
        <p className="flex items-center gap-1.5 text-sm font-medium text-secondary-strong">
          <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      <div>
        <label className="block text-xs font-bold uppercase tracking-widest text-ink mb-1">
          {t('findings.fieldsToVerify')}
        </label>
        {findings.map((finding, index) => (
          <div key={index} className="space-y-2 mb-3 p-3 border-2 border-ink/20">
            <input
              type="text"
              placeholder={t('findings.fieldNamePlaceholder')}
              value={finding.field_name}
              onChange={(e) => handleFindingChange(index, 'field_name', e.target.value)}
              className="w-full px-3 py-2 border-2 border-ink bg-surface text-ink text-sm focus:outline-none focus:border-primary"
            />
            <select
              value={finding.finding}
              onChange={(e) => handleFindingChange(index, 'finding', e.target.value)}
              className="w-full px-3 py-2 border-2 border-ink bg-surface text-ink text-sm focus:outline-none focus:border-primary"
            >
              <option value="">{t('findings.selectFinding')}</option>
              {FINDING_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>
              ))}
            </select>
            <textarea
              placeholder={t('findings.descriptionPlaceholder')}
              value={finding.description}
              onChange={(e) => handleFindingChange(index, 'description', e.target.value)}
              className="w-full px-3 py-2 border-2 border-ink bg-surface text-ink text-sm focus:outline-none focus:border-primary"
              rows={2}
            />
            {findings.length > 1 && (
              <button
                type="button"
                onClick={() => removeFinding(index)}
                className="text-xs font-bold uppercase tracking-widest text-secondary-strong hover:text-secondary hover:underline"
              >
                {t('findings.removeFinding')}
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={addFinding}
          className="text-xs font-bold uppercase tracking-widest text-ink hover:text-primary underline"
        >
          + {t('findings.addFinding')}
        </button>
      </div>

      <div>
        <label className="block text-xs font-bold uppercase tracking-widest text-ink mb-1">
          {t('findings.overallFinding')}
        </label>
        <select
          value={overallFinding}
          onChange={(e) => setOverallFinding(e.target.value)}
          className="w-full px-3 py-2 border-2 border-ink bg-surface text-ink text-sm focus:outline-none focus:border-primary"
        >
          <option value="">{t('findings.selectOverallFinding')}</option>
          {FINDING_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor={`notes-${taskId}`} className="block text-xs font-bold uppercase tracking-widest text-ink mb-1">
          {t('findings.notesLabel')}
        </label>
        <textarea
          id={`notes-${taskId}`}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full px-3 py-2 border-2 border-ink bg-surface text-ink text-sm focus:outline-none focus:border-primary"
          rows={2}
          placeholder={t('findings.notesPlaceholder')}
        />
      </div>

      <div className="flex items-start gap-2 border-2 border-ink p-3 bg-surface">
        <input
          id="declaration"
          type="checkbox"
          checked={declarationConfirmed}
          onChange={(e) => setDeclarationConfirmed(e.target.checked)}
          className="mt-0.5"
        />
        <label htmlFor="declaration" className="text-xs font-bold uppercase tracking-widest text-ink">
          {t('findings.declarationText')}
        </label>
      </div>

      <button
        type="button"
        onClick={() => submitMutation.mutate()}
        disabled={!declarationConfirmed || !overallFinding || submitMutation.isPending}
        className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-primary text-white font-bold text-xs uppercase tracking-widest border-2 border-ink shadow-hard-sm transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50"
      >
        {submitMutation.isPending ? (
          <span className="animate-spin w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" aria-hidden="true" />
        ) : (
          <>
            <Send className="w-3.5 h-3.5" aria-hidden="true" />
            {t('findings.submitFindingsCta')}
          </>
        )}
      </button>
    </div>
  );
};

export default VerifierFindingsPage;
