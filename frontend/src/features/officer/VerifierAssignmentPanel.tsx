import React, { useState } from 'react';
import { useTranslation } from '../../context/LanguageContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UserCheck, Users, AlertCircle, CheckCircle2, Loader2, MapPin } from 'lucide-react';
import apiService from '../../services/apiService';
import { DepartmentTask } from '../../types/aiFlow';

interface Verifier {
  id: string;
  name: string;
  email: string;
  district?: string | null;
  role: string;
}

interface VerifierWithWorkload extends Verifier {
  activeTaskCount: number;
}

interface VerifierAssignmentPanelProps {
  /** The task that needs a verifier assigned. */
  task: DepartmentTask;
  /** Called on successful assignment so parent can refresh. */
  onAssigned?: () => void;
}

const FIELD_MODES = new Set(['FIELD_VERIFICATION', 'OFFLINE_APPOINTMENT', 'HYBRID']);

/**
 * Officer UI to assign a field verifier to a department task (§29).
 *
 * Shows when the task's resolution_mode is FIELD_VERIFICATION,
 * OFFLINE_APPOINTMENT, or HYBRID. Lists available VERIFIERs with their
 * workload so the officer can make an informed choice.
 */
const VerifierAssignmentPanel: React.FC<VerifierAssignmentPanelProps> = ({ task, onAssigned }) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [selectedVerifierId, setSelectedVerifierId] = useState<string | null>(
    task.assignedVerifierId ?? null,
  );
  const [notes, setNotes] = useState('');
  const [success, setSuccess] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Only render when the task needs a field verifier
  const needsVerifier = task.resolutionMode ? FIELD_MODES.has(task.resolutionMode) : false;

  const { data: verifiers = [], isLoading: verifiersLoading } = useQuery<VerifierWithWorkload[]>({
    queryKey: ['verifiers-with-workload'],
    queryFn: async () => {
      // One officer-readable endpoint returns VERIFIER users + their active
      // task counts. (Was two calls: admin-only `/users` — 403 for officers —
      // plus a non-existent `/cases/tasks/all`, so the list was always empty
      // and every workload showed 0.)
      const res = await apiService.get<VerifierWithWorkload[]>('/cases/verifiers');
      return res.data ?? [];
    },
    enabled: needsVerifier,
    staleTime: 2 * 60 * 1000,
  });

  const assignMutation = useMutation({
    mutationFn: () =>
      apiService.patch(`/cases/${task.id}/assign-verifier`, {
        verifier_id: selectedVerifierId,
        notes: notes.trim() || undefined,
      }),
    onSuccess: () => {
      setSuccess(true);
      setApiError(null);
      queryClient.invalidateQueries({ queryKey: ['verifier-assigned-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
      onAssigned?.();
    },
    onError: (err: any) => {
      setApiError(
        err?.response?.data?.detail ?? t('verifierAssignment.assignError', 'Failed to assign verifier. Please try again.'),
      );
    },
  });

  if (!needsVerifier) return null;

  const alreadyAssigned = !!task.assignedVerifierId && task.assignedVerifierId === selectedVerifierId && success;
  const canSubmit = !!selectedVerifierId && !assignMutation.isPending && !success;

  return (
    <div className="border-2 border-ink bg-surface p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <UserCheck className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
        <h3 className="font-bold text-sm uppercase tracking-widest text-ink">
          {t('verifierAssignment.title', 'Assign Field Verifier')}
        </h3>
        <span className="ml-auto text-[10px] font-mono uppercase tracking-widest text-ink/40 border border-ink/20 px-2 py-0.5">
          {task.resolutionMode?.replace(/_/g, ' ')}
        </span>
      </div>

      <p className="text-xs text-ink/60 leading-relaxed">
        {t(
          'verifierAssignment.subtitle',
          'Select a verifier to conduct the field visit. The verifier will receive a case package with all parcel and task details.',
        )}
      </p>

      {/* Success banner */}
      {(success || alreadyAssigned) && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border-2 border-green-600 text-green-800 text-sm font-medium">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          {t('verifierAssignment.assignSuccess', 'Verifier assigned successfully.')}
        </div>
      )}

      {/* Error banner */}
      {apiError && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border-2 border-red-600 text-red-800 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {apiError}
        </div>
      )}

      {/* Verifier list */}
      {verifiersLoading ? (
        <div className="flex items-center gap-2 text-xs text-ink/60 py-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
          {t('verifierAssignment.loadingVerifiers', 'Loading verifiers...')}
        </div>
      ) : verifiers.length === 0 ? (
        <p className="text-xs text-ink/50 border-2 border-dashed border-ink/20 p-3 text-center">
          {t('verifierAssignment.noVerifiers', 'No VERIFIER-role users found in the system.')}
        </p>
      ) : (
        <div className="space-y-2">
          <label className="block text-xs font-bold uppercase tracking-widest text-ink mb-1">
            {t('verifierAssignment.selectLabel', 'Select Verifier')}
          </label>
          <div className="grid gap-2 max-h-60 overflow-y-auto pr-1">
            {verifiers.map((v) => {
              const isSelected = selectedVerifierId === v.id;
              const isCurrentlyAssigned = task.assignedVerifierId === v.id;
              return (
                <button
                  key={v.id}
                  type="button"
                  id={`verifier-${v.id}`}
                  onClick={() => { setSelectedVerifierId(v.id); setSuccess(false); }}
                  disabled={assignMutation.isPending || success}
                  className={`w-full text-left flex items-center justify-between gap-3 px-3 py-2.5 border-2 transition-all ${
                    isSelected
                      ? 'border-primary bg-primary/5 text-ink'
                      : 'border-ink/20 hover:border-ink bg-surface-1 text-ink'
                  } disabled:opacity-60`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 border-2 ${
                        isSelected ? 'border-primary bg-primary text-white' : 'border-ink/20 bg-surface-2 text-ink'
                      }`}
                    >
                      {v.name?.charAt(0)?.toUpperCase() ?? 'V'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold truncate">
                        {v.name}
                        {isCurrentlyAssigned && (
                          <span className="ml-2 text-[10px] font-mono text-primary">
                            {t('verifierAssignment.currentlyAssigned', '(assigned)')}
                          </span>
                        )}
                      </p>
                      {v.district && (
                        <p className="text-xs text-ink/50 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 shrink-0" aria-hidden="true" />
                          {v.district}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span
                      className={`inline-block text-[11px] font-mono font-bold px-2 py-0.5 border ${
                        v.activeTaskCount === 0
                          ? 'border-green-500 text-green-700 bg-green-50'
                          : v.activeTaskCount <= 2
                          ? 'border-amber-500 text-amber-700 bg-amber-50'
                          : 'border-red-400 text-red-700 bg-red-50'
                      }`}
                    >
                      {v.activeTaskCount} {t('verifierAssignment.activeTasks', 'active')}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Notes */}
      {!success && (
        <div>
          <label htmlFor={`verifier-notes-${task.id}`} className="block text-xs font-bold uppercase tracking-widest text-ink mb-1">
            {t('verifierAssignment.notesLabel', 'Assignment Notes (optional)')}
          </label>
          <textarea
            id={`verifier-notes-${task.id}`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder={t('verifierAssignment.notesPlaceholder', 'Special instructions, access details, contact info...')}
            className="w-full px-3 py-2 border-2 border-ink bg-surface text-ink text-sm focus:outline-none focus:border-primary resize-none"
          />
        </div>
      )}

      {/* Submit */}
      {!success && (
        <button
          type="button"
          id={`assign-verifier-btn-${task.id}`}
          onClick={() => assignMutation.mutate()}
          disabled={!canSubmit}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white font-bold text-xs uppercase tracking-widest border-2 border-ink shadow-hard-sm transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50"
        >
          {assignMutation.isPending ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
              {t('verifierAssignment.assigning', 'Assigning...')}
            </>
          ) : (
            <>
              <Users className="w-3.5 h-3.5" aria-hidden="true" />
              {t('verifierAssignment.assignBtn', 'Assign Verifier')}
            </>
          )}
        </button>
      )}
    </div>
  );
};

export default VerifierAssignmentPanel;
