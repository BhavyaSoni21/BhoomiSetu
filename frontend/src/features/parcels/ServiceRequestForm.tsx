import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { CheckCircle2, LogIn, Send, UserPlus } from 'lucide-react';
import apiService from '../../services/apiService';
import { useAuthUser } from '../auth/auth';
import { Workflow } from '../../types/workflow';

interface ServiceRequestFormProps {
  parcelId: string;
  workflowType: string;
  title: string;
  onClose: () => void;
}

const ServiceRequestForm: React.FC<ServiceRequestFormProps> = ({ parcelId, workflowType, title, onClose }) => {
  const { t } = useTranslation();
  // Backend requires an authenticated CITIZEN to create a workflow
  // (workflows.controller.ts: POST /workflows is @Roles(CITIZEN_ROLE)-guarded)
  // - a guest or signed-in staff account sees a sign-in prompt instead of the
  // working form, rather than a submit that silently 403s.
  const { data: user, isLoading: userLoading } = useAuthUser();
  const isCitizen = user?.role === 'CITIZEN';

  const [createdBy, setCreatedBy] = useState('');
  const [requestDetails, setRequestDetails] = useState('');

  const mutation = useMutation<Workflow, Error>(async () => {
    const response = await apiService.post('/workflows', {
      parcelId,
      workflowType,
      createdBy: createdBy.trim() || undefined,
      requestDetails: requestDetails.trim() || undefined,
    });
    return response.data;
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };

  if (userLoading) return null;

  if (!isCitizen) {
    return (
      <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
        <div className="relative bg-surface border-2 sm:border-4 border-ink shadow-hard-lg max-w-md w-full p-6">
          <span className="absolute -top-3 -right-3 w-6 h-6 rounded-full bg-secondary border-2 border-ink" aria-hidden="true" />
          <h3 className="text-lg font-black uppercase tracking-tight font-display text-ink mb-2">{title}</h3>
          <p className="text-sm text-ink/80 leading-relaxed mb-5">{t('serviceRequest.signInRequiredBody')}</p>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-full border-2 border-ink bg-primary px-4 py-2 text-sm font-bold uppercase tracking-wider text-white shadow-hard-sm transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
            >
              <LogIn className="w-4 h-4" aria-hidden="true" />
              {t('serviceRequest.signInCta')}
            </Link>
            <Link
              to="/register"
              className="inline-flex items-center gap-2 rounded-full border-2 border-ink bg-surface px-4 py-2 text-sm font-bold uppercase tracking-wider text-ink shadow-hard-sm transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
            >
              <UserPlus className="w-4 h-4" aria-hidden="true" />
              {t('serviceRequest.registerCta')}
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="ml-auto text-xs font-bold uppercase tracking-wider text-ink/60 hover:text-ink transition"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (mutation.isSuccess) {
    const workflow = mutation.data;
    return (
      <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
        <div className="relative bg-surface border-2 sm:border-4 border-ink shadow-hard-lg max-w-md w-full p-6">
          <span className="absolute -top-3 -right-3 w-6 h-6 rounded-full bg-primary border-2 border-ink flex items-center justify-center" aria-hidden="true">
            <CheckCircle2 className="w-3.5 h-3.5 text-white" />
          </span>
          <h3 className="text-lg font-black uppercase tracking-tight font-display text-primary mb-2">Request Submitted</h3>
          <p className="text-sm text-ink/80 mb-1">
            Your request has been submitted and is now <strong className="text-ink">{workflow.currentStatus}</strong>.
          </p>
          <p className="text-xs text-ink/50 font-mono mb-4">Reference ID: {workflow.id}</p>
          <div className="space-y-1 mb-4 border-t-2 border-b-2 border-ink/15 py-3 divide-y-2 divide-ink/10">
            {workflow.steps.map((step) => (
              <div key={step.id} className="flex justify-between text-sm text-ink/70 py-1 first:pt-0 last:pb-0">
                <span>{step.department.replace(/_/g, ' ')}</span>
                <span className="font-bold uppercase text-xs text-ink">{step.status}</span>
              </div>
            ))}
          </div>
          <button
            onClick={onClose}
            className="w-full flex items-center justify-center gap-2 rounded-full border-2 border-ink bg-primary px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-white shadow-hard-sm transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
      <div className="relative bg-surface border-2 sm:border-4 border-ink shadow-hard-lg max-w-md w-full p-6">
        <span className="absolute -top-3 -right-3 w-6 h-6 rounded-full bg-secondary border-2 border-ink" aria-hidden="true" />
        <h3 className="text-lg font-black uppercase tracking-tight font-display text-ink mb-4">{title}</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="requestedByInput" className="block text-xs font-bold uppercase tracking-widest text-ink mb-1">
              Your Name
            </label>
            <input
              id="requestedByInput"
              type="text"
              value={createdBy}
              onChange={(e) => setCreatedBy(e.target.value)}
              className="w-full border-2 border-ink bg-surface px-3.5 py-2.5 text-ink placeholder:text-ink/40 focus:outline-none focus:border-primary"
              placeholder="Optional"
            />
          </div>
          <div>
            <label htmlFor="requestDetailsInput" className="block text-xs font-bold uppercase tracking-widest text-ink mb-1">
              Details
            </label>
            <textarea
              id="requestDetailsInput"
              value={requestDetails}
              onChange={(e) => setRequestDetails(e.target.value)}
              rows={4}
              className="w-full border-2 border-ink bg-surface px-3.5 py-2.5 text-ink placeholder:text-ink/40 focus:outline-none focus:border-primary"
              placeholder="Describe your request..."
            />
          </div>
          {mutation.isError && (
            <p className="text-sm font-medium text-secondary-strong">Something went wrong submitting your request. Please try again.</p>
          )}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border-2 border-ink text-ink font-bold uppercase text-xs tracking-wider hover:bg-muted transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isLoading}
              className="inline-flex items-center gap-2 rounded-full border-2 border-ink bg-primary px-4 py-2 text-sm font-bold uppercase tracking-wider text-white shadow-hard-sm transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50"
            >
              <Send className="w-4 h-4" aria-hidden="true" />
              {mutation.isLoading ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ServiceRequestForm;
