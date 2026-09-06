import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import apiService from '../../services/apiService';
import { DocumentVerificationResult } from '../../types/documentVerification';

interface DocumentVerificationPanelProps {
  // Reuses whichever parcel is already selected via ParcelSearch/MapComponent
  // elsewhere on the Citizen Portal, rather than embedding a second,
  // redundant parcel-search form just for this panel.
  selectedParcelId: string | null;
}

const VERDICT_STYLES: Record<string, string> = {
  VERIFIED: 'bg-green-50 text-green-800 border-green-200',
  PARTIAL_MATCH: 'bg-yellow-50 text-yellow-800 border-yellow-200',
  MISMATCH: 'bg-red-50 text-red-800 border-red-200',
  INSUFFICIENT_DATA: 'bg-gray-50 text-gray-700 border-gray-200',
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
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold mb-1">Verify a Document</h2>
      <p className="text-sm text-gray-500 mb-4">
        Select a parcel from the search results, then upload a photo or scan of a land record document (e.g. a
        Record of Rights copy or sale deed). We'll read it and check it against that parcel's official records.
      </p>

      {!selectedParcelId ? (
        <p className="text-sm text-gray-500 italic">Select a parcel from the search results to get started.</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="dv-document" className="block text-sm font-medium text-gray-700 mb-1">
              Document Image
            </label>
            <input
              id="dv-document"
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm"
              required
            />
          </div>

          {mutation.isError && (
            <p className="text-sm text-red-600">
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
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
          >
            {mutation.isLoading ? 'Verifying...' : 'Verify Document'}
          </button>
        </form>
      )}

      {mutation.isSuccess && (
        <div className="mt-4 border-t pt-4 space-y-3">
          <div className={`rounded-md border px-3 py-2 text-sm font-medium ${VERDICT_STYLES[mutation.data.overallVerdict]}`}>
            {VERDICT_LABELS[mutation.data.overallVerdict]}
          </div>

          {mutation.data.fieldChecks.length > 0 && (
            <div className="space-y-1">
              {mutation.data.fieldChecks.map((check, i) => (
                <div key={i} className="flex items-center justify-between text-sm border-b py-1.5 last:border-b-0">
                  <span className="text-gray-700">{check.field}</span>
                  <span
                    className={
                      check.status === 'MATCHED'
                        ? 'text-green-700 font-medium'
                        : check.status === 'MISMATCH'
                          ? 'text-red-700 font-medium'
                          : 'text-gray-400'
                    }
                  >
                    {FIELD_STATUS_LABELS[check.status]}
                  </span>
                </div>
              ))}
            </div>
          )}

          <details className="text-xs text-gray-500">
            <summary className="cursor-pointer hover:text-gray-700">Show extracted text</summary>
            <pre className="mt-2 whitespace-pre-wrap bg-gray-50 p-2 rounded border border-gray-200">{mutation.data.extractedText}</pre>
          </details>
        </div>
      )}
    </div>
  );
};

export default DocumentVerificationPanel;
