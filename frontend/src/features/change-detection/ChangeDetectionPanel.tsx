import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import apiService from '../../services/apiService';
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
        <label htmlFor={id} className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
        <input
          id={id}
          type="number"
          step="any"
          value={bounds[key]}
          onChange={(e) => setBounds((prev) => ({ ...prev, [key]: e.target.value }))}
          className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold mb-1">Analyze Imagery</h2>
      <p className="text-sm text-gray-500 mb-4">
        Upload a before/after image pair covering a known geographic area to detect physical changes and generate
        governance alerts for any parcel affected.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="cd-before-image" className="block text-sm font-medium text-gray-700 mb-1">Before Image</label>
            <input
              id="cd-before-image"
              type="file"
              accept="image/*"
              onChange={(e) => setBeforeFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm"
              required
            />
          </div>
          <div>
            <label htmlFor="cd-after-image" className="block text-sm font-medium text-gray-700 mb-1">After Image</label>
            <input
              id="cd-after-image"
              type="file"
              accept="image/*"
              onChange={(e) => setAfterFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm"
              required
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium text-gray-700">Geographic Bounds Covered by Both Images</label>
            <button
              type="button"
              onClick={() => setBounds(PUNE_BOUNDS)}
              className="text-xs text-blue-600 hover:underline"
            >
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
          <label htmlFor="cd-description" className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
          <input
            id="cd-description"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g. Satellite pass comparison, Sept 2026"
          />
        </div>

        {mutation.isError && (
          <p className="text-sm text-red-600">
            {axios.isAxiosError(mutation.error) && mutation.error.response?.status === 400
              ? 'Please check the images and bounds provided.'
              : 'Something went wrong analyzing this imagery. Please try again.'}
          </p>
        )}

        <button
          type="submit"
          disabled={mutation.isLoading || !beforeFile || !afterFile}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
        >
          {mutation.isLoading ? 'Analyzing...' : 'Analyze'}
        </button>
      </form>

      {mutation.isSuccess && (
        <div className="mt-4 border-t pt-4">
          {mutation.data.changeDetected ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-800">
                Change detected: {(mutation.data.changedPixelRatio * 100).toFixed(1)}% of the analyzed area
              </p>
              <p className="text-sm text-gray-600">
                {mutation.data.affectedParcelIds.length} parcel(s) affected, {mutation.data.alertsCreated} governance
                alert(s) created.
              </p>
              {mutation.data.affectedParcelIds.length > 0 && (
                <div className="space-y-1">
                  {mutation.data.affectedParcelIds.map((parcelId) => (
                    <div key={parcelId} className="flex items-center justify-between text-sm border-b py-1 last:border-b-0">
                      <span className="text-gray-600">Parcel #{parcelId.substring(0, 8)}...</span>
                      <button
                        onClick={() => navigate(`/parcels/${parcelId}`)}
                        className="px-2 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600"
                      >
                        View
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-600">
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
