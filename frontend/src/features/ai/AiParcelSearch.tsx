import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import apiService from '../../services/apiService';
import { AiQueryResponse } from '../../types/aiQuery';

const FILTER_LABELS: Record<string, string> = {
  state: 'State',
  district: 'District',
  tax_status: 'Tax Status',
  has_restriction: 'Has Restriction',
  land_use: 'Land Use',
  registration_status: 'Registration Status',
};

const AiParcelSearch: React.FC = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  const mutation = useMutation<AiQueryResponse, Error, string>(async (q) => {
    const response = await apiService.post('/ai/query', { query: q });
    return response.data;
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    mutation.mutate(query.trim());
  };

  const appliedFilters = mutation.data ? Object.entries(mutation.data.filters) : [];

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold mb-1">Ask AI</h2>
      <p className="text-sm text-gray-500 mb-4">
        Describe what you're looking for in plain language, e.g. "parcels with overdue tax and a restriction".
      </p>
      <form onSubmit={handleSubmit} className="flex gap-2 mb-4">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Show me parcels with pending tax and a land-use restriction"
        />
        <button
          type="submit"
          disabled={mutation.isLoading}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
        >
          {mutation.isLoading ? 'Asking...' : 'Ask AI'}
        </button>
      </form>

      {mutation.isError && (
        <p className="text-sm text-red-600">
          {axios.isAxiosError(mutation.error) && mutation.error.response?.status === 503
            ? 'AI is not configured on this server.'
            : 'Something went wrong interpreting that query. Try rephrasing it.'}
        </p>
      )}

      {mutation.isSuccess && (
        <div className="space-y-3">
          {appliedFilters.length > 0 && (
            <p className="text-xs text-gray-500">
              Interpreted as:{' '}
              {appliedFilters.map(([key, value]) => `${FILTER_LABELS[key] ?? key} = ${value}`).join(', ')}
            </p>
          )}
          <p className="text-sm font-medium text-gray-700">{mutation.data.totalMatches} parcel(s) matched</p>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {mutation.data.results.map((parcel) => (
              <div key={parcel.id} className="flex items-center justify-between border-b py-2 last:border-b-0">
                <div>
                  <p className="text-sm font-medium text-gray-800">Parcel #{parcel.id.substring(0, 8)}...</p>
                  <p className="text-xs text-gray-500">{parcel.stateCode}-{parcel.districtCode}</p>
                </div>
                <button
                  onClick={() => navigate(`/parcels/${parcel.id}`)}
                  className="px-2 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600"
                >
                  View
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AiParcelSearch;
