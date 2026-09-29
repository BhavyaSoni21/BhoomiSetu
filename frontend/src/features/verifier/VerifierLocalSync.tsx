import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../context/LanguageContext';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, CheckCircle2, AlertCircle, UploadCloud, Trash2 } from 'lucide-react';
import apiService from '../../services/apiService';
import { getLocalQueue, clearLocalQueue, LocalEvidenceRecord } from '../../services/verifierLocalSyncService';

const VerifierLocalSync: React.FC = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [queue, setQueue] = useState<LocalEvidenceRecord[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setQueue(getLocalQueue());
  }, []);

  const syncMutation = useMutation(
    async () => {
      setSyncing(true);
      setError(null);
      const records = getLocalQueue();
      let synced = 0;
      let failed = 0;

      for (const record of records) {
        const { photo, ...payload } = record;
        try {
          await apiService.post(`/cases/${record.case_id}/evidence/capture`, payload);
          synced++;
        } catch (_err) {
          failed++;
        }
      }

      if (synced > 0) clearLocalQueue();
      setQueue(getLocalQueue());
      setSyncing(false);
      queryClient.invalidateQueries(['verifier-tasks']);

      if (failed > 0) {
        setError(`${t('localSync.syncPartialFail', { synced, failed })}`);
      }
      return { synced, failed };
    },
    {
      onError: () => {
        setSyncing(false);
      },
    },
  );

  const handleClear = () => {
    if (window.confirm(t('localSync.clearConfirm'))) {
      clearLocalQueue();
      setQueue([]);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black uppercase tracking-tight font-display text-ink flex items-center gap-2">
          <RefreshCw className="w-5 h-5" aria-hidden="true" />
          {t('localSync.title')}
        </h1>
      </div>

      <p className="text-sm text-ink/60">{t('localSync.subtitle', { count: queue.length })}</p>

      {error && (
        <p className="flex items-center gap-1.5 text-sm font-medium text-secondary-strong">
          <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      {queue.length > 0 ? (
        <>
          <div className="space-y-2">
            {queue.map((record, index) => (
              <div key={index} className="border-2 border-ink/20 p-3 flex items-center justify-between">
                <div>
                  <p className="font-bold text-sm text-ink">
                    EVIDENCE #{record.sequence || index + 1}
                  </p>
                  <p className="text-xs text-ink/60">
                    {t('localSync.caseId')}: {record.case_id.slice(0, 8)} - {record.captured_at ? new Date(record.captured_at).toLocaleString() : 'N/A'}
                  </p>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-ink/50">
                  {t('localSync.pending')}
                </span>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => syncMutation.mutate()}
              disabled={syncing}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-primary text-white font-bold text-xs uppercase tracking-widest border-2 border-ink shadow-hard-sm transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50"
            >
              {syncing ? (
                <span className="animate-spin w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" aria-hidden="true" />
              ) : (
                <>
                  <UploadCloud className="w-3.5 h-3.5" aria-hidden="true" />
                  {t('localSync.syncNowCta')}
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 border-2 border-ink bg-surface-1 text-ink font-bold text-xs uppercase tracking-widest hover:bg-surface-2 transition disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              {t('localSync.clearQueueCta')}
            </button>
          </div>
        </>
      ) : (
        <div className="border-2 border-ink/20 p-4 text-center">
          <CheckCircle2 className="w-5 h-5 mx-auto mb-1 text-primary" aria-hidden="true" />
          <p className="text-sm text-ink/70">{t('localSync.queueEmpty')}</p>
        </div>
      )}
    </div>
  );
};

export default VerifierLocalSync;
