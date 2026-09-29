import React, { useState } from 'react';
import { X, ZoomIn, ZoomOut, Sparkles, Loader2 } from 'lucide-react';
import apiService from '../../services/apiService';

interface OfficialPdfViewerModalProps {
  url: string;
  fileName: string;
  parcelId?: string;
  onClose: () => void;
}

const OfficialPdfViewerModal: React.FC<OfficialPdfViewerModalProps> = ({ url, fileName, parcelId, onClose }) => {
  const [summary, setSummary] = useState<string | null>(null);
  const [isSummarising, setIsSummarising] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSummarise = async () => {
    if (!parcelId) {
      setError('Parcel ID required for summarisation');
      return;
    }
    setIsSummarising(true);
    setError(null);
    setSummary(null);
    try {
      // Was a raw fetch('/api/...') — wrong prefix (real route is /api/v1) and
      // no auth header, so it 404'd. apiService carries the baseURL + bearer.
      const response = await apiService.post(`/parcels/${parcelId}/documents/summarise`, { url, fileName });
      setSummary(response.data.summary);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Summarisation failed');
    } finally {
      setIsSummarising(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 p-4" role="dialog" aria-modal="true" aria-label="Official document viewer">
      <div className="mx-auto flex h-full max-w-6xl flex-col overflow-hidden border-2 border-ink bg-surface shadow-hard-md">
        <div className="flex items-center justify-between gap-2 border-b-2 border-ink p-3">
          <h2 className="font-display text-sm font-black uppercase tracking-wider">Official document</h2>
          <div className="flex gap-2">
            {parcelId && (
              <button
                onClick={handleSummarise}
                disabled={isSummarising}
                className="inline-flex items-center gap-2 border-2 border-ink px-3 py-2 text-xs font-bold uppercase hover:bg-ink/10 disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                {isSummarising ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Summarise'}
              </button>
            )}
            <button onClick={onClose} aria-label="Close document viewer" className="border-2 border-ink px-3 py-2">
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className="flex-1 min-h-0 flex">
          <iframe
            title="Official land record PDF"
            src={`${url}#view=FitH&toolbar=1&navpanes=0`}
            className="min-h-0 flex-1 bg-neutral-700"
          />
          {(summary || isSummarising || error) && (
            <div className="w-96 border-l-2 border-ink bg-surface p-4 overflow-y-auto">
              <div className="flex items-center justify-between gap-2 mb-3">
                <h3 className="font-display text-xs font-black uppercase tracking-wider">AI Summary</h3>
                <button onClick={() => setSummary(null)} className="text-sm opacity-50 hover:opacity-100">✕</button>
              </div>
              {isSummarising && <div className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" />Generating summary…</div>}
              {error && <div className="text-sm text-error">{error}</div>}
              {summary && <div className="text-sm whitespace-pre-wrap">{summary}</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OfficialPdfViewerModal;