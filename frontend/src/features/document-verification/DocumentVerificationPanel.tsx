import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { CheckCircle2, FileSearch, UploadCloud } from 'lucide-react';
import apiService from '../../services/apiService';
import { DocumentVerificationResult } from '../../types/documentVerification';

interface DocumentVerificationPanelProps {
  // Reuses whichever parcel is already selected via ParcelSearch/MapComponent
  // elsewhere on the Citizen Portal, rather than embedding a second,
  // redundant parcel-search form just for this panel.
  selectedParcelId: string | null;
}

const VERDICT_STYLES: Record<string, string> = {
  VERIFIED: 'bg-primary/10 text-primary border-primary/40',
  PARTIAL_MATCH: 'bg-accent/15 text-secondary-strong border-accent/50',
  MISMATCH: 'bg-secondary/10 text-secondary-strong border-secondary/50',
  INSUFFICIENT_DATA: 'bg-muted text-ink/60 border-ink/20',
};

const VERDICT_LABELS: Record<string, string> = {
  VERIFIED: 'Verified - matches official records',
  PARTIAL_MATCH: 'Partial match - some details differ from official records',
  MISMATCH: 'Mismatch - does not match official records',
  INSUFFICIENT_DATA: "Couldn't read this document - try a clearer photo or scan",
};

const FIELD_STATUS_LABELS: Record<string, string> = {
  MATCHED: 'Matched',
  MISMATCH: 'Mismatch',
  NOT_AVAILABLE: 'Not available',
};

const DocumentVerificationPanel: React.FC<DocumentVerificationPanelProps> = ({ selectedParcelId }) => {
  const [file, setFile] = useState<File | null>(null);

  const mutation = useMutation<DocumentVerificationResult, Error>(async () => {
    const formData = new FormData();
    formData.append('document', file!);
    formData.append('parcelId', selectedParcelId!);

    // Content-Type must be unset (not just relabeled) so the browser can
    // generate the multipart boundary itself - same as ChangeDetectionPanel.
    const response = await apiService.post('/document-verification/verify', formData, {
      headers: { 'Content-Type': undefined },
    });
    return response.data;
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !selectedParcelId) return;
    mutation.mutate();
  };

  return (
    <div className="relative bg-surface border-2 sm:border-4 border-ink shadow-hard-md p-6">
      <span className="absolute -top-3 -right-3 w-6 h-6 rounded-full bg-secondary border-2 border-ink" aria-hidden="true" />
      <div className="flex items-center gap-2.5 mb-1">
        <div className="w-8 h-8 border-2 border-ink bg-secondary/15 text-secondary-strong flex items-center justify-center shrink-0">
          <FileSearch className="w-4 h-4" aria-hidden="true" />
        </div>
        <h2 className="text-lg font-black uppercase tracking-tight font-display text-ink">Verify a Document</h2>
      </div>
      <p className="text-sm text-ink/60 mb-4 leading-relaxed">
        Select a parcel from the search results, then upload a photo or scan of a land record document (e.g. a
        Record of Rights copy or sale deed). We'll read it and check it against that parcel's official records.
      </p>

      {!selectedParcelId ? (
        <p className="text-sm text-ink/50 italic">Select a parcel from the search results to get started.</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="dv-document" className="block text-xs font-bold uppercase tracking-widest text-ink mb-1">
              Document Image
            </label>
            <input
              id="dv-document"
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm border-2 border-ink bg-surface px-3 py-2 file:mr-3 file:border-2 file:border-ink file:bg-muted file:px-3 file:py-1 file:text-xs file:font-bold file:uppercase file:cursor-pointer"
              required
            />
          </div>

          {mutation.isError && (
            <p className="text-sm font-medium text-secondary-strong">
              {axios.isAxiosError(mutation.error) && mutation.error.response?.status === 404
                ? 'That parcel could not be found. Please select it again.'
                : axios.isAxiosError(mutation.error) && mutation.error.response?.status === 400
                  ? 'Please check the file you uploaded.'
                  : 'Something went wrong verifying this document. Please try again.'}
            </p>
          )}

          <button
            type="submit"
            disabled={mutation.isLoading || !file}
            className="inline-flex items-center gap-2 rounded-full border-2 border-ink bg-primary px-4 py-2 text-sm font-bold uppercase tracking-wider text-white shadow-hard-sm transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50"
          >
            <UploadCloud className="w-4 h-4" aria-hidden="true" />
            {mutation.isLoading ? 'Verifying...' : 'Verify Document'}
          </button>
        </form>
      )}

      {mutation.isSuccess && (
        <div className="mt-4 border-t-2 border-ink/15 pt-4 space-y-3">
          <div className={`border-2 px-3 py-2 text-sm font-bold flex items-center gap-2 ${VERDICT_STYLES[mutation.data.overallVerdict]}`}>
            <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
            {VERDICT_LABELS[mutation.data.overallVerdict]}
          </div>

          {mutation.data.fieldChecks.length > 0 && (
            <div className="divide-y-2 divide-ink/10 border-2 border-ink/10">
              {mutation.data.fieldChecks.map((check, i) => (
                <div key={i} className="flex items-center justify-between text-sm px-3 py-1.5">
                  <span className="text-ink/70">{check.field}</span>
                  <span
                    className={
                      check.status === 'MATCHED'
                        ? 'text-primary font-bold'
                        : check.status === 'MISMATCH'
                          ? 'text-secondary-strong font-bold'
                          : 'text-ink/40'
                    }
                  >
                    {FIELD_STATUS_LABELS[check.status]}
                  </span>
                </div>
              ))}
            </div>
          )}

          <details className="text-xs text-ink/50">
            <summary className="cursor-pointer hover:text-ink font-bold uppercase tracking-wide">Show extracted text</summary>
            <pre className="mt-2 whitespace-pre-wrap bg-muted p-2 border-2 border-ink/10 font-mono text-[11px] text-ink/70">{mutation.data.extractedText}</pre>
          </details>
        </div>
      )}
    </div>
  );
};

export default DocumentVerificationPanel;
