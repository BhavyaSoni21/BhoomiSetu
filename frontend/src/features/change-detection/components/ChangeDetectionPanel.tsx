import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { ScanSearch, MapPin, AlertTriangle, CheckCircle2, AlertCircle } from 'lucide-react';
import apiService from '../../../services/apiService';
import { ChangeAnalysisResponse } from '../../types/changeDetection';

// Approximate bounding box of the seeded Pune cluster (seed.ts:
// centerLng 73.8567, centerLat 18.5204, 10x10 grid, 0.0015 spacing) - a
// one-click starting point for demoing this against real seeded parcels.
const PUNE_BOUNDS = { minLng: '73.8492', minLat: '18.5129', maxLng: '73.8642', maxLat: '18.5279' };

const ChangeDetectionPanel: React.FC = () => {
  const navigate = useNavigate();
  const [beforeFile, setBeforeFile] = useState<File | null>(null);
  const [afterFile, setAfterFile] = useState<File | null>(null);
  const [bounds, setBounds] = useState({ minLng: '', minLat: '', maxLng: '', maxLat: '' });
  const [description, setDescription] = useState('');

  const mutation = useMutation<ChangeAnalysisResponse, Error>(async () => {
    const formData = new FormData();
    formData.append('before', beforeFile!);
    formData.append('after', afterFile!);
    formData.append('minLng', bounds.minLng);
    formData.append('minLat', bounds.minLat);
    formData.append('maxLng', bounds.maxLng);
    formData.append('maxLat', bounds.maxLat);
    if (description.trim()) formData.append('description', description.trim());

    // apiService defaults every request to Content-Type: application/json;
    // for a FormData body that must be unset (not just relabeled) so the
    // browser can generate the multipart boundary itself - otherwise the
    // server can't parse the body as multipart at all.
    const response = await apiService.post('/change-detection/analyze', formData, {
      headers: { 'Content-Type': undefined },
    });
    return response.data;
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!beforeFile || !afterFile) return;
    mutation.mutate();
  };

  const boundsField = (key: keyof typeof bounds, label: string) => {
    const id = `cd-bounds-${key}`;
    return (
      <div>
        <label htmlFor={id} className="block text-[11px] font-bold uppercase tracking-widest text-ink/60 mb-1">{label}</label>
        <input
          id={id}
          type="number"
          step="any"
          value={bounds[key]}
          onChange={(e) => setBounds((prev) => ({ ...prev, [key]: e.target.value }))}
          className="w-full px-2.5 py-2 border-2 border-ink bg-surface text-ink text-sm focus:outline-none focus:border-primary"
          required
        />
      </div>
    );
  };

  return (
    <div className="bg-surface border-4 border-ink shadow-hard-lg p-4 sm:p-6">
      <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight font-display text-ink mb-1 flex items-center gap-2">
        <ScanSearch className="w-5 h-5 text-secondary" aria-hidden="true" />
        Analyze Imagery
      </h2>
      <p className="text-sm text-ink/60 mb-4">
        Upload a before/after image pair covering a known geographic area to detect physical changes and generate
        governance alerts for any parcel affected.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="cd-before-image" className="block text-xs font-bold uppercase tracking-widest text-ink mb-1">Before Image</label>
            <input
              id="cd-before-image"
              type="file"
              accept="image/*"
              onChange={(e) => setBeforeFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm border-2 border-ink bg-surface file:mr-3 file:my-1.5 file:ml-1.5 file:py-1.5 file:px-3 file:border-2 file:border-ink file:bg-secondary file:text-white file:font-bold file:text-xs file:uppercase file:tracking-wide file:cursor-pointer"
              required
            />
          </div>
          <div>
            <label htmlFor="cd-after-image" className="block text-xs font-bold uppercase tracking-widest text-ink mb-1">After Image</label>
            <input
              id="cd-after-image"
              type="file"
              accept="image/*"
              onChange={(e) => setAfterFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm border-2 border-ink bg-surface file:mr-3 file:my-1.5 file:ml-1.5 file:py-1.5 file:px-3 file:border-2 file:border-ink file:bg-secondary file:text-white file:font-bold file:text-xs file:uppercase file:tracking-wide file:cursor-pointer"
              required
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-bold uppercase tracking-widest text-ink">Geographic Bounds Covered by Both Images</label>
            <button
              type="button"
              onClick={() => setBounds(PUNE_BOUNDS)}
              className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-primary hover:text-primary-strong hover:underline"
            >
              <MapPin className="w-3 h-3" aria-hidden="true" />
              Use Pune cluster bounds
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {boundsField('minLng', 'Min Longitude')}
            {boundsField('minLat', 'Min Latitude')}
            {boundsField('maxLng', 'Max Longitude')}
            {boundsField('maxLat', 'Max Latitude')}
          </div>
        </div>

        <div>
          <label htmlFor="cd-description" className="block text-xs font-bold uppercase tracking-widest text-ink mb-1">Description (optional)</label>
          <input
            id="cd-description"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 border-2 border-ink bg-surface text-ink focus:outline-none focus:border-primary"
            placeholder="e.g. Satellite pass comparison, Sept 2026"
          />
        </div>

        {mutation.isError && (
          <p className="flex items-center gap-1.5 text-sm font-medium text-secondary-strong">
            <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
            {axios.isAxiosError(mutation.error) && mutation.error.response?.status === 400
              ? 'Please check the images and bounds provided.'
              : 'Something went wrong analyzing this imagery. Please try again.'}
          </p>
        )}

        <button
          type="submit"
          disabled={mutation.isLoading || !beforeFile || !afterFile}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-white font-bold text-xs uppercase tracking-widest border-2 border-ink shadow-hard-sm transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50"
        >
          <ScanSearch className="w-4 h-4" aria-hidden="true" />
          {mutation.isLoading ? 'Analyzing...' : 'Analyze'}
        </button>
      </form>

      {mutation.isSuccess && (
        <div className="mt-4 border-t-4 border-ink pt-4">
          {mutation.data.changeDetected ? (
            <div className="border-2 border-ink border-l-4 border-l-secondary bg-secondary/10 p-4 space-y-2">
              <p className="flex items-center gap-1.5 text-sm font-bold text-ink">
                <AlertTriangle className="w-4 h-4 text-secondary shrink-0" aria-hidden="true" />
                Change detected: {(mutation.data.changedPixelRatio * 100).toFixed(1)}% of the analyzed area
              </p>
              <p className="text-sm text-ink/70">
                {mutation.data.affectedParcelIds.length} parcel(s) affected, {mutation.data.alertsCreated} governance
                alert(s) created.
              </p>
              {mutation.data.affectedParcelIds.length > 0 && (
                <div className="border-2 border-ink divide-y-2 divide-ink bg-surface">
                  {mutation.data.affectedParcelIds.map((parcelId) => (
                    <div key={parcelId} className="flex items-center justify-between text-sm px-3 py-2">
                      <span className="text-ink/70">Parcel #{parcelId.substring(0, 8)}...</span>
                      <button
                        onClick={() => navigate(`/parcels/${parcelId}`)}
                        className="px-3 py-1 bg-primary text-white text-xs font-bold uppercase tracking-widest border-2 border-ink shadow-hard-sm transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
                      >
                        View
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="flex items-center gap-1.5 text-sm text-ink/70 border-2 border-ink border-l-4 border-l-primary bg-primary/10 p-4">
              <CheckCircle2 className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
              No significant change detected ({(mutation.data.changedPixelRatio * 100).toFixed(2)}% of the analyzed
              area differed).
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default ChangeDetectionPanel;
